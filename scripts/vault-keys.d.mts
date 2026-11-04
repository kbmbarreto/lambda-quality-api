export class VaultKeyConfigurationError extends Error {
  code: string;
}
export function parseVaultKeys(raw?: string): Record<string, unknown>;
export function readVaultKey(raw: string | undefined, id: string): Buffer;
