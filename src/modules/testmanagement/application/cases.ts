import { randomUUID } from 'node:crypto';
import type { Actor } from '../../workspace/domain/models.js';
import type {
  ListInput,
  Records,
} from '../../../shared/application/records.js';
import { pageResult } from '../../../shared/application/records.js';
import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import {
  conflict,
  forbidden,
  listQuery,
  notFound,
} from '../../workspace/application/access.js';
import { Projects } from '../../project/application/projects.js';
import type { ProjectContext } from '../../project/application/projects.js';
import type { TestCase, FieldValueInput } from '../domain/models.js';
import { exactOrder, invalid, validateFieldValues } from '../domain/rules.js';
export const TEST_CASES = Symbol('TestCases');
export type CaseDefinition = Pick<
  TestCase,
  | 'title'
  | 'description'
  | 'preconditions'
  | 'postconditions'
  | 'severity'
  | 'priority'
  | 'status'
  | 'type'
  | 'layer'
  | 'behavior'
  | 'automationStatus'
>;
export interface StepInput {
  action: string;
  testData?: string | null;
  expectedResult?: string | null;
}
export interface CreateCaseInput extends Omit<CaseDefinition, 'status'> {
  status: Exclude<TestCase['status'], 'ARCHIVED'>;
  suiteId?: string | null;
  steps?: StepInput[];
  tagIds?: string[];
  attachmentIds?: string[];
  customFields?: FieldValueInput[];
}
export interface ChangeCaseInput extends Partial<
  Omit<CaseDefinition, 'status'>
