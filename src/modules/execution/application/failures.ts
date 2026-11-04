import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import { conflict, notFound } from '../../workspace/application/access.js';
export const EXECUTION_FAILURES = Symbol('ExecutionFailures');
// Public transactional read port for defect origins; never changes execution state.
export class ExecutionFailures {
  async environment(
    tx: WorkspaceTransaction,
    projectId: string,
    caseId: string,
  ) {
    const item = await this.find(tx, projectId, caseId);
    const run = await tx.testRuns.find({ id: item.testRunId, projectId });
    if (!run) throw notFound();
    return {
      environmentId: run.environmentId,
      environmentSnapshot: run.environmentSnapshot,
    };
  }
  async find(
    tx: WorkspaceTransaction,
    projectId: string,
    id: string,
    failed = false,
  ) {
    const row = await tx.testRunCases.find({ id, projectId });
    if (!row) throw notFound();
    if (failed && row.result !== 'FAILED')
      conflict(
        'DEFECT_FAILURE_REQUIRED',
        'O caso da execução deve apresentar resultado FAILED.',
      );
    return row;
  }
}
