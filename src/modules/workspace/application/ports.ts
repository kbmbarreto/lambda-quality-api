import type { DefectSummaryQueries } from '../../defect/application/summary.js';
import type { ResultImport } from '../../execution/domain/result-import.js';
import type { VaultEntry } from '../../vault/domain/models.js';
import type { CaseImportReceipt } from '../../testmanagement/application/import-cases.js';
import type { DefectAnalyticsQueries } from '../../defect/application/analytics.js';
import type { GovernanceProgressQueries } from '../../governance/application/progress.js';
import type { DashboardQueries } from '../../dashboard/application/ports.js';
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
import type {
  TestSuite,
  TestCase,
  TestCaseSummary,
  TestStep,
  TestCaseTag,
  TestCaseAttachment,
  TestCaseFieldValue,
} from '../../testmanagement/domain/models.js';
import type { Records } from '../../../shared/application/records.js';
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
export const WORKSPACE_STORE = Symbol('WorkspaceStore');
export const INVITATION_MAIL = Symbol('InvitationMail');
export interface WorkspaceTransaction {
  dashboard: DashboardQueries;
  defectAnalytics: DefectAnalyticsQueries;
  defectSummary: DefectSummaryQueries;
  governanceProgress: GovernanceProgressQueries;
  frameworks: Records<GovernanceFramework>;
  frameworkSections: Records<FrameworkSection>;
  governanceControls: Records<GovernanceControl>;
  assessments: Records<Assessment>;
  controlAssessments: Records<ControlAssessment>;
  evidenceLinks: Records<EvidenceLink>;
  governanceGoals: Records<GovernanceGoal>;
  actionPlans: Records<ActionPlan>;

  workspaces: Records<Workspace>;
  members: Records<Member>;
  roles: Records<Role>;
  groups: Records<Group>;
  memberRoles: Records<MemberRole>;
  groupMembers: Records<GroupMember>;
  groupRoles: Records<GroupRole>;
  rolePermissions: Records<RolePermission>;
  invitations: Records<Invitation>;
  fields: Records<CustomFieldDefinition>;
  tags: Records<Tag>;
  attachments: Records<Attachment>;
  projects: Records<Project>;
  projectMembers: Records<ProjectMember>;
  milestones: Records<Milestone>;
  environments: Records<Environment>;
  testSuites: Records<TestSuite>;
  testCases: Records<TestCase>;
  caseImports: Records<CaseImportReceipt>;
  testSteps: Records<TestStep>;
  testCaseTags: Records<TestCaseTag>;
  testCaseAttachments: Records<TestCaseAttachment>;
  testCaseFieldValues: Records<TestCaseFieldValue>;
  testPlans: Records<TestPlan>;
  testPlanCases: Records<TestPlanCase>;
  testRuns: Records<TestRun>;
  resultImports: Records<ResultImport>;
  inWorkspace(workspaceId: string): WorkspaceTransaction;
  summarizeRuns(ids: string[]): Promise<
    {
      testRunId: string;
      result: import('../../execution/domain/models.js').TestResult;
      total: number;
    }[]
  >;
  summarizeAutomation(
    ids: string[],
  ): Promise<{ projectId: string; active: number; automated: number }[]>;
  testRunCases: Records<TestRunCase>;
  testRunSteps: Records<TestRunStep>;
  executionComments: Records<ExecutionComment>;
  vaultEntries: Records<VaultEntry>;
  defects: Records<Defect>;
  defectHistory: Pick<Records<DefectHistoryEvent>, 'create' | 'list' | 'count'>;
  defectAttachments: Records<DefectAttachment>;
  reserveDefectSequence(projectId: string): Promise<number>;
  reserveCaseSequence(projectId: string): Promise<number>;
  summarizeTestCases(
    projectId: string,
    status?: TestCase['status'] | 'ALL',
  ): Promise<TestCaseSummary>;
  audit(event: TenantAudit): Promise<void>;
}
export interface WorkspaceStore {
  transaction<T>(
    workspaceId: string | null,
    work: (tx: WorkspaceTransaction) => Promise<T>,
  ): Promise<T>;
  inventory<T>(
    workspaceIds: string[],
    work: (tx: WorkspaceTransaction) => Promise<T>,
  ): Promise<T>;
  findInvitationByHash(
    hash: string,
  ): Promise<Pick<Invitation, 'id' | 'workspaceId'> | null>;
  visibleWorkspaces(userId: string): Promise<Workspace[]>;
  pendingDeliveries(
    limit: number,
  ): Promise<Pick<Invitation, 'id' | 'workspaceId'>[]>;
  deletedAttachments(before: Date): Promise<Attachment[]>;
  storageKeys(): Promise<string[]>;
}
export interface InvitationMail {
  send(input: {
    email: string;
    token: string;
    workspaceName: string;
    expiresAt: Date;
  }): Promise<void>;
}
