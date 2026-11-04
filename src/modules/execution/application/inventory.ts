import type { ListInput } from '../../../shared/application/records.js';
import { pageResult } from '../../../shared/application/records.js';
import { listQuery } from '../../workspace/application/access.js';
import type { Actor } from '../../workspace/domain/models.js';
import { Projects } from '../../project/application/projects.js';
import { withInventoryScope } from '../../project/application/inventory-scope.js';
import type { TestRun } from '../domain/models.js';
export const RUN_INVENTORY = Symbol('RunInventory');
export class RunInventory {
  constructor(private readonly projects: Projects) {}
  list(
    actor: Actor,
    input: ListInput & { workspaceId?: string; projectId?: string },
  ) {
    return withInventoryScope(
      this.projects,
      actor,
      input,
      'testrun.read',
      async (tx, contexts) => {
        const byId = new Map(contexts.map((ctx) => [ctx.project.id, ctx]));
        const query = listQuery<TestRun>(
          { ...input, sort: input.sort ?? 'createdAt,desc' },
          ['name', 'createdAt', 'startedAt', 'finishedAt'],
          'createdAt',
        );
        query.in = { field: 'projectId', values: [...byId.keys()] };
        if (input.status && input.status !== 'ALL')
          query.where = { status: input.status as TestRun['status'] };
        if (input.q) query.search = { fields: ['name'], value: input.q };
        const total = await tx.testRuns.count(query);
        const rows = await tx.testRuns.list(query);
        const counts = await tx.summarizeRuns(rows.map((r) => r.id));
        const keys = {
          NOT_TESTED: 'notTested',
          PASSED: 'passed',
          FAILED: 'failed',
          BLOCKED: 'blocked',
          SKIPPED: 'skipped',
        } as const;
        return pageResult(
          rows.map((row) => {
            const ctx = byId.get(row.projectId)!;
            const summary = {
              total: 0,
              notTested: 0,
              passed: 0,
              failed: 0,
              blocked: 0,
              skipped: 0,
            };
            for (const count of counts.filter((c) => c.testRunId === row.id)) {
              summary.total += count.total;
              summary[keys[count.result]] = count.total;
            }
            return {
              ...row,
              workspaceName: ctx.access.workspace.name,
              projectName: ctx.project.name,
              projectKey: ctx.project.key,
              projectStatus: ctx.project.status,
              summary,
            };
          }),
          input,
          total,
        );
      },
    );
  }
}
