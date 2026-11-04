import type { Defect } from './models.js';
import type { EnvironmentCategory } from '../../project/domain/models.js';
export const DEFECT_ENVIRONMENT_CATEGORIES = [
  'PRODUCTION',
  'HOMOLOGATION',
  'OTHER',
  'UNSPECIFIED',
] as const;
export type DefectEnvironmentCategory = EnvironmentCategory | 'UNSPECIFIED';
export interface DefectAnalyticsInput {
  from: string;
  to: string;
  projectId?: string;
  category?: DefectEnvironmentCategory;
}
export interface DefectAggregate {
  projectId: string;
  month: string;
  environmentId: string | null;
  environmentName: string | null;
  category: DefectEnvironmentCategory;
  status: Defect['status'];
  total: number;
}
export interface DefectAnalytics {
  generatedAt: string;
  period: { from: string; to: string; dateField: 'createdAt'; timezone: 'UTC' };
  totalBugs: number;
  byStatus: Record<Defect['status'], number>;
  byCategory: Record<DefectEnvironmentCategory, number>;
  monthly: {
    month: string;
    totalBugs: number;
    byCategory: Record<DefectEnvironmentCategory, number>;
  }[];
  byProject: {
    projectId: string;
    projectKey: string;
    projectName: string;
    totalBugs: number;
    byCategory: Record<DefectEnvironmentCategory, number>;
  }[];
  byEnvironment: {
    projectId: string;
    environmentId: string | null;
    name: string | null;
    category: DefectEnvironmentCategory;
    totalBugs: number;
  }[];
}
