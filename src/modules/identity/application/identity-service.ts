import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { ApplicationError, invalidCode } from '../../../shared/domain/errors.js';
import { publicUser } from '../domain/models.js';
import type { AccessIdentity, AuthSession, CodePurpose, EmailChallenge, RefreshToken, TokenPair } from '../domain/models.js';
import type { AccessTokens, CodeEmail, IdentitySettings, IdentityStore, IdentityTransaction, Passwords } from './ports.js';

export const IDENTITY_SERVICE = Symbol('IdentityService');
export class IdentityService {
  constructor(private readonly store: IdentityStore, private readonly passwords: Passwords, private readonly tokens: AccessTokens, private readonly mail: CodeEmail, private readonly settings: IdentitySettings, private readonly now: () => Date = () => new Date()) {}

  private hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
  private normalize(email: string): string { return email.trim().toLowerCase(); }
  private codeHash(id: string, email: string, purpose: CodePurpose, code: string): string {
    return createHmac('sha256', this.settings.codeSecret).update(JSON.stringify(['lambdaquality-email-code-v1', id, email, purpose, code])).digest('hex');
  }
  private audit(tx: IdentityTransaction, action: string, entityType: string, entityId: string, userId: string | null, requestId: string, now: Date) {
    return tx.audit({ id: randomUUID(), action, entityType, entityId, actorUserId: userId, correlationId: requestId, occurredAt: now });
  }

  async requestCode(rawEmail: string, purpose: CodePurpose, requestId: string) {
    const email = this.normalize(rawEmail);
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const now = this.now();
    const challengeId = randomUUID();
    await this.store.transaction(async (tx) => {
      const scope = this.hash(JSON.stringify([email, purpose]));
      const previous = await tx.lockCodeScope(scope);
      if (previous && now.getTime() - previous.getTime() < this.settings.codeCooldown * 1000) {
        const wait = Math.ceil((previous.getTime() + this.settings.codeCooldown * 1000 - now.getTime()) / 1000);
        throw new ApplicationError(429, 'RATE_LIMIT_EXCEEDED', 'Aguarde antes de solicitar outro código.', wait);
      }
      const user = await tx.findUserByEmail(email);
      await tx.revokeChallenges(email, purpose, now);
      await tx.touchCodeScope(scope, now);
      await tx.createChallenge({ id: challengeId, email, purpose, codeHash: this.codeHash(challengeId, email, purpose, code), eligible: purpose === 'REGISTRATION' ? !user : user?.status === 'ACTIVE', attempts: 0, createdAt: now, expiresAt: new Date(now.getTime() + this.settings.codeTtl * 1000), consumedAt: null, revokedAt: null });
      await this.audit(tx, 'identity.email_code_requested', 'EmailChallenge', challengeId, null, requestId, now);
    });
    // O mesmo e-mail neutro é enviado independentemente da existência da conta.
    // Assim erros do provedor e o tempo de envio não revelam contas cadastradas.
    try {
      await this.mail.send(email, code, purpose, this.settings.codeTtl);
    } catch {
      await this.store.transaction(async (tx) => {
        await tx.updateChallenge(challengeId, { revokedAt: this.now() });
        await this.audit(tx, 'identity.email_delivery_failed', 'EmailChallenge', challengeId, null, requestId, this.now());
      });
      throw new ApplicationError(503, 'EMAIL_DELIVERY_UNAVAILABLE', 'Não foi possível enviar o código. Aguarde e tente novamente.');
    }
    return { challengeId, expiresIn: this.settings.codeTtl, resendAfter: this.settings.codeCooldown };
  }

