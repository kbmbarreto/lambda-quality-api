import type {
  TestCase,
  FieldValueSnapshot,
} from '../../testmanagement/domain/models.js';
export const PLAN_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'ARCHIVED',
] as const;
export const RUN_STATUSES = [
  'CREATED',
  'IN_PROGRESS',
  'COMPLETED',
  'ABORTED',
] as const;
export const TEST_RESULTS = [
  'NOT_TESTED',
  'PASSED',
  'FAILED',
  'BLOCKED',
  'SKIPPED',
] as const;
export type TestResult = (typeof TEST_RESULTS)[number];
export interface TestPlan {
  id: string;
  workspaceId: string;
  projectId: string;
  milestoneId: string | null;
  environmentId: string | null;
  name: string;
  description: string | null;
  status: (typeof PLAN_STATUSES)[number];
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  activatedAt: Date | null;
  completedAt: Date | null;
  archivedAt: Date | null;
}
export interface TestPlanCase {
  id: string;
  workspaceId: string;
  projectId: string;
  testPlanId: string;
  testCaseId: string;
  position: number;
}
export interface ContextSnapshot {
  name: string;
  description: string | null;
}
export interface TestRun {
  id: string;
  workspaceId: string;
  projectId: string;
  testPlanId: string | null;
  milestoneId: string | null;
  environmentId: string | null;
  planNameSnapshot: string | null;
  milestoneSnapshot: ContextSnapshot | null;
  environmentSnapshot: ContextSnapshot | null;
  name: string;
  source: 'MANUAL';
  externalRunRef: string | null;
  status: (typeof RUN_STATUSES)[number];
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}
export type DefinitionSnapshot = Pick<
  TestCase,
  | 'description'
  | 'preconditions'
  | 'postconditions'
  | 'type'
  | 'layer'
  | 'behavior'
  | 'automationStatus'
  | 'suiteId'
  | 'status'
  | 'version'
>;
export type FieldSnapshot = FieldValueSnapshot;
export interface TestRunCase {
  id: string;
  workspaceId: string;
  projectId: string;
  testRunId: string;
  testCaseId: string;
  position: number;
  caseSequenceSnapshot: number;
  humanIdSnapshot: string;
  titleSnapshot: string;
  severitySnapshot: TestCase['severity'];
  prioritySnapshot: TestCase['priority'];
  definitionSnapshot: DefinitionSnapshot;
  customFieldsSnapshot: FieldSnapshot[];
  tagsSnapshot: { id: string; name: string }[];
  result: TestResult;
  resultOrigin: 'MANUAL' | 'JUNIT';
  externalResult: import('./result-import.js').ExternalResult | null;
  executedBy: string | null;
  executedAt: Date | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface TestRunStep {
  id: string;
  workspaceId: string;
  projectId: string;
  testRunId: string;
  testRunCaseId: string;
  sourceStepId: string;
  position: number;
  actionSnapshot: string;
  testDataSnapshot: string | null;
  expectedResultSnapshot: string | null;
  actualResult: string | null;
  result: TestResult;
  comment: string | null;
  executedBy: string | null;
  executedAt: Date | null;
}
export interface ExecutionComment {
  id: string;
  workspaceId: string;
  projectId: string;
  testRunId: string;
  runCaseId: string | null;
  runStepId: string | null;
  text: string;
  createdBy: string;
  createdAt: Date;
}
