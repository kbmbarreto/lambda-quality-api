import type { EnvironmentCategory } from '../../project/domain/models.js';
import type { TestCase } from '../../testmanagement/domain/models.js';
export const DEFECT_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
] as const;
export interface DefectEnvironmentSnapshot {
  name: string;
  category: EnvironmentCategory;
}
export interface Defect {
  environmentId: string | null;
  environmentSnapshot: DefectEnvironmentSnapshot | null;
  id: string;
  workspaceId: string;
  projectId: string;
  sequence: number;
  title: string;
  description: string | null;
  severity: TestCase['severity'];
  status: (typeof DEFECT_STATUSES)[number];
  testRunCaseId: string | null;
  externalSystem: string | null;
  externalIssueId: string | null;
  externalUrl: string | null;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}
export interface DefectAttachment {
  id: string;
  workspaceId: string;
  projectId: string;
  defectId: string;
  attachmentId: string;
}

export interface DefectHistoryEvent {
  id: string;
  workspaceId: string;
  projectId: string;
  defectId: string;
  type: 'CREATED' | 'UPDATED';
  actorUserId: string | null;
  actorDisplayName: string | null;
  createdAt: Date;
  fromStatus: Defect['status'] | null;
  toStatus: Defect['status'] | null;
  comment: string | null;
}
