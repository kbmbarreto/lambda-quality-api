import { pageResult } from '../../../shared/application/records.js';
import type { ListInput } from '../../../shared/application/records.js';
import { listQuery } from '../../workspace/application/access.js';
import type { Actor } from '../../workspace/domain/models.js';
import { Projects } from '../../project/application/projects.js';
import { withInventoryScope } from '../../project/application/inventory-scope.js';
import { defectInventoryFilter } from './inventory-filters.js';
import type { DefectInventoryFilters } from './inventory-filters.js';
import type { Defect } from '../domain/models.js';
export const DEFECT_INVENTORY = Symbol('DefectInventory');
export class DefectInventory {
  constructor(private readonly projects: Projects) {}
  async list(actor: Actor, input: ListInput & DefectInventoryFilters) {
    return withInventoryScope(
      this.projects,
      actor,
      input,
      'defect.read',
      async (tx, scopes) => {
        const byId = new Map(scopes.map((ctx) => [ctx.project.id, ctx]));
        const query = listQuery<Defect>(
          { ...input, sort: input.sort ?? 'createdAt,desc' },
          ['createdAt', 'updatedAt', 'title', 'sequence'],
          'createdAt',
        );
        query.in = { field: 'projectId', values: [...byId.keys()] };
        Object.assign(query, defectInventoryFilter(input));
        const total = await tx.defects.count(query);
        const rows = await tx.defects.list(query);
        return pageResult(
          rows.map((row) => {
            const ctx = byId.get(row.projectId)!;
            return {
              id: row.id,
              workspaceId: row.workspaceId,
              workspaceName: ctx.access.workspace.name,
              projectId: row.projectId,
              projectName: ctx.project.name,
              projectKey: ctx.project.key,
              projectStatus: ctx.project.status,
              sequence: row.sequence,
              humanId: `${ctx.project.key}-DEF-${row.sequence}`,
              title: row.title,
              status: row.status,
              severity: row.severity,
              environmentId: row.environmentId,
              environmentSnapshot: row.environmentSnapshot,
              version: row.version,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              resolvedAt: row.resolvedAt,
            };
          }),
          input,
          total,
        );
      },
      { requireWorkspaceGrant: true },
    );
  }
}
