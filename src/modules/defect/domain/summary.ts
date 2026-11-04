import type { Defect } from './models.js';
import type { EnvironmentCategory } from '../../project/domain/models.js';

export interface DefectSummaryAggregate {
  status: Defect['status'];
  category: EnvironmentCategory | 'UNSPECIFIED';
  total: number;
  resolutionHours: number;
  resolutionSamples: number;
}
export interface DefectSummary {
  generatedAt: Date;
  totalBugs: number;
  byStatus: Record<Defect['status'], number>;
  byCategory: Record<EnvironmentCategory | 'UNSPECIFIED', number>;
  resolutionTime: {
    averageHours: number | null;
    sampleSize: number;
    basis: 'CREATED_TO_RESOLVED';
  } | null;
}
