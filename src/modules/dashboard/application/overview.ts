import {
  actionProgress,
  actionGoalStatus,
} from '../../governance/domain/rules.js';
import { GovernanceProgress } from '../../governance/application/progress.js';
import { combineProgress } from '../../governance/domain/progress.js';
import { ApplicationError } from '../../../shared/domain/errors.js';
import { Projects } from '../../project/application/projects.js';
import { dashboardSupportedDays } from '../domain/models.js';
import type { Actor, PermissionCode } from '../../workspace/domain/models.js';
import type {
  DashboardDays,
  DashboardPeriod,
  DashboardOverview,
  DashboardSourceScope,
  DashboardGoalRow,
  DashboardGoal,
  DashboardProject,
  DashboardDocument,
  DashboardActivity,
} from '../domain/models.js';
export const DASHBOARD_OVERVIEW = Symbol('DashboardOverview');
export const percentage = (numerator: number, denominator: number) =>
  denominator ? Math.round((numerator / denominator) * 10000) / 100 : null;
export function dashboardPeriod(
  now: Date,
  days: DashboardDays,
): DashboardPeriod {
  if (days === 'ALL')
    return {
      days,
      supportedDays: [...dashboardSupportedDays],
      from: null,
      to: now.toISOString(),
      previousFrom: null,
      previousTo: null,
    };
  const from = new Date(now.getTime() - days * 86400000);
  return {
    days,
    supportedDays: [...dashboardSupportedDays],
    from: from.toISOString(),
    to: now.toISOString(),
    previousFrom: new Date(from.getTime() - days * 86400000).toISOString(),
    previousTo: from.toISOString(),
  };
}
const titles = {
  TEST_CASES: 'Atividade em caso de teste',
  EXECUTION: 'Atividade em execução',
  DEFECTS: 'Atividade em defeito',
  GOVERNANCE: 'Atividade em governança',
  PROJECT: 'Atividade em projeto',
  WORKSPACE: 'Atividade no Workspace',
} as const;
export function goalProgress(row: DashboardGoalRow): number | null {
  return row.actionProgress?.percent ?? null;
}
export class DashboardOverviewService {
  constructor(
    private readonly projects: Projects,
    private readonly now: () => Date = () => new Date(),
    private readonly progress: GovernanceProgress,
  ) {}
  async overview(
    actor: Actor,
    input: { days: DashboardDays; workspaceId?: string },
  ): Promise<DashboardOverview> {
    const generatedAt = this.now().toISOString();
    const period = dashboardPeriod(new Date(generatedAt), input.days);
    const result: DashboardOverview = {
      generatedAt,
      period,
      metrics: {
        testCases: { value: null, previousValue: null },
        activeTestCases: { value: null, previousValue: null },
        executions: { value: null, previousValue: null },
        defects: { value: null, previousValue: null },
        coverage: { value: null, previousValue: null },
        automationCoverage: { value: null, previousValue: null },
      },
      results: null,
      defectsByStatus: null,
      projects: null,
      activity: null,
      governance: null,
      frameworkGovernance: null,
      documents: null,
    };
    const projectRows: (DashboardProject & { updatedAt: Date })[] = [];
    const goalRows: (DashboardGoal & { deadline: string | null })[] = [];
    const eventRows: DashboardActivity[] = [];
    const documentRows: DashboardDocument[] = [];
    const coverageFractions: number[] = [];
    let activeCases = 0;
    let automatedCases = 0;
    const ids = input.workspaceId
      ? [input.workspaceId]
      : (await this.projects.access.store.visibleWorkspaces(actor.userId)).map(
          (ws) => ws.id,
        );
    for (const ws of ids) {
      try {
        await this.projects.access.store.transaction(ws, async (tx) => {
          const access = await this.projects.access.resolve(tx, ws, actor);
          const contexts = await this.projects.visibleContexts(tx, access);
          const active = contexts.filter(
            (ctx) => ctx.project.status === 'ACTIVE',
          );
          const granted = (permission: PermissionCode) =>
            access.permissions.includes(permission);
          const source = (
            permission: PermissionCode,
            includeArchived = false,
          ) =>
            (includeArchived ? contexts : active)
              .filter((ctx) => ctx.capabilities.includes(permission))
              .map((ctx) => ctx.project.id);
          const cases = source('testcase.read'),
            runs = source('testrun.read'),
            defects = source('defect.read');
          const coverage = cases.filter((id) => runs.includes(id));
          const allActive = granted('governance.read')
            ? await this.projects.activeIds(tx)
            : [];
          const scope: DashboardSourceScope = {
            caseProjects: source('testcase.read', true),
            defectProjects: source('defect.read', true),
            workspaceCases:
              granted('testcase.read') &&
              allActive.every((id) => cases.includes(id)),
            workspaceDefects:
              granted('defect.read') &&
              allActive.every((id) => defects.includes(id)),
            projectProjects: source('project.read'),
            runProjects: runs,
            activeCaseProjects: cases,
            activeDefectProjects: defects,
            workspace: granted('workspace.read'),
            governance: granted('governance.read'),
            attachments: granted('attachment.read'),
          };
          if (period.days === 'ALL') {
            const first = await tx.dashboard.historyStart(scope, period.to);
            if (first && (!period.from || first.toISOString() < period.from))
              period.from = first.toISOString();
          }
          // Each source uses one batched projection, independent of the number of records.
          const catalog = await tx.dashboard.catalog(cases);
          const automation = await tx.dashboard.automation(cases);
          for (const row of automation) {
            activeCases += row.active;
            automatedCases += row.automated;
          }
          const automationMap = new Map(
            automation.map((r) => [r.projectId, r]),
          );
          const executions = await tx.dashboard.executions(runs, period);
          const results = await tx.dashboard.results(runs, period);
          const defectRows = await tx.dashboard.defects(defects, period);
          const exercised = await tx.dashboard.exercised(coverage, period);
          if (granted('testcase.read')) {
            result.metrics.testCases.value =
              (result.metrics.testCases.value ?? 0) +
              catalog.reduce((sum, r) => sum + r.total, 0);
            result.metrics.activeTestCases.value =
              (result.metrics.activeTestCases.value ?? 0) +
              automation.reduce((sum, r) => sum + r.active, 0);
          }
          if (granted('testrun.read')) {
            result.metrics.executions.value =
              (result.metrics.executions.value ?? 0) +
              executions.reduce((sum, r) => sum + r.current, 0);
            if (period.days !== 'ALL')
              result.metrics.executions.previousValue =
                (result.metrics.executions.previousValue ?? 0) +
                executions.reduce((sum, r) => sum + r.previous, 0);
            result.results ??= {
              NOT_TESTED: 0,
              PASSED: 0,
              FAILED: 0,
              BLOCKED: 0,
              SKIPPED: 0,
            };
            for (const row of results) result.results[row.result] += row.total;
          }
          if (granted('defect.read')) {
            result.metrics.defects.value =
              (result.metrics.defects.value ?? 0) +
              defectRows.reduce((sum, r) => sum + r.current, 0);
            if (period.days !== 'ALL')
              result.metrics.defects.previousValue =
                (result.metrics.defects.previousValue ?? 0) +
                defectRows.reduce((sum, r) => sum + r.previous, 0);
            result.defectsByStatus ??= {
              OPEN: 0,
              IN_PROGRESS: 0,
              RESOLVED: 0,
              CLOSED: 0,
              REJECTED: 0,
            };
            for (const row of defectRows)
              result.defectsByStatus[row.status] += row.current;
          }
          const catalogMap = new Map(
            catalog.map((r) => [r.projectId, r.total]),
          );
          const exercisedMap = new Map(
            exercised.map((r) => [r.projectId, r.total]),
          );
          const resultMap = new Map<string, { total: number; done: number }>();
          for (const row of results) {
            const summary = resultMap.get(row.projectId) ?? {
              total: 0,
              done: 0,
            };
            summary.total += row.total;
            if (row.result !== 'NOT_TESTED') summary.done += row.total;
            resultMap.set(row.projectId, summary);
          }
          for (const id of coverage) {
            const denominator = catalogMap.get(id) ?? 0;
            if (denominator)
              coverageFractions.push((exercisedMap.get(id) ?? 0) / denominator);
          }
          if (granted('project.read')) {
            result.projects ??= [];
            for (const ctx of active.filter((ctx) =>
              ctx.capabilities.includes('project.read'),
            )) {
              const p = ctx.project,
                progress = resultMap.get(p.id);
              projectRows.push({
                id: p.id,
                workspaceId: ws,
                workspaceName: access.workspace.name,
                key: p.key,
                name: p.name,
                status: p.status,
                updatedAt: p.updatedAt,
                progress:
                  ctx.capabilities.includes('testrun.read') && progress
                    ? percentage(progress.done, progress.total)
                    : null,
                activeTestCases: cases.includes(p.id)
                  ? (automationMap.get(p.id)?.active ?? 0)
                  : null,
                automationCoverage: cases.includes(p.id)
                  ? percentage(
                      automationMap.get(p.id)?.automated ?? 0,
                      automationMap.get(p.id)?.active ?? 0,
                    )
                  : null,
                coverage: coverage.includes(p.id)
                  ? percentage(
                      exercisedMap.get(p.id) ?? 0,
                      catalogMap.get(p.id) ?? 0,
                    )
                  : null,
              });
            }
          }
          if (scope.governance) {
            result.governance ??= [];
            result.frameworkGovernance ??= {
              indicatorType: 'INTERNAL',
              generatedAt,
              frameworkCount: 0,
              frameworksWithAssessment: 0,
              overall: null,
              frameworks: [],
              attention: {
                notAssessedControls: 0,
                notMetControls: 0,
                partiallyMetControls: 0,
                expiredEvidence: 0,
                upcomingGoals: 0,
              },
            };
            const frameworkBlock = result.frameworkGovernance;
            const frameworks = await tx.frameworks.list({
              where: { status: 'ACTIVE' },
            });
            const progressRows = await this.progress.readMany(
              tx,
              frameworks,
              generatedAt,
            );
            const selectedIds: string[] = [];
            for (const p of progressRows) {
              frameworkBlock.frameworks.push({
                workspaceId: ws,
                workspaceName: access.workspace.name,
                frameworkId: p.framework.id,
                frameworkName: p.framework.name,
                state: p.state,
                assessment: p.assessment,
                definitionVersionDiffers: p.definitionVersionDiffers,
                summary: p.summary,
                sections: p.sections
                  .filter((s) => !s.parentSectionId)
                  .map((s) => ({
                    id: s.id,
                    code: s.code,
                    name: s.name,
                    summary: s.subtree,
                  })),
              });
              if (p.assessment) selectedIds.push(p.assessment.id);
            }
            const today = generatedAt.slice(0, 10);
            const through = new Date(
              new Date(generatedAt).getTime() + 30 * 86400000,
            )
              .toISOString()
              .slice(0, 10);
            frameworkBlock.attention.expiredEvidence +=
              await tx.governanceProgress.expiredEvidence(selectedIds, today);
            frameworkBlock.attention.upcomingGoals +=
              await tx.dashboard.upcomingGoals(scope, today, through);
            const goals = await tx.dashboard.goals(scope);
            const totals = new Map(
              (
                await tx.governanceProgress.actionTotals(goals.map((g) => g.id))
              ).map((r) => [r.goalId, r]),
            );
            for (const row of goals) {
              const last = row.lastResult;
              const completion = actionProgress(totals.get(row.id));
              row.actionProgress = completion;
              const detail = completion.totalActions
                ? `Ações concluídas: ${completion.completedActions} de ${completion.totalActions} (${completion.percent}%). Canceladas: ${completion.cancelledActions}.`
                : 'Nenhuma ação válida vinculada.';
              goalRows.push({
                id: row.id,
                workspaceId: ws,
                name: row.name,
                frameworkName: row.frameworkName,
                frameworkId: row.frameworkId,
                sectionId: row.sectionId,
                sectionName: row.lastResult
                  ? (row.lastResult.section?.name ?? null)
                  : row.sectionName,
                ownerDisplayName: row.ownerDisplayName,
                currentValue: last?.value ?? null,
                targetValue: row.targetValue,
                calculatedAt: last?.calculatedAt ?? null,
                status: actionGoalStatus(
                  row,
                  completion,
                  new Date(generatedAt),
                ),
                actionProgress: completion,
                progress: goalProgress(row),
                detail: detail.slice(0, 250),
                deadline: row.deadline,
              });
            }
          }
          if (scope.attachments) {
            result.documents ??= [];
            for (const row of await tx.dashboard.documents())
              documentRows.push({
                id: row.id,
                workspaceId: ws,
                name: row.name,
                versionLabel: null,
                updatedAt: row.createdAt.toISOString(),
              });
          }
          if (
            access.permissions.some((p) =>
              [
                'workspace.read',
                'project.read',
                'testcase.read',
                'testrun.read',
                'defect.read',
                'governance.read',
                'attachment.read',
              ].includes(p),
            )
          ) {
            result.activity ??= [];
            const byProject = new Map(
              contexts.map((ctx) => [ctx.project.id, ctx.project]),
            );
            for (const row of await tx.dashboard.activity(scope, period)) {
              const project = row.projectId
                ? byProject.get(row.projectId)
                : null;
              eventRows.push({
                id: row.id,
                title: titles[row.module],
                context:
                  `${access.workspace.name}${project ? ` / ${project.key}: ${project.name}` : ''}`.slice(
                    0,
                    250,
                  ),
                occurredAt: row.occurredAt.toISOString(),
                target: {
                  module: row.module,
                  workspaceId: ws,
                  projectId: row.projectId,
                },
              });
            }
          }
        });
      } catch (error) {
        // Discovery can become stale after a committed revocation. Explicit scope remains a 404.
        if (
          !input.workspaceId &&
          error instanceof ApplicationError &&
          error.status === 404
        )
          continue;
        throw error;
      }
    }
    result.metrics.automationCoverage.value = percentage(
      automatedCases,
      activeCases,
    );
    result.metrics.coverage.value = coverageFractions.length
      ? Math.round(
          (coverageFractions.reduce((sum, r) => sum + r, 0) /
            coverageFractions.length) *
            10000,
        ) / 100
      : null;
    if (result.projects)
      result.projects = projectRows
        .sort(
          (a, b) =>
            b.updatedAt.getTime() - a.updatedAt.getTime() ||
            a.id.localeCompare(b.id),
        )
        .slice(0, 10)
        .map(({ updatedAt: _updatedAt, ...row }) => row);
    if (result.activity)
      result.activity = eventRows
        .sort(
          (a, b) =>
            b.occurredAt.localeCompare(a.occurredAt) ||
            a.id.localeCompare(b.id),
        )
        .slice(0, 10);
    if (result.documents)
      result.documents = documentRows
        .sort(
          (a, b) =>
            b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
        )
        .slice(0, 6);
    if (result.governance)
      result.governance = goalRows
        .sort(
          (a, b) =>
            Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') ||
            Number(a.deadline === null) - Number(b.deadline === null) ||
            (a.deadline ?? '').localeCompare(b.deadline ?? '') ||
            a.id.localeCompare(b.id),
        )
        .slice(0, 6);
    if (result.frameworkGovernance) {
      const block = result.frameworkGovernance;
      block.frameworks.sort(
        (a, b) =>
          a.workspaceName.localeCompare(b.workspaceName) ||
          a.workspaceId.localeCompare(b.workspaceId) ||
          a.frameworkName.localeCompare(b.frameworkName) ||
          a.frameworkId.localeCompare(b.frameworkId),
      );
      const summaries = block.frameworks.flatMap((f) =>
        f.summary ? [f.summary] : [],
      );
      block.frameworkCount = block.frameworks.length;
      block.frameworksWithAssessment = summaries.length;
      block.overall = summaries.length ? combineProgress(summaries) : null;
      block.attention.notAssessedControls =
        block.overall?.counts.NOT_ASSESSED ?? 0;
      block.attention.notMetControls = block.overall?.counts.NOT_MET ?? 0;
      block.attention.partiallyMetControls =
        block.overall?.counts.PARTIALLY_MET ?? 0;
    }
    return result;
  }
}
