import { Prisma } from '../../../generated/prisma/client.js';
import type { DashboardQueries } from '../application/ports.js';
import type {
  DashboardPeriod,
  DashboardGoalScope,
  DashboardSourceScope,
  DashboardGoalRow,
  DashboardEventRow,
} from '../domain/models.js';
import type { TestResult } from '../../execution/domain/models.js';
import type { Defect } from '../../defect/domain/models.js';

const inIds = (column: Prisma.Sql, ids: string[]) =>
  ids.length
    ? Prisma.sql`${column} IN (${Prisma.join(ids)})`
    : Prisma.sql`FALSE`;
const since = (
  column: Prisma.Sql,
  period: DashboardPeriod,
  previous = false,
) =>
  period.days === 'ALL'
    ? Prisma.sql`TRUE`
    : Prisma.sql`${column} >= ${new Date((previous ? period.previousFrom : period.from)!)}`;
const currentCount = (column: Prisma.Sql, period: DashboardPeriod) =>
  period.days === 'ALL'
    ? Prisma.sql`COUNT(*)`
    : Prisma.sql`SUM(${since(column, period)})`;
const previousCount = (column: Prisma.Sql, period: DashboardPeriod) =>
  period.days === 'ALL'
    ? Prisma.sql`0`
    : Prisma.sql`SUM(${column} < ${new Date(period.from!)})`;
