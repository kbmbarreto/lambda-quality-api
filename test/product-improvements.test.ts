import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parseAzureCsv } from '../dist/modules/testmanagement/domain/azure-csv.js';
import { AesVaultCipher } from '../dist/modules/vault/infrastructure/aes-vault-cipher.js';
import type { VaultEntry } from '../dist/modules/vault/domain/models.js';
import { brazilTimestamp, responseDates } from '../dist/shared/http/dates.js';
const csv = readFileSync('test/fixtures/azure-test-cases.csv', 'utf8');
const header = 'ID,Work Item Type,Title,Test Step,Step Action,Step Expected';
describe('Azure CSV imports', () => {
  it('imports the sample cases and preserves Portuguese BDD and ordered steps', () => {
    const cases = parseAzureCsv('\uFEFF' + csv);
    expect(cases).toHaveLength(5);
    expect(cases.map((item) => item.steps.length)).toEqual([3, 3, 4, 4, 4]);
    expect(cases[0].description).toBe(
      "Dado que eu possuo um perfil 'Financeiro'\nQuando acesso o relatório financeiro\nEntão devo visualizar o relatório financeiro",
    );
    expect(cases[0].steps[0].expectedResult).toBeNull();
  });
  it('handles escaped quotes, commas, CRLF, multiline values and non-BDD expected results', () => {
    const input =
      header +
      '\r\n"1","Test Case","Título, com ""aspas""",,,\r\n,,,1,"Ação\ncom detalhe","Resultado, esperado"\r\n';
    expect(parseAzureCsv(input)[0]).toEqual({
      azureId: '1',
      title: 'Título, com "aspas"',
      description: null,
      steps: [
        { action: 'Ação\ncom detalhe', expectedResult: 'Resultado, esperado' },
      ],
    });
  });
  it.each([
    '',
    'ID,Title\n1,Title',
    header + '\n,,,1,Action,Expected',
    header + '\n1,Bug,Title,,,',
    header + '\n1,Test Case,Title,,,\n1,Test Case,Other,,,',
    header + '\n1,Test Case,Title,,,\n,,,2,Action,Expected',
    header + '\n1,Test Case,"Unclosed,,,',
    header + '\n1,Test Case,"Title"x,,,',
    header + '\n1,Test Case,Title,,,\n,,,1,Action',
    header + '\n1,Test Case,Title,,,\0',
  ])(
    'rejects malformed or unsupported CSV records without returning input data (%#)',
    (input) => {
      expect(() => parseAzureCsv(input)).toThrow();
    },
  );
});
describe('Encrypted test vault', () => {
  const key = randomBytes(32).toString('base64'),
    old = randomBytes(32).toString('base64');
  const context = { id: 'entry', workspaceId: 'ws', projectId: 'p' };
  const secret = {
    username: 'private-user',
    password: 'test-password-secret',
    url: 'https://test.local',
    notes: 'confidential note',
  };
  const cipher = new AesVaultCipher({
    keys: JSON.stringify({ v1: key }),
    activeKeyId: 'v1',
  });
  const entry = () =>
    ({ ...context, ...cipher.encrypt(secret, context) }) as VaultEntry;
  it('round-trips sensitive fields with a random IV for every write', () => {
    const first = entry(),
      second = entry();
    expect(first.encryptedPayload).not.toBe(second.encryptedPayload);
    for (const value of Object.values(secret))
      expect(first.encryptedPayload).not.toContain(value);
    expect(cipher.decrypt(first)).toEqual(secret);
  });
  it('rejects the previous payload format without exposing vault contents', () => {
    const row = entry();
    expect(row.encryptedPayload).toMatch(/^v2\./);
    expect(() =>
      cipher.decrypt({
        ...row,
        encryptedPayload: row.encryptedPayload.replace(/^v2\./, 'v1.'),
      }),
    ).toThrow('Não foi possível acessar os dados do cofre.');
  });
  it('authenticates entry, project, Workspace, ciphertext and authentication tag', () => {
    const row = entry();
    for (const altered of [
      { ...row, id: 'other' },
      { ...row, workspaceId: 'other' },
      { ...row, projectId: 'other' },
      {
        ...row,
        encryptedPayload: row.encryptedPayload.replace(
          /^v2\.[^.]+\./,
          'v2.AAAAAAAAAAAAAAAA.',
        ),
      },
      { ...row, encryptedPayload: row.encryptedPayload.slice(0, -4) + 'AAAA' },
    ])
      expect(() => cipher.decrypt(altered)).toThrow('cofre');
  });
  it('keeps old keys readable when rotating the active key', () => {
    const oldCipher = new AesVaultCipher({
      keys: JSON.stringify({ old }),
      activeKeyId: 'old',
    });
    const rotating = new AesVaultCipher({
      keys: JSON.stringify({ old, v1: key }),
      activeKeyId: 'v1',
    });
    expect(
      rotating.decrypt({
        ...context,
        ...oldCipher.encrypt(secret, context),
      } as VaultEntry),
    ).toEqual(secret);
    expect(rotating.encrypt(secret, context).keyId).toBe('v1');
  });
  it('fails with a sanitized 503 for missing/wrong key without exposing secrets', () => {
    for (const keys of [
      undefined,
      'broken-json',
      JSON.stringify({ v1: 'short' }),
    ]) {
      const broken = new AesVaultCipher({ keys, activeKeyId: 'v1' });
      expect(() => broken.encrypt(secret, context)).toThrow('cofre');
    }
    const wrong = new AesVaultCipher({
      keys: JSON.stringify({ v1: old }),
      activeKeyId: 'v1',
    });
    expect(() => wrong.decrypt(entry())).toThrow('cofre');
  });
});
describe('UTC-3 response dates', () => {
  it('preserves the instant across day/year changes and offsets already supplied', () => {
    const date = new Date('2026-01-01T01:02:03.004Z');
    expect(brazilTimestamp(date)).toBe('2025-12-31T22:02:03.004-03:00');
    expect(new Date(brazilTimestamp(date)).getTime()).toBe(date.getTime());
    expect(responseDates({ createdAt: '2026-10-06T12:00:00+02:00' })).toEqual({
      createdAt: '2026-10-06T07:00:00.000-03:00',
    });
  });
  it('converts nested timestamps while preserving calendar dates and user text', () => {
    expect(
      responseDates({
        createdAt: new Date('2026-10-06T00:00:00Z'),
        period: { from: '2026-10-06T00:00:00.000Z' },
        list: [{ timestamp: '2026-10-06T00:00:00Z' }],
        dueDate: '2026-10-06',
        password: '2026-10-06T00:00:00Z',
        description: '2026-10-06T00:00:00Z',
      }),
    ).toEqual({
      createdAt: '2026-10-05T21:00:00.000-03:00',
      period: { from: '2026-10-05T21:00:00.000-03:00' },
      list: [{ timestamp: '2026-10-05T21:00:00.000-03:00' }],
      dueDate: '2026-10-06',
      password: '2026-10-06T00:00:00Z',
      description: '2026-10-06T00:00:00Z',
    });
  });
});
