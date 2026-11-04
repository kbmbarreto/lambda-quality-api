export const FRAMEWORK_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export type FrameworkStatus = (typeof FRAMEWORK_STATUSES)[number];
export const ASSESSMENT_STATUSES = ['DRAFT', 'IN_PROGRESS', 'CLOSED'] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];
export const COMPLIANCE_STATUSES = [
  'NOT_ASSESSED',
  'NOT_MET',
  'PARTIALLY_MET',
  'MET',
  'NOT_APPLICABLE',
] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];
export const EVIDENCE_TYPES = ['ATTACHMENT', 'URL'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export const GOAL_TYPES = [
  'AUTOMATION_COVERAGE',
  'CRITICAL_DEFECTS',
  'GOVERNANCE_SCORE',
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];
export const GOAL_OPERATORS = ['GT', 'GTE', 'EQ', 'LTE', 'LT'] as const;
export type GoalOperator = (typeof GOAL_OPERATORS)[number];
export const GOAL_STATUSES = [
  'ACTIVE',
  'ACHIEVED',
  'MISSED',
  'CANCELLED',
] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];
export const ACTION_PLAN_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
] as const;
export type ActionPlanStatus = (typeof ACTION_PLAN_STATUSES)[number];
export interface FrameworkSnapshot {
  id: string;
  code: string;
  name: string;
  versionLabel: string;
  version: number;
  description: string | null;
  sections: FrameworkSection[];
}
export interface ControlSnapshot {
  id: string;
  sectionId: string;
  code: string;
  title: string;
  description: string | null;
  weight: number;
  sectionPath: { id: string; code: string; name: string }[];
}
export interface AttachmentSnapshot {
  originalName: string;
  contentType: string;
  sizeBytes: number;
  checksum: string;
}
export const GOAL_RESULT_REASONS = [
  'SECTION_NOT_IN_SNAPSHOT',
  'EMPTY_SECTION',
  'NO_APPLICABLE_CONTROLS',
  'NO_CLOSED_ASSESSMENT',
] as const;
export interface GoalResult {
  reason?: (typeof GOAL_RESULT_REASONS)[number];
  section?: {
    id: string;
    name: string;
    path: { id: string; code: string; name: string }[];
  } | null;
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  calculatedAt: string;
  sourceIds: string[];
}
export interface GovernanceFramework {
  id: string;
  workspaceId: string;
  code: string;
  name: string;
  versionLabel: string;
  description: string | null;
  status: FrameworkStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface FrameworkSection {
  id: string;
  workspaceId: string;
  frameworkId: string;
  parentSectionId: string | null;
  code: string;
  name: string;
  description: string | null;
  position: number;
}
export interface GovernanceControl {
  creationOrder: number;
  id: string;
  workspaceId: string;
  frameworkId: string;
  sectionId: string;
  code: string;
  title: string;
  description: string | null;
  weight: number;
  active: boolean;
}
export interface Assessment {
  id: string;
  workspaceId: string;
  frameworkId: string;
  name: string;
  status: AssessmentStatus;
  assessmentDate: string;
  frameworkSnapshot: FrameworkSnapshot;
  closedAt: Date | null;
  createdBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface ControlAssessment {
  id: string;
  workspaceId: string;
  frameworkId: string;
  assessmentId: string;
  controlId: string;
  controlSnapshot: ControlSnapshot;
  status: ComplianceStatus;
  score: number | null;
  justification: string | null;
  assessedBy: string | null;
  assessedAt: Date | null;
}
export interface EvidenceLink {
  id: string;
  workspaceId: string;
  controlAssessmentId: string;
  evidenceType: EvidenceType;
  referenceId: string | null;
  url: string | null;
  title: string;
  validUntil: string | null;
  attachmentSnapshot: AttachmentSnapshot | null;
  createdBy: string;
  createdAt: Date;
}
export interface GovernanceGoal {
  sectionId: string | null;
  ownerMemberId: string | null;
  id: string;
  workspaceId: string;
  projectId: string | null;
  frameworkId: string | null;
  name: string;
  description: string | null;
  goalType: GoalType;
  operator: GoalOperator;
  targetValue: number;
  deadline: string | null;
  status: GoalStatus;
  lastResult: GoalResult | null;
  createdBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface ActionPlan {
  id: string;
  workspaceId: string;
  controlAssessmentId: string | null;
  goalId: string | null;
  title: string;
  description: string | null;
  ownerMemberId: string | null;
  status: ActionPlanStatus;
  dueDate: string | null;
  completedAt: Date | null;
  createdBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalActionTotals {
  goalId: string;
  total: number;
  completed: number;
  cancelled: number;
}
export interface GoalActionProgress {
  basis: 'ACTIONS';
  totalActions: number;
  completedActions: number;
  cancelledActions: number;
  percent: number | null;
}
