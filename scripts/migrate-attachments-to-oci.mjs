import { loadConfig } from '../dist/shared/config/config.js';
import { PrismaWorkspaceStore } from '../dist/modules/workspace/infrastructure/prisma-workspace-store.js';
import { LocalStorage } from '../dist/modules/attachment/infrastructure/local-storage.js';
import { OciStorage } from '../dist/modules/attachment/infrastructure/oci-storage.js';
import { migrateLegacyAttachment } from '../dist/modules/attachment/infrastructure/legacy-migration.js';

let store;
let target;
try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply') || args.length > 1)
    throw new Error('Use --apply ou nenhum argumento.');
  const apply = args.includes('--apply');
  const config = loadConfig();
  store = new PrismaWorkspaceStore(config);
  target = new OciStorage(config.objectStorage);
  await target.verifyPrivateBucket();
  const source = new LocalStorage(config.workspace.storageRoot);
  const before = new Date(
    Date.now() - config.workspace.retentionDays * 86400000,
  );
  const counts = { existing: 0, copied: 0, pending: 0 };
  let cursor;
  while (true) {
    const files = await store.client.attachment.findMany({
      where: { OR: [{ deletedAt: null }, { deletedAt: { gte: before } }] },
      select: { id: true, storageKey: true, sizeBytes: true, checksum: true },
      orderBy: { id: 'asc' },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!files.length) break;
    for (const file of files)
      counts[await migrateLegacyAttachment(source, target, file, apply)]++;
    cursor = files.at(-1).id;
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...counts }));
  console.log(
    'Verificação concluída. Os arquivos locais e os metadados foram preservados.',
  );
} catch {
  console.error(
    'Migração interrompida. Verifique configuração OCI, acesso ao banco/arquivos e integridade dos anexos. Reexecutar retoma os objetos já verificados; nenhum arquivo local é removido.',
  );
  process.exitCode = 1;
} finally {
  target?.onModuleDestroy();
  await store?.onModuleDestroy();
}
