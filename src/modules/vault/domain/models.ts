export interface VaultEntry {
  id: string;
  workspaceId: string;
  projectId: string;
  environmentId: string | null;
  name: string;
  encryptedPayload: string;
  keyId: string;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
export interface VaultSecret {
  username: string;
  password: string;
  url: string | null;
  notes: string | null;
}
export interface VaultContext {
  workspaceId: string;
  projectId: string;
  id: string;
}
export interface VaultCipher {
  encrypt(
    secret: VaultSecret,
    context: VaultContext,
  ): { encryptedPayload: string; keyId: string };
  decrypt(entry: VaultEntry): VaultSecret;
}
