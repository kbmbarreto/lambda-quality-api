import { PrismaDefectSummaryQueries } from '../../defect/infrastructure/prisma-summary-queries.js';
import type { ResultImport } from '../../execution/domain/result-import.js';
import type { VaultEntry } from '../../vault/domain/models.js';
import type { CaseImportReceipt } from '../../testmanagement/application/import-cases.js';
import { PrismaDefectAnalyticsQueries } from '../../defect/infrastructure/prisma-analytics-queries.js';
import { PrismaGovernanceProgressQueries } from '../../governance/infrastructure/prisma-progress-queries.js';
import { PrismaDashboardQueries } from '../../dashboard/infrastructure/prisma-dashboard-queries.js';
import type {
  GovernanceFramework,
  FrameworkSection,
  GovernanceControl,
  Assessment,
  ControlAssessment,
  EvidenceLink,
  GovernanceGoal,
  ActionPlan,
} from '../../governance/domain/models.js';
import type {
  Defect,
  DefectAttachment,
  DefectHistoryEvent,
} from '../../defect/domain/models.js';
import type {
  TestPlan,
  TestPlanCase,
  TestRun,
  TestRunCase,
  TestRunStep,
  ExecutionComment,
} from '../../execution/domain/models.js';
import { randomUUID } from 'node:crypto';
import type {
  TestSuite,
  TestCase,
  TestCaseSummary,
  TestStep,
  TestCaseTag,
  TestCaseAttachment,
  TestCaseFieldValue,
} from '../../testmanagement/domain/models.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../../shared/config/config.js';
import type {
  Records,
  RecordQuery,
} from '../../../shared/application/records.js';
import type {
  WorkspaceStore,
  WorkspaceTransaction,
} from '../application/ports.js';
import type {
  Workspace,
  Member,
  Role,
  Group,
  MemberRole,
  GroupMember,
  GroupRole,
  RolePermission,
  Invitation,
  TenantAudit,
} from '../domain/models.js';
import type {
  CustomFieldDefinition,
  Tag,
} from '../../testmanagement/domain/catalogs.js';
import type { Attachment } from '../../attachment/domain/models.js';
import type {
  Project,
  ProjectMember,
  Milestone,
  Environment,
} from '../../project/domain/models.js';
import { ApplicationError } from '../../../shared/domain/errors.js';

type Db = Prisma.TransactionClient;
interface Spec<T> {
  generated?: (keyof T & string)[];
  table: string;
  fields: (keyof T & string)[];
  json?: (keyof T & string)[];
  booleans?: (keyof T & string)[];
  dates?: (keyof T & string)[];
}
const snake = (field: string) =>
  field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
