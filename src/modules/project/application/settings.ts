import { randomUUID } from 'node:crypto';
import { pageResult } from '../../../shared/application/records.js';
import type { ListInput } from '../../../shared/application/records.js';
import {
  conflict,
  listQuery,
  notFound,
} from '../../workspace/application/access.js';
import { normalizeName } from '../../workspace/domain/models.js';
import type { Actor } from '../../workspace/domain/models.js';
import type { Milestone, Environment } from '../domain/models.js';
import { Projects } from './projects.js';
import { ApplicationError } from '../../../shared/domain/errors.js';
export const PROJECT_SETTINGS = Symbol('ProjectSettings');
export interface MilestoneInput {
  name: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}
export interface EnvironmentInput {
  category?: Environment['category'];
  name: string;
  description?: string | null;
  active: boolean;
}
const environmentView = ({
  normalizedName: _normalized,
  ...row
}: Environment) => row;
export function validateDates(start: string | null, due: string | null) {
  for (const value of [start, due])
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value ||
        value < '1000-01-01')
    )
      throw new ApplicationError(
        400,
        'VALIDATION_ERROR',
        'Informe datas de calendário válidas entre 1000 e 9999.',
      );
  if (start && due && start > due)
    throw new ApplicationError(
      400,
      'VALIDATION_ERROR',
      'A data inicial não pode ser posterior ao prazo.',
    );
}
export class ProjectSettings {
  constructor(private readonly projects: Projects) {}
  milestones(actor: Actor, ws: string, projectId: string, input: ListInput) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'project.read',
      false,
      async (tx) => {
        const query = listQuery<Milestone>(
          input,
          ['name', 'createdAt', 'dueDate'],
          'createdAt',
        );
        query.where = { projectId, deletedAt: null };
        if (input.status && input.status !== 'ALL')
          query.where.status = input.status as Milestone['status'];
        if (input.q) query.search = { fields: ['name'], value: input.q };
        return pageResult(
          await tx.milestones.list(query),
          input,
          await tx.milestones.count(query),
        );
      },
    );
  }
  milestone(actor: Actor, ws: string, projectId: string, id: string) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'project.read',
      false,
      async (tx) => {
        const row = await tx.milestones.find({
          id,
          projectId,
          deletedAt: null,
        });
        if (!row) throw notFound();
        return row;
      },
    );
  }
  createMilestone(
    actor: Actor,
    ws: string,
    projectId: string,
    input: MilestoneInput,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'milestone.manage',
      true,
      async (tx) => {
        validateDates(input.startDate ?? null, input.dueDate ?? null);
        const row = await tx.milestones.create({
          id: randomUUID(),
          workspaceId: ws,
          projectId,
          name: input.name,
          description: input.description ?? null,
          startDate: input.startDate ?? null,
          dueDate: input.dueDate ?? null,
          status: 'PLANNED',
          completedAt: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await this.projects.access.audit(
          tx,
          actor,
          ws,
          'project.milestone_created',
          'Milestone',
          row.id,
        );
        return row;
      },
    );
  }
  updateMilestone(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: Partial<MilestoneInput> & {
      status?: Exclude<Milestone['status'], 'COMPLETED'>;
    },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'milestone.manage',
      true,
      async (tx) => {
        const row = await tx.milestones.find({
          id,
          projectId,
          deletedAt: null,
        });
        if (!row) throw notFound();
        if (row.status === 'COMPLETED')
          conflict(
            'MILESTONE_COMPLETED',
            'O marco concluído não pode ser alterado.',
          );
        validateDates(
          input.startDate === undefined ? row.startDate : input.startDate,
          input.dueDate === undefined ? row.dueDate : input.dueDate,
        );
        await tx.milestones.update(
          { id, projectId },
          { ...input, updatedAt: new Date() },
        );
        await this.projects.access.audit(
          tx,
          actor,
          ws,
          'project.milestone_updated',
          'Milestone',
          id,
        );
        return tx.milestones.find({ id, projectId });
      },
    );
  }
  completeMilestone(actor: Actor, ws: string, projectId: string, id: string) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'milestone.manage',
      true,
      async (tx) => {
        const row = await tx.milestones.find({
          id,
          projectId,
          deletedAt: null,
        });
        if (!row) throw notFound();
        if (row.status === 'CANCELLED')
          conflict(
            'MILESTONE_CANCELLED',
            'O marco cancelado não pode ser concluído.',
          );
        if (row.status !== 'COMPLETED') {
          await tx.milestones.update(
            { id, projectId },
            {
              status: 'COMPLETED',
              completedAt: new Date(),
              updatedAt: new Date(),
            },
          );
          await this.projects.access.audit(
            tx,
            actor,
            ws,
            'project.milestone_completed',
            'Milestone',
            id,
          );
        }
        return tx.milestones.find({ id, projectId });
      },
    );
  }
  removeMilestone(actor: Actor, ws: string, projectId: string, id: string) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'milestone.manage',
      true,
      async (tx) => {
        const row = await tx.milestones.find({ id, projectId });
        if (!row) throw notFound();
        if (!row.deletedAt) {
          await tx.milestones.update(
            { id, projectId },
            { deletedAt: new Date(), updatedAt: new Date() },
          );
          await this.projects.access.audit(
            tx,
            actor,
            ws,
            'project.milestone_deleted',
            'Milestone',
            id,
          );
        }
      },
    );
  }
  environments(
    actor: Actor,
    ws: string,
    projectId: string,
    input: ListInput & { active?: boolean },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'project.read',
      false,
      async (tx) => {
        const query = listQuery<Environment>(
          input,
          ['name', 'createdAt'],
          'name',
        );
        query.where = { projectId, deletedAt: null };
        if (input.active !== undefined) query.where.active = input.active;
        if (input.q) query.search = { fields: ['name'], value: input.q };
        return pageResult(
          (await tx.environments.list(query)).map(environmentView),
          input,
          await tx.environments.count(query),
        );
      },
    );
  }
  environment(actor: Actor, ws: string, projectId: string, id: string) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'project.read',
      false,
      async (tx) => {
        const row = await tx.environments.find({
          id,
          projectId,
          deletedAt: null,
        });
        if (!row) throw notFound();
        return environmentView(row);
      },
    );
  }
  createEnvironment(
    actor: Actor,
    ws: string,
    projectId: string,
    input: EnvironmentInput,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'environment.manage',
      true,
      async (tx) => {
        const row = await tx.environments.create({
          id: randomUUID(),
          workspaceId: ws,
          projectId,
          name: input.name,
          normalizedName: normalizeName(input.name),
          description: input.description ?? null,
          active: input.active,
          category: input.category ?? 'OTHER',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        });
        await this.projects.access.audit(
          tx,
          actor,
          ws,
          'project.environment_created',
          'Environment',
          row.id,
        );
        return environmentView(row);
      },
    );
  }
  updateEnvironment(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: Partial<EnvironmentInput>,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'environment.manage',
      true,
      async (tx) => {
        const row = await tx.environments.find({
          id,
          projectId,
          deletedAt: null,
        });
        if (!row) throw notFound();
        await tx.environments.update(
          { id, projectId },
          {
            ...input,
            ...(input.name
              ? { normalizedName: normalizeName(input.name) }
              : {}),
            updatedAt: new Date(),
          },
        );
        await this.projects.access.audit(
          tx,
          actor,
          ws,
          'project.environment_updated',
          'Environment',
          id,
        );
        return environmentView(
          (await tx.environments.find({ id, projectId }))!,
        );
      },
    );
  }
  removeEnvironment(actor: Actor, ws: string, projectId: string, id: string) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'environment.manage',
      true,
      async (tx) => {
        const row = await tx.environments.find({ id, projectId });
        if (!row) throw notFound();
        if (!row.deletedAt) {
          await tx.environments.update(
            { id, projectId },
            { deletedAt: new Date(), active: false, updatedAt: new Date() },
          );
          await this.projects.access.audit(
            tx,
            actor,
            ws,
            'project.environment_deleted',
            'Environment',
            id,
          );
        }
      },
    );
  }
}
