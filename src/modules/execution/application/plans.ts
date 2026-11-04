import { ApplicationError } from '../../../shared/domain/errors.js';
import { randomUUID } from 'node:crypto';
import type { Actor } from '../../workspace/domain/models.js';
import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import type { ListInput } from '../../../shared/application/records.js';
import { pageResult } from '../../../shared/application/records.js';
import {
  conflict,
  forbidden,
  listQuery,
  notFound,
} from '../../workspace/application/access.js';
import { Projects } from '../../project/application/projects.js';
import { TestDefinitions } from '../../testmanagement/application/definitions.js';
import { exactOrder } from '../../testmanagement/domain/rules.js';
import type { TestPlan } from '../domain/models.js';
import { checkVersion, selectionIds } from '../domain/rules.js';
import { executionContext } from './context.js';
export const TEST_PLANS = Symbol('TestPlans');
export interface PlanInput {
  name: string;
  description?: string | null;
  milestoneId?: string | null;
  environmentId?: string | null;
  caseIds?: string[];
}
export class TestPlans {
  constructor(
    private readonly projects: Projects,
    private readonly definitions: TestDefinitions,
  ) {}
  async find(
    tx: WorkspaceTransaction,
    projectId: string,
    id: string,
    version?: number,
    draft = false,
  ) {
    const row = await tx.testPlans.find({ id, projectId });
    if (!row) throw notFound();
    if (version !== undefined) checkVersion(row.version, version, 'PLAN');
    if (draft && row.status !== 'DRAFT')
      conflict(
        'TEST_PLAN_NOT_DRAFT',
        'Somente planos DRAFT permitem alterar metadados ou seleção.',
      );
    return row;
  }
  async entries(
    tx: WorkspaceTransaction,
    projectId: string,
    testPlanId: string,
  ) {
    return tx.testPlanCases.list({
      where: { projectId, testPlanId },
      order: { field: 'position', direction: 'asc' },
    });
  }
  async view(tx: WorkspaceTransaction, row: TestPlan) {
    return { ...row, cases: await this.entries(tx, row.projectId, row.id) };
  }
  async changed(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    row: TestPlan,
    action: string,
  ) {
    await tx.testPlans.update(
      { id: row.id, projectId: row.projectId },
      { version: row.version + 1, updatedAt: new Date() },
    );
    await this.projects.access.audit(
      tx,
      actor,
      ws,
      `test.plan_${action}`,
      'TestPlan',
      row.id,
    );
  }
  async order(
    tx: WorkspaceTransaction,
    projectId: string,
    testPlanId: string,
    caseIds: string[],
  ) {
    const entries = await this.entries(tx, projectId, testPlanId);
    const offset = Math.max(0, ...entries.map((e) => e.position)) + 1;
    for (const [i, testCaseId] of caseIds.entries())
      await tx.testPlanCases.update(
        { projectId, testPlanId, testCaseId },
        { position: offset + i },
      );
    for (const [i, testCaseId] of caseIds.entries())
      await tx.testPlanCases.update(
        { projectId, testPlanId, testCaseId },
        { position: i + 1 },
      );
  }
  list(actor: Actor, ws: string, projectId: string, input: ListInput) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.read',
      false,
      async (tx) => {
        const query = listQuery<TestPlan>(
          input,
          ['name', 'createdAt', 'updatedAt'],
          'createdAt',
        );
        query.where = { projectId };
        if (input.status && input.status !== 'ALL')
          query.where.status = input.status as TestPlan['status'];
        else if (input.status !== 'ALL')
          query.in = {
            field: 'status',
            values: ['DRAFT', 'ACTIVE', 'COMPLETED'],
          };
        if (input.q) query.search = { fields: ['name'], value: input.q };
        const items = [];
        for (const row of await tx.testPlans.list(query))
          items.push(await this.view(tx, row));
        return pageResult(items, input, await tx.testPlans.count(query));
      },
    );
  }
  get(actor: Actor, ws: string, projectId: string, id: string) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.read',
      false,
      async (tx) => this.view(tx, await this.find(tx, projectId, id)),
    );
  }
  cases(
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
      'testrun.read',
      false,
      async (tx) => {
        await this.find(tx, projectId, id);
        const query = listQuery<import('../domain/models.js').TestPlanCase>(
          input,
          ['position'],
          'position',
        );
        query.where = { projectId, testPlanId: id };
        return pageResult(
          await tx.testPlanCases.list(query),
          input,
          await tx.testPlanCases.count(query),
        );
      },
    );
  }
  create(actor: Actor, ws: string, projectId: string, input: PlanInput) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.manage',
      true,
      async (tx, ctx) => {
        const ids = input.caseIds ?? [];
        selectionIds(ids, true);
        if (ids.length && !ctx.capabilities.includes('testcase.read'))
          throw forbidden();
        await this.definitions.cases(tx, projectId, ids);
        await executionContext(
          tx,
          projectId,
          input.milestoneId ?? null,
          input.environmentId ?? null,
        );
        const row = await tx.testPlans.create({
          id: randomUUID(),
          workspaceId: ws,
          projectId,
          name: input.name,
          description: input.description ?? null,
          milestoneId: input.milestoneId ?? null,
          environmentId: input.environmentId ?? null,
          status: 'DRAFT',
          version: 1,
          createdBy: actor.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          activatedAt: null,
          completedAt: null,
          archivedAt: null,
        });
        for (const [i, testCaseId] of ids.entries())
          await tx.testPlanCases.create({
            id: randomUUID(),
            workspaceId: ws,
            projectId,
            testPlanId: row.id,
            testCaseId,
            position: i + 1,
          });
        await this.projects.access.audit(
          tx,
          actor,
          ws,
          'test.plan_created',
          'TestPlan',
          row.id,
        );
        return this.view(tx, row);
      },
    );
  }
  update(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: Partial<Omit<PlanInput, 'caseIds'>> & { version: number },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.manage',
      true,
      async (tx) => {
        const row = await this.find(tx, projectId, id, input.version, true);
        await executionContext(
          tx,
          projectId,
          input.milestoneId === undefined ? row.milestoneId : input.milestoneId,
          input.environmentId === undefined
            ? row.environmentId
            : input.environmentId,
        );
        const { version: _version, ...changes } = input;
        await tx.testPlans.update({ id, projectId }, changes);
        await this.changed(tx, actor, ws, row, 'updated');
        return this.view(tx, await this.find(tx, projectId, id));
      },
    );
  }
  addCase(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: { version: number; testCaseId: string; position?: number },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.manage',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, input.version, true);
        if (!ctx.capabilities.includes('testcase.read')) throw forbidden();
        await this.definitions.cases(tx, projectId, [input.testCaseId]);
        const entries = await this.entries(tx, projectId, id);
        if (entries.some((e) => e.testCaseId === input.testCaseId))
          conflict(
            'TEST_PLAN_CASE_EXISTS',
            'O caso já está selecionado no plano.',
          );
        const ids = entries.map((e) => e.testCaseId);
        ids.push(input.testCaseId);
        selectionIds(ids);
        const position = input.position ?? ids.length;
        if (position < 1 || position > ids.length)
          throw new ApplicationError(
            400,
            'TEST_ORDER_INVALID',
            'Posição inválida na seleção.',
          );
        ids.pop();
        ids.splice(position - 1, 0, input.testCaseId);
        await tx.testPlanCases.create({
          id: randomUUID(),
          workspaceId: ws,
          projectId,
          testPlanId: id,
          testCaseId: input.testCaseId,
          position: entries.length + 1,
        });
        await this.order(tx, projectId, id, ids);
        await this.changed(tx, actor, ws, row, 'case_added');
        return this.view(tx, await this.find(tx, projectId, id));
      },
    );
  }
  addCases(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: { version: number; caseIds: string[] },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.manage',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, input.version, true);
        if (!ctx.capabilities.includes('testcase.read')) throw forbidden();
        selectionIds(input.caseIds);
        const entries = await this.entries(tx, projectId, id);
        if (
          input.caseIds.some((caseId) =>
            entries.some((e) => e.testCaseId === caseId),
          )
        )
          conflict(
            'TEST_PLAN_CASE_EXISTS',
            'Um dos casos já está selecionado no plano.',
          );
        selectionIds([...entries.map((e) => e.testCaseId), ...input.caseIds]);
        await this.definitions.cases(tx, projectId, input.caseIds);
        for (const [i, testCaseId] of input.caseIds.entries())
          await tx.testPlanCases.create({
            id: randomUUID(),
            workspaceId: ws,
            projectId,
            testPlanId: id,
            testCaseId,
            position: entries.length + i + 1,
          });
        await this.changed(tx, actor, ws, row, 'cases_added');
        return this.view(tx, await this.find(tx, projectId, id));
      },
    );
  }
  removeCase(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    testCaseId: string,
    version: number,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.manage',
      true,
      async (tx) => {
        const row = await this.find(tx, projectId, id, version, true);
        if (
          !(await tx.testPlanCases.find({
            projectId,
            testPlanId: id,
            testCaseId,
          }))
        )
          throw notFound();
        await tx.testPlanCases.remove({
          projectId,
          testPlanId: id,
          testCaseId,
        });
        await this.order(
          tx,
          projectId,
          id,
          (await this.entries(tx, projectId, id)).map((e) => e.testCaseId),
        );
        await this.changed(tx, actor, ws, row, 'case_removed');
        return this.view(tx, await this.find(tx, projectId, id));
      },
    );
  }
  reorder(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: { version: number; caseIds: string[] },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.manage',
      true,
      async (tx) => {
        const row = await this.find(tx, projectId, id, input.version, true);
        exactOrder(
          (await this.entries(tx, projectId, id)).map((e) => e.testCaseId),
          input.caseIds,
        );
        await this.order(tx, projectId, id, input.caseIds);
        await this.changed(tx, actor, ws, row, 'cases_reordered');
        return this.view(tx, await this.find(tx, projectId, id));
      },
    );
  }
  transition(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    version: number,
    target: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED',
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.manage',
      true,
      async (tx, ctx) => {
        const row = await this.find(tx, projectId, id, version);
        if (row.status === target) return this.view(tx, row);
        if (target === 'ACTIVE') {
          if (row.status !== 'DRAFT')
            conflict(
              'TEST_PLAN_STATE_INVALID',
              'Somente planos DRAFT podem ser ativados.',
            );
          if (!ctx.capabilities.includes('testcase.read')) throw forbidden();
          const ids = (await this.entries(tx, projectId, id)).map(
            (e) => e.testCaseId,
          );
          selectionIds(ids);
          await this.definitions.cases(tx, projectId, ids, true);
        } else {
          if (
            row.status === 'ARCHIVED' ||
            (target === 'COMPLETED' && row.status !== 'ACTIVE')
          )
            conflict(
              'TEST_PLAN_STATE_INVALID',
              'Transição de estado do plano não permitida.',
            );
          if (
            await tx.testRuns.count({
              where: { projectId, testPlanId: id },
              in: { field: 'status', values: ['CREATED', 'IN_PROGRESS'] },
            })
          )
            conflict(
              'TEST_PLAN_RUNS_OPEN',
              'Conclua ou aborte as execuções abertas do plano.',
            );
        }
        await tx.testPlans.update(
          { id, projectId },
          {
            status: target,
            ...(target === 'ACTIVE'
              ? { activatedAt: new Date() }
              : target === 'COMPLETED'
                ? { completedAt: new Date() }
                : { archivedAt: new Date() }),
          },
        );
        await this.changed(tx, actor, ws, row, target.toLowerCase());
        return this.view(tx, await this.find(tx, projectId, id));
      },
    );
  }
}