const historyAllowed = (ids: string[]) => Prisma.sql`NOT EXISTS (
  SELECT 1 FROM JSON_TABLE(
    COALESCE(NULLIF(CAST(g.last_result AS CHAR), 'null'), '{"sourceIds":[]}'),
    '$.sourceIds[*]' COLUMNS (source_id CHAR(36) PATH '$')
  ) AS sources WHERE NOT (${inIds(Prisma.sql`sources.source_id`, ids)})
)`;
function goalVisible(scope: DashboardGoalScope) {
  const source = (
    type: string,
    ids: string[],
    workspace: boolean,
  ) => Prisma.sql`
    (g.goal_type = ${type} AND (
      (g.project_id IS NOT NULL AND ${inIds(Prisma.sql`g.project_id`, ids)}
        AND EXISTS (SELECT 1 FROM projects p WHERE p.workspace_id = g.workspace_id AND p.id = g.project_id AND p.status = 'ACTIVE'))
      OR (g.project_id IS NULL AND ${workspace} AND ${historyAllowed(ids)})
    ))`;
  return Prisma.sql`(g.goal_type = 'GOVERNANCE_SCORE'
    OR ${source('AUTOMATION_COVERAGE', scope.caseProjects, scope.workspaceCases)}
    OR ${source('CRITICAL_DEFECTS', scope.defectProjects, scope.workspaceDefects)})`;
}
/** Projections are tenant-scoped; callers supply already authorized source IDs. */
export class PrismaDashboardQueries implements DashboardQueries {
  constructor(
    private readonly db: Prisma.TransactionClient,
    private readonly workspaceId: string | null,
  ) {}
  private get ws(): string {
    if (!this.workspaceId) throw new Error('Dashboard requires a tenant.');
    return this.workspaceId;
  }
  async catalog(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.db.$queryRaw<
      { projectId: string; total: bigint }[]
    >(Prisma.sql`
      SELECT project_id AS projectId, COUNT(*) AS total FROM test_cases
      WHERE workspace_id = ${this.ws} AND ${inIds(Prisma.sql`project_id`, ids)} AND archived_at IS NULL GROUP BY project_id`);
    return rows.map((r) => ({ ...r, total: Number(r.total) }));
  }
  async automation(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.db.$queryRaw<
      { projectId: string; active: bigint; automated: bigint }[]
    >(Prisma.sql`
      SELECT project_id AS projectId, COUNT(*) AS active,
        SUM(automation_status = 'AUTOMATED') AS automated
      FROM test_cases
      WHERE workspace_id = ${this.ws} AND ${inIds(Prisma.sql`project_id`, ids)}
        AND status = 'ACTIVE' AND archived_at IS NULL
      GROUP BY project_id`);
    return rows.map((r) => ({
      projectId: r.projectId,
      active: Number(r.active),
      automated: Number(r.automated),
    }));
  }
  async executions(ids: string[], period: DashboardPeriod) {
    if (!ids.length) return [];
    const rows = await this.db.$queryRaw<
      { projectId: string; current: bigint; previous: bigint }[]
    >(Prisma.sql`
      SELECT project_id AS projectId,
        ${currentCount(Prisma.sql`created_at`, period)} AS current,
        ${previousCount(Prisma.sql`created_at`, period)} AS previous
      FROM test_runs WHERE workspace_id = ${this.ws} AND ${inIds(Prisma.sql`project_id`, ids)}
        AND ${since(Prisma.sql`created_at`, period, true)} AND created_at < ${new Date(period.to)} GROUP BY project_id`);
    return rows.map((r) => ({
      ...r,
      current: Number(r.current),
      previous: Number(r.previous),
    }));
  }
  async results(ids: string[], period: DashboardPeriod) {
    if (!ids.length) return [];
    const rows = await this.db.$queryRaw<
      { projectId: string; result: TestResult; total: bigint }[]
    >(Prisma.sql`
      SELECT r.project_id AS projectId, c.result, COUNT(*) AS total FROM test_runs r
      JOIN test_run_cases c ON c.workspace_id = r.workspace_id AND c.project_id = r.project_id AND c.test_run_id = r.id
      WHERE r.workspace_id = ${this.ws} AND ${inIds(Prisma.sql`r.project_id`, ids)}
        AND ${since(Prisma.sql`r.created_at`, period)} AND r.created_at < ${new Date(period.to)} GROUP BY r.project_id, c.result`);
    return rows.map((r) => ({ ...r, total: Number(r.total) }));
  }
  async defects(ids: string[], period: DashboardPeriod) {
    if (!ids.length) return [];
    const rows = await this.db.$queryRaw<
      { status: Defect['status']; current: bigint; previous: bigint }[]
    >(Prisma.sql`
      SELECT status, ${currentCount(Prisma.sql`created_at`, period)} AS current,
        ${previousCount(Prisma.sql`created_at`, period)} AS previous FROM defects
      WHERE workspace_id = ${this.ws} AND ${inIds(Prisma.sql`project_id`, ids)}
        AND ${since(Prisma.sql`created_at`, period, true)} AND created_at < ${new Date(period.to)} GROUP BY status`);
    return rows.map((r) => ({
      ...r,
      current: Number(r.current),
      previous: Number(r.previous),
    }));
  }
  async exercised(ids: string[], period: DashboardPeriod) {
    if (!ids.length) return [];
    const rows = await this.db.$queryRaw<
      { projectId: string; total: bigint }[]
    >(Prisma.sql`
      SELECT c.project_id AS projectId, COUNT(DISTINCT c.test_case_id) AS total FROM test_run_cases c
      JOIN test_cases t ON t.workspace_id = c.workspace_id AND t.project_id = c.project_id AND t.id = c.test_case_id AND t.archived_at IS NULL
      WHERE c.workspace_id = ${this.ws} AND ${inIds(Prisma.sql`c.project_id`, ids)}
        AND c.result IN ('PASSED','FAILED','BLOCKED') AND ${since(Prisma.sql`c.executed_at`, period)} AND c.executed_at < ${new Date(period.to)} GROUP BY c.project_id`);
    return rows.map((r) => ({ ...r, total: Number(r.total) }));
  }
  async goals(scope: DashboardGoalScope) {
    const rows = await this.db.$queryRaw<
      (Omit<DashboardGoalRow, 'lastResult'> & { lastResult: string | null })[]
    >(Prisma.sql`
      SELECT g.id, g.name, f.name AS frameworkName, g.framework_id AS frameworkId,
        g.section_id AS sectionId, s.name AS sectionName, u.display_name AS ownerDisplayName, CAST(g.deadline AS CHAR) AS deadline,
        g.status, g.operator, g.target_value AS targetValue, CAST(g.last_result AS CHAR) AS lastResult
      FROM governance_goals g LEFT JOIN governance_frameworks f ON f.workspace_id = g.workspace_id AND f.id = g.framework_id
      LEFT JOIN framework_sections s ON s.workspace_id = g.workspace_id AND s.framework_id = g.framework_id AND s.id = g.section_id
      LEFT JOIN workspace_members m ON m.workspace_id = g.workspace_id AND m.id = g.owner_member_id AND m.status = 'ACTIVE'
      LEFT JOIN users u ON u.id = m.user_id
      WHERE g.workspace_id = ${this.ws} AND g.status IN ('ACTIVE','ACHIEVED','MISSED') AND ${goalVisible(scope)}
      ORDER BY g.id ASC`);
    return rows.map((r) => ({
      ...r,
      lastResult: r.lastResult
        ? (JSON.parse(r.lastResult) as DashboardGoalRow['lastResult'])
        : null,
    }));
  }
  async upcomingGoals(
    scope: DashboardGoalScope,
    today: string,
    through: string,
  ) {
    const rows = await this.db.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COUNT(*) AS total FROM governance_goals g WHERE g.workspace_id = ${this.ws}
        AND g.status <> 'CANCELLED'
        AND NOT (EXISTS (SELECT 1 FROM action_plans a WHERE a.workspace_id = g.workspace_id AND a.goal_id = g.id AND a.status = 'DONE')
          AND NOT EXISTS (SELECT 1 FROM action_plans a WHERE a.workspace_id = g.workspace_id AND a.goal_id = g.id AND a.status IN ('OPEN','IN_PROGRESS'))) AND g.deadline >= ${today} AND g.deadline <= ${through} AND ${goalVisible(scope)}`);
    return Number(rows[0].total);
  }
  private activityQueries(
    scope: DashboardSourceScope,
    period: DashboardPeriod,
  ) {
    const queries: Prisma.Sql[] = [];
    const add = (
      module: DashboardEventRow['module'],
      type: string,
      join: Prisma.Sql,
      project: Prisma.Sql,
      filter: Prisma.Sql,
    ) =>
      queries.push(Prisma.sql`
      SELECT a.id, ${module} AS module, ${project} AS projectId, a.occurred_at AS occurredAt
      FROM audit_events a ${join} WHERE a.workspace_id = ${this.ws} AND a.entity_type = ${type}
        AND ${since(Prisma.sql`a.occurred_at`, period)} AND a.occurred_at < ${new Date(period.to)} AND ${filter}`);
    if (scope.activeCaseProjects.length)
      add(
        'TEST_CASES',
        'TestCase',
        Prisma.sql`JOIN test_cases t ON t.workspace_id = a.workspace_id AND t.id = a.entity_id`,
        Prisma.sql`t.project_id`,
        inIds(Prisma.sql`t.project_id`, scope.activeCaseProjects),
      );
    if (scope.runProjects.length)
      add(
        'EXECUTION',
        'TestRun',
        Prisma.sql`JOIN test_runs r ON r.workspace_id = a.workspace_id AND r.id = a.entity_id`,
        Prisma.sql`r.project_id`,
        inIds(Prisma.sql`r.project_id`, scope.runProjects),
      );
    if (scope.activeDefectProjects.length)
      add(
        'DEFECTS',
        'Defect',
        Prisma.sql`JOIN defects d ON d.workspace_id = a.workspace_id AND d.id = a.entity_id`,
        Prisma.sql`d.project_id`,
        inIds(Prisma.sql`d.project_id`, scope.activeDefectProjects),
      );
    if (scope.projectProjects.length)
      add(
        'PROJECT',
        'Project',
        Prisma.sql`JOIN projects p ON p.workspace_id = a.workspace_id AND p.id = a.entity_id`,
        Prisma.sql`p.id`,
        inIds(Prisma.sql`p.id`, scope.projectProjects),
      );
    if (scope.workspace)
      add(
        'WORKSPACE',
        'Workspace',
        Prisma.sql`JOIN workspaces w ON w.id = a.workspace_id AND w.id = a.entity_id`,
        Prisma.sql`NULL`,
        Prisma.sql`TRUE`,
      );
    if (scope.attachments)
      add(
        'WORKSPACE',
        'Attachment',
        Prisma.sql`JOIN attachments t ON t.workspace_id = a.workspace_id AND t.id = a.entity_id`,
        Prisma.sql`NULL`,
        Prisma.sql`t.deleted_at IS NULL`,
      );
    if (scope.governance) {
      add(
        'GOVERNANCE',
        'GovernanceFramework',
        Prisma.sql`JOIN governance_frameworks f ON f.workspace_id = a.workspace_id AND f.id = a.entity_id`,
        Prisma.sql`NULL`,
        Prisma.sql`TRUE`,
      );
      add(
        'GOVERNANCE',
        'Assessment',
        Prisma.sql`JOIN assessments s ON s.workspace_id = a.workspace_id AND s.id = a.entity_id`,
        Prisma.sql`NULL`,
        Prisma.sql`TRUE`,
      );
      add(
        'GOVERNANCE',
        'GovernanceGoal',
        Prisma.sql`JOIN governance_goals g ON g.workspace_id = a.workspace_id AND g.id = a.entity_id`,
        Prisma.sql`g.project_id`,
        goalVisible(scope),
      );
    }
    return queries;
  }
  async activity(scope: DashboardSourceScope, period: DashboardPeriod) {
    const queries = this.activityQueries(scope, period);
    if (!queries.length) return [];
    return this.db.$queryRaw<DashboardEventRow[]>(
      Prisma.sql`SELECT * FROM (${Prisma.join(queries, ' UNION ALL ')}) events ORDER BY occurredAt DESC, id ASC LIMIT 10`,
    );
  }
  async historyStart(scope: DashboardSourceScope, to: string) {
    const period: DashboardPeriod = {
      days: 'ALL',
      supportedDays: [7, 30, 90, 'ALL'],
      from: null,
      to,
      previousFrom: null,
      previousTo: null,
    };
    // Include the same authorized temporal sources as the displayed indicators/activity,
    // before item limits; current catalog, goals and documents do not define a window.
    const queries = this.activityQueries(scope, period).map(
      (q) => Prisma.sql`
      SELECT MIN(occurredAt) AS instant FROM (${q}) events`,
    );
    if (scope.runProjects.length)
      queries.push(Prisma.sql`SELECT MIN(created_at) AS instant FROM test_runs
        WHERE workspace_id = ${this.ws} AND ${inIds(Prisma.sql`project_id`, scope.runProjects)} AND created_at < ${new Date(to)}`);
    if (scope.activeDefectProjects.length)
      queries.push(Prisma.sql`SELECT MIN(created_at) AS instant FROM defects
        WHERE workspace_id = ${this.ws} AND ${inIds(Prisma.sql`project_id`, scope.activeDefectProjects)} AND created_at < ${new Date(to)}`);
    const coverage = scope.activeCaseProjects.filter((id) =>
      scope.runProjects.includes(id),
    );
    if (coverage.length)
      queries.push(Prisma.sql`SELECT MIN(c.executed_at) AS instant FROM test_run_cases c
        JOIN test_cases t ON t.workspace_id = c.workspace_id AND t.project_id = c.project_id AND t.id = c.test_case_id AND t.archived_at IS NULL
        WHERE c.workspace_id = ${this.ws} AND ${inIds(Prisma.sql`c.project_id`, coverage)}
          AND c.result IN ('PASSED','FAILED','BLOCKED') AND c.executed_at < ${new Date(to)}`);
    if (!queries.length) return null;
    const rows = await this.db.$queryRaw<{ instant: Date | null }[]>(Prisma.sql`
      SELECT MIN(instant) AS instant FROM (${Prisma.join(queries, ' UNION ALL ')}) history`);
    return rows[0].instant;
  }
  documents() {
    return this.db.$queryRaw<
      { id: string; name: string; createdAt: Date }[]
    >(Prisma.sql`
      SELECT id, original_name AS name, created_at AS createdAt FROM attachments
      WHERE workspace_id = ${this.ws} AND deleted_at IS NULL ORDER BY created_at DESC, id ASC LIMIT 6`);
  }
}
