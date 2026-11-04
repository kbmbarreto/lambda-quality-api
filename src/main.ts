import { createApp } from './app.js';
import { loadConfig } from './shared/config/config.js';
import {
  readVaultKey,
  VaultKeyConfigurationError,
} from '../scripts/vault-keys.mjs';
try {
  const config = loadConfig();
  try {
    readVaultKey(config.testVault?.keys, config.testVault?.activeKeyId || 'v1');
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: 'test_vault.configuration_unavailable',
        reason:
          error instanceof VaultKeyConfigurationError
            ? error.code
            : 'VAULT_CONFIGURATION_ERROR',
        message:
          'O cofre está indisponível. Execute npm run vault:check para conferir a configuração. A API continuará iniciando.',
      }),
    );
  }
  const app = await createApp({ config });
  await app.listen(config.port, config.host);
  console.log(
    JSON.stringify({
      event: 'application.started',
      port: config.port,
      swagger: config.swagger,
    }),
  );
} catch {
  console.error(
    'Não foi possível iniciar a aplicação. Verifique configuração essencial, chaves RS256 e disponibilidade do banco.',
  );
  process.exitCode = 1;
}