function databaseCodes(error: unknown, depth = 0): string[] {
  if (!error || typeof error !== 'object' || depth > 5) return [];
  const record = error as Record<string, unknown>;
  return [record.code, record.originalCode, record.kind]
    .filter((value): value is string => typeof value === 'string')
    .concat(
      ...['cause', 'meta', 'driverAdapterError'].map((key) =>
        databaseCodes(record[key], depth + 1),
      ),
    );
}
// SQL identifiers come exclusively from these static specs. All data is bound.
class SqlRecords<T extends { id: string }> implements Records<T> {
  constructor(
    private readonly db: Db,
    private readonly spec: Spec<T>,
    private readonly scope: string | null,
    private readonly workspaceTable = false,
  ) {}
  private column(field: keyof T & string): string {
    if (!this.spec.fields.includes(field))
      throw new Error('Unknown repository field.');
    return `\`${snake(field)}\``;
  }
  private filter(query: RecordQuery<T> = {}) {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (this.scope) {
      clauses.push(`${this.workspaceTable ? '`id`' : '`workspace_id`'} = ?`);
      values.push(this.scope);
    }
    for (const [key, value] of Object.entries(query.where || {})) {
      const column = this.column(key as keyof T & string);
      clauses.push(value === null ? `${column} IS NULL` : `${column} = ?`);
      if (value !== null) values.push(value);
    }
    if (query.in) {
      clauses.push(
        query.in.values.length
          ? `${this.column(query.in.field as keyof T & string)} IN (${query.in.values.map(() => '?').join(',')})`
          : '1 = 0',
      );
      values.push(...query.in.values);
    }
    if (query.search) {
      const value = `%${query.search.value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
      clauses.push(
        `(${query.search.fields.map((field) => `${this.column(field as keyof T & string)} LIKE ?`).join(' OR ')})`,
      );
      values.push(...query.search.fields.map(() => value));
    }
    for (const rule of query.compare || []) {
      const operators = { lt: '<', lte: '<=', gt: '>', gte: '>=' };
      clauses.push(
        `${this.column(rule.field as keyof T & string)} ${rule.op === 'notNull' ? 'IS NOT NULL' : `${operators[rule.op]} ?`}`,
      );
      if (rule.op !== 'notNull') values.push(rule.value);
    }
    return {
      sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '',
      values,
    };
  }
  private decode(row: Record<string, unknown>): T {
    const result: Record<string, unknown> = {};
    for (const key of this.spec.fields) {
      let value = row[key];
      if (this.spec.json?.includes(key))
        value = typeof value === 'string' ? JSON.parse(value) : value;
      if (this.spec.booleans?.includes(key)) value = Boolean(value);
      if (this.spec.dates?.includes(key) && value instanceof Date)
        value = value.toISOString().slice(0, 10);
      result[key] = value;
    }
    return result as T;
  }
  async list(query: RecordQuery<T> = {}): Promise<T[]> {
    const { sql, values } = this.filter(query);
    const select = this.spec.fields
      .map(
        (key) =>
          `${this.spec.json?.includes(key) ? `CAST(${this.column(key)} AS CHAR)` : this.column(key)} AS \`${key}\``,
      )
      .join(', ');
    const order = query.order
      ? `${this.column(query.order.field as keyof T & string)} ${query.order.direction === 'desc' ? 'DESC' : 'ASC'}, \`id\` ASC`
      : '`id` ASC';
    const limit = query.take === undefined ? '' : ' LIMIT ? OFFSET ?';
    const args =
      query.take === undefined
        ? values
        : [...values, query.take, query.skip || 0];
    const rows = await this.db.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${select} FROM \`${this.spec.table}\`${sql} ORDER BY ${order}${limit}`,
      ...args,
    );
    return rows.map((row) => this.decode(row));
  }
  async find(where: Partial<T>): Promise<T | null> {
    return (await this.list({ where, take: 1 }))[0] || null;
  }
  async count(query: RecordQuery<T> = {}): Promise<number> {
    const { sql, values } = this.filter(query);
    const rows = await this.db.$queryRawUnsafe<{ total: bigint }[]>(
      `SELECT COUNT(*) AS total FROM \`${this.spec.table}\`${sql}`,
      ...values,
    );
    return Number(rows[0].total);
  }
  async create(record: T): Promise<T> {
    if (
      this.scope &&
      (this.workspaceTable
        ? record.id
        : (record as Record<string, unknown>).workspaceId) !== this.scope
    )
      throw new Error('Repository tenant mismatch.');
    const fields = this.spec.fields.filter((key) => !this.spec.generated?.includes(key));
    const columns = fields.map((key) => this.column(key));
    const values = fields.map((key) =>
      this.spec.json?.includes(key) ? JSON.stringify(record[key]) : record[key],
    );
    await this.db.$executeRawUnsafe(
      `INSERT INTO \`${this.spec.table}\` (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
      ...values,
    );
    return this.spec.generated?.length ? (await this.find({ id: record.id } as Partial<T>))! : record;
  }
  async update(where: Partial<T>, changes: Partial<T>): Promise<void> {
    const entries = Object.entries(changes).filter(
      ([, value]) => value !== undefined,
    );
    if (!entries.length) return;
    if (entries.some(([key]) => key === 'id' || key === 'workspaceId' || this.spec.generated?.includes(key as keyof T & string)))
      throw new Error('Immutable repository identifier.');
    const { sql, values } = this.filter({ where });
    if (!sql) throw new Error('Unscoped update.');
    await this.db.$executeRawUnsafe(
      `UPDATE \`${this.spec.table}\` SET ${entries.map(([key]) => `${this.column(key as keyof T & string)} = ?`).join(',')}${sql}`,
      ...entries.map(([key, value]) =>
        this.spec.json?.includes(key as keyof T & string)
          ? JSON.stringify(value)
          : value,
      ),
      ...values,
    );
  }
  async remove(where: Partial<T>): Promise<void> {
    const { sql, values } = this.filter({ where });
    if (!sql) throw new Error('Unscoped delete.');
    await this.db.$executeRawUnsafe(
      `DELETE FROM \`${this.spec.table}\`${sql}`,
      ...values,
    );
  }
}
class Transaction implements WorkspaceTransaction {
  readonly dashboard: PrismaDashboardQueries;
  readonly defectAnalytics: PrismaDefectAnalyticsQueries;
  readonly defectSummary: PrismaDefectSummaryQueries;
  readonly governanceProgress: PrismaGovernanceProgressQueries;
  readonly frameworks;
  readonly frameworkSections;
  readonly governanceControls;
  readonly assessments;
  readonly controlAssessments;
  readonly evidenceLinks;
  readonly governanceGoals;
  readonly actionPlans;

