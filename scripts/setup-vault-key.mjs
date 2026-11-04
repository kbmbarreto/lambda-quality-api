import { randomBytes, randomUUID } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import {
  parseVaultKeys,
  readVaultKey,
  VaultKeyConfigurationError,
} from './vault-keys.mjs';

export function setupVaultKey(path) {
  if (!lstatSync(path).isFile())
    throw new Error('Informe um arquivo .env regular existente.');
  const original = readFileSync(path, 'utf8');
  const env = parse(original);
  const activeId = env.TEST_VAULT_ACTIVE_KEY_ID || 'v1';
  try {
    readVaultKey(env.TEST_VAULT_ENCRYPTION_KEYS, activeId);
    return { changed: false };
  } catch (error) {
    if (!(error instanceof VaultKeyConfigurationError)) throw error;
  }
  // Never replace an existing key ID: old entries may depend on it.
  const keys = env.TEST_VAULT_ENCRYPTION_KEYS
    ? parseVaultKeys(env.TEST_VAULT_ENCRYPTION_KEYS)
    : {};
  if (
    env.TEST_VAULT_ENCRYPTION_KEYS?.includes('\n') ||
    env.TEST_VAULT_ENCRYPTION_KEYS?.includes('\r')
  )
    throw new Error(
      'Mantenha TEST_VAULT_ENCRYPTION_KEYS em uma única linha antes de executar este comando.',
    );
  let number = 1;
  while (Object.hasOwn(keys, `v${number}`)) number++;
  const id = `v${number}`;
  keys[id] = randomBytes(32).toString('base64');
  const json = JSON.stringify(keys);
  const quote = json.includes("'") ? '`' : "'";
  if (json.includes(quote))
    throw new Error('O JSON não pode ser representado com segurança no .env.');
  const replacements = {
    TEST_VAULT_ACTIVE_KEY_ID: id,
    TEST_VAULT_ENCRYPTION_KEYS: `${quote}${json}${quote}`,
  };
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  let updated = original;
  for (const [name, value] of Object.entries(replacements)) {
    const assignment = new RegExp(`^(?:export\\s+)?${name}\\s*=.*$`, 'gm');
    if (assignment.test(updated))
      updated = updated.replace(assignment, () => `${name}=${value}`);
    else
      updated += `${updated.endsWith('\n') ? '' : newline}${name}=${value}${newline}`;
  }
  const candidate = parse(updated);
  readVaultKey(
    candidate.TEST_VAULT_ENCRYPTION_KEYS,
    candidate.TEST_VAULT_ACTIVE_KEY_ID,
  );
  if (
    JSON.stringify(parseVaultKeys(candidate.TEST_VAULT_ENCRYPTION_KEYS)) !==
    json
  )
    throw new Error('O .env não preservaria as chaves existentes.');
  const temporary = `${path}.vault-${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, updated, { flag: 'wx', mode: 0o600 });
    if (readFileSync(path, 'utf8') !== original)
      throw new Error('O .env mudou durante a operação; execute novamente.');
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
  return { changed: true };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const result = setupVaultKey(resolve(process.argv[2] || '.env'));
    console.log(
      result.changed
        ? 'Nova chave do cofre configurada no .env privado. IDs anteriores preservados; reinicie a API. Nenhum segredo foi exibido.'
        : 'Chave do cofre válida já configurada; .env preservado.',
    );
  } catch (error) {
    console.error(
      error instanceof VaultKeyConfigurationError
        ? `Configuração do cofre inválida: ${error.code}; .env preservado.`
        : 'Não foi possível configurar a chave do cofre. Confira o arquivo .env e use JSON em uma linha; nenhum segredo foi exibido.',
    );
    process.exitCode = 1;
  }
}
