import type { ListInput } from '../../../shared/application/records.js';
import { pageResult } from '../../../shared/application/records.js';
import { listQuery } from '../../workspace/application/access.js';
import type { Actor } from '../../workspace/domain/models.js';
import { Projects } from '../../project/application/projects.js';
import type { Project } from '../../project/domain/models.js';
import { withInventoryScope } from '../../project/application/inventory-scope.js';
import { percentage } from './overview.js';
export const DASHBOARD_PROJECTS = Symbol('DashboardProjects');
export class DashboardProjects {
  constructor(private readonly projects: Projects) {}
  list(actor: Actor, input: ListInput & { workspaceId?: string }) {
    return withInventoryScope(
      this.projects,
      actor,
      input,
      'project.read',
      async (tx, contexts) => {
        const byId = new Map(contexts.map((ctx) => [ctx.project.id, ctx]));
        const query = listQuery<Project>(
          input,
          ['name', 'key', 'createdAt'],
          'name',
        );
        query.in = { field: 'id', values: [...byId.keys()] };
        if (input.status !== 'ALL')
          query.where = {
            status: (input.status || 'ACTIVE') as Project['status'],
          };
        if (input.q) query.search = { fields: ['name', 'key'], value: input.q };
        const total = await tx.projects.count(query);
        const rows = await tx.projects.list(query);
        const readable = rows
          .filter((row) =>
            byId.get(row.id)!.capabilities.includes('testcase.read'),
          )
          .map((row) => row.id);
        const counts = new Map(
          (await tx.summarizeAutomation(readable)).map((c) => [c.projectId, c]),
        );
        return pageResult(
          rows.map((row) => {
            const ctx = byId.get(row.id)!;
            const allowed = readable.includes(row.id);
            const count = counts.get(row.id) || { active: 0, automated: 0 };
            return {
              id: row.id,
              workspaceId: row.workspaceId,
              workspaceName: ctx.access.workspace.name,
              name: row.name,
              key: row.key,
              status: row.status,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              permissions: ctx.capabilities,
              activeTestCases: allowed ? count.active : null,
              automatedTestCases: allowed ? count.automated : null,
              automationCoverage: allowed
                ? percentage(count.automated, count.active)
                : null,
            };
          }),
          input,
          total,
        );
      },
    );
  }
}
