import { randomUUID } from 'node:crypto';
import { ApplicationError } from '../../../shared/domain/errors.js';
import { pageResult } from '../../../shared/application/records.js';
import type { ListInput } from '../../../shared/application/records.js';
import type { Actor } from '../../workspace/domain/models.js';
import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import {
  forbidden,
  listQuery,
  notFound,
  conflict,
} from '../../workspace/application/access.js';
import { Projects } from '../../project/application/projects.js';
import type { ProjectContext } from '../../project/application/projects.js';
import { ExecutionFailures } from '../../execution/application/failures.js';
import type { Defect, DefectHistoryEvent } from '../domain/models.js';
import {
  checkDefectVersion,
  validExternalUrl,
  resolutionOnStatusChange,
} from '../domain/rules.js';
export const DEFECTS = Symbol('Defects');
export interface CreateDefectInput {
  environmentId?: string | null;
  title: string;
  description?: string | null;
  severity?: Defect['severity'];
  testRunCaseId?: string | null;
  attachmentIds?: string[];
}
export interface FailureDefectInput extends Omit<
  CreateDefectInput,
  'title' | 'testRunCaseId'
> {
  title?: string;
  testRunCaseId: string;
}
export interface ChangeDefectInput {
  comment?: string;
  environmentId?: string | null;
  version: number;
  title?: string;
  description?: string | null;
  severity?: Defect['severity'];
  status?: Defect['status'];
}
export interface ExternalLinkInput {
  version: number;
  externalSystem: string;
  externalIssueId: string;
  externalUrl: string;
}
export class Defects {
  constructor(
    private readonly projects: Projects,
    private readonly failures: ExecutionFailures,
  ) {}
  async find(
    tx: WorkspaceTransaction,
    projectId: string,
    id: string,
    version?: number,
  ) {
    const row = await tx.defects.find({ id, projectId });
    if (!row) throw notFound();
    if (version !== undefined) checkDefectVersion(row.version, version);
    return row;
  }
  async view(tx: WorkspaceTransaction, ctx: ProjectContext, row: Defect) {
    const attachmentIds: string[] = [];
    for (const link of await tx.defectAttachments.list({
      where: { projectId: row.projectId, defectId: row.id },
    })) {
      if (await tx.attachments.find({ id: link.attachmentId, deletedAt: null }))
        attachmentIds.push(link.attachmentId);
    }
    return {
      ...row,
      humanId: `${ctx.project.key}-DEF-${row.sequence}`,
      testRunId: row.testRunCaseId
        ? (await this.failures.find(tx, row.projectId, row.testRunCaseId))
            .testRunId
        : null,
      attachmentIds,
    };
  }
  private async recordHistory(
    tx: WorkspaceTransaction,
    actor: Actor,
    row: Defect,
    type: DefectHistoryEvent['type'],
    createdAt: Date,
    changes: Pick<DefectHistoryEvent, 'fromStatus' | 'toStatus' | 'comment'> = {
      fromStatus: null,
      toStatus: null,
      comment: null,
    },
  ) {
    const user = (
      await this.projects.access.directory.getUsers([actor.userId])
    )[0];
    await tx.defectHistory.create({
      id: randomUUID(),
      workspaceId: row.workspaceId,
      projectId: row.projectId,
      defectId: row.id,
      type,
      actorUserId: actor.userId,
      actorDisplayName: user?.displayName ?? null,
      createdAt,
      ...changes,
    });
  }
  history(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: ListInput,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'defect.read',
      false,
      async (tx) => {
        await this.find(tx, projectId, id);
        const query = listQuery<DefectHistoryEvent>(
          input,
          ['createdAt'],
          'createdAt',
        );
        query.where = { projectId, defectId: id };
        const rows = await tx.defectHistory.list(query);
        return pageResult(
          rows.map((row) => ({
            id: row.id,
            type: row.type,
            actor: { id: row.actorUserId, displayName: row.actorDisplayName },
            createdAt: row.createdAt,
            fromStatus: row.fromStatus,
            toStatus: row.toStatus,
            comment: row.comment,
          })),
          input,
          await tx.defectHistory.count(query),
        );
      },
    );
  }
  async changed(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    row: Defect,
    action: string,
    event?: Pick<DefectHistoryEvent, 'fromStatus' | 'toStatus' | 'comment'>,
  ) {
    const now = new Date();
    await tx.defects.update(
      { id: row.id, projectId: row.projectId },
      { version: row.version + 1, updatedAt: now },
    );
    await this.recordHistory(tx, actor, row, 'UPDATED', now, event);
    await this.projects.access.audit(
      tx,
      actor,
      ws,
      `defect.${action}`,
      'Defect',
      row.id,
    );
  }
  list(
    actor: Actor,
    ws: string,
    projectId: string,
    input: ListInput & {
      severity?: Defect['severity'];
      testRunCaseId?: string;
      environmentId?: string;
    },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'defect.read',
      false,
      async (tx, ctx) => {
        const query = listQuery<Defect>(
          input,
          ['sequence', 'title', 'createdAt', 'updatedAt'],
          'sequence',
        );
        query.where = { projectId };
        if (input.status && input.status !== 'ALL')
          query.where.status = input.status as Defect['status'];
        if (input.environmentId) {
          if (
            !(await tx.environments.find({
              id: input.environmentId,
              projectId,
            }))
          )
            throw notFound();
          query.where.environmentId = input.environmentId;
        }
        if (input.severity) query.where.severity = input.severity;
        if (input.q) query.search = { fields: ['title'], value: input.q };
        if (input.testRunCaseId) {
          if (!ctx.capabilities.includes('testrun.read')) throw forbidden();
          await this.failures.find(tx, projectId, input.testRunCaseId);
          query.where.testRunCaseId = input.testRunCaseId;
        }
        const items = [];
        for (const row of await tx.defects.list(query))
          items.push(await this.view(tx, ctx, row));
        return pageResult(items, input, await tx.defects.count(query));
      },
    );
  }
  get(actor: Actor, ws: string, projectId: string, id: string) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'defect.read',
      false,
      async (tx, ctx) => this.view(tx, ctx, await this.find(tx, projectId, id)),
    );
  }
  async environment(
    tx: WorkspaceTransaction,
    projectId: string,
    id: string | null,
  ) {
    if (!id) return { environmentId: null, environmentSnapshot: null };
    const env = await tx.environments.find({
      id,
      projectId,
      active: true,
      deletedAt: null,
    });
    if (!env) throw notFound();
    return {
      environmentId: env.id,
      environmentSnapshot: { name: env.name, category: env.category },
    };
  }
  async creationEnvironment(
    tx: WorkspaceTransaction,
    projectId: string,
    input: CreateDefectInput,
  ) {
    if (input.environmentId !== undefined || !input.testRunCaseId)
      return this.environment(tx, projectId, input.environmentId ?? null);
    const origin = await this.failures.environment(
      tx,
      projectId,
      input.testRunCaseId,
    );
    if (!origin.environmentId) return this.environment(tx, projectId, null);
    const env = await tx.environments.find({
      id: origin.environmentId,
      projectId,
    });
    if (!env) throw notFound();
    return {
      environmentId: env.id,
      environmentSnapshot: {
        name: origin.environmentSnapshot?.name ?? env.name,
        category: env.category,
      },
    };
  }
  async insert(
    tx: WorkspaceTransaction,
    ctx: ProjectContext,
    actor: Actor,
    ws: string,
    projectId: string,
    input: CreateDefectInput,
  ) {
    if (input.testRunCaseId) {
      if (!ctx.capabilities.includes('testrun.read')) throw forbidden();
      await this.failures.find(tx, projectId, input.testRunCaseId, true);
    }
    const ids = input.attachmentIds ?? [];
    if (ids.length > 100 || new Set(ids).size !== ids.length)
      throw new ApplicationError(
        400,
        'VALIDATION_ERROR',
        'Informe até 100 anexos distintos.',
      );
    if (ids.length && !ctx.access.permissions.includes('attachment.read'))
      throw forbidden();
    for (const id of ids)
      if (!(await tx.attachments.find({ id, deletedAt: null })))
        throw notFound();
    const environment = await this.creationEnvironment(tx, projectId, input);
    const row = await tx.defects.create({
      ...environment,
      id: randomUUID(),
      workspaceId: ws,
      projectId,
      sequence: await tx.reserveDefectSequence(projectId),
      title: input.title,
      description: input.description ?? null,
      severity: input.severity ?? 'NORMAL',
      status: 'OPEN',
      resolvedAt: null,
      testRunCaseId: input.testRunCaseId ?? null,
      externalSystem: null,
      externalIssueId: null,
      externalUrl: null,
      version: 1,
      createdBy: actor.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    for (const attachmentId of ids)
      await tx.defectAttachments.create({
        id: randomUUID(),
        workspaceId: ws,
        projectId,
        defectId: row.id,
        attachmentId,
      });
    await this.recordHistory(tx, actor, row, 'CREATED', row.createdAt, {
      fromStatus: null,
      toStatus: row.status,
      comment: null,
    });
    await this.projects.access.audit(
      tx,
      actor,
      ws,
      input.testRunCaseId ? 'defect.created_from_failure' : 'defect.created',
      'Defect',
      row.id,
    );
    return this.view(tx, ctx, row);
  }
  create(
    actor: Actor,
    ws: string,
    projectId: string,
    input: CreateDefectInput,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'defect.manage',
      true,
      (tx, ctx) => this.insert(tx, ctx, actor, ws, projectId, input),
    );
  }
  fromFailure(
    actor: Actor,
    ws: string,
    projectId: string,
    input: FailureDefectInput,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'defect.manage',
      true,
      async (tx, ctx) => {
        if (!ctx.capabilities.includes('testrun.read')) throw forbidden();
        const origin = await this.failures.find(
          tx,
          projectId,
          input.testRunCaseId,
          true,
        );
        return this.insert(tx, ctx, actor, ws, projectId, {
          ...input,
          title: input.title ?? origin.titleSnapshot,
          severity: input.severity ?? origin.severitySnapshot,
          description:
            input.description === undefined
              ? origin.comment
              : input.description,
        });
      },
    );
  }
  update(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: ChangeDefectInput,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'defect.manage',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, input.version);
        const { version: _version, comment, ...changes } = input;
        if (
          comment !== undefined &&
          (typeof comment !== 'string' ||
            !comment.trim() ||
            Array.from(comment.trim()).length > 10000)
        )
          throw new ApplicationError(
            400,
            'VALIDATION_ERROR',
            'Informe um comentário entre 1 e 10000 caracteres.',
          );
        const fields = Object.entries(changes).filter(
          ([, v]) => v !== undefined,
        );
        if (!fields.length && comment === undefined)
          throw new ApplicationError(
            400,
            'VALIDATION_ERROR',
            'Informe ao menos um campo para alterar.',
          );
        if (
          comment === undefined &&
          fields.length === 1 &&
          fields[0][0] === 'status' &&
          input.status === row.status
        )
          return this.view(tx, ctx, row);
        const environment =
          input.environmentId !== undefined
            ? await this.environment(tx, projectId, input.environmentId)
            : {};
        await tx.defects.update(
          { id, projectId },
          {
            ...changes,
            ...environment,
            ...(input.status !== undefined
              ? {
                  resolvedAt: resolutionOnStatusChange(
                    row,
                    input.status,
                    new Date(),
                  ),
                }
              : {}),
          },
        );
        await this.changed(
          tx,
          actor,
          ws,
          row,
          input.status !== undefined && input.status !== row.status
            ? 'status_changed'
            : 'updated',
          {
            fromStatus:
              input.status !== undefined && input.status !== row.status
                ? row.status
                : null,
            toStatus:
              input.status !== undefined && input.status !== row.status
                ? input.status
                : null,
            comment: comment?.trim() ?? null,
          },
        );
        return this.view(tx, ctx, await this.find(tx, projectId, id));
      },
    );
  }
  externalLink(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: ExternalLinkInput,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'defect.manage',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, input.version);
        if (!validExternalUrl(input.externalUrl))
          throw new ApplicationError(
            400,
            'DEFECT_EXTERNAL_URL_INVALID',
            'Informe URL HTTP/HTTPS absoluta, sem credenciais.',
          );
        const { version: _version, ...changes } = input;
        await tx.defects.update({ id, projectId }, changes);
        await this.changed(tx, actor, ws, row, 'external_linked');
        return this.view(tx, ctx, await this.find(tx, projectId, id));
      },
    );
  }
  unlinkExternal(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    version: number,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'defect.manage',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, version);
        if (!row.externalSystem) return this.view(tx, ctx, row);
        await tx.defects.update(
          { id, projectId },
          { externalSystem: null, externalIssueId: null, externalUrl: null },
        );
        await this.changed(tx, actor, ws, row, 'external_unlinked');
        return this.view(tx, ctx, await this.find(tx, projectId, id));
      },
    );
  }
  attachment(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    attachmentId: string,
    version: number,
    add: boolean,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'defect.manage',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, version);
        const where = { projectId, defectId: id, attachmentId };
        const link = await tx.defectAttachments.find(where);
        if (add) {
          if (!ctx.access.permissions.includes('attachment.read'))
            throw forbidden();
          if (
            !(await tx.attachments.find({ id: attachmentId, deletedAt: null }))
          )
            throw notFound();
          if (link) return this.view(tx, ctx, row);
          if (
            (await tx.defectAttachments.count({
              where: { projectId, defectId: id },
            })) >= 100
          )
            conflict(
              'DEFECT_ATTACHMENT_LIMIT',
              'O defeito admite até 100 anexos.',
            );
          await tx.defectAttachments.create({
            id: randomUUID(),
            workspaceId: ws,
            projectId,
            defectId: id,
            attachmentId,
          });
        } else {
          if (!link) return this.view(tx, ctx, row);
          await tx.defectAttachments.remove(where);
        }
        await this.changed(
          tx,
          actor,
          ws,
          row,
          add ? 'attachment_added' : 'attachment_removed',
        );
        return this.view(tx, ctx, await this.find(tx, projectId, id));
      },
    );
  }
}
