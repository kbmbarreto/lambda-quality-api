import type {
  FrameworkProgress,
  ProgressSummary,
} from '../../governance/domain/progress.js';
import type { TestResult } from '../../execution/domain/models.js';
import type { Defect } from '../../defect/domain/models.js';
import type {
  GoalResult,
  GoalActionProgress,
  GoalStatus,
  GoalOperator,
} from '../../governance/domain/models.js';
export type DashboardDays = 7 | 30 | 90 | 'ALL';
export const dashboardSupportedDays: DashboardDays[] = [7, 30, 90, 'ALL'];
export interface DashboardPeriod {
  days: DashboardDays;
  supportedDays: DashboardDays[];
  from: string | null;
  to: string;
  previousFrom: string | null;
  previousTo: string | null;
}
export interface DashboardMetric {
  value: number | null;
  previousValue: number | null;
}
export type DashboardResults = Record<TestResult, number>;
export type DashboardDefects = Record<Defect['status'], number>;
export type DashboardModule =
  | 'TEST_CASES'
  | 'EXECUTION'
  | 'DEFECTS'
  | 'GOVERNANCE'
  | 'PROJECT'
  | 'WORKSPACE';
export interface DashboardProject {
  id: string;
  workspaceId: string;
  workspaceName: string;
  key: string;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  progress: number | null;
  coverage: number | null;
  activeTestCases: number | null;
  automationCoverage: number | null;
}
export interface DashboardActivity {
  id: string;
  title: string;
  context: string;
  occurredAt: string;
  target: {
    module: DashboardModule;
    workspaceId: string;
    projectId: string | null;
  };
}
export interface DashboardGoal {
  actionProgress: GoalActionProgress;
  frameworkId: string | null;
  sectionId: string | null;
  sectionName: string | null;
  ownerDisplayName: string | null;
  currentValue: number | null;
  targetValue: number;
  deadline: string | null;
  calculatedAt: string | null;
  id: string;
  workspaceId: string;
  name: string;
  frameworkName: string | null;
  progress: number | null;
  detail: string;
  status: GoalStatus;
}
export interface DashboardDocument {
  id: string;
  workspaceId: string;
  name: string;
  versionLabel: string | null;
  updatedAt: string;
}
export interface DashboardOverview {
  generatedAt: string;
  period: DashboardPeriod;
  metrics: {
    testCases: DashboardMetric;
    activeTestCases: DashboardMetric;
    executions: DashboardMetric;
    defects: DashboardMetric;
    coverage: DashboardMetric;
    automationCoverage: DashboardMetric;
  };
  results: DashboardResults | null;
  defectsByStatus: DashboardDefects | null;
  projects: DashboardProject[] | null;
  activity: DashboardActivity[] | null;
  governance: DashboardGoal[] | null;
  frameworkGovernance: DashboardFrameworkGovernance | null;
  documents: DashboardDocument[] | null;
}
export interface DashboardGoalRow {
  actionProgress?: GoalActionProgress;
  frameworkId: string | null;
  sectionId: string | null;
  sectionName: string | null;
  ownerDisplayName: string | null;
  id: string;
  name: string;
  frameworkName: string | null;
  deadline: string | null;
  status: GoalStatus;
  operator: GoalOperator;
  targetValue: number;
  lastResult: GoalResult | null;
}
export interface DashboardEventRow {
  id: string;
  module: DashboardModule;
  projectId: string | null;
  occurredAt: Date;
}
export interface DashboardGoalScope {
  caseProjects: string[];
  defectProjects: string[];
  workspaceCases: boolean;
  workspaceDefects: boolean;
}
export interface DashboardSourceScope extends DashboardGoalScope {
  projectProjects: string[];
  runProjects: string[];
  activeCaseProjects: string[];
  activeDefectProjects: string[];
  workspace: boolean;
  governance: boolean;
  attachments: boolean;
}

export interface DashboardFrameworkGovernance {
  indicatorType: 'INTERNAL';
  generatedAt: string;
  frameworkCount: number;
  frameworksWithAssessment: number;
  overall: ProgressSummary | null;
  frameworks: {
    workspaceId: string;
    workspaceName: string;
    frameworkId: string;
    frameworkName: string;
    state: FrameworkProgress['state'];
    assessment: FrameworkProgress['assessment'];
    definitionVersionDiffers: boolean;
    summary: ProgressSummary | null;
    sections: {
      id: string;
      code: string;
      name: string;
      summary: ProgressSummary;
    }[];
  }[];
  attention: {
    notAssessedControls: number;
    notMetControls: number;
    partiallyMetControls: number;
    expiredEvidence: number;
    upcomingGoals: number;
  };
}