> {
  version: number;
  status?: Exclude<TestCase['status'], 'ARCHIVED'>;
  customFields?: FieldValueInput[];
}
export class TestCases {
  constructor(private readonly projects: Projects) {}
  async find(
    tx: WorkspaceTransaction,
    projectId: string,
    id: string,
    version?: number,
    write = false,
  ) {
    const row = await tx.testCases.find({ projectId, id });
    if (!row) throw notFound();
    if (version !== undefined && row.version !== version)
      conflict(
        'TEST_CASE_VERSION_CONFLICT',
        'O caso foi alterado. Consulte a versão atual antes de tentar novamente.',
      );
    if (write && row.archivedAt)
      conflict(
        'TEST_CASE_ARCHIVED',
        'O caso está arquivado e não permite alterações.',
      );
    return row;
  }
  async suite(tx: WorkspaceTransaction, projectId: string, id: string | null) {
    if (id && !(await tx.testSuites.find({ id, projectId, archivedAt: null })))
      throw notFound();
  }
  async view(tx: WorkspaceTransaction, ctx: ProjectContext, row: TestCase) {
    const where = { projectId: row.projectId, testCaseId: row.id };
    const links = await tx.testCaseAttachments.list({ where });
    const attachmentIds = [];
    for (const link of links)
      if (await tx.attachments.find({ id: link.attachmentId, deletedAt: null }))
        attachmentIds.push(link.attachmentId);
    return {
      ...row,
      humanId: `${ctx.project.key}-${row.sequence}`,
      steps: await tx.testSteps.list({
        where,
        order: { field: 'position', direction: 'asc' },
      }),
      tagIds: (await tx.testCaseTags.list({ where })).map((t) => t.tagId),
      attachmentIds,
      customFields: (await tx.testCaseFieldValues.list({ where })).map((v) => ({
        fieldId: v.fieldId,
        value: v.value,
      })),
    };
  }
  async values(
    tx: WorkspaceTransaction,
    projectId: string,
    id: string,
    input: FieldValueInput[] | undefined,
    replace = false,
  ) {
    const definitions = await tx.fields.list({
      where: { target: 'TEST_CASE' },
    });
    const current = await tx.testCaseFieldValues.list({
      where: { projectId, testCaseId: id },
    });
    const activeIds = new Set(
      definitions.filter((d) => !d.archivedAt).map((d) => d.id),
    );
    let merged = current
      .filter((v) => activeIds.has(v.fieldId))
      .map((v) => ({ fieldId: v.fieldId, value: v.value }));
    if (input) {
      if (new Set(input.map((v) => v.fieldId)).size !== input.length)
        invalid(
          'Não repita campos personalizados.',
          'CUSTOM_FIELD_VALUE_INVALID',
        );
      if (replace) merged = [];
      merged = merged.filter(
        (v) => !input.some((e) => e.fieldId === v.fieldId),
      );
    }
    const final: FieldValueInput[] = [...merged, ...(input ?? [])];
    validateFieldValues(definitions, final);
    if (input) {
      for (const value of current.filter((v) => activeIds.has(v.fieldId)))
        await tx.testCaseFieldValues.remove({
          id: value.id,
          projectId,
          testCaseId: id,
        });
      for (const entry of final.filter((v) => v.value !== null))
        await tx.testCaseFieldValues.create({
          id: randomUUID(),
          workspaceId: definitions.find((d) => d.id === entry.fieldId)!
            .workspaceId,
          projectId,
          testCaseId: id,
          fieldId: entry.fieldId,
          value: entry.value!,
        });
    }
  }
  async changed(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    row: TestCase,
    action: string,
  ) {
    await tx.testCases.update(
      { id: row.id, projectId: row.projectId },
      { version: row.version + 1, updatedAt: new Date() },
    );
    await this.projects.access.audit(
      tx,
      actor,
      ws,
      `test.case_${action}`,
      'TestCase',
      row.id,
    );
  }
  list(
    actor: Actor,
    ws: string,
    projectId: string,
    input: ListInput & {
      suiteId?: string;
      root?: boolean;
      tagId?: string;
      priority?: TestCase['priority'];
      automationStatus?: TestCase['automationStatus'];
    },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.read',
      false,
      async (tx, ctx) => {
        const query = listQuery<TestCase>(
          input,
          ['sequence', 'title', 'createdAt', 'updatedAt'],
          'sequence',
        );
        query.where = { projectId };
        if (input.status && input.status !== 'ALL')
          query.where.status = input.status as TestCase['status'];
        else if (input.status !== 'ALL') query.where.archivedAt = null;
        if (input.suiteId && input.root)
          invalid('Use suiteId ou root, sem combinar ambos.');
        if (input.suiteId) {
          if (!(await tx.testSuites.find({ id: input.suiteId, projectId })))
            throw notFound();
          query.where.suiteId = input.suiteId;
        }
        if (input.root) query.where.suiteId = null;
        if (input.priority) query.where.priority = input.priority;
        if (input.automationStatus)
          query.where.automationStatus = input.automationStatus;
        if (input.q) query.search = { fields: ['title'], value: input.q };
        if (input.tagId) {
          if (!(await tx.tags.find({ id: input.tagId }))) throw notFound();
          query.in = {
            field: 'id',
            values: (
              await tx.testCaseTags.list({
                where: { projectId, tagId: input.tagId },
              })
            ).map((v) => v.testCaseId),
          };
        }
        const rows = await tx.testCases.list(query);
        const items = [];
        for (const row of rows) items.push(await this.view(tx, ctx, row));
        return pageResult(items, input, await tx.testCases.count(query));
      },
    );
  }
  summary(
    actor: Actor,
    ws: string,
    projectId: string,
    input: { status?: TestCase['status'] | 'ALL' },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.read',
      false,
      (tx) => tx.summarizeTestCases(projectId, input.status),
    );
  }
  get(actor: Actor, ws: string, projectId: string, id: string) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.read',
      false,
      async (tx, ctx) => this.view(tx, ctx, await this.find(tx, projectId, id)),
    );
  }
  async insert(
    tx: WorkspaceTransaction,
    ctx: ProjectContext,
    actor: Actor,
    ws: string,
    projectId: string,
    input: CreateCaseInput,
  ) {
    await this.suite(tx, projectId, input.suiteId ?? null);
    const {
      steps = [],
      tagIds = [],
      attachmentIds = [],
      customFields = [],
      suiteId = null,
      ...definition
    } = input;
    if (steps.length > 1000) invalid('O caso admite até 1000 passos.');
    if (
      new Set(tagIds).size !== tagIds.length ||
      new Set(attachmentIds).size !== attachmentIds.length
    )
      invalid('Não repita tags ou anexos.');
    if (
      attachmentIds.length &&
      !ctx.access.permissions.includes('attachment.read')
    )
      throw forbidden();
    const row = await tx.testCases.create({
      id: randomUUID(),
      workspaceId: ws,
      projectId,
      suiteId,
      sequence: await tx.reserveCaseSequence(projectId),
      ...definition,
      createdBy: actor.userId,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
    });
    await this.values(tx, projectId, row.id, customFields, true);
    for (const [i, step] of steps.entries())
      await tx.testSteps.create({
        id: randomUUID(),
        workspaceId: ws,
        projectId,
        testCaseId: row.id,
        position: i + 1,
        action: step.action,
        testData: step.testData ?? null,
        expectedResult: step.expectedResult ?? null,
      });
    for (const tagId of tagIds) {
      if (!(await tx.tags.find({ id: tagId }))) throw notFound();
      await tx.testCaseTags.create({
        id: randomUUID(),
        workspaceId: ws,
        projectId,
        testCaseId: row.id,
        tagId,
      });
    }
    for (const attachmentId of attachmentIds) {
      if (!(await tx.attachments.find({ id: attachmentId, deletedAt: null })))
        throw notFound();
      await tx.testCaseAttachments.create({
        id: randomUUID(),
        workspaceId: ws,
        projectId,
        testCaseId: row.id,
        attachmentId,
      });
    }
    return row;
  }
  create(actor: Actor, ws: string, projectId: string, input: CreateCaseInput) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.create',
      true,
      async (tx, ctx) => {
        const row = await this.insert(tx, ctx, actor, ws, projectId, input);
        await this.projects.access.audit(
          tx,
          actor,
          ws,
          'test.case_created',
          'TestCase',
          row.id,
        );
        return this.view(tx, ctx, row);
      },
    );
  }
  update(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: ChangeCaseInput,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.update',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, input.version, true);
        await this.values(tx, projectId, id, input.customFields);
        const { version: _version, customFields: _fields, ...changes } = input;
        await tx.testCases.update({ id, projectId }, changes);
        await this.changed(tx, actor, ws, row, 'updated');
        return this.view(tx, ctx, await this.find(tx, projectId, id));
      },
    );
  }
  move(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: { version: number; suiteId: string | null },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.update',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, input.version, true);
        await this.suite(tx, projectId, input.suiteId);
        await tx.testCases.update(
          { id, projectId },
          { suiteId: input.suiteId },
        );
        await this.changed(tx, actor, ws, row, 'moved');
        return this.view(tx, ctx, await this.find(tx, projectId, id));
      },
    );
  }
  clone(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: { title?: string; suiteId?: string | null },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.create',
      true,
      async (tx, ctx) => {
        if (!ctx.capabilities.includes('testcase.read')) throw forbidden();
        const source = await this.view(
          tx,
          ctx,
          await this.find(tx, projectId, id),
        );
        const fields = await tx.fields.list({
          where: { archivedAt: null, target: 'TEST_CASE' },
        });
        const row = await this.insert(tx, ctx, actor, ws, projectId, {
          title: input.title ?? source.title,
          description: source.description,
          preconditions: source.preconditions,
          postconditions: source.postconditions,
          severity: source.severity,
          priority: source.priority,
          status: 'DRAFT',
          type: source.type,
          layer: source.layer,
          behavior: source.behavior,
          automationStatus: source.automationStatus,
          suiteId: input.suiteId === undefined ? source.suiteId : input.suiteId,
          steps: source.steps.map((s) => ({
            action: s.action,
            testData: s.testData,
            expectedResult: s.expectedResult,
          })),
          tagIds: source.tagIds,
          attachmentIds: source.attachmentIds,
          customFields: source.customFields.filter((v) =>
            fields.some((f) => f.id === v.fieldId),
          ),
        });
        await this.projects.access.audit(
          tx,
          actor,
          ws,
          'test.case_cloned',
          'TestCase',
          row.id,
        );
        return this.view(tx, ctx, row);
      },
    );
  }
  archive(
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
      'testcase.archive',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, version);
        if (!row.archivedAt) {
          await tx.testCases.update(
            { id, projectId },
            { status: 'ARCHIVED', archivedAt: new Date() },
          );
          await this.changed(tx, actor, ws, row, 'archived');
        }
        return this.view(tx, ctx, await this.find(tx, projectId, id));
      },
    );
  }
  restore(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: {
      version: number;
      status: Exclude<TestCase['status'], 'ARCHIVED'>;
      suiteId?: string | null;
      customFields?: FieldValueInput[];
    },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.archive',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, input.version);
        if (!row.archivedAt)
          conflict('TEST_CASE_NOT_ARCHIVED', 'O caso não está arquivado.');
        const suiteId =
          input.suiteId === undefined ? row.suiteId : input.suiteId;
        await this.suite(tx, projectId, suiteId);
        await this.values(tx, projectId, id, input.customFields);
        await tx.testCases.update(
          { id, projectId },
          { suiteId, status: input.status, archivedAt: null },
        );
        await this.changed(tx, actor, ws, row, 'restored');
        return this.view(tx, ctx, await this.find(tx, projectId, id));
      },
    );
  }
  steps(actor: Actor, ws: string, projectId: string, id: string) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.read',
      false,
      async (tx) => {
        await this.find(tx, projectId, id);
        return tx.testSteps.list({
          where: { projectId, testCaseId: id },
          order: { field: 'position', direction: 'asc' },
        });
      },
    );
  }
  private async stepOrder(
    tx: WorkspaceTransaction,
    projectId: string,
    testCaseId: string,
    ids: string[],
  ) {
    // Positions above the current maximum avoid unique conflicts during swaps.
    const current = await tx.testSteps.list({
      where: { projectId, testCaseId },
    });
    const offset = Math.max(0, ...current.map((s) => s.position)) + 1;
    for (const [i, id] of ids.entries())
      await tx.testSteps.update(
        { id, projectId, testCaseId },
        { position: offset + i },
      );
    for (const [i, id] of ids.entries())
      await tx.testSteps.update(
        { id, projectId, testCaseId },
        { position: i + 1 },
      );
  }
  addStep(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: StepInput & { version: number; position?: number },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.update',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, input.version, true);
        const steps = await tx.testSteps.list({
          where: { projectId, testCaseId: id },
          order: { field: 'position', direction: 'asc' },
        });
        const position = input.position ?? steps.length + 1;
        if (steps.length >= 1000 || position < 1 || position > steps.length + 1)
          invalid(
            'Posição inválida ou limite de 1000 passos atingido.',
            'TEST_ORDER_INVALID',
          );
        const step = await tx.testSteps.create({
          id: randomUUID(),
          workspaceId: ws,
          projectId,
          testCaseId: id,
          position: steps.length + 1,
          action: input.action,
          testData: input.testData ?? null,
          expectedResult: input.expectedResult ?? null,
        });
        const ids = steps.map((s) => s.id);
        ids.splice(position - 1, 0, step.id);
        await this.stepOrder(tx, projectId, id, ids);
        await this.changed(tx, actor, ws, row, 'step_added');
        return this.view(tx, ctx, await this.find(tx, projectId, id));
      },
    );
  }
  updateStep(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    stepId: string,
    input: Partial<StepInput> & { version: number },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.update',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, input.version, true);
        if (
          !(await tx.testSteps.find({ id: stepId, projectId, testCaseId: id }))
        )
          throw notFound();
        const { version: _version, ...changes } = input;
        await tx.testSteps.update(
          { id: stepId, projectId, testCaseId: id },
          changes,
        );
        await this.changed(tx, actor, ws, row, 'step_updated');
        return this.view(tx, ctx, await this.find(tx, projectId, id));
      },
    );
  }
  removeStep(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    stepId: string,
    version: number,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.update',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, version, true);
        if (
          !(await tx.testSteps.find({ id: stepId, projectId, testCaseId: id }))
        )
          throw notFound();
        await tx.testSteps.remove({ id: stepId, projectId, testCaseId: id });
        await this.stepOrder(
          tx,
          projectId,
          id,
          (
            await tx.testSteps.list({
              where: { projectId, testCaseId: id },
              order: { field: 'position', direction: 'asc' },
            })
          ).map((s) => s.id),
        );
        await this.changed(tx, actor, ws, row, 'step_removed');
        return this.view(tx, ctx, await this.find(tx, projectId, id));
      },
    );
  }
  reorderSteps(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: { version: number; ids: string[] },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.update',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, input.version, true);
        exactOrder(
          (
            await tx.testSteps.list({ where: { projectId, testCaseId: id } })
          ).map((s) => s.id),
          input.ids,
        );
        await this.stepOrder(tx, projectId, id, input.ids);
        await this.changed(tx, actor, ws, row, 'steps_reordered');
        return this.view(tx, ctx, await this.find(tx, projectId, id));
      },
    );
  }
  link(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    targetId: string,
    version: number,
    kind: 'tag' | 'attachment',
    remove = false,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.update',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, version, true);
        if (
          kind === 'attachment' &&
          !ctx.access.permissions.includes('attachment.read')
        )
          throw forbidden();
        if (
          kind === 'tag'
            ? !(await tx.tags.find({ id: targetId }))
            : !(await tx.attachments.find({
                id: targetId,
                ...(remove ? {} : { deletedAt: null }),
              }))
        )
          throw notFound();
        // Both link kinds share the same tenant/project/case identity.
        const repo = (
          kind === 'tag' ? tx.testCaseTags : tx.testCaseAttachments
        ) as Records<{
          id: string;
          workspaceId: string;
          projectId: string;
          testCaseId: string;
          tagId?: string;
          attachmentId?: string;
        }>;
        const where = {
          projectId,
          testCaseId: id,
          [kind === 'tag' ? 'tagId' : 'attachmentId']: targetId,
        };
        const existing = await repo.find(where);
        if (remove ? !!existing : !existing) {
          if (remove) await repo.remove(where);
          else
            await repo.create({ id: randomUUID(), workspaceId: ws, ...where });
          await this.changed(
            tx,
            actor,
            ws,
            row,
            `${kind}_${remove ? 'unlinked' : 'linked'}`,
          );
        }
        return this.view(tx, ctx, await this.find(tx, projectId, id));
      },
    );
  }
  putValues(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: { version: number; customFields: FieldValueInput[] },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.update',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, input.version, true);
        await this.values(tx, projectId, id, input.customFields, true);
        await this.changed(tx, actor, ws, row, 'fields_updated');
        return this.view(tx, ctx, await this.find(tx, projectId, id));
      },
    );
  }
}
