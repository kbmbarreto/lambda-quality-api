import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import {
  databaseSettings,
  databaseDialect,
} from '../../../scripts/database-env.mjs';
import { deferredObjectStorageConfig } from './object-storage.js';
import type { ObjectStorageSource } from './object-storage.js';

export interface AppConfig {
  environment: string;
  port: number;
  host: string;
  database: ReturnType<typeof databaseSettings>;
  jwt: {
    privateKey: string;
    publicKey: string;
    keyId: string;
    issuer: string;
    audience: string;
    accessTtl: number;
    sessionTtl: number;
    refreshIdleTtl: number;
  };
  codes: { secret: string; ttl: number; maxAttempts: number; cooldown: number };
  mail: { apiKey: string; fromEmail: string; fromName: string };
  rate: { limit: number; window: number };
  cors: string[];
  swagger: boolean;
  objectStorage: ObjectStorageSource;
  testVault?: { keys?: string; activeKeyId: string };
  workspace: {
    invitationTtl: number;
    invitationCooldown: number;
    secret: string;
    acceptUrl?: string;
    storageRoot: string;
    maxFileBytes: number;
    retentionDays: number;
  };
}
export const CONFIG = Symbol('AppConfig');
function positiveInteger(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
): number {
  const value = Number(env[key] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`Configuração inválida: ${key}.`);
  return value;
}
export function loadConfig(env = process.env): AppConfig {
  databaseDialect(env);
  const environment = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(environment))
    throw new Error('NODE_ENV inválido.');
  const secret = env.OTP_HMAC_SECRET || env.JWT_SECRET || '';
  if (secret.length < 32)
    throw new Error(
      'Configure OTP_HMAC_SECRET ou JWT_SECRET com pelo menos 32 caracteres.',
    );
  const fromEmail = env.SENDGRID_FROM_EMAIL || env.MAIL_USERNAME || '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromEmail))
    throw new Error('Configure um remetente SendGrid válido.');
  if (!env.SENDGRID_API_KEY) throw new Error('Configure SENDGRID_API_KEY.');
  const privateKey = readFileSync(
    resolve(env.JWT_PRIVATE_KEY_PATH || '.local/keys/private.pem'),
    'utf8',
  );
  const publicKey = readFileSync(
    resolve(env.JWT_PUBLIC_KEY_PATH || '.local/keys/public.pem'),
    'utf8',
  );
  const privateObject = createPrivateKey(privateKey);
  const publicObject = createPublicKey(publicKey);
  if (
    privateObject.asymmetricKeyType !== 'rsa' ||
    (privateObject.asymmetricKeyDetails?.modulusLength || 0) < 2048 ||
    !createPublicKey(privateObject)
      .export({ type: 'spki', format: 'der' })
      .equals(publicObject.export({ type: 'spki', format: 'der' }))
  )
    throw new Error(
      'Configure um par de chaves RSA compatível, com pelo menos 2048 bits.',
    );
  if (env.SWAGGER_ENABLED && !['true', 'false'].includes(env.SWAGGER_ENABLED))
    throw new Error('SWAGGER_ENABLED deve ser true ou false.');
  if (Number(env.PORT || 3000) > 65535) throw new Error('PORT inválida.');
  const cors = (env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (cors.includes('*')) throw new Error('CORS_ORIGINS não aceita wildcard.');
  const workspaceSecret = env.INVITATION_ENCRYPTION_SECRET || secret;
  if (workspaceSecret.length < 32)
    throw new Error(
      'INVITATION_ENCRYPTION_SECRET deve ter pelo menos 32 caracteres.',
    );
  const acceptUrl = env.INVITATION_ACCEPT_URL || undefined;
  if (acceptUrl) {
    const url = new URL(acceptUrl);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.hash ||
      url.search ||
      url.username ||
      url.password ||
      (environment === 'production' && url.protocol !== 'https:')
    )
      throw new Error(
        'INVITATION_ACCEPT_URL deve ser uma URL válida, sem query/fragmento/credenciais; HTTPS em produção.',
      );
  }
  const maxFileBytes = positiveInteger(env, 'ATTACHMENT_MAX_BYTES', 10485760);
  if (maxFileBytes > 52428800)
    throw new Error('ATTACHMENT_MAX_BYTES não pode exceder 50 MiB.');
  return {
    environment,
    port: positiveInteger(env, 'PORT', 3000),
    host: env.HOST || '127.0.0.1',
    database: databaseSettings(env),
    jwt: {
      privateKey,
      publicKey,
      keyId: env.JWT_KEY_ID || 'lambdaquality-local',
      issuer: env.JWT_ISSUER || 'lambdaquality-api',
      audience: env.JWT_AUDIENCE || 'lambdaquality-client',
      accessTtl: positiveInteger(env, 'ACCESS_TOKEN_TTL_SECONDS', 900),
      sessionTtl: positiveInteger(env, 'SESSION_TTL_SECONDS', 604800),
      refreshIdleTtl: positiveInteger(env, 'REFRESH_IDLE_TTL_SECONDS', 86400),
    },
    codes: {
      secret,
      ttl: positiveInteger(env, 'EMAIL_CODE_TTL_SECONDS', 600),
      maxAttempts: positiveInteger(env, 'EMAIL_CODE_MAX_ATTEMPTS', 5),
      cooldown: positiveInteger(env, 'EMAIL_CODE_COOLDOWN_SECONDS', 60),
    },
    mail: {
      apiKey: env.SENDGRID_API_KEY,
      fromEmail,
      fromName: env.SENDGRID_FROM_NAME || 'Lambda Quality',
    },
    rate: {
      limit: positiveInteger(env, 'AUTH_RATE_LIMIT', 20),
      window: positiveInteger(env, 'AUTH_RATE_WINDOW_SECONDS', 60),
    },
    cors,
    swagger: env.SWAGGER_ENABLED
      ? env.SWAGGER_ENABLED === 'true'
      : environment !== 'production',
    objectStorage: deferredObjectStorageConfig(env),
    testVault: {
      keys: env.TEST_VAULT_ENCRYPTION_KEYS,
      activeKeyId: env.TEST_VAULT_ACTIVE_KEY_ID || 'v1',
    },
    workspace: {
      invitationTtl: positiveInteger(env, 'INVITATION_TTL_SECONDS', 172800),
      invitationCooldown: positiveInteger(
        env,
        'INVITATION_COOLDOWN_SECONDS',
        60,
      ),
      secret: workspaceSecret,
      acceptUrl,
      storageRoot: resolve(env.ATTACHMENT_STORAGE_PATH || '.local/uploads'),
      maxFileBytes,
      retentionDays: positiveInteger(env, 'ATTACHMENT_RETENTION_DAYS', 30),
    },
  };
}
