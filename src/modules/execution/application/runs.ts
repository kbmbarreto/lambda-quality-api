import { randomUUID } from 'node:crypto';
import type { Actor } from '../../workspace/domain/models.js';
import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import type { ListInput } from '../../../shared/application/records.js';
import { pageResult } from '../../../shared/application/records.js';
import { ApplicationError } from '../../../shared/domain/errors.js';
import {
  conflict,
  forbidden,
  listQuery,
  notFound,
} from '../../workspace/application/access.js';
import { Projects } from '../../project/application/projects.js';
import type { ProjectContext } from '../../project/application/projects.js';
import { TestDefinitions } from '../../testmanagement/application/definitions.js';
import type {
  TestRun,
  TestRunCase,
  TestResult,
  ExecutionComment,
} from '../domain/models.js';
import {
  checkVersion,
  selectionIds,
  requirePassingSteps,
  requireCompleteResults,
} from '../domain/rules.js';
import { executionContext } from './context.js';
export const TEST_RUNS = Symbol('TestRuns');
export interface RunInput {
  name: string;
  caseIds: string[];
  milestoneId?: string | null;
  environmentId?: string | null;
}
export class TestRuns {
  constructor(
    private readonly projects: Projects,
    private readonly definitions: TestDefinitions,
  ) {}
  async find(
    tx: WorkspaceTransaction,
    projectId: string,
    id: string,
    version?: number,
    executing = false,
  ) {
    const row = await tx.testRuns.find({ id, projectId });
    if (!row) throw notFound();
    if (version !== undefined) checkVersion(row.version, version, 'RUN');
    if (executing && row.status !== 'IN_PROGRESS')
      conflict(
        'TEST_RUN_NOT_IN_PROGRESS',
        'A execução deve estar IN_PROGRESS para registrar resultados ou comentários.',
      );
    return row;
  }
  async cases(tx: WorkspaceTransaction, projectId: string, testRunId: string) {
    return tx.testRunCases.list({
      where: { projectId, testRunId },
      order: { field: 'position', direction: 'asc' },
    });
  }
  async view(tx: WorkspaceTransaction, row: TestRun) {
    const cases = await this.cases(tx, row.projectId, row.id);
    const summary = {
      total: cases.length,
      notTested: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
    };
    const keys = {
      NOT_TESTED: 'notTested',
      PASSED: 'passed',
      FAILED: 'failed',
      BLOCKED: 'blocked',
      SKIPPED: 'skipped',
    } as const;
    for (const entry of cases) summary[keys[entry.result]]++;
    return { ...row, summary };
  }
  async changed(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    row: TestRun,
    action: string,
  ) {
    await tx.testRuns.update(
      { id: row.id, projectId: row.projectId },
      { version: row.version + 1, updatedAt: new Date() },
    );
    await this.projects.access.audit(
      tx,
      actor,
      ws,
      `test.run_${action}`,
      'TestRun',
      row.id,
    );
  }
  async runCase(
    tx: WorkspaceTransaction,
    projectId: string,
    testRunId: string,
    id: string,
  ) {
    const row = await tx.testRunCases.find({ id, projectId, testRunId });
    if (!row) throw notFound();
    return row;
  }
  async caseView(tx: WorkspaceTransaction, row: TestRunCase) {
    return {
      ...row,
      steps: await tx.testRunSteps.list({
        where: {
          projectId: row.projectId,
          testRunId: row.testRunId,
          testRunCaseId: row.id,
        },
        order: { field: 'position', direction: 'asc' },
      }),
    };
  }
  list(
    actor: Actor,
    ws: string,
    projectId: string,
    input: ListInput & { testPlanId?: string },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.read',
      false,
      async (tx) => {
        const query = listQuery<TestRun>(
          input,
          ['name', 'createdAt', 'startedAt', 'finishedAt'],
          'createdAt',
        );
        query.where = { projectId };
        if (input.status && input.status !== 'ALL')
          query.where.status = input.status as TestRun['status'];
        if (input.testPlanId) {
          if (!(await tx.testPlans.find({ id: input.testPlanId, projectId })))
            throw notFound();
          query.where.testPlanId = input.testPlanId;
        }
        if (input.q) query.search = { fields: ['name'], value: input.q };
        const items = [];
        for (const row of await tx.testRuns.list(query))
          items.push(await this.view(tx, row));
        return pageResult(items, input, await tx.testRuns.count(query));
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
  listCases(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: ListInput & { result?: string },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.read',
      false,
      async (tx) => {
        await this.find(tx, projectId, id);
        const query = listQuery<TestRunCase>(
          input,
          ['position', 'titleSnapshot'],
          'position',
        );
        query.where = { projectId, testRunId: id };
        if (input.result && input.result !== 'ALL')
          query.where.result = input.result as TestResult;
        if (input.q)
          query.search = { fields: ['titleSnapshot'], value: input.q };
        const items = [];
        for (const row of await tx.testRunCases.list(query))
          items.push(await this.caseView(tx, row));
        return pageResult(items, input, await tx.testRunCases.count(query));
      },
    );
  }
  getCase(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    runCaseId: string,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.read',
      false,
      async (tx) => {
        await this.find(tx, projectId, id);
        return this.caseView(
          tx,
          await this.runCase(tx, projectId, id, runCaseId),
        );
      },
    );
  }
  async insert(
    tx: WorkspaceTransaction,
    ctx: ProjectContext,
    actor: Actor,
    ws: string,
    projectId: string,
    input: RunInput,
    testPlanId: string | null = null,
    planNameSnapshot: string | null = null,
  ) {
    if (!ctx.capabilities.includes('testcase.read')) throw forbidden();
    selectionIds(input.caseIds);
    const { milestone, environment } = await executionContext(
      tx,
      projectId,
      input.milestoneId ?? null,
      input.environmentId ?? null,
    );
    const row = await tx.testRuns.create({
      id: randomUUID(),
      workspaceId: ws,
      projectId,
      testPlanId,
      planNameSnapshot,
      milestoneId: input.milestoneId ?? null,
      environmentId: input.environmentId ?? null,
      milestoneSnapshot: milestone
        ? { name: milestone.name, description: milestone.description }
        : null,
      environmentSnapshot: environment
        ? { name: environment.name, description: environment.description }
        : null,
      name: input.name,
      source: 'MANUAL',
      externalRunRef: null,
      status: 'CREATED',
      version: 1,
      createdBy: actor.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      startedAt: null,
      finishedAt: null,
    });
    let stepCount = 0;
    for (const [i, testCaseId] of input.caseIds.entries()) {
      const snapshot = await this.definitions.snapshot(
        tx,
        projectId,
        testCaseId,
      );
      stepCount += snapshot.steps.length;
      if (stepCount > 10000)
        throw new ApplicationError(
          400,
          'TEST_RUN_STEP_LIMIT',
          'Uma execução admite até 10000 passos.',
        );
      const c = snapshot.testCase;
      const runCase = await tx.testRunCases.create({
        id: randomUUID(),
        workspaceId: ws,
        projectId,
        testRunId: row.id,
        testCaseId,
        position: i + 1,
        caseSequenceSnapshot: c.sequence,
        humanIdSnapshot: `${ctx.project.key}-${c.sequence}`,
        titleSnapshot: c.title,
        severitySnapshot: c.severity,
        prioritySnapshot: c.priority,
        definitionSnapshot: {
          description: c.description,
          preconditions: c.preconditions,
          postconditions: c.postconditions,
          type: c.type,
          layer: c.layer,
          behavior: c.behavior,
          automationStatus: c.automationStatus,
          suiteId: c.suiteId,
          status: c.status,
          version: c.version,
        },
        customFieldsSnapshot: snapshot.customFieldsSnapshot,
        tagsSnapshot: snapshot.tagsSnapshot,
        result: 'NOT_TESTED',
        resultOrigin: 'MANUAL',
        externalResult: null,
        executedBy: null,
        executedAt: null,
        comment: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      for (const step of snapshot.steps)
        await tx.testRunSteps.create({
          id: randomUUID(),
          workspaceId: ws,
          projectId,
          testRunId: row.id,
          testRunCaseId: runCase.id,
          sourceStepId: step.id,
          position: step.position,
          actionSnapshot: step.action,
          testDataSnapshot: step.testData,
          expectedResultSnapshot: step.expectedResult,
          actualResult: null,
          result: 'NOT_TESTED',
          comment: null,
          executedBy: null,
          executedAt: null,
        });
    }
    await this.projects.access.audit(
      tx,
      actor,
      ws,
      'test.run_created',
      'TestRun',
      row.id,
    );
    return this.view(tx, row);
  }
  create(actor: Actor, ws: string, projectId: string, input: RunInput) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.manage',
      true,
      (tx, ctx) => this.insert(tx, ctx, actor, ws, projectId, input),
    );
  }
  fromPlan(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: { name: string; version: number },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.manage',
      true,
      async (tx, ctx) => {
        const plan = await tx.testPlans.find({ id, projectId });
        if (!plan) throw notFound();
        checkVersion(plan.version, input.version, 'PLAN');
        if (plan.status !== 'ACTIVE')
          conflict(
            'TEST_PLAN_NOT_ACTIVE',
            'Somente planos ACTIVE podem criar execuções.',
          );
        const entries = await tx.testPlanCases.list({
          where: { projectId, testPlanId: id },
          order: { field: 'position', direction: 'asc' },
        });
        return this.insert(
          tx,
          ctx,
          actor,
          ws,
          projectId,
          {
            name: input.name,
            caseIds: entries.map((e) => e.testCaseId),
            milestoneId: plan.milestoneId,
            environmentId: plan.environmentId,
          },
          id,
          plan.name,
        );
      },
    );
  }
  transition(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    version: number,
    target: 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED',
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      target === 'ABORTED' ? 'testrun.manage' : 'testrun.execute',
      true,
      async (tx) => {
        const row = await this.find(tx, projectId, id, version);
        if (row.status === target) return this.view(tx, row);
        if (target === 'IN_PROGRESS') {
          if (row.status !== 'CREATED')
            conflict(
              'TEST_RUN_STATE_INVALID',
              'Somente execuções CREATED podem ser iniciadas.',
            );
        } else if (target === 'COMPLETED') {
          if (row.status !== 'IN_PROGRESS')
            conflict(
              'TEST_RUN_STATE_INVALID',
              'Somente execuções IN_PROGRESS podem ser concluídas.',
            );
          const entries = await this.cases(tx, projectId, id);
          requireCompleteResults(entries.map((c) => c.result));
          for (const entry of entries)
            if (entry.resultOrigin !== 'JUNIT' || !entry.externalResult)
              requirePassingSteps(
                entry.result,
                (
                  await tx.testRunSteps.list({
                    where: {
                      projectId,
                      testRunId: id,
                      testRunCaseId: entry.id,
                    },
                  })
                ).map((s) => s.result),
              );
        } else if (row.status !== 'CREATED' && row.status !== 'IN_PROGRESS')
          conflict(
            'TEST_RUN_STATE_INVALID',
            'Somente execuções abertas podem ser abortadas.',
          );
        await tx.testRuns.update(
          { id, projectId },
          {
            status: target,
            ...(target === 'IN_PROGRESS'
              ? { startedAt: new Date() }
              : { finishedAt: new Date() }),
          },
        );
        await this.changed(tx, actor, ws, row, target.toLowerCase());
        return this.view(tx, await this.find(tx, projectId, id));
      },
    );
  }
  caseResult(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    runCaseId: string,
    input: { version: number; result: TestResult; comment?: string | null },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.execute',
      true,
      async (tx) => {
        const row = await this.find(tx, projectId, id, input.version, true);
        await this.runCase(tx, projectId, id, runCaseId);
        const steps = await tx.testRunSteps.list({
          where: { projectId, testRunId: id, testRunCaseId: runCaseId },
        });
        requirePassingSteps(
          input.result,
          steps.map((s) => s.result),
        );
        await tx.testRunCases.update(
          { id: runCaseId, projectId, testRunId: id },
          {
            result: input.result,
            resultOrigin: 'MANUAL',
            externalResult: null,
            executedBy: input.result === 'NOT_TESTED' ? null : actor.userId,
            executedAt: input.result === 'NOT_TESTED' ? null : new Date(),
            updatedAt: new Date(),
            ...(input.comment !== undefined ? { comment: input.comment } : {}),
          },
        );
        await this.changed(tx, actor, ws, row, 'case_result_recorded');
        return this.view(tx, await this.find(tx, projectId, id));
      },
    );
  }
  stepResult(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    runCaseId: string,
    runStepId: string,
    input: {
      version: number;
      result: TestResult;
      comment?: string | null;
      actualResult?: string | null;
    },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.execute',
      true,
      async (tx) => {
        const row = await this.find(tx, projectId, id, input.version, true);
        await this.runCase(tx, projectId, id, runCaseId);
        if (
          !(await tx.testRunSteps.find({
            id: runStepId,
            projectId,
            testRunId: id,
            testRunCaseId: runCaseId,
          }))
        )
          throw notFound();
        await tx.testRunSteps.update(
          { id: runStepId, projectId, testRunId: id, testRunCaseId: runCaseId },
          {
            result: input.result,
            executedBy: input.result === 'NOT_TESTED' ? null : actor.userId,
            executedAt: input.result === 'NOT_TESTED' ? null : new Date(),
            ...(input.comment !== undefined ? { comment: input.comment } : {}),
            ...(input.actualResult !== undefined
              ? { actualResult: input.actualResult }
              : {}),
          },
        );
        await tx.testRunCases.update(
          { id: runCaseId, projectId, testRunId: id },
          {
            result: 'NOT_TESTED',
            resultOrigin: 'MANUAL',
            externalResult: null,
            executedBy: null,
            executedAt: null,
            updatedAt: new Date(),
          },
        );
        await this.changed(tx, actor, ws, row, 'step_result_recorded');
        return this.view(tx, await this.find(tx, projectId, id));
      },
    );
  }
  comments(
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
        const query = listQuery<ExecutionComment>(
          input,
          ['createdAt'],
          'createdAt',
        );
        query.where = { projectId, testRunId: id };
        if (input.q) query.search = { fields: ['text'], value: input.q };
        return pageResult(
          await tx.executionComments.list(query),
          input,
          await tx.executionComments.count(query),
        );
      },
    );
  }
  comment(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: {
      version: number;
      text: string;
      runCaseId?: string | null;
      runStepId?: string | null;
    },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.execute',
      true,
      async (tx) => {
        const row = await this.find(tx, projectId, id, input.version, true);
        if (input.runStepId && !input.runCaseId)
          throw new ApplicationError(
            400,
            'VALIDATION_ERROR',
            'Comentário de passo exige runCaseId.',
          );
        if (input.runCaseId)
          await this.runCase(tx, projectId, id, input.runCaseId);
        if (
          input.runStepId &&
          !(await tx.testRunSteps.find({
            id: input.runStepId,
            projectId,
            testRunId: id,
            testRunCaseId: input.runCaseId!,
          }))
        )
          throw notFound();
        await tx.executionComments.create({
          id: randomUUID(),
          workspaceId: ws,
          projectId,
          testRunId: id,
          runCaseId: input.runCaseId ?? null,
          runStepId: input.runStepId ?? null,
          text: input.text,
          createdBy: actor.userId,
          createdAt: new Date(),
        });
        await this.changed(tx, actor, ws, row, 'comment_added');
        return this.view(tx, await this.find(tx, projectId, id));
      },
    );
  }
}
