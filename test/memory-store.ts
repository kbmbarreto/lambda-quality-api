import type { IdentityStore, IdentityTransaction } from '../dist/modules/identity/application/ports.js';
import type { AuditInput, AuthSession, CodePurpose, EmailChallenge, RefreshToken, User } from '../dist/modules/identity/domain/models.js';
export class MemoryStore implements IdentityStore, IdentityTransaction {
  users = new Map<string, User>();
  sessions = new Map<string, AuthSession>();
  tokens = new Map<string, RefreshToken>();
  challenges = new Map<string, EmailChallenge>();
  scopes = new Map<string, Date | null>();
  events: AuditInput[] = [];
  private tail: Promise<void> = Promise.resolve();
  async transaction<T>(work: (tx: IdentityTransaction) => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise((resolve) => { release = resolve; });
    await previous;
    const snapshot = structuredClone({ users: this.users, sessions: this.sessions, tokens: this.tokens, challenges: this.challenges, scopes: this.scopes, events: this.events });
    try { return await work(this); }
    catch (error) { Object.assign(this, snapshot); throw error; }
    finally { release(); }
  }
  async findUserByEmail(email: string) { return [...this.users.values()].find((user) => user.email === email) || null; }
  async findUserById(id: string) { return this.users.get(id) || null; }
  async lockUser(id: string) { return this.findUserById(id); }
  async createUser(user: User) { if (await this.findUserByEmail(user.email)) throw new Error('Duplicate'); this.users.set(user.id, user); return user; }
  async updatePassword(userId: string, hash: string, at: Date) { Object.assign(this.users.get(userId)!, { passwordHash: hash, passwordChangedAt: at }); }
  async lockCodeScope(id: string) { return this.scopes.get(id) || null; }
  async touchCodeScope(id: string, at: Date) { this.scopes.set(id, at); }
  async findChallenge(id: string) { return this.challenges.get(id) || null; }
  async lockChallenge(id: string) { return this.findChallenge(id); }
  async createChallenge(challenge: EmailChallenge) { this.challenges.set(challenge.id, challenge); }
  async updateChallenge(id: string, changes: Partial<Pick<EmailChallenge, 'attempts' | 'consumedAt' | 'revokedAt'>>) { Object.assign(this.challenges.get(id)!, changes); }
  async revokeChallenges(email: string, purpose: CodePurpose, at: Date) { for (const value of this.challenges.values()) if (value.email === email && value.purpose === purpose && !value.consumedAt && !value.revokedAt) value.revokedAt = at; }
  async createSession(session: AuthSession, token: RefreshToken) { this.sessions.set(session.id, session); this.tokens.set(token.id, token); }
  async findSession(id: string) { return this.sessions.get(id) || null; }
  async lockSession(id: string) { return this.findSession(id); }
  async lockRefreshToken(id: string) { return this.tokens.get(id) || null; }
  async findTokenByHash(hash: string) { const token = [...this.tokens.values()].find((token) => token.tokenHash === hash); return token ? { token, session: this.sessions.get(token.sessionId)! } : null; }
  async rotateToken(currentId: string, successor: RefreshToken, at: Date) { Object.assign(this.tokens.get(currentId)!, { consumedAt: at, replacedByTokenId: successor.id }); this.tokens.set(successor.id, successor); this.sessions.get(successor.sessionId)!.lastUsedAt = at; }
  async revokeSession(id: string, reason: string, at: Date) { const session = this.sessions.get(id)!; if (!session.revokedAt) { session.revokedAt = at; session.revokeReason = reason; } for (const token of this.tokens.values()) if (token.sessionId === id) token.revokedAt ||= at; }
  async revokeUserSessions(userId: string, reason: string, at: Date) { for (const session of this.sessions.values()) if (session.userId === userId && !session.revokedAt) await this.revokeSession(session.id, reason, at); }
  async audit(event: AuditInput) { this.events.push(event); }
  async health() {}
}
