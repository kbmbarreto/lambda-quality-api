import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
/** Public transactional read port; caller must authorize each Project first. */
export class CriticalDefectMetrics {
  async read(tx: WorkspaceTransaction, projectId: string) {
    let count = 0;
    for (const severity of ['CRITICAL', 'BLOCKER'] as const)
      for (const status of ['OPEN', 'IN_PROGRESS'] as const)
        count += await tx.defects.count({
          where: { projectId, severity, status },
        });
    return count;
  }
}
