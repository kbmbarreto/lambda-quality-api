import { randomUUID } from 'node:crypto';
import { ApplicationError } from '../../../shared/domain/errors.js';
import { pageResult } from '../../../shared/application/records.js';
import type {
  ListInput,
  Records,
  RecordQuery,
} from '../../../shared/application/records.js';
import type { Actor } from '../../workspace/domain/models.js';
import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import { Projects } from '../../project/application/projects.js';
import {
  forbidden,
  notFound,
  listQuery,
} from '../../workspace/application/access.js';
import type { GovernanceGoal, ActionPlan } from '../domain/models.js';
import { sectionPath } from '../domain/progress.js';
import { GOAL_TYPES } from '../domain/models.js';
import {
  definedChanges,
  checkVersion,
  invalid,
  governanceConflict,
  actionProgress,
  actionGoalStatus,
} from '../domain/rules.js';
import { GovernanceAssessments } from './assessments.js';
import {
  AutomationCoverageCalculator,
  CriticalDefectsCalculator,
  GovernanceScoreCalculator,
} from './calculators.js';
import type { GoalCalculator } from './calculators.js';
export interface GoalInput {
  sectionId?: string | null;
  ownerMemberId?: string | null;
  projectId?: string | null;
  frameworkId?: string | null;
  name: string;
  description?: string | null;
  goalType: GovernanceGoal['goalType'];
  operator: GovernanceGoal['operator'];
  targetValue: number;
  deadline?: string | null;
}
export interface ActionInput {
  controlAssessmentId?: string | null;
  goalId?: string | null;
  title: string;
  description?: string | null;
  ownerMemberId?: string | null;
  dueDate?: string | null;
}
export class GovernanceGoalsActions {
  readonly calculators: GoalCalculator[] = [
    new AutomationCoverageCalculator(),
    new CriticalDefectsCalculator(),
    new GovernanceScoreCalculator(),
  ];
  constructor(
    readonly assessments: GovernanceAssessments,
    readonly projects: Projects,
  ) {}
  get access() {
    return this.assessments.access;
  }
  async project(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    id: string,
    write = false,
  ) {
    const ctx = await this.projects.resolve(tx, actor, ws, id);
    if (write && ctx.project.status === 'ARCHIVED')
      governanceConflict('PROJECT_ARCHIVED', 'O projeto está arquivado.');
    return ctx;
  }
  async metricScope(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    goal: GovernanceGoal,
    historical = false,
  ) {
    if (goal.goalType === 'GOVERNANCE_SCORE') return [];
    const ids = goal.projectId
      ? [goal.projectId]
      : await this.projects.activeIds(tx);
    if (historical && goal.lastResult && !goal.projectId)
      ids.push(...goal.lastResult.sourceIds);
    const permission =
      goal.goalType === 'AUTOMATION_COVERAGE' ? 'testcase.read' : 'defect.read';
    for (const id of new Set(ids)) {
      let ctx;
      try {
        ctx = await this.project(tx, actor, ws, id);
      } catch (e) {
        if (
          e instanceof ApplicationError &&
          e.status === 404 &&
          !goal.projectId
        )
          throw forbidden();
        throw e;
      }
      if (!ctx.capabilities.includes(permission)) throw forbidden();
    }
    return [...new Set(ids)];
  }
  async authorizeGoal(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    row: GovernanceGoal,
    write = false,
  ) {
    if (row.projectId) await this.project(tx, actor, ws, row.projectId, write);
    // Workspace metric totals and historical source IDs must not reveal hidden projects.
    if (!row.projectId && row.goalType !== 'GOVERNANCE_SCORE')
      await this.metricScope(tx, actor, ws, row, true);
  }
  async findGoal(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    id: string,
    version?: number,
    write = false,
  ) {
    const row = await tx.governanceGoals.find({ id });
    if (!row) throw notFound();
    await this.authorizeGoal(tx, actor, ws, row, write);
    if (version !== undefined) checkVersion(row.version, version);
    if (write && row.status === 'CANCELLED')
      governanceConflict('GOVERNANCE_GOAL_CANCELLED', 'A meta está cancelada.');
    return row;
  }
  async visibleGoal(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    row: GovernanceGoal,
  ) {
    try {
      await this.authorizeGoal(tx, actor, ws, row);
      return true;
    } catch (e) {
      if (e instanceof ApplicationError && [403, 404].includes(e.status))
        return false;
      throw e;
    }
  }
  async goalScope(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    row: Pick<
      GovernanceGoal,
      'goalType' | 'frameworkId' | 'projectId' | 'targetValue' | 'sectionId'
    >,
  ) {
    if (row.goalType === 'GOVERNANCE_SCORE') {
      if (!row.frameworkId || row.projectId)
        invalid(
          'Índice de governança exige frameworkId e escopo de Workspace.',
        );
      await this.assessments.frameworks.find(tx, row.frameworkId);
      if (
        row.sectionId &&
        !(await tx.frameworkSections.find({
          id: row.sectionId,
          frameworkId: row.frameworkId,
        }))
      )
        throw notFound();
    } else {
      if (row.frameworkId || row.sectionId)
        invalid('Esta métrica não admite frameworkId ou sectionId.');
      if (row.projectId) await this.project(tx, actor, ws, row.projectId, true);
    }
    if (
      row.targetValue < 0 ||
      (row.goalType !== 'CRITICAL_DEFECTS' && row.targetValue > 100) ||
      (row.goalType === 'CRITICAL_DEFECTS' &&
        !Number.isInteger(row.targetValue))
    )
      invalid(
        'Percentuais devem estar entre 0 e 100; contagem de defeitos deve ser inteira.',
      );
  }
  async pageVisible<T extends { id: string }>(
    records: Records<T>,
    input: ListInput,
    query: RecordQuery<T>,
    visible: (row: T) => Promise<boolean>,
  ) {
    // Authorization precedes pagination and total, including sort and literal search.
    delete query.skip;
    delete query.take;
    const rows = [];
    for (const row of await records.list(query))
      if (await visible(row)) rows.push(row);
    return pageResult(
      rows.slice((input.page - 1) * input.size, input.page * input.size),
      input,
      rows.length,
    );
  }
  goals(actor: Actor, ws: string, input: ListInput & { projectId?: string }) {
    return this.access.run(ws, actor, 'governance.read', async (tx) => {
      const query = listQuery<GovernanceGoal>(
        input,
        ['name', 'deadline', 'createdAt', 'updatedAt'],
        'name',
      );
      query.where = {};
      if (input.projectId) {
        await this.project(tx, actor, ws, input.projectId);
        query.where.projectId = input.projectId;
      }

      if (input.q) query.search = { fields: ['name'], value: input.q };
      delete query.skip;
      delete query.take;
      const visible = [];
      for (const row of await tx.governanceGoals.list(query))
        if (await this.visibleGoal(tx, actor, ws, row)) visible.push(row);
      const rows = (await this.goalViews(tx, visible)).filter(
        (row) =>
          !input.status ||
          input.status === 'ALL' ||
          row.status === input.status,
      );
      return pageResult(
        rows.slice((input.page - 1) * input.size, input.page * input.size),
        input,
        rows.length,
      );
    });
  }
  getGoal(actor: Actor, ws: string, id: string) {
    return this.access.run(
      ws,
      actor,
      'governance.read',
      async (tx) =>
        (await this.goalViews(tx, [await this.findGoal(tx, actor, ws, id)]))[0],
    );
  }
  createGoal(actor: Actor, ws: string, input: GoalInput) {
    return this.access.run(ws, actor, 'governance.manage', async (tx) => {
      const row: GovernanceGoal = {
        id: randomUUID(),
        workspaceId: ws,
        ...input,
        projectId: input.projectId ?? null,
        frameworkId: input.frameworkId ?? null,
        sectionId: input.sectionId ?? null,
        ownerMemberId: input.ownerMemberId ?? null,
        description: input.description ?? null,
        deadline: input.deadline ?? null,
        status: 'ACTIVE',
        lastResult: null,
        createdBy: actor.userId,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.goalScope(tx, actor, ws, row);
      await this.owner(tx, input.ownerMemberId);
      await this.authorizeGoal(tx, actor, ws, row, true);
      row.status = actionGoalStatus(row, actionProgress());
      await tx.governanceGoals.create(row);
      await this.access.audit(
        tx,
        actor,
        ws,
        'governance.goal.created',
        'GovernanceGoal',
        row.id,
      );
      return (await this.goalViews(tx, [row]))[0];
    });
  }
  updateGoal(
    actor: Actor,
    ws: string,
    id: string,
    input: Partial<GoalInput> & {
      version: number;
      status?: 'ACTIVE' | 'CANCELLED';
    },
  ) {
    return this.access.run(ws, actor, 'governance.manage', async (tx) => {
      const row = await this.findGoal(tx, actor, ws, id, input.version, true);
      const { version: _version, ...rawChanges } = input;
      const changes = definedChanges(rawChanges);
      if (!Object.values(changes).some((v) => v !== undefined))
        invalid('Informe ao menos um campo para alterar.');
      const next = { ...row, ...changes };
      await this.goalScope(tx, actor, ws, next);
      await this.owner(tx, input.ownerMemberId);
      await this.authorizeGoal(tx, actor, ws, next, true);
      await tx.governanceGoals.update(
        { id },
        {
          ...changes,
          lastResult: null,
          status: actionGoalStatus(
            {
              ...next,
              status: input.status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
            },
            actionProgress((await tx.governanceProgress.actionTotals([id]))[0]),
          ),
          version: row.version + 1,
          updatedAt: new Date(),
        },
      );
      await this.access.audit(
        tx,
        actor,
        ws,
        'governance.goal.updated',
        'GovernanceGoal',
        id,
      );
      return (
        await this.goalViews(tx, [(await tx.governanceGoals.find({ id }))!])
      )[0];
    });
  }
  calculate(actor: Actor, ws: string, id: string, version: number) {
    return this.access.run(ws, actor, 'governance.manage', async (tx) => {
      const row = await this.findGoal(tx, actor, ws, id, version, true),
        now = new Date();
      const projectIds = await this.metricScope(tx, actor, ws, row);
      const calculator = this.calculators.find(
        (c) => c.supports() === row.goalType,
      );
      if (!calculator) invalid('Tipo de meta indisponível.');
      const lastResult = await calculator.calculate(row, {
        tx,
        projectIds,
        now,
      });
      await tx.governanceGoals.update(
        { id },
        {
          lastResult,
          status: actionGoalStatus(
            row,
            actionProgress((await tx.governanceProgress.actionTotals([id]))[0]),
            now,
          ),
          version: row.version + 1,
          updatedAt: now,
        },
      );
      await this.access.audit(
        tx,
        actor,
        ws,
        'governance.goal.calculated',
        'GovernanceGoal',
        id,
      );
      return (
        await this.goalViews(tx, [(await tx.governanceGoals.find({ id }))!])
      )[0];
    });
  }
  async goalViews(tx: WorkspaceTransaction, rows: GovernanceGoal[]) {
    const totals = new Map(
      (await tx.governanceProgress.actionTotals(rows.map((r) => r.id))).map(
        (r) => [r.goalId, r],
      ),
    );
    const now = new Date();
    const members = await tx.members.list({
      where: { status: 'ACTIVE' },
      in: {
        field: 'id',
        values: rows.flatMap((r) => (r.ownerMemberId ? [r.ownerMemberId] : [])),
      },
    });
    const names = new Map(
      (await this.access.directory.getUsers(members.map((m) => m.userId))).map(
        (u) => [u.id, u.displayName],
      ),
    );
    const owners = new Map(
      members.map((m) => [m.id, names.get(m.userId) ?? null]),
    );
    const sections = rows.some((r) => r.sectionId && !r.lastResult)
      ? await tx.frameworkSections.list({
          in: {
            field: 'frameworkId',
            values: [
              ...new Set(
                rows.flatMap((r) => (r.frameworkId ? [r.frameworkId] : [])),
              ),
            ],
          },
        })
      : [];
    return rows.map((row) => {
      const section = row.lastResult
        ? (row.lastResult.section ?? null)
        : (sections.find(
            (s) => s.id === row.sectionId && s.frameworkId === row.frameworkId,
          ) ?? null);
      const completion = actionProgress(totals.get(row.id));
      return {
        ...row,
        status: actionGoalStatus(row, completion, now),
        actionProgress: completion,
        ownerDisplayName: row.ownerMemberId
          ? (owners.get(row.ownerMemberId) ?? null)
          : null,
        sectionName: section?.name ?? null,
        sectionPath: row.lastResult
          ? (row.lastResult.section?.path ?? [])
          : row.sectionId
            ? sectionPath(sections, row.sectionId)
            : [],
      };
    });
  }
  async actionVisible(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    row: ActionPlan,
  ) {
    const goal = row.goalId
      ? await tx.governanceGoals.find({ id: row.goalId })
      : null;
    return (
      !row.goalId || (!!goal && (await this.visibleGoal(tx, actor, ws, goal)))
    );
  }
  async findAction(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    id: string,
    version?: number,
    write = false,
  ) {
    const row = await tx.actionPlans.find({ id });
    if (!row || !(await this.actionVisible(tx, actor, ws, row)))
      throw notFound();
    if (row.goalId && write) {
      const goal = await tx.governanceGoals.find({ id: row.goalId });
      if (goal) await this.authorizeGoal(tx, actor, ws, goal, true);
    }
    if (version !== undefined) checkVersion(row.version, version);
    if (write && ['DONE', 'CANCELLED'].includes(row.status))
      governanceConflict(
        'GOVERNANCE_ACTION_TERMINAL',
        'A ação está concluída ou cancelada.',
      );
    return row;
  }
  async owner(tx: WorkspaceTransaction, id: string | null | undefined) {
    if (id && !(await tx.members.find({ id, status: 'ACTIVE' })))
      throw notFound();
  }
  actions(
    actor: Actor,
    ws: string,
    input: ListInput & { goalId?: string; controlAssessmentId?: string },
  ) {
    return this.access.run(ws, actor, 'governance.read', async (tx) => {
      const query = listQuery<ActionPlan>(
        input,
        ['title', 'dueDate', 'createdAt', 'updatedAt'],
        'dueDate',
      );
      query.where = {};
      if (input.status && input.status !== 'ALL')
        query.where.status = input.status as ActionPlan['status'];
      if (input.goalId) {
        await this.findGoal(tx, actor, ws, input.goalId);
        query.where.goalId = input.goalId;
      }
      if (input.controlAssessmentId) {
        if (
          !(await tx.controlAssessments.find({ id: input.controlAssessmentId }))
        )
          throw notFound();
        query.where.controlAssessmentId = input.controlAssessmentId;
      }
      if (input.q) query.search = { fields: ['title'], value: input.q };
      return this.pageVisible(tx.actionPlans, input, query, (row) =>
        this.actionVisible(tx, actor, ws, row),
      );
    });
  }
  getAction(actor: Actor, ws: string, id: string) {
    return this.access.run(ws, actor, 'governance.read', (tx) =>
      this.findAction(tx, actor, ws, id),
    );
  }
  createAction(actor: Actor, ws: string, input: ActionInput) {
    return this.access.run(ws, actor, 'governance.manage', async (tx) => {
      if (input.goalId) {
        await this.findGoal(tx, actor, ws, input.goalId, undefined, true);
      }
      if (
        input.controlAssessmentId &&
        !(await tx.controlAssessments.find({ id: input.controlAssessmentId }))
      )
        throw notFound();
      await this.owner(tx, input.ownerMemberId);
      const row = await tx.actionPlans.create({
        id: randomUUID(),
        workspaceId: ws,
        ...input,
        controlAssessmentId: input.controlAssessmentId ?? null,
        goalId: input.goalId ?? null,
        description: input.description ?? null,
        ownerMemberId: input.ownerMemberId ?? null,
        dueDate: input.dueDate ?? null,
        status: 'OPEN',
        completedAt: null,
        createdBy: actor.userId,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await this.access.audit(
        tx,
        actor,
        ws,
        'governance.action.created',
        'ActionPlan',
        row.id,
      );
      await this.syncActionGoals(tx, actor, ws, [row.goalId]);
      return row;
    });
  }
  updateAction(
    actor: Actor,
    ws: string,
    id: string,
    input: {
      version: number;
      goalId?: string | null;
      title?: string;
      description?: string | null;
      ownerMemberId?: string | null;
      dueDate?: string | null;
      status?: 'OPEN' | 'IN_PROGRESS' | 'CANCELLED';
    },
    complete = false,
  ) {
    return this.access.run(ws, actor, 'governance.manage', async (tx) => {
      const row = await this.findAction(tx, actor, ws, id, input.version, true);
      const { version: _version, ...rawChanges } = input;
      const changes = definedChanges(rawChanges);
      if (!complete && !Object.values(changes).some((v) => v !== undefined))
        invalid('Informe ao menos um campo para alterar.');
      if (row.status === 'IN_PROGRESS' && changes.status === 'OPEN')
        governanceConflict(
          'GOVERNANCE_STATE_INVALID',
          'A ação em andamento não pode voltar para aberta.',
        );
      if (input.goalId) {
        await this.findGoal(tx, actor, ws, input.goalId, undefined, true);
      }
      await this.owner(tx, input.ownerMemberId);
      await tx.actionPlans.update(
        { id },
        {
          ...changes,
          ...(complete
            ? { status: 'DONE' as const, completedAt: new Date() }
            : {}),
          version: row.version + 1,
          updatedAt: new Date(),
        },
      );
      await this.access.audit(
        tx,
        actor,
        ws,
        complete ? 'governance.action.completed' : 'governance.action.updated',
        'ActionPlan',
        id,
      );
      if (complete || input.status !== undefined || input.goalId !== undefined)
        await this.syncActionGoals(tx, actor, ws, [row.goalId, input.goalId]);
      return tx.actionPlans.find({ id });
    });
  }
  async syncActionGoals(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    ids: (string | null | undefined)[],
  ) {
    const goalIds = [...new Set(ids.filter((id): id is string => !!id))];
    const totals = new Map(
      (await tx.governanceProgress.actionTotals(goalIds)).map((r) => [
        r.goalId,
        r,
      ]),
    );
    for (const id of goalIds) {
      const goal = await tx.governanceGoals.find({ id });
      if (!goal || goal.status === 'CANCELLED') continue;
      const now = new Date();
      await tx.governanceGoals.update(
        { id },
        {
          status: actionGoalStatus(goal, actionProgress(totals.get(id)), now),
          version: goal.version + 1,
          updatedAt: now,
        },
      );
      await this.access.audit(
        tx,
        actor,
        ws,
        'governance.goal.actions_updated',
        'GovernanceGoal',
        id,
      );
    }
  }
  metrics(actor: Actor, ws: string) {
    return this.access.run(ws, actor, 'governance.read', async () => ({
      goalTypes: [...GOAL_TYPES],
      indicatorType: 'INTERNAL' as const,
    }));
  }
  dashboard(actor: Actor, ws: string) {
    return this.access.run(ws, actor, 'governance.read', async (tx) => {
      const goals = [];
      for (const row of await tx.governanceGoals.list())
        if (await this.visibleGoal(tx, actor, ws, row)) goals.push(row);
      const goalRows = await this.goalViews(tx, goals);
      const actions = [];
      for (const row of await tx.actionPlans.list())
        if (await this.actionVisible(tx, actor, ws, row)) actions.push(row);
      const assessments = await tx.assessments.list();
      const closed = assessments
        .filter((a) => a.status === 'CLOSED')
        .sort(
          (a, b) =>
            b.closedAt!.getTime() - a.closedAt!.getTime() ||
            a.id.localeCompare(b.id),
        );
      const latest = [];
      const seen = new Set<string>();
      let notMet = 0,
        partial = 0,
        expiredEvidence = 0;
      const today = new Date().toISOString().slice(0, 10);
      for (const a of closed) {
        if (seen.has(a.frameworkId)) continue;
        seen.add(a.frameworkId);
        const controls = await tx.controlAssessments.list({
          where: { assessmentId: a.id },
        });
        for (const c of controls) {
          if (c.status === 'NOT_MET') notMet++;
          if (c.status === 'PARTIALLY_MET') partial++;
          expiredEvidence += await tx.evidenceLinks.count({
            where: { controlAssessmentId: c.id },
            compare: [{ field: 'validUntil', op: 'lt', value: today }],
          });
        }
        const view = await this.assessments.view(tx, a);
        latest.push({
          frameworkId: a.frameworkId,
          assessmentId: a.id,
          frameworkName: a.frameworkSnapshot.name,
          closedAt: a.closedAt,
          index: view.index.value,
        });
      }
      const count = (rows: { status: string }[], status: string) =>
        rows.filter((r) => r.status === status).length;
      return {
        indicatorType: 'INTERNAL' as const,
        frameworks: await tx.frameworks.count(),
        assessments: {
          draft: count(assessments, 'DRAFT'),
          inProgress: count(assessments, 'IN_PROGRESS'),
          closed: closed.length,
        },
        latestAssessments: latest,
        goals: {
          active: count(goalRows, 'ACTIVE'),
          achieved: count(goalRows, 'ACHIEVED'),
          missed: count(goalRows, 'MISSED'),
          cancelled: count(goalRows, 'CANCELLED'),
        },
        actions: {
          open: count(actions, 'OPEN'),
          inProgress: count(actions, 'IN_PROGRESS'),
          done: count(actions, 'DONE'),
          cancelled: count(actions, 'CANCELLED'),
        },
        attention: {
          notMetControls: notMet,
          partiallyMetControls: partial,
          expiredEvidence,
        },
      };
    });
  }
}
