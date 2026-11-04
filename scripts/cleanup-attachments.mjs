import { loadConfig } from '../dist/shared/config/config.js';
import { PrismaWorkspaceStore } from '../dist/modules/workspace/infrastructure/prisma-workspace-store.js';
import { WorkspaceAccess } from '../dist/modules/workspace/application/access.js';
import { PrismaDirectory } from '../dist/modules/identity/infrastructure/prisma-directory.js';
import { OciStorage } from '../dist/modules/attachment/infrastructure/oci-storage.js';
import { Attachments } from '../dist/modules/attachment/application/attachments.js';
let store;
let storage;
try {
  const config = loadConfig();
  store = new PrismaWorkspaceStore(config);
  storage = new OciStorage(config.objectStorage);
  await storage.verifyPrivateBucket();
  const access = new WorkspaceAccess(store, new PrismaDirectory(store.client));
  const files = new Attachments(access, storage, config.workspace.maxFileBytes);
  await files.cleanup(config.workspace.retentionDays);
  console.log('Limpeza de anexos excluídos e uploads órfãos concluída.');
} catch {
  console.error('Não foi possível concluir a limpeza de anexos.');
  process.exitCode = 1;
} finally {
  storage?.onModuleDestroy();
  await store?.onModuleDestroy();
}
