import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';
import { MailService } from '@sendgrid/mail';
import { JwtAccessTokens } from '../dist/modules/identity/infrastructure/jwt-access-tokens.js';
import { SendgridCodeEmail } from '../dist/modules/identity/infrastructure/sendgrid-code-email.js';
import {
  databaseSettings,
  databaseDialect,
  migrationDirectory,
} from '../scripts/database-env.mjs';
import { testConfig } from './helpers.js';

describe('Infrastructure security', () => {
  it('uses RS256 with issuer, audience, purpose and session claims', async () => {
    const tokens = new JwtAccessTokens(testConfig.jwt);
    const identity = { userId: randomUUID(), sessionId: randomUUID() };
    const jwt = await tokens.sign(identity);
    expect(await tokens.verify(jwt)).toEqual(identity);
    const key = await importPKCS8(testConfig.jwt.privateKey, 'RS256');
    for (const changes of [
      { audience: 'other' },
      { issuer: 'other' },
      { tokenUse: 'refresh' },
      { expired: true },
    ]) {
      const bad = await new SignJWT({
        sid: identity.sessionId,
        tokenUse: 'tokenUse' in changes ? changes.tokenUse : 'access',
      })
        .setProtectedHeader({
          alg: 'RS256',
          kid: testConfig.jwt.keyId,
          typ: 'JWT',
        })
        .setSubject(identity.userId)
        .setJti(randomUUID())
        .setIssuer(
          'issuer' in changes ? changes.issuer! : testConfig.jwt.issuer,
        )
        .setAudience(
          'audience' in changes ? changes.audience! : testConfig.jwt.audience,
        )
        .setIssuedAt()
        .setExpirationTime(
          'expired' in changes ? Math.floor(Date.now() / 1000) - 10 : '15m',
        )
        .sign(key);
      await expect(tokens.verify(bad)).rejects.toMatchObject({ status: 401 });
    }
  });
  it('maps JDBC config to MySQL and preserves encoded credentials without logging', () => {
    const config = databaseSettings({
      DB_URL:
        'jdbc:mysql://localhost:3306/example?serverTimezone=UTC&allowPublicKeyRetrieval=true',
      DB_USERNAME: 'test',
      DB_PASSWORD: 'p@ss:#word',
    });
    expect(new URL(config.url).password).toBe('p%40ss%3A%23word');
    expect(config.password).toBe('p@ss:#word');
    expect(new URL(config.url).searchParams.has('serverTimezone')).toBe(false);
    expect(config.allowPublicKeyRetrieval).toBe(true);
  });
  it('selects an explicit migration history without changing connection credentials', () => {
    expect(databaseDialect({})).toBe('mysql');
    expect(migrationDirectory({ DATABASE_DIALECT: 'mysql' })).toBe(
      'prisma/migrations',
    );
    expect(migrationDirectory({ DATABASE_DIALECT: 'mariadb' })).toBe(
      'prisma/migrations-mariadb',
    );
    expect(() => databaseDialect({ DATABASE_DIALECT: 'sqlite' })).toThrow(
      'DATABASE_DIALECT',
    );
  });
  it('keeps the MariaDB bootstrap in sync with the original history and its isolation constraints', async () => {
    const names = (await readdir('prisma/migrations'))
      .filter((name) => /^\d{12}_/.test(name))
      .sort();
    const mariaNames = (await readdir('prisma/migrations-mariadb'))
      .filter((name) => /^\d{12}_/.test(name))
      .sort();
    expect(mariaNames).toEqual(names);
    for (const name of names) {
      const original = readFileSync(
        `prisma/migrations/${name}/migration.sql`,
        'utf8',
      );
      const actual = readFileSync(
        `prisma/migrations-mariadb/${name}/migration.sql`,
        'utf8',
      );
      const expected = original
        .replaceAll('utf8mb4_0900_ai_ci', 'utf8mb4_unicode_nopad_ci')
        .replaceAll('utf8mb4_0900_bin', 'utf8mb4_nopad_bin')
        .replaceAll('DROP CHECK', 'DROP CONSTRAINT')
        .replaceAll(
          "REGEXP_LIKE(`key`, '^[A-Z][A-Z0-9_]{1,11}$','c')",
          () => "(`key` REGEXP BINARY '^[A-Z][A-Z0-9_]{1,11}$')",
        );
      expect(actual).toBe(expected);
    }
  });
  it('uses SendGrid API, with code in email only and tracking disabled', async () => {
    const send = vi
      .spyOn(MailService.prototype, 'send')
      .mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }, {}]);
    const client = new SendgridCodeEmail({
      ...testConfig.mail,
      apiKey: 'SG.test-key',
    });
    await client.send('user@example.com', '123456', 'REGISTRATION', 600);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Lambda Quality — Código para confirmar seu cadastro',
        text: expect.stringContaining('123456'),
        trackingSettings: {
          clickTracking: { enable: false, enableText: false },
          openTracking: { enable: false },
        },
      }),
    );
    send.mockRestore();
  });
  it('keeps domain/application independent of framework and ORM imports', async () => {
    for (const directory of [
      'src/modules/vault/domain',
      'src/modules/vault/application',
      'src/modules/identity/domain',
      'src/modules/identity/application',
      'src/modules/workspace/domain',
      'src/modules/workspace/application',
      'src/modules/testmanagement/domain',
      'src/modules/testmanagement/application',
      'src/modules/attachment/domain',
      'src/modules/attachment/application',
      'src/modules/project/domain',
      'src/modules/project/application',
      'src/modules/governance/domain',
      'src/modules/governance/application',
      'src/modules/defect/domain',
      'src/modules/defect/application',
      'src/modules/execution/domain',
      'src/modules/execution/application',
    ]) {
      for (const file of await readdir(directory)) {
        const source = readFileSync(`${directory}/${file}`, 'utf8');
        expect(source).not.toMatch(
          /from\s+['"](@nestjs|@prisma|.*generated\/prisma)/,
        );
      }
    }
  });
});
