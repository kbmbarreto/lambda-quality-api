import { afterEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'dotenv';
import { readVaultKey } from '../scripts/vault-keys.mjs';
import { setupVaultKey } from '../scripts/setup-vault-key.mjs';
const directories: string[] = [];
afterEach(() => {
  for (const d of directories.splice(0))
    rmSync(d, { recursive: true, force: true });
});
function file(content: string) {
  const dir = mkdtempSync(join(tmpdir(), 'lambdaquality-vault-'));
  directories.push(dir);
  const path = join(dir, '.env');
  writeFileSync(path, content);
  return path;
}
describe('Vault configuration and local key setup', () => {
  it('rejects filled but invalid key material with a safe diagnostic', () => {
    for (const [keys, id, code] of [
      [undefined, 'v1', 'VAULT_KEYS_MISSING'],
      ['bad-json', 'v1', 'VAULT_KEYS_INVALID_JSON'],
      ['[]', 'v1', 'VAULT_KEYS_INVALID_JSON'],
      ['{}', 'v1', 'VAULT_ACTIVE_KEY_MISSING'],
      [
        JSON.stringify({
          v1: 'ordinary-password-with-67-characters-that-is-not-a-valid-AES-key!!!!!',
        }),
        'v1',
        'VAULT_KEY_INVALID_BASE64_32_BYTES',
      ],
      [
        JSON.stringify({ v1: randomBytes(50).toString('base64') }),
        'v1',
        'VAULT_KEY_INVALID_BASE64_32_BYTES',
      ],
      [
        JSON.stringify({ v1: randomBytes(32).toString('hex') }),
        'v1',
        'VAULT_KEY_INVALID_BASE64_32_BYTES',
      ],
      ['{}', 'bad id', 'VAULT_KEY_ID_INVALID'],
    ] as const) {
      try {
        readVaultKey(keys, id);
        expect.fail('Invalid key was accepted');
      } catch (error) {
        expect(error).toMatchObject({ code, message: code });
      }
    }
  });
  it('repairs local configuration with a new ID while preserving old material and unrelated settings', () => {
    const old = "invalid'old-material";
    const preserved = randomBytes(32).toString('base64');
    const path = file(
      `OTHER_SECRET=unchanged\n# preserve this comment\nTEST_VAULT_ACTIVE_KEY_ID=v1\nTEST_VAULT_ENCRYPTION_KEYS=\`${JSON.stringify({ v1: old, v2: preserved })}\`\n`,
    );
    expect(setupVaultKey(path)).toEqual({ changed: true });
    const actual = readFileSync(path, 'utf8'),
      env = parse(actual);
    expect(actual).toContain(
      'OTHER_SECRET=unchanged\n# preserve this comment\n',
    );
    expect(env.TEST_VAULT_ACTIVE_KEY_ID).toBe('v3');
    expect(JSON.parse(env.TEST_VAULT_ENCRYPTION_KEYS)).toMatchObject({
      v1: old,
      v2: preserved,
    });
    expect(readVaultKey(env.TEST_VAULT_ENCRYPTION_KEYS, 'v3')).toHaveLength(32);
    expect(
      readVaultKey(env.TEST_VAULT_ENCRYPTION_KEYS, 'v2').toString('base64'),
    ).toBe(preserved);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(setupVaultKey(path)).toEqual({ changed: false });
    expect(readFileSync(path, 'utf8')).toBe(actual);
  });
  it('preserves malformed JSON for correction instead of deleting existing key IDs', () => {
    const content =
      'TEST_VAULT_ACTIVE_KEY_ID=v1\nTEST_VAULT_ENCRYPTION_KEYS=bad-json\n';
    const path = file(content);
    expect(() => setupVaultKey(path)).toThrow('VAULT_KEYS_INVALID_JSON');
    expect(readFileSync(path, 'utf8')).toBe(content);
  });
});
