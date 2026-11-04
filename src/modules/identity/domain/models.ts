export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type CodePurpose = 'REGISTRATION' | 'PASSWORD_RESET';
export interface User {
  id: string; email: string; displayName: string; passwordHash: string;
  status: UserStatus; emailVerifiedAt: Date; passwordChangedAt: Date;
  createdAt: Date; updatedAt: Date;
}
export type PublicUser = Pick<User, 'id' | 'email' | 'displayName' | 'status' | 'emailVerifiedAt' | 'createdAt'>;
export function publicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, displayName: user.displayName, status: user.status, emailVerifiedAt: user.emailVerifiedAt, createdAt: user.createdAt };
}
export interface AuthSession {
  id: string; userId: string; createdAt: Date; expiresAt: Date; lastUsedAt: Date;
  revokedAt: Date | null; revokeReason: string | null;
}
export interface RefreshToken {
  id: string; sessionId: string; tokenHash: string; createdAt: Date; expiresAt: Date;
  consumedAt: Date | null; revokedAt: Date | null; replacedByTokenId: string | null;
}
export interface EmailChallenge {
  id: string; email: string; purpose: CodePurpose; codeHash: string; attempts: number;
  eligible: boolean; createdAt: Date; expiresAt: Date; consumedAt: Date | null; revokedAt: Date | null;
}
export interface AccessIdentity { userId: string; sessionId: string }
export interface TokenPair { accessToken: string; refreshToken: string; tokenType: 'Bearer'; expiresIn: number; refreshExpiresIn: number }
export interface AuditInput { id: string; actorUserId: string | null; action: string; entityType: string; entityId: string; occurredAt: Date; correlationId: string }
