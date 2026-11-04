import type {
  DashboardPeriod,
  DashboardGoalScope,
  DashboardSourceScope,
  DashboardGoalRow,
  DashboardEventRow,
} from '../domain/models.js';
import type { TestResult } from '../../execution/domain/models.js';
import type { Defect } from '../../defect/domain/models.js';
export interface DashboardQueries {
  historyStart(scope: DashboardSourceScope, to: string): Promise<Date | null>;
  catalog(
    projectIds: string[],
  ): Promise<{ projectId: string; total: number }[]>;
  automation(
    projectIds: string[],
  ): Promise<{ projectId: string; active: number; automated: number }[]>;
  executions(
    projectIds: string[],
    period: DashboardPeriod,
  ): Promise<{ projectId: string; current: number; previous: number }[]>;
  results(
    projectIds: string[],
    period: DashboardPeriod,
  ): Promise<{ projectId: string; result: TestResult; total: number }[]>;
  defects(
    projectIds: string[],
    period: DashboardPeriod,
  ): Promise<{ status: Defect['status']; current: number; previous: number }[]>;
  exercised(
    projectIds: string[],
    period: DashboardPeriod,
  ): Promise<{ projectId: string; total: number }[]>;
  upcomingGoals(
    scope: DashboardGoalScope,
    today: string,
    through: string,
  ): Promise<number>;
  goals(scope: DashboardGoalScope): Promise<DashboardGoalRow[]>;
  activity(
    scope: DashboardSourceScope,
    period: DashboardPeriod,
  ): Promise<DashboardEventRow[]>;
  documents(): Promise<{ id: string; name: string; createdAt: Date }[]>;
}
