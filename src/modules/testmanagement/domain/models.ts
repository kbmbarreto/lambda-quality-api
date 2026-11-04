import type { CustomFieldDefinition } from './catalogs.js';
export const SEVERITIES = [
  'TRIVIAL',
  'MINOR',
  'NORMAL',
  'MAJOR',
  'CRITICAL',
  'BLOCKER',
] as const;
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const CASE_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'DEPRECATED',
  'ARCHIVED',
] as const;
export const TEST_TYPES = [
  'FUNCTIONAL',
  'REGRESSION',
  'SMOKE',
  'SANITY',
  'PERFORMANCE',
  'SECURITY',
  'USABILITY',
  'OTHER',
] as const;
export const TEST_LAYERS = [
  'E2E',
  'API',
  'INTEGRATION',
  'UNIT',
  'COMPONENT',
  'OTHER',
] as const;
export const AUTOMATION_STATUSES = [
  'MANUAL',
  'TO_BE_AUTOMATED',
  'IN_PROGRESS',
  'AUTOMATED',
  'NOT_APPLICABLE',
] as const;
export interface TestSuite {
  id: string;
  workspaceId: string;
  projectId: string;
  parentSuiteId: string | null;
  name: string;
  description: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}
export interface TestCase {
  id: string;
  workspaceId: string;
  projectId: string;
  suiteId: string | null;
  sequence: number;
  title: string;
  description: string | null;
  preconditions: string | null;
  postconditions: string | null;
  severity: (typeof SEVERITIES)[number];
  priority: (typeof PRIORITIES)[number];
  status: (typeof CASE_STATUSES)[number];
  type: (typeof TEST_TYPES)[number];
  layer: (typeof TEST_LAYERS)[number];
  behavior: string | null;
  automationStatus: (typeof AUTOMATION_STATUSES)[number];
  createdBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}
export interface TestCaseSummary {
  totalCases: number;
  suites: { suiteId: string | null; totalCases: number }[];
}
export interface TestStep {
  id: string;
  workspaceId: string;
  projectId: string;
  testCaseId: string;
  position: number;
  action: string;
  testData: string | null;
  expectedResult: string | null;
}
export interface TestCaseTag {
  id: string;
  workspaceId: string;
  projectId: string;
  testCaseId: string;
  tagId: string;
}
export interface TestCaseAttachment {
  id: string;
  workspaceId: string;
  projectId: string;
  testCaseId: string;
  attachmentId: string;
}
export type CustomValue = string | number | boolean;
export interface TestCaseFieldValue {
  id: string;
  workspaceId: string;
  projectId: string;
  testCaseId: string;
  fieldId: string;
  value: CustomValue;
}
export interface FieldValueInput {
  fieldId: string;
  value: CustomValue | null;
}

export interface FieldValueSnapshot {
  fieldId: string;
  key: string;
  name: string;
  type: CustomFieldDefinition['type'];
  required: boolean;
  options: CustomFieldDefinition['options'];
  archivedAt: string | null;
  value: CustomValue;
}
