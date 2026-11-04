import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import { notFound } from '../../workspace/application/access.js';
/** Private attachment metadata, intentionally without storageKey or download URL. */
export class EvidenceAttachments {
  async snapshot(tx: WorkspaceTransaction, id: string) {
    const row = await tx.attachments.find({ id, deletedAt: null });
    if (!row) throw notFound();
    return {
      originalName: row.originalName,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      checksum: row.checksum,
    };
  }
  async available(tx: WorkspaceTransaction, id: string) {
    return !!(await tx.attachments.find({ id, deletedAt: null }));
  }
}
