import type { AccessIdentity, AuditInput, AuthSession, CodePurpose, EmailChallenge, RefreshToken, User } from '../domain/models.js';

export const IDENTITY_STORE = Symbol('IdentityStore');
export const PASSWORDS = Symbol('Passwords');
export const ACCESS_TOKENS = Symbol('AccessTokens');
export const CODE_EMAIL = Symbol('CodeEmail');
export interface IdentityTransaction {
  lockCodeScope(id: string): Promise<Date | null>;
  touchCodeScope(id: string, at: Date): Promise<void>;
  findUserByEmail(email: string): Promise<User | null>;
  lockUser(id: string): Promise<User | null>;
  createUser(user: User): Promise<User>;
  updatePassword(userId: string, hash: string, at: Date): Promise<void>;
  lockChallenge(id: string): Promise<EmailChallenge | null>;
  createChallenge(challenge: EmailChallenge): Promise<void>;
  updateChallenge(id: string, changes: Partial<Pick<EmailChallenge, 'attempts' | 'consumedAt' | 'revokedAt'>>): Promise<void>;
  revokeChallenges(email: string, purpose: CodePurpose, at: Date): Promise<void>;
  createSession(session: AuthSession, token: RefreshToken): Promise<void>;
  lockSession(id: string): Promise<AuthSession | null>;
  lockRefreshToken(id: string): Promise<RefreshToken | null>;
  rotateToken(currentId: string, successor: RefreshToken, at: Date): Promise<void>;
  revokeSession(id: string, reason: string, at: Date): Promise<void>;
  revokeUserSessions(userId: string, reason: string, at: Date): Promise<void>;
  audit(event: AuditInput): Promise<void>;
}
export interface IdentityStore {
  transaction<T>(work: (tx: IdentityTransaction) => Promise<T>): Promise<T>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  findSession(id: string): Promise<AuthSession | null>;
  findTokenByHash(hash: string): Promise<{ token: RefreshToken; session: AuthSession } | null>;
  findChallenge(id: string): Promise<EmailChallenge | null>;
  health(): Promise<void>;
}
export interface Passwords { hash(password: string): Promise<string>; verify(hash: string, password: string): Promise<boolean>; verifyDummy(password: string): Promise<void> }
export interface AccessTokens { sign(identity: AccessIdentity): Promise<string>; verify(token: string): Promise<AccessIdentity> }
export interface CodeEmail { send(email: string, code: string, purpose: CodePurpose, expiresInSeconds: number): Promise<void> }
export interface IdentitySettings { accessTtl: number; sessionTtl: number; refreshIdleTtl: number; codeSecret: string; codeTtl: number; codeMaxAttempts: number; codeCooldown: number }