  private async validateChallenge(tx: IdentityTransaction, id: string, purpose: CodePurpose, code: string): Promise<EmailChallenge | null> {
    const challenge = await tx.lockChallenge(id);
    const now = this.now();
    if (!challenge || challenge.purpose !== purpose || challenge.consumedAt || challenge.revokedAt || challenge.expiresAt <= now || challenge.attempts >= this.settings.codeMaxAttempts) return null;
    const matches = timingSafeEqual(Buffer.from(challenge.codeHash, 'hex'), Buffer.from(this.codeHash(id, challenge.email, purpose, code), 'hex'));
    if (!matches || !challenge.eligible) {
      const attempts = challenge.attempts + 1;
      await tx.updateChallenge(id, { attempts, ...(attempts >= this.settings.codeMaxAttempts ? { revokedAt: now } : {}) });
      return null; // Retornar permite commit das tentativas antes do erro HTTP.
    }
    return challenge;
  }

  async register(input: { challengeId: string; code: string; displayName: string; password: string }, requestId: string) {
    const passwordHash = await this.passwords.hash(input.password);
    const now = this.now();
    const user = await this.store.transaction(async (tx) => {
      const challenge = await this.validateChallenge(tx, input.challengeId, 'REGISTRATION', input.code);
      if (!challenge) return null;
      if (await tx.findUserByEmail(challenge.email)) return null;
      const created = await tx.createUser({ id: randomUUID(), email: challenge.email, displayName: input.displayName.trim(), passwordHash, status: 'ACTIVE', emailVerifiedAt: now, passwordChangedAt: now, createdAt: now, updatedAt: now });
      await tx.updateChallenge(challenge.id, { consumedAt: now });
      await this.audit(tx, 'identity.user_registered', 'User', created.id, created.id, requestId, now);
      return created;
    });
    if (!user) throw invalidCode();
    return publicUser(user);
  }

  async resetPassword(input: { challengeId: string; code: string; newPassword: string }, requestId: string): Promise<void> {
    const passwordHash = await this.passwords.hash(input.newPassword);
    const now = this.now();
    const changed = await this.store.transaction(async (tx) => {
      const challenge = await this.validateChallenge(tx, input.challengeId, 'PASSWORD_RESET', input.code);
      if (!challenge) return false;
      const candidate = await tx.findUserByEmail(challenge.email);
      const user = candidate ? await tx.lockUser(candidate.id) : null;
      if (!user || user.status !== 'ACTIVE' || challenge.createdAt < user.passwordChangedAt) return false;
      await tx.updatePassword(user.id, passwordHash, now);
      await tx.updateChallenge(challenge.id, { consumedAt: now });
      await tx.revokeUserSessions(user.id, 'PASSWORD_RESET', now);
      await tx.revokeChallenges(challenge.email, 'PASSWORD_RESET', now);
      await this.audit(tx, 'identity.password_reset', 'User', user.id, user.id, requestId, now);
      return true;
    });
    if (!changed) throw invalidCode();
  }

  private newRefresh(session: AuthSession, now: Date): { raw: string; token: RefreshToken } {
    const raw = randomBytes(32).toString('base64url');
    return { raw, token: { id: randomUUID(), sessionId: session.id, tokenHash: this.hash(raw), createdAt: now, expiresAt: new Date(Math.min(now.getTime() + this.settings.refreshIdleTtl * 1000, session.expiresAt.getTime())), consumedAt: null, revokedAt: null, replacedByTokenId: null } };
  }
  private async pair(session: AuthSession, refresh: { raw: string; token: RefreshToken }): Promise<TokenPair> {
    return { accessToken: await this.tokens.sign({ userId: session.userId, sessionId: session.id }), refreshToken: refresh.raw, tokenType: 'Bearer', expiresIn: this.settings.accessTtl, refreshExpiresIn: Math.max(0, Math.floor((refresh.token.expiresAt.getTime() - this.now().getTime()) / 1000)) };
  }

