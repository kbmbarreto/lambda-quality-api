import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import { conflict, notFound } from '../../workspace/application/access.js';
export async function executionContext(
  tx: WorkspaceTransaction,
  projectId: string,
  milestoneId: string | null,
  environmentId: string | null,
) {
  const milestone = milestoneId
    ? await tx.milestones.find({ id: milestoneId, projectId, deletedAt: null })
    : null;
  const environment = environmentId
    ? await tx.environments.find({
        id: environmentId,
        projectId,
        deletedAt: null,
      })
    : null;
  if ((milestoneId && !milestone) || (environmentId && !environment))
    throw notFound();
  if (milestone?.status === 'CANCELLED' || (environment && !environment.active))
    conflict(
      'TEST_CONTEXT_UNAVAILABLE',
      'O marco cancelado ou ambiente inativo não pode ser selecionado.',
    );
  return { milestone, environment };
}
