import 'dotenv/config';
import { readVaultKey, VaultKeyConfigurationError } from './vault-keys.mjs';
try {
  readVaultKey(
    process.env.TEST_VAULT_ENCRYPTION_KEYS,
    process.env.TEST_VAULT_ACTIVE_KEY_ID || 'v1',
  );
  console.log(
    'Configuração criptográfica do cofre válida: AES-256, chave Base64 de 32 bytes. Nenhum acesso ao banco.',
  );
} catch (error) {
  const reason =
    error instanceof VaultKeyConfigurationError
      ? error.code
      : 'VAULT_CONFIGURATION_ERROR';
  console.error(
    `Cofre indisponível: ${reason}. Confira TEST_VAULT_ENCRYPTION_KEYS e TEST_VAULT_ACTIVE_KEY_ID; nenhum segredo foi exibido.`,
  );
  process.exitCode = 1;
}
