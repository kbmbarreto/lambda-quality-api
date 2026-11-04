import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ApplicationError } from '../../../shared/domain/errors.js';
import { readVaultKey } from '../../../../scripts/vault-keys.mjs';
import type {
  VaultCipher,
  VaultContext,
  VaultEntry,
  VaultSecret,
} from '../domain/models.js';
export interface VaultKeys {
  keys?: string;
  activeKeyId: string;
}
const aad = (context: VaultContext) =>
  Buffer.from(
    JSON.stringify([
      'lambdaquality-test-vault',
      2,
      context.workspaceId,
      context.projectId,
      context.id,
    ]),
  );
export class AesVaultCipher implements VaultCipher {
  constructor(private readonly config: VaultKeys) {}
  private key(id: string) {
    try {
      return readVaultKey(this.config.keys, id);
    } catch {
      throw new ApplicationError(
        503,
        'TEST_VAULT_UNAVAILABLE',
        'O cofre está temporariamente indisponível.',
      );
    }
  }
  encrypt(secret: VaultSecret, context: VaultContext) {
    const keyId = this.config.activeKeyId;
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key(keyId), iv, {
        authTagLength: 16,
      });
    cipher.setAAD(aad(context));
    const bytes = Buffer.concat([
      cipher.update(JSON.stringify(secret), 'utf8'),
      cipher.final(),
    ]);
    return {
      keyId,
      encryptedPayload: [
        'v2',
        iv.toString('base64'),
        cipher.getAuthTag().toString('base64'),
        bytes.toString('base64'),
      ].join('.'),
    };
  }
  decrypt(entry: VaultEntry): VaultSecret {
    const key = this.key(entry.keyId);
    try {
      const [format, iv64, tag64, content64, ...extra] =
        entry.encryptedPayload.split('.');
      if (format !== 'v2' || extra.length || !iv64 || !tag64 || !content64)
        throw new Error();
      const iv = Buffer.from(iv64, 'base64'),
        tag = Buffer.from(tag64, 'base64');
      if (iv.length !== 12 || tag.length !== 16) throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', key, iv, {
        authTagLength: 16,
      });
      decipher.setAAD(aad(entry));
      decipher.setAuthTag(tag);
      const result: unknown = JSON.parse(
        Buffer.concat([
          decipher.update(Buffer.from(content64, 'base64')),
          decipher.final(),
        ]).toString('utf8'),
      );
      if (
        !result ||
        typeof result !== 'object' ||
        !('username' in result) ||
        !('password' in result) ||
        typeof result.username !== 'string' ||
        typeof result.password !== 'string'
      )
        throw new Error();
      return result as VaultSecret;
    } catch {
      throw new ApplicationError(
        503,
        'TEST_VAULT_UNAVAILABLE',
        'Não foi possível acessar os dados do cofre.',
      );
    }
  }
}
