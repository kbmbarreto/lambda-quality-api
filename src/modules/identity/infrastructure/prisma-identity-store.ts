import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient, Prisma } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../../shared/config/config.js';
import type { AuditInput, AuthSession, CodePurpose, EmailChallenge, RefreshToken, User } from '../domain/models.js';
import type { IdentityStore, IdentityTransaction } from '../application/ports.js';

type TransactionClient = Prisma.TransactionClient;
class PrismaIdentityTransaction implements IdentityTransaction {
  constructor(private readonly db: TransactionClient) {}
  async lockCodeScope(id: string): Promise<Date | null> {
    await this.db.emailCodeScope.upsert({ where: { id }, create: { id }, update: {} });
    const rows = await this.db.$queryRaw<{ lastRequestedAt: Date | null }[]>`SELECT last_requested_at AS lastRequestedAt FROM email_code_scopes WHERE id = ${id} FOR UPDATE`;
    return rows[0]?.lastRequestedAt ?? null;
  }
  async touchCodeScope(id: string, at: Date): Promise<void> { await this.db.emailCodeScope.update({ where: { id }, data: { lastRequestedAt: at } }); }
  findUserByEmail(email: string): Promise<User | null> { return this.db.user.findUnique({ where: { email } }); }
  async lockUser(id: string): Promise<User | null> {
    await this.db.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
    return this.db.user.findUnique({ where: { id } });
  }
  createUser(user: User): Promise<User> { return this.db.user.create({ data: user }); }
  async updatePassword(userId: string, hash: string, at: Date): Promise<void> { await this.db.user.update({ where: { id: userId }, data: { passwordHash: hash, passwordChangedAt: at } }); }
  async lockChallenge(id: string): Promise<EmailChallenge | null> {
    await this.db.$queryRaw`SELECT id FROM email_challenges WHERE id = ${id} FOR UPDATE`;
    return this.db.emailChallenge.findUnique({ where: { id } });
  }
  async createChallenge(challenge: EmailChallenge): Promise<void> { await this.db.emailChallenge.create({ data: challenge }); }
  async updateChallenge(id: string, changes: Partial<Pick<EmailChallenge, 'attempts' | 'consumedAt' | 'revokedAt'>>): Promise<void> { await this.db.emailChallenge.update({ where: { id }, data: changes }); }
  async revokeChallenges(email: string, purpose: CodePurpose, at: Date): Promise<void> { await this.db.emailChallenge.updateMany({ where: { email, purpose, consumedAt: null, revokedAt: null }, data: { revokedAt: at } }); }
  async createSession(session: AuthSession, token: RefreshToken): Promise<void> {
    await this.db.authSession.create({ data: session });
    await this.db.refreshToken.create({ data: token });
  }
  async lockSession(id: string): Promise<AuthSession | null> {
    await this.db.$queryRaw`SELECT id FROM auth_sessions WHERE id = ${id} FOR UPDATE`;
    return this.db.authSession.findUnique({ where: { id } });
  }
  async lockRefreshToken(id: string): Promise<RefreshToken | null> {
    await this.db.$queryRaw`SELECT id FROM refresh_tokens WHERE id = ${id} FOR UPDATE`;
    return this.db.refreshToken.findUnique({ where: { id } });
  }
  async rotateToken(currentId: string, successor: RefreshToken, at: Date): Promise<void> {
    await this.db.refreshToken.create({ data: successor });
    await this.db.refreshToken.update({ where: { id: currentId }, data: { consumedAt: at, replacedByTokenId: successor.id } });
    await this.db.authSession.update({ where: { id: successor.sessionId }, data: { lastUsedAt: at } });
  }
  async revokeSession(id: string, reason: string, at: Date): Promise<void> {
    await this.db.authSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: at, revokeReason: reason } });
    await this.db.refreshToken.updateMany({ where: { sessionId: id, revokedAt: null }, data: { revokedAt: at } });
  }
  async revokeUserSessions(userId: string, reason: string, at: Date): Promise<void> {
    // Todas as mutações de sessão adquirem primeiro o lock de User.
    const sessions = await this.db.authSession.findMany({ where: { userId, revokedAt: null }, select: { id: true } });
    for (const session of sessions) { await this.lockSession(session.id); await this.revokeSession(session.id, reason, at); }
  }
  async audit(event: AuditInput): Promise<void> { await this.db.auditEvent.create({ data: event }); }
}

export class PrismaIdentityStore implements IdentityStore {
  readonly client: PrismaClient;
  constructor(config: AppConfig) {
    const { url: _url, ...connection } = config.database;
    this.client = new PrismaClient({ adapter: new PrismaMariaDb({ ...connection, charset: 'utf8mb4', timezone: 'Z', connectionLimit: 10, connectTimeout: 5000, acquireTimeout: 5000 }) });
  }
  transaction<T>(work: (tx: IdentityTransaction) => Promise<T>): Promise<T> {
    return this.client.$transaction((tx) => work(new PrismaIdentityTransaction(tx)), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 10000 });
  }
  findUserByEmail(email: string): Promise<User | null> { return this.client.user.findUnique({ where: { email } }); }
  findUserById(id: string): Promise<User | null> { return this.client.user.findUnique({ where: { id } }); }
  findSession(id: string): Promise<AuthSession | null> { return this.client.authSession.findUnique({ where: { id } }); }
  async findTokenByHash(hash: string) {
    const token = await this.client.refreshToken.findUnique({ where: { tokenHash: hash }, include: { session: true } });
    return token ? { token, session: token.session } : null;
  }
  findChallenge(id: string): Promise<EmailChallenge | null> { return this.client.emailChallenge.findUnique({ where: { id } }); }
  async health(): Promise<void> { await this.client.$queryRaw`SELECT id FROM users LIMIT 1`; }
  async onModuleDestroy(): Promise<void> { await this.client.$disconnect(); }
}