  readonly workspaces;
  readonly members;
  readonly roles;
  readonly groups;
  readonly memberRoles;
  readonly groupMembers;
  readonly groupRoles;
  readonly rolePermissions;
  readonly invitations;
  readonly fields;
  readonly tags;
  readonly attachments;
  readonly projects;
  readonly projectMembers;
  readonly milestones;
  readonly environments;
  readonly testSuites;
  readonly testCases;
  readonly caseImports;
  readonly testSteps;
  readonly testCaseTags;
  readonly testCaseAttachments;
  readonly testCaseFieldValues;
  readonly testPlans;
  readonly testPlanCases;
  readonly testRuns;
  readonly resultImports;
  readonly testRunCases;
  readonly testRunSteps;
  readonly executionComments;
  readonly vaultEntries;
  readonly defects;
  readonly defectHistory;
  readonly defectAttachments;
  private readonly scope: string | null;
  constructor(
    private readonly db: Db,
    scope: string | null,
  ) {
    this.scope = scope;
    this.dashboard = new PrismaDashboardQueries(db, scope);
    this.defectSummary = new PrismaDefectSummaryQueries(db, scope);
    this.defectAnalytics = new PrismaDefectAnalyticsQueries(db, scope);
    this.governanceProgress = new PrismaGovernanceProgressQueries(db, scope);
    this.frameworks = new SqlRecords<GovernanceFramework>(
      db,
      {
        table: 'governance_frameworks',
        fields: [
          'id',
          'workspaceId',
          'code',
          'name',
          'versionLabel',
          'description',
          'status',
          'version',
          'createdAt',
          'updatedAt',
        ],
      },
      scope,
    );
    this.frameworkSections = new SqlRecords<FrameworkSection>(
      db,
      {
        table: 'framework_sections',
        fields: [
          'id',
          'workspaceId',
          'frameworkId',
          'parentSectionId',
          'code',
          'name',
          'description',
          'position',
        ],
      },
      scope,
    );
    this.governanceControls = new SqlRecords<GovernanceControl>(
      db,
      {
        table: 'governance_controls',
        generated: ['creationOrder'],
        fields: [
          'creationOrder',
          'id',
          'workspaceId',
          'frameworkId',
          'sectionId',
          'code',
          'title',
          'description',
          'weight',
          'active',
        ],
        booleans: ['active'],
      },
      scope,
    );
    this.assessments = new SqlRecords<Assessment>(
      db,
      {
        table: 'assessments',
        fields: [
          'id',
          'workspaceId',
          'frameworkId',
          'name',
          'status',
          'assessmentDate',
          'frameworkSnapshot',
          'closedAt',
          'createdBy',
          'version',
          'createdAt',
          'updatedAt',
        ],
        json: ['frameworkSnapshot'],
        dates: ['assessmentDate'],
      },
      scope,
    );
    this.controlAssessments = new SqlRecords<ControlAssessment>(
      db,
      {
        table: 'control_assessments',
        fields: [
          'id',
          'workspaceId',
          'frameworkId',
          'assessmentId',
          'controlId',
          'controlSnapshot',
          'status',
          'score',
          'justification',
          'assessedBy',
          'assessedAt',
        ],
        json: ['controlSnapshot'],
      },
      scope,
    );
    this.evidenceLinks = new SqlRecords<EvidenceLink>(
      db,
      {
        table: 'evidence_links',
        fields: [
          'id',
          'workspaceId',
          'controlAssessmentId',
          'evidenceType',
          'referenceId',
          'url',
          'title',
          'validUntil',
          'attachmentSnapshot',
          'createdBy',
          'createdAt',
        ],
        json: ['attachmentSnapshot'],
        dates: ['validUntil'],
      },
      scope,
    );
    this.governanceGoals = new SqlRecords<GovernanceGoal>(
      db,
      {
        table: 'governance_goals',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'frameworkId',
          'sectionId',
          'ownerMemberId',
          'name',
          'description',
          'goalType',
          'operator',
          'targetValue',
          'deadline',
          'status',
          'lastResult',
          'createdBy',
          'version',
          'createdAt',
          'updatedAt',
        ],
        json: ['lastResult'],
        dates: ['deadline'],
      },
      scope,
    );
    this.actionPlans = new SqlRecords<ActionPlan>(
      db,
      {
        table: 'action_plans',
        fields: [
          'id',
          'workspaceId',
          'controlAssessmentId',
          'goalId',
          'title',
          'description',
          'ownerMemberId',
          'status',
          'dueDate',
          'completedAt',
          'createdBy',
          'version',
          'createdAt',
          'updatedAt',
        ],
        dates: ['dueDate'],
      },
      scope,
    );

