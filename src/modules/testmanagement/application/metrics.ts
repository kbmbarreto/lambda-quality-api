import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
/** Public transactional read port; caller must authorize each Project first. */
export class AutomationMetrics {
  async read(tx: WorkspaceTransaction, projectId: string) {
    const denominator = await tx.testCases.count({
      where: { projectId, status: 'ACTIVE' },
    });
    const numerator = await tx.testCases.count({
      where: { projectId, status: 'ACTIVE', automationStatus: 'AUTOMATED' },
    });
    return { numerator, denominator };
  }
}
