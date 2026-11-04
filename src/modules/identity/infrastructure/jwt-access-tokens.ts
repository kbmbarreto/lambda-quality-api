import { importPKCS8, importSPKI, jwtVerify, SignJWT, errors } from 'jose';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../../../shared/config/config.js';
import { ApplicationError } from '../../../shared/domain/errors.js';
import type { AccessTokens } from '../application/ports.js';
import type { AccessIdentity } from '../domain/models.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class JwtAccessTokens implements AccessTokens {
  private readonly privateKey;
  private readonly publicKey;
  constructor(private readonly config: AppConfig['jwt']) {
    this.privateKey = importPKCS8(config.privateKey, 'RS256');
    this.publicKey = importSPKI(config.publicKey, 'RS256');
  }
  async sign(identity: AccessIdentity): Promise<string> {
    return new SignJWT({ sid: identity.sessionId, tokenUse: 'access' })
      .setProtectedHeader({ alg: 'RS256', kid: this.config.keyId, typ: 'JWT' })
      .setSubject(identity.userId).setJti(randomUUID()).setIssuer(this.config.issuer)
      .setAudience(this.config.audience).setIssuedAt().setExpirationTime(`${this.config.accessTtl}s`)
      .sign(await this.privateKey);
  }
  async verify(token: string): Promise<AccessIdentity> {
    try {
      const { payload, protectedHeader } = await jwtVerify(token, await this.publicKey, {
        algorithms: ['RS256'], issuer: this.config.issuer, audience: this.config.audience,
        requiredClaims: ['sub', 'sid', 'jti', 'iat', 'exp', 'tokenUse'], maxTokenAge: `${this.config.accessTtl}s`,
      });
      if (protectedHeader.kid !== this.config.keyId || protectedHeader.typ !== 'JWT' || payload.tokenUse !== 'access' || typeof payload.sub !== 'string' || !uuid.test(payload.sub) || typeof payload.sid !== 'string' || !uuid.test(payload.sid) || typeof payload.jti !== 'string' || !uuid.test(payload.jti)) throw new Error('Invalid claims');
      return { userId: payload.sub, sessionId: payload.sid };
    } catch (error) {
      if (error instanceof errors.JWTExpired) throw new ApplicationError(401, 'AUTH_ACCESS_TOKEN_EXPIRED', 'Token de acesso expirado.');
      throw new ApplicationError(401, 'AUTH_INVALID_ACCESS_TOKEN', 'Token de acesso inválido.');
    }
  }
}
