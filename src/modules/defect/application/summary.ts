import { withInventoryScope } from '../../project/application/inventory-scope.js';
import { Projects } from '../../project/application/projects.js';
import type { Actor } from '../../workspace/domain/models.js';
import type { RecordQuery } from '../../../shared/application/records.js';
import type { Defect } from '../domain/models.js';
import type {
  DefectSummary,
  DefectSummaryAggregate,
} from '../domain/summary.js';
import { defectInventoryFilter } from './inventory-filters.js';
import type { DefectInventoryFilters } from './inventory-filters.js';

export const DEFECT_SUMMARY = Symbol('DefectSummary');
export interface DefectSummaryQueries {
  aggregate(
    projectIds: string[],
    filter: RecordQuery<Defect>,
  ): Promise<DefectSummaryAggregate[]>;
}
export class DefectSummaryService {
  constructor(private readonly projects: Projects) {}
  read(actor: Actor, input: DefectInventoryFilters) {
    return withInventoryScope(
      this.projects,
      actor,
      input,
      'defect.read',
      async (tx, contexts): Promise<DefectSummary> => {
        const result: DefectSummary = {
          generatedAt: new Date(),
          totalBugs: 0,
          byStatus: {
            OPEN: 0,
            IN_PROGRESS: 0,
            RESOLVED: 0,
            CLOSED: 0,
            REJECTED: 0,
          },
          byCategory: {
            HOMOLOGATION: 0,
            PRODUCTION: 0,
            OTHER: 0,
            UNSPECIFIED: 0,
          },
          resolutionTime: {
            averageHours: null,
            sampleSize: 0,
            basis: 'CREATED_TO_RESOLVED',
          },
        };
        let hours = 0,
          samples = 0;
        for (const row of await tx.defectSummary.aggregate(
          contexts.map((c) => c.project.id),
          defectInventoryFilter(input),
        )) {
          result.totalBugs += row.total;
          result.byStatus[row.status] += row.total;
          result.byCategory[row.category] += row.total;
          hours += row.resolutionHours;
          samples += row.resolutionSamples;
        }
        result.resolutionTime = {
          averageHours: samples
            ? Math.round((hours / samples) * 100) / 100
            : null,
          sampleSize: samples,
          basis: 'CREATED_TO_RESOLVED',
        };
        return result;
      },
      { requireWorkspaceGrant: true },
    );
  }
}
