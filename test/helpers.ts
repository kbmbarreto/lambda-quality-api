import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { FileStorage } from '../dist/modules/attachment/application/storage.js';
import type { AppConfig } from '../dist/shared/config/config.js';
import { IdentityService } from '../dist/modules/identity/application/identity-service.js';
import { ArgonPasswords } from '../dist/modules/identity/infrastructure/argon-passwords.js';
import { JwtAccessTokens } from '../dist/modules/identity/infrastructure/jwt-access-tokens.js';
import type {
  CodeEmail,
  IdentityStore,
} from '../dist/modules/identity/application/ports.js';
import type { CodePurpose } from '../dist/modules/identity/domain/models.js';
import { MemoryStore } from './memory-store.js';
const keys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
export const testConfig = {
  environment: 'test',
  port: 3000,
  host: '127.0.0.1',
  database: {
    url: 'mysql://test:test@127.0.0.1:3306/test',
    host: '127.0.0.1',
    port: 3306,
    user: 'test',
    password: 'test',
    database: 'test',
    allowPublicKeyRetrieval: true,
  },
  jwt: {
    ...keys,
    keyId: 'test-key',
    issuer: 'lambdaquality-api',
    audience: 'lambdaquality-client',
    accessTtl: 900,
    sessionTtl: 604800,
    refreshIdleTtl: 86400,
  },
  codes: {
    secret: 'test-secret-with-more-than-32-characters',
    ttl: 600,
    maxAttempts: 5,
    cooldown: 60,
  },
  mail: {
    apiKey: 'test-api-key',
    fromEmail: 'no-reply@example.com',
    fromName: 'Lambda Quality',
  },
  rate: { limit: 1000, window: 60 },
  cors: [],
  swagger: true,
  objectStorage: {
    region: 'sa-saopaulo-1',
    namespace: 'test',
    bucket: 'test',
    prefix: 'test/attachments',
    tenancyOcid: 'ocid1.tenancy.oc1..test',
    userOcid: 'ocid1.user.oc1..test',
    fingerprint: Array(16).fill('00').join(':'),
    privateKey: keys.privateKey,
  },
  workspace: {
    invitationTtl: 172800,
    invitationCooldown: 60,
    secret: 'test-workspace-secret-more-than-32-characters',
    storageRoot: '.local/test-uploads',
    maxFileBytes: 10485760,
    retentionDays: 30,
  },
} satisfies AppConfig;
export class MemoryFileStorage implements FileStorage {
  private readonly files = new Map<
    string,
    { bytes: Uint8Array; modifiedAt: Date }
  >();
  async put(key: string, bytes: Uint8Array) {
    if (this.files.has(key)) throw new Error('Object already exists');
    this.files.set(key, {
      bytes: Uint8Array.from(bytes),
      modifiedAt: new Date(),
    });
  }
  async open(key: string) {
    const file = this.files.get(key);
    if (!file) throw new Error('Object unavailable');
    return Readable.from([file.bytes]);
  }
  async remove(key: string) {
    this.files.delete(key);
  }
  async list() {
    return [...this.files].map(([key, file]) => ({
      key,
      modifiedAt: file.modifiedAt,
    }));
  }
}
export class FakeEmail implements CodeEmail {
  messages: { email: string; code: string; purpose: CodePurpose }[] = [];
  fail = false;
  async send(email: string, code: string, purpose: CodePurpose) {
    if (this.fail) throw new Error('provider failed with secret');
    this.messages.push({ email, code, purpose });
  }
  lastCode(): string {
    return this.messages.at(-1)!.code;
  }
}
export function harness(store: IdentityStore = new MemoryStore()) {
  let time = new Date();
  const mail = new FakeEmail();
  const passwords = new ArgonPasswords();
  const tokens = new JwtAccessTokens(testConfig.jwt);
  const service = new IdentityService(
    store,
    passwords,
    tokens,
    mail,
    {
      accessTtl: 900,
      sessionTtl: 604800,
      refreshIdleTtl: 86400,
      codeSecret: testConfig.codes.secret,
      codeTtl: 600,
      codeMaxAttempts: 5,
      codeCooldown: 60,
    },
    () => time,
  );
  return {
    service,
    store,
    mail,
    passwords,
    tokens,
    advance: (ms: number) => {
      time = new Date(time.getTime() + ms);
    },
    requestId: randomUUID(),
  };
}
export async function register(
  h: ReturnType<typeof harness>,
  email = 'user@example.com',
) {
  const challenge = await h.service.requestCode(
    email,
    'REGISTRATION',
    h.requestId,
  );
  return h.service.register(
    {
      challengeId: challenge.challengeId,
      code: h.mail.lastCode(),
      displayName: 'Test User',
      password: 'VerySecurePassword123!',
    },
    h.requestId,
  );
}
