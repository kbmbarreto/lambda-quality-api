export class VaultKeyConfigurationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export function parseVaultKeys(raw) {
  if (!raw) throw new VaultKeyConfigurationError('VAULT_KEYS_MISSING');
  let keys;
  try {
    keys = JSON.parse(raw);
  } catch {
    throw new VaultKeyConfigurationError('VAULT_KEYS_INVALID_JSON');
  }
  if (!keys || typeof keys !== 'object' || Array.isArray(keys))
    throw new VaultKeyConfigurationError('VAULT_KEYS_INVALID_JSON');
  return keys;
}
export function readVaultKey(raw, id) {
  if (!/^[a-zA-Z0-9_-]{1,50}$/.test(id))
    throw new VaultKeyConfigurationError('VAULT_KEY_ID_INVALID');
  const keys = parseVaultKeys(raw);
  if (!Object.hasOwn(keys, id))
    throw new VaultKeyConfigurationError('VAULT_ACTIVE_KEY_MISSING');
  const encoded = keys[id];
  if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(encoded))
    throw new VaultKeyConfigurationError('VAULT_KEY_INVALID_BASE64_32_BYTES');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded)
    throw new VaultKeyConfigurationError('VAULT_KEY_INVALID_BASE64_32_BYTES');
  return key;
}