    this.vaultEntries = new SqlRecords<VaultEntry>(db,{table:"test_vault_entries",fields:["id","workspaceId","projectId","environmentId","name","encryptedPayload","keyId","version","createdBy","createdAt","updatedAt","deletedAt"]},scope);
    const history = new SqlRecords<DefectHistoryEvent>(
      db,
      {
        table: 'defect_history_events',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'defectId',
          'type',
          'actorUserId',
          'actorDisplayName',
          'createdAt',
          'fromStatus',
          'toStatus',
          'comment',
        ],
      },
      scope,
    );
    this.defectHistory = {
      create: (event: DefectHistoryEvent) => history.create(event),
      list: (
        query?: import('../../../shared/application/records.js').RecordQuery<DefectHistoryEvent>,
      ) => history.list(query),
      count: (
        query?: import('../../../shared/application/records.js').RecordQuery<DefectHistoryEvent>,
      ) => history.count(query),
    };
    this.defects = new SqlRecords<Defect>(
      db,
      {
        table: 'defects',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'sequence',
          'title',
          'description',
          'severity',
          'status',
          'testRunCaseId',
          'environmentId',
          'environmentSnapshot',
          'externalSystem',
          'externalIssueId',
          'externalUrl',
          'version',
          'createdBy',
          'createdAt',
          'updatedAt',
          'resolvedAt',
        ],
        json: ['environmentSnapshot'],
      },
      scope,
    );
    this.defectAttachments = new SqlRecords<DefectAttachment>(
      db,
      {
        table: 'defect_attachments',
        fields: ['id', 'workspaceId', 'projectId', 'defectId', 'attachmentId'],
      },
      scope,
    );

    this.testPlans = new SqlRecords<TestPlan>(
      db,
      {
        table: 'test_plans',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'milestoneId',
          'environmentId',
          'name',
          'description',
          'status',
          'version',
          'createdBy',
          'createdAt',
          'updatedAt',
          'activatedAt',
          'completedAt',
          'archivedAt',
        ],
      },
      scope,
    );
    this.testPlanCases = new SqlRecords<TestPlanCase>(
      db,
      {
        table: 'test_plan_cases',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'testPlanId',
          'testCaseId',
          'position',
        ],
      },
      scope,
    );
    this.testRuns = new SqlRecords<TestRun>(
      db,
      {
        table: 'test_runs',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'testPlanId',
          'milestoneId',
          'environmentId',
          'planNameSnapshot',
          'milestoneSnapshot',
          'environmentSnapshot',
          'name',
          'source',
          'externalRunRef',
          'status',
          'version',
          'createdBy',
          'createdAt',
          'updatedAt',
          'startedAt',
          'finishedAt',
        ],
        json: ['milestoneSnapshot', 'environmentSnapshot'],
      },
      scope,
    );
    this.resultImports = new SqlRecords<ResultImport>(
      db,
      {
        table: "test_result_imports",
        fields: [
          "id",
          "workspaceId",
          "projectId",
          "testRunId",
          "runVersion",
          "fileName",
          "fileHash",
          "items",
          "createdBy",
          "createdAt",
          "expiresAt",
          "requestKey",
          "requestHash",
          "appliedAt",
          "appliedVersion",
          "mappings",
        ],
        json: ["items", "mappings"],
      },
      scope,
    );
    this.testRunCases = new SqlRecords<TestRunCase>(
      db,
      {
        table: 'test_run_cases',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'testRunId',
          'testCaseId',
          'position',
          'caseSequenceSnapshot',
          'humanIdSnapshot',
          'titleSnapshot',
          'severitySnapshot',
          'prioritySnapshot',
          'definitionSnapshot',
          'customFieldsSnapshot',
          'tagsSnapshot',
          'result',
          'resultOrigin',
          'externalResult',
          'executedBy',
          'executedAt',
          'comment',
          'createdAt',
          'updatedAt',
        ],
        json: ['definitionSnapshot', 'customFieldsSnapshot', 'tagsSnapshot', 'externalResult'],
      },
      scope,
    );
    this.testRunSteps = new SqlRecords<TestRunStep>(
      db,
      {
        table: 'test_run_steps',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'testRunId',
          'testRunCaseId',
          'sourceStepId',
          'position',
          'actionSnapshot',
          'testDataSnapshot',
          'expectedResultSnapshot',
          'actualResult',
          'result',
          'comment',
          'executedBy',
          'executedAt',
        ],
      },
      scope,
    );
    this.executionComments = new SqlRecords<ExecutionComment>(
      db,
      {
        table: 'execution_comments',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'testRunId',
          'runCaseId',
          'runStepId',
          'text',
          'createdBy',
          'createdAt',
        ],
      },
      scope,
    );

    this.testSuites = new SqlRecords<TestSuite>(
      db,
      {
        table: 'test_suites',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'parentSuiteId',
          'name',
          'description',
          'position',
          'createdAt',
          'updatedAt',
          'archivedAt',
        ],
      },
      scope,
    );
    this.caseImports = new SqlRecords<CaseImportReceipt>(db, {table: 'test_case_imports', fields: ['id','workspaceId','projectId','fileHash','cases','createdBy','createdAt'],json:['cases']},scope);
    this.testCases = new SqlRecords<TestCase>(
      db,
      {
        table: 'test_cases',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'suiteId',
          'sequence',
          'title',
          'description',
          'preconditions',
          'postconditions',
          'severity',
          'priority',
          'status',
          'type',
          'layer',
          'behavior',
          'automationStatus',
          'createdBy',
          'version',
          'createdAt',
          'updatedAt',
          'archivedAt',
        ],
      },
      scope,
    );
    this.testSteps = new SqlRecords<TestStep>(
      db,
      {
        table: 'test_steps',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'testCaseId',
          'position',
          'action',
          'testData',
          'expectedResult',
        ],
      },
      scope,
    );
    this.testCaseTags = new SqlRecords<TestCaseTag>(
      db,
      {
        table: 'test_case_tags',
        fields: ['id', 'workspaceId', 'projectId', 'testCaseId', 'tagId'],
      },
      scope,
    );
    this.testCaseAttachments = new SqlRecords<TestCaseAttachment>(
      db,
      {
        table: 'test_case_attachments',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'testCaseId',
          'attachmentId',
        ],
      },
      scope,
    );
    this.testCaseFieldValues = new SqlRecords<TestCaseFieldValue>(
      db,
      {
        table: 'test_case_field_values',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'testCaseId',
          'fieldId',
          'value',
        ],
        json: ['value'],
      },
      scope,
    );
    this.projects = new SqlRecords<Project>(
      db,
      {
        table: 'projects',
        fields: [
          'id',
          'workspaceId',
          'key',
          'name',
          'description',
          'status',
          'createdAt',
          'updatedAt',
          'archivedAt',
        ],
      },
      scope,
    );
    this.projectMembers = new SqlRecords<ProjectMember>(
      db,
      {
        table: 'project_members',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'workspaceMemberId',
          'projectRole',
          'createdAt',
          'updatedAt',
        ],
      },
      scope,
    );
    this.milestones = new SqlRecords<Milestone>(
      db,
      {
        table: 'milestones',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'name',
          'description',
          'status',
          'startDate',
          'dueDate',
          'completedAt',
          'createdAt',
          'updatedAt',
          'deletedAt',
        ],
        dates: ['startDate', 'dueDate'],
      },
      scope,
    );
    this.environments = new SqlRecords<Environment>(
      db,
      {
        table: 'environments',
        fields: [
          'id',
          'workspaceId',
          'projectId',
          'name',
          'normalizedName',
          'category',
          'description',
          'active',
          'createdAt',
          'updatedAt',
          'deletedAt',
        ],
        booleans: ['active'],
      },
      scope,
    );
    this.workspaces = new SqlRecords<Workspace>(
      db,
      {
        table: 'workspaces',
        fields: [
          'id',
          'name',
          'slug',
          'status',
          'ownerMemberId',
          'createdAt',
          'updatedAt',
        ],
      },
      scope,
      true,
    );
    this.members = new SqlRecords<Member>(
      db,
      {
        table: 'workspace_members',
        fields: ['id', 'workspaceId', 'userId', 'status', 'joinedAt'],
      },
      scope,
    );
    this.roles = new SqlRecords<Role>(
      db,
      {
        table: 'roles',
        fields: [
          'id',
          'workspaceId',
          'name',
          'normalizedName',
          'description',
          'systemRole',
          'createdAt',
        ],
        booleans: ['systemRole'],
      },
      scope,
    );
    this.groups = new SqlRecords<Group>(
      db,
      {
        table: 'groups',
        fields: [
          'id',
          'workspaceId',
          'name',
          'normalizedName',
          'description',
          'createdAt',
        ],
      },
      scope,
    );
    this.memberRoles = new SqlRecords<MemberRole>(
      db,
      {
        table: 'member_roles',
        fields: ['id', 'workspaceId', 'memberId', 'roleId'],
      },
      scope,
    );
    this.groupMembers = new SqlRecords<GroupMember>(
      db,
      {
        table: 'group_members',
        fields: ['id', 'workspaceId', 'groupId', 'memberId'],
      },
      scope,
    );
    this.groupRoles = new SqlRecords<GroupRole>(
      db,
      {
        table: 'group_roles',
        fields: ['id', 'workspaceId', 'groupId', 'roleId'],
      },
      scope,
    );
    this.rolePermissions = new SqlRecords<RolePermission>(
      db,
      {
        table: 'role_permissions',
        fields: ['id', 'workspaceId', 'roleId', 'permissionCode'],
      },
      scope,
    );
    this.invitations = new SqlRecords<Invitation>(
      db,
      {
        table: 'invitations',
        fields: [
          'id',
          'workspaceId',
          'email',
          'tokenHash',
          'status',
          'expiresAt',
          'invitedBy',
          'acceptedBy',
          'acceptedAt',
          'createdAt',
          'lastSentAt',
          'deliveryStatus',
          'deliveryPayload',
          'deliveryAttempts',
        ],
      },
      scope,
    );
    this.fields = new SqlRecords<CustomFieldDefinition>(
      db,
      {
        table: 'custom_field_definitions',
        fields: [
          'id',
          'workspaceId',
          'key',
          'name',
          'description',
          'type',
          'target',
          'required',
          'position',
          'options',
          'archivedAt',
          'createdAt',
          'updatedAt',
        ],
        json: ['options'],
        booleans: ['required'],
      },
      scope,
    );
    this.tags = new SqlRecords<Tag>(
      db,
      {
        table: 'tags',
        fields: [
          'id',
          'workspaceId',
          'name',
          'normalizedName',
          'createdAt',
          'updatedAt',
        ],
      },
      scope,
    );
    this.attachments = new SqlRecords<Attachment>(
      db,
      {
        table: 'attachments',
        fields: [
          'id',
          'workspaceId',
          'storageKey',
          'originalName',
          'contentType',
          'sizeBytes',
          'checksum',
          'uploadedBy',
          'createdAt',
          'deletedAt',
        ],
      },
      scope,
    );
  }
  inWorkspace(workspaceId: string): WorkspaceTransaction {
    if (this.scope !== null)
      throw new Error("Scoped transactions cannot change tenant.");
    return new Transaction(this.db, workspaceId);
  }
  async summarizeRuns(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.db.$queryRaw<
      {
        testRunId: string;
        result: import("../../execution/domain/models.js").TestResult;
        total: bigint;
      }[]
    >(Prisma.sql`
      SELECT test_run_id AS testRunId, result, COUNT(*) AS total FROM test_run_cases
      WHERE test_run_id IN (${Prisma.join(ids)}) ${this.scope ? Prisma.sql`AND workspace_id = ${this.scope}` : Prisma.empty}
      GROUP BY test_run_id, result`);
    return rows.map((r) => ({ ...r, total: Number(r.total) }));
  }
  async summarizeAutomation(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.db.$queryRaw<
      { projectId: string; active: bigint; automated: bigint }[]
    >(Prisma.sql`
      SELECT project_id AS projectId, COUNT(*) AS active, SUM(automation_status = 'AUTOMATED') AS automated FROM test_cases
      WHERE project_id IN (${Prisma.join(ids)}) AND status = 'ACTIVE' AND archived_at IS NULL
      ${this.scope ? Prisma.sql`AND workspace_id = ${this.scope}` : Prisma.empty} GROUP BY project_id`);
    return rows.map((r) => ({
      projectId: r.projectId,
      active: Number(r.active),
      automated: Number(r.automated),
    }));
  }
  async summarizeTestCases(
    projectId: string,
    status?: TestCase['status'] | 'ALL',
  ): Promise<TestCaseSummary> {
    if (!this.scope) throw new Error('Test case summary requires a tenant.');
    const statusFilter =
      status === 'ALL'
        ? Prisma.empty
        : status
          ? Prisma.sql`AND status = ${status}`
          : Prisma.sql`AND archived_at IS NULL`;
    const rows = await this.db.$queryRaw<
      { suiteId: string | null; totalCases: bigint }[]
    >(Prisma.sql`
      SELECT suite_id AS suiteId, COUNT(*) AS totalCases
      FROM test_cases
      WHERE workspace_id = ${this.scope} AND project_id = ${projectId}
      ${statusFilter}
      GROUP BY suite_id
      ORDER BY suite_id ASC
    `);
    const suites = rows.map((row) => ({
      suiteId: row.suiteId,
      totalCases: Number(row.totalCases),
    }));
    return {
      totalCases: suites.reduce((total, suite) => total + suite.totalCases, 0),
      suites,
    };
  }
  reserveCaseSequence(projectId: string): Promise<number> {
    return this.reserveSequence(projectId, 'TEST_CASE');
  }
  reserveDefectSequence(projectId: string): Promise<number> {
    return this.reserveSequence(projectId, 'DEFECT');
  }
  private async reserveSequence(
    projectId: string,
    entityType: 'TEST_CASE' | 'DEFECT',
  ): Promise<number> {
    if (!this.scope) throw new Error('Sequence requires a tenant.');
    const id = randomUUID();
    await this.db
      .$executeRaw`INSERT INTO sequence_counters (id,workspace_id,project_id,entity_type,next_value) VALUES (${id},${this.scope},${projectId},${entityType},1) ON DUPLICATE KEY UPDATE next_value = next_value`;
    const rows = await this.db.$queryRaw<
      { nextValue: number }[]
    >`SELECT next_value AS nextValue FROM sequence_counters WHERE workspace_id = ${this.scope} AND project_id = ${projectId} AND entity_type = ${entityType} FOR UPDATE`;
    const sequence = rows[0].nextValue;
    if (sequence >= 2147483647)
      throw new ApplicationError(
        409,
        entityType === 'TEST_CASE'
          ? 'TEST_CASE_SEQUENCE_EXHAUSTED'
          : 'DEFECT_SEQUENCE_EXHAUSTED',
        'O limite de sequência do projeto foi atingido.',
      );
    await this.db
      .$executeRaw`UPDATE sequence_counters SET next_value = ${sequence + 1} WHERE workspace_id = ${this.scope} AND project_id = ${projectId} AND entity_type = ${entityType}`;
    return sequence;
  }
  async audit(event: TenantAudit): Promise<void> {
    await this.db.auditEvent.create({ data: event });
  }
}
export class PrismaWorkspaceStore implements WorkspaceStore {
  readonly client: PrismaClient;
  constructor(config: AppConfig) {
    const { url: _url, ...settings } = config.database;
    this.client = new PrismaClient({
      adapter: new PrismaMariaDb({
        ...settings,
        charset: 'utf8mb4',
        timezone: 'Z',
        connectionLimit: 10,
        connectTimeout: 5000,
        acquireTimeout: 5000,
      }),
    });
  }
  async transaction<T>(
    workspaceId: string | null,
    work: (tx: WorkspaceTransaction) => Promise<T>,
    lockWorkspaceIds: string[] = [],
  ): Promise<T> {
    try {
      return await this.client.$transaction(
        async (db) => {
          for (const id of [...new Set(lockWorkspaceIds)].sort())
            await db.$queryRaw`SELECT id FROM workspaces WHERE id = ${id} FOR UPDATE`;
          if (workspaceId)
            await db.$queryRaw`SELECT id FROM workspaces WHERE id = ${workspaceId} FOR UPDATE`;
          return work(new Transaction(db, workspaceId));
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 10000,
          timeout: 20000,
        },
      );
    } catch (error) {
      const codes = databaseCodes(error);
      if (
        codes.some((code) =>
          ['P2002', '1062', 'UniqueConstraintViolation'].includes(code),
        )
      )
        throw new ApplicationError(
          409,
          'RESOURCE_CONFLICT',
          'Já existe um recurso com os mesmos dados neste escopo.',
        );
      if (
        codes.some((code) =>
          ['P2034', '1205', '1213', 'TransactionWriteConflict'].includes(code),
        )
      )
        throw new ApplicationError(
          503,
          'SERVICE_UNAVAILABLE',
          'Operação concorrente. Consulte o estado atual e tente novamente.',
        );
      throw error;
    }
  }
  inventory<T>(
    workspaceIds: string[],
    work: (tx: WorkspaceTransaction) => Promise<T>,
  ) {
    return this.transaction(null, work, workspaceIds);
  }
  findInvitationByHash(tokenHash: string) {
    return this.client.invitation.findUnique({
      where: { tokenHash },
      select: { id: true, workspaceId: true },
    });
  }
  async visibleWorkspaces(userId: string): Promise<Workspace[]> {
    const rows = await this.client.workspace.findMany({
      where: {
        status: 'ACTIVE',
        members: { some: { userId, status: 'ACTIVE' } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows as Workspace[];
  }
  pendingDeliveries(limit: number) {
    return this.client.invitation.findMany({
      where: { deliveryPayload: { not: null } },
      take: limit,
      orderBy: { lastSentAt: 'asc' },
      select: { id: true, workspaceId: true },
    });
  }
  deletedAttachments(before: Date) {
    return this.client.attachment.findMany({
      where: { deletedAt: { lt: before } },
    });
  }
  async storageKeys() {
    return (
      await this.client.attachment.findMany({ select: { storageKey: true } })
    ).map((row) => row.storageKey);
  }
  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
