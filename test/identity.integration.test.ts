import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MySqlContainer } from '@testcontainers/mysql';
import type { StartedMySqlContainer } from '@testcontainers/mysql';
import mariadb from 'mariadb';
import type { Connection } from 'mariadb';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import request from 'supertest';
import { databaseSettings, databaseDialect } from '../scripts/database-env.mjs';
import { PrismaIdentityStore } from '../dist/modules/identity/infrastructure/prisma-identity-store.js';
import { createApp } from '../dist/app.js';
import { FakeEmail, MemoryFileStorage, harness, register, testConfig } from './helpers.js';

const dialect = databaseDialect({
  DATABASE_DIALECT:
    process.env.TEST_DATABASE_DIALECT || process.env.DATABASE_DIALECT,
});
const serverUrl =
  process.env.TEST_DATABASE_SERVER_URL || process.env.TEST_MYSQL_SERVER_URL;
const collation =
  dialect === 'mariadb' ? 'utf8mb4_unicode_nopad_ci' : 'utf8mb4_0900_ai_ci';
let store: PrismaIdentityStore;
let container: StartedMySqlContainer | undefined;
let admin: Connection | undefined;
let createdDatabase = false;
const testDatabase = `lambdaquality_test_${randomBytes(6).toString('hex')}`;
beforeAll(async () => {
  let url: string;
  if (
    process.env.TEST_USE_CONFIGURED_DATABASE === 'true' ||
    process.env.TEST_USE_CONFIGURED_MYSQL === 'true' ||
    serverUrl
  ) {
    const settings = serverUrl
      ? databaseSettings({ DATABASE_URL: serverUrl })
      : databaseSettings();
    const { url: _url, database: _database, ...server } = settings;
    if (
      !['localhost', '127.0.0.1', '[::1]'].includes(server.host) &&
      !serverUrl
    )
      throw new Error(
        'Testes no servidor configurado só são permitidos em loopback; para um servidor dedicado, configure TEST_DATABASE_SERVER_URL.',
      );
    admin = await mariadb.createConnection({
      ...server,
      timezone: 'Z',
      connectTimeout: 5000,
    });
    const version = (await admin.query('SELECT VERSION() AS version'))[0]
      .version as string;
    if (!(dialect === 'mariadb' ? /^10\.11\..*MariaDB/i : /^8\./).test(version))
      throw new Error(
        'A versão do servidor de teste não corresponde ao DATABASE_DIALECT.',
      );
    if (!/^lambdaquality_test_[a-f0-9]{12}$/.test(testDatabase))
      throw new Error('Nome de banco de teste inválido.');
    await admin.query(
      `CREATE DATABASE \`${testDatabase}\` CHARACTER SET utf8mb4 COLLATE ${collation}`,
    );
    createdDatabase = true;
    const target = new URL(settings.url);
    target.pathname = `/${testDatabase}`;
    url = target.toString();
  } else {
    container = await new MySqlContainer(
      dialect === 'mariadb' ? 'mariadb:10.11.14' : 'mysql:8.4.11',
    )
      .withDatabase(testDatabase)
      .start();
    url = container.getConnectionUri();
  }
  execFileSync(
    process.execPath,
    [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    {
      env: {
        ...process.env,
        DATABASE_URL: url,
        DB_USERNAME: '',
        DB_PASSWORD: '',
        NODE_ENV: 'test',
        DATABASE_DIALECT: dialect,
      },
      timeout: 60000,
      stdio: 'pipe',
    },
  );
  const database = databaseSettings({
    DATABASE_URL: url,
    NODE_ENV: 'test',
    DATABASE_DIALECT: dialect,
  });
  store = new PrismaIdentityStore({ ...testConfig, database });
  await store.health();
});
afterAll(async () => {
  await store?.onModuleDestroy();
  if (admin) {
    try {
      if (
        createdDatabase &&
        /^lambdaquality_test_[a-f0-9]{12}$/.test(testDatabase)
      )
        await admin.query(`DROP DATABASE \`${testDatabase}\``);
    } finally {
      await admin.end();
    }
  }
  await container?.stop();
});

describe('Identity with MySQL/MariaDB and real migrations', () => {
  it('creates the schema and registers users with hashed credentials and persistent audit', async () => {
    const h = harness(store); const email = `${randomUUID()}@example.com`; const user = await register(h, email);
    const record = await store.client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(record.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await store.client.auditEvent.count({ where: { actorUserId: user.id, action: 'identity.user_registered' } })).toBe(1);
    await expect(store.client.user.create({ data: { ...record, id: randomUUID() } })).rejects.toMatchObject({ code: 'P2002' });
  });
  it('commits invalid-code attempts rather than rolling them back on an HTTP error', async () => {
    const h = harness(store); const c = await h.service.requestCode(`${randomUUID()}@example.com`, 'REGISTRATION', h.requestId);
    const wrong = h.mail.lastCode() === '000000' ? '111111' : '000000';
    await expect(h.service.register({ challengeId: c.challengeId, code: wrong, displayName: 'Test User', password: 'VerySecurePassword123!' }, h.requestId)).rejects.toMatchObject({ code: 'AUTH_INVALID_EMAIL_CODE' });
    expect((await store.client.emailChallenge.findUniqueOrThrow({ where: { id: c.challengeId } })).attempts).toBe(1);
  });
  it('serializes concurrent refresh and persists revocation before reporting reuse', async () => {
    const h = harness(store); const email = `${randomUUID()}@example.com`; await register(h, email);
    const pair = await h.service.login(email, 'VerySecurePassword123!', h.requestId);
    const results = await Promise.allSettled([h.service.refresh(pair.refreshToken, h.requestId), h.service.refresh(pair.refreshToken, h.requestId)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const loser = results.find((r) => r.status === 'rejected')!;
    if (loser.status === 'rejected') expect(loser.reason).toMatchObject({ code: 'AUTH_REFRESH_TOKEN_REUSED' });
    const winner = results.find((r) => r.status === 'fulfilled')!;
    if (winner.status === 'fulfilled') await expect(h.service.authenticate(winner.value.accessToken)).rejects.toMatchObject({ code: 'AUTH_SESSION_REVOKED' });
    expect(await store.client.auditEvent.count({ where: { correlationId: h.requestId, action: 'identity.refresh_reuse_detected' } })).toBe(1);
  });
  it('rejects refresh successors from another family at the database level', async () => {
    const h = harness(store); const email = `${randomUUID()}@example.com`; const user = await register(h, email);
    await h.service.login(email, 'VerySecurePassword123!', h.requestId); await h.service.login(email, 'VerySecurePassword123!', h.requestId);
    const sessions = await store.client.authSession.findMany({ where: { userId: user.id }, include: { tokens: true } });
    await expect(store.client.refreshToken.update({ where: { id: sessions[0].tokens[0].id }, data: { replacedByTokenId: sessions[1].tokens[0].id } })).rejects.toMatchObject({ code: 'P2003' });
  });
  it('resets passwords and invalidates all access/refresh tokens transactionally', async () => {
    const h = harness(store); const email = `${randomUUID()}@example.com`; const user = await register(h, email);
    const pair = await h.service.login(email, 'VerySecurePassword123!', h.requestId); h.advance(1000);
    const c = await h.service.requestCode(email, 'PASSWORD_RESET', h.requestId);
    await h.service.resetPassword({ challengeId: c.challengeId, code: h.mail.lastCode(), newPassword: 'OtherSecurePassword123!' }, h.requestId);
    expect(await store.client.authSession.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    await expect(h.service.authenticate(pair.accessToken)).rejects.toMatchObject({ code: 'AUTH_SESSION_REVOKED' });
    await expect(h.service.login(email, 'OtherSecurePassword123!', h.requestId)).resolves.toHaveProperty('accessToken');
  });
  it('serves real HTTP contracts on top of the MySQL adapter', async () => {
    const mail = new FakeEmail(); const app = await createApp({ config: testConfig, store, mail, fileStorage: new MemoryFileStorage() });
    try {
      const http = request(app.getHttpServer()); const email = `${randomUUID()}@example.com`;
      const c = await http.post('/api/v1/auth/registration/code').send({ email }).expect(202);
      await http.post('/api/v1/auth/register').send({ challengeId: c.body.data.challengeId, code: mail.lastCode(), displayName: 'Test User', password: 'VerySecurePassword123!' }).expect(201);
      const pair = await http.post('/api/v1/auth/login').send({ email, password: 'VerySecurePassword123!' }).expect(200);
      await http.get('/api/v1/auth/me').set('Authorization', `Bearer ${pair.body.data.accessToken}`).expect(200);
      await http.get('/api/v1/health/ready').expect(200);
    } finally { await app.close(); }
  });
});
