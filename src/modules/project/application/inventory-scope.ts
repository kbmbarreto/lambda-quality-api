import { ApplicationError } from '../../../shared/domain/errors.js';
import { notFound } from '../../workspace/application/access.js';
import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import type { Actor, PermissionCode } from '../../workspace/domain/models.js';
import { Projects } from './projects.js';
import type { ProjectContext } from './projects.js';

/** Authorization, filtering, count and page share locks with tenant mutations. */
export async function withInventoryScope<T>(
  projects: Projects,
  actor: Actor,
  input: { workspaceId?: string; projectId?: string },
  permission: PermissionCode,
  work: (tx: WorkspaceTransaction, contexts: ProjectContext[]) => Promise<T>,
  options: { requireWorkspaceGrant?: boolean } = {},
): Promise<T> {
  const ids = input.workspaceId
    ? [input.workspaceId]
    : (await projects.access.store.visibleWorkspaces(actor.userId)).map(
        (ws) => ws.id,
      );
  return projects.access.store.inventory(ids, async (tx) => {
    const contexts: ProjectContext[] = [];
    for (const id of [...new Set(ids)].sort()) {
      try {
        const scoped = tx.inWorkspace(id);
        const access = await projects.access.resolve(scoped, id, actor);
        if (
          input.workspaceId &&
          options.requireWorkspaceGrant &&
          !access.permissions.includes(permission)
        )
          throw notFound();
        contexts.push(
          ...(await projects.visibleContexts(scoped, access)).filter(
            (ctx) =>
              ctx.capabilities.includes(permission) &&
              (!input.projectId || ctx.project.id === input.projectId),
          ),
        );
      } catch (error) {
        if (
          input.workspaceId ||
          !(error instanceof ApplicationError) ||
          error.status !== 404
        )
          throw error;
      }
    }
    if (input.projectId && !contexts.length) throw notFound();
    return work(tx, contexts);
  });
}