  async login(rawEmail: string, password: string, requestId: string): Promise<TokenPair> {
    const user = await this.store.findUserByEmail(this.normalize(rawEmail));
    let valid = false;
    if (user) valid = await this.passwords.verify(user.passwordHash, password);
    else await this.passwords.verifyDummy(password);
    if (!user || !valid || user.status !== 'ACTIVE') throw new ApplicationError(401, 'AUTH_INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    const now = this.now();
    const session: AuthSession = { id: randomUUID(), userId: user.id, createdAt: now, expiresAt: new Date(now.getTime() + this.settings.sessionTtl * 1000), lastUsedAt: now, revokedAt: null, revokeReason: null };
    const refresh = this.newRefresh(session, now);
    const created = await this.store.transaction(async (tx) => {
      const current = await tx.lockUser(user.id);
      if (!current || current.status !== 'ACTIVE' || current.passwordHash !== user.passwordHash) return false;
      await tx.createSession(session, refresh.token);
      await this.audit(tx, 'identity.login', 'AuthSession', session.id, user.id, requestId, now);
      return true;
    });
    if (!created) throw new ApplicationError(401, 'AUTH_INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    return this.pair(session, refresh);
  }

  async refresh(raw: string, requestId: string): Promise<TokenPair> {
    const found = await this.store.findTokenByHash(this.hash(raw));
    if (!found) throw new ApplicationError(401, 'AUTH_INVALID_REFRESH_TOKEN', 'Token de renovação inválido.');
    const now = this.now();
    const result = await this.store.transaction(async (tx) => {
      const user = await tx.lockUser(found.session.userId);
      const session = await tx.lockSession(found.session.id);
      const token = await tx.lockRefreshToken(found.token.id);
      if (!user || user.status !== 'ACTIVE' || !session || !token) return { error: 'AUTH_INVALID_REFRESH_TOKEN' };
      if (token.consumedAt) {
        await tx.revokeSession(session.id, 'REFRESH_TOKEN_REUSED', now);
        await this.audit(tx, 'identity.refresh_reuse_detected', 'AuthSession', session.id, user.id, requestId, now);
        return { error: 'AUTH_REFRESH_TOKEN_REUSED' };
      }
      if (session.revokedAt || token.revokedAt) return { error: 'AUTH_SESSION_REVOKED' };
      if (session.expiresAt <= now) return { error: 'AUTH_SESSION_EXPIRED' };
      if (token.expiresAt <= now) return { error: 'AUTH_REFRESH_TOKEN_EXPIRED' };
      const next = this.newRefresh(session, now);
      await tx.rotateToken(token.id, next.token, now);
      await this.audit(tx, 'identity.session_refreshed', 'AuthSession', session.id, user.id, requestId, now);
      return { session, next };
    });
    if (result.error) throw new ApplicationError(401, result.error, 'Não foi possível renovar a sessão. Faça login novamente.');
    return this.pair(result.session!, result.next!);
  }

  async authenticate(raw: string): Promise<AccessIdentity> {
    const identity = await this.tokens.verify(raw);
    const [user, session] = await Promise.all([this.store.findUserById(identity.userId), this.store.findSession(identity.sessionId)]);
    if (!user || user.status !== 'ACTIVE' || !session || session.userId !== user.id) throw new ApplicationError(401, 'AUTH_INVALID_ACCESS_TOKEN', 'Token de acesso inválido.');
    if (session.revokedAt) throw new ApplicationError(401, 'AUTH_SESSION_REVOKED', 'Sessão revogada. Faça login novamente.');
    if (session.expiresAt <= this.now()) throw new ApplicationError(401, 'AUTH_SESSION_EXPIRED', 'Sessão expirada. Faça login novamente.');
    return identity;
  }

  async logout(identity: AccessIdentity, all: boolean, requestId: string): Promise<void> {
    await this.store.transaction(async (tx) => {
      await tx.lockUser(identity.userId);
      if (all) await tx.revokeUserSessions(identity.userId, 'LOGOUT_ALL', this.now());
      else { await tx.lockSession(identity.sessionId); await tx.revokeSession(identity.sessionId, 'LOGOUT', this.now()); }
      await this.audit(tx, all ? 'identity.logout_all' : 'identity.logout', 'AuthSession', identity.sessionId, identity.userId, requestId, this.now());
    });
  }
  async me(identity: AccessIdentity) {
    const user = await this.store.findUserById(identity.userId);
    if (!user || user.status !== 'ACTIVE') throw new ApplicationError(401, 'AUTH_UNAUTHENTICATED', 'Autenticação necessária.');
    return publicUser(user);
  }
}
