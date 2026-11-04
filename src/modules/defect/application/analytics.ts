import { ApplicationError } from '../../../shared/domain/errors.js';
import type { Actor } from '../../workspace/domain/models.js';
import { forbidden } from '../../workspace/application/access.js';
import { Projects } from '../../project/application/projects.js';
import type {
  DefectAggregate,
  DefectAnalytics,
  DefectAnalyticsInput,
} from '../domain/analytics.js';
import { validDate } from '../../../shared/domain/calendar-date.js';
export const DEFECT_ANALYTICS = Symbol('DefectAnalytics');
export interface DefectAnalyticsQueries {
  aggregate(
    projectIds: string[],
    input: DefectAnalyticsInput,
  ): Promise<DefectAggregate[]>;
}
export function reportMonths(from: string, to: string) {
  if (!validDate(from) || !validDate(to) || from > to)
    throw new ApplicationError(
      400,
      'VALIDATION_ERROR',
      'Informe um intervalo válido de datas.',
    );
  const first = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7)) - 1;
  const last = Number(to.slice(0, 4)) * 12 + Number(to.slice(5, 7)) - 1;
  if (last - first >= 36)
    throw new ApplicationError(
      400,
      'VALIDATION_ERROR',
      'Consulte até 36 meses por vez.',
    );
  return Array.from(
    { length: last - first + 1 },
    (_, i) =>
      `${Math.floor((first + i) / 12)
        .toString()
        .padStart(
          4,
          '0',
        )}-${(((first + i) % 12) + 1).toString().padStart(2, '0')}`,
  );
}
const categories = () => ({
  PRODUCTION: 0,
  HOMOLOGATION: 0,
  OTHER: 0,
  UNSPECIFIED: 0,
});
export class DefectAnalyticsService {
  constructor(private readonly projects: Projects) {}
  read(actor: Actor, ws: string, input: DefectAnalyticsInput) {
    const months = reportMonths(input.from, input.to);
    return this.projects.access.run(
      ws,
      actor,
      'defect.read',
      async (tx, access): Promise<DefectAnalytics> => {
        const contexts = input.projectId
          ? [await this.projects.resolve(tx, actor, ws, input.projectId)]
          : await this.projects.visibleContexts(tx, access);
        if (
          input.projectId &&
          !contexts[0].capabilities.includes('defect.read')
        )
          throw forbidden();
        const projects = contexts
          .filter((c) => c.capabilities.includes('defect.read'))
          .map((c) => c.project);
        const result: DefectAnalytics = {
          generatedAt: new Date().toISOString(),
          period: {
            from: input.from,
            to: input.to,
            dateField: 'createdAt',
            timezone: 'UTC',
          },
          totalBugs: 0,
          byStatus: {
            OPEN: 0,
            IN_PROGRESS: 0,
            RESOLVED: 0,
            CLOSED: 0,
            REJECTED: 0,
          },
          byCategory: categories(),
          monthly: months.map((month) => ({
            month,
            totalBugs: 0,
            byCategory: categories(),
          })),
          byProject: [],
          byEnvironment: [],
        };
        const monthly = new Map(result.monthly.map((m) => [m.month, m]));
        const projectRows = new Map(
          projects.map((p) => [
            p.id,
            {
              projectId: p.id,
              projectKey: p.key,
              projectName: p.name,
              totalBugs: 0,
              byCategory: categories(),
            },
          ]),
        );
        const environments = new Map<
          string,
          DefectAnalytics['byEnvironment'][number]
        >();
        for (const row of await tx.defectAnalytics.aggregate(
          projects.map((p) => p.id),
          input,
        )) {
          result.totalBugs += row.total;
          result.byStatus[row.status] += row.total;
          result.byCategory[row.category] += row.total;
          const month = monthly.get(row.month)!;
          month.totalBugs += row.total;
          month.byCategory[row.category] += row.total;
          const project = projectRows.get(row.projectId)!;
          project.totalBugs += row.total;
          project.byCategory[row.category] += row.total;
          const key = JSON.stringify([
            row.projectId,
            row.environmentId,
            row.environmentName,
            row.category,
          ]);
          const environment = environments.get(key) ?? {
            projectId: row.projectId,
            environmentId: row.environmentId,
            name: row.environmentName,
            category: row.category,
            totalBugs: 0,
          };
          environment.totalBugs += row.total;
          environments.set(key, environment);
        }
        result.byProject = [...projectRows.values()].sort(
          (a, b) =>
            a.projectName.localeCompare(b.projectName) ||
            a.projectId.localeCompare(b.projectId),
        );
        result.byEnvironment = [...environments.values()].sort(
          (a, b) =>
            a.projectId.localeCompare(b.projectId) ||
            a.category.localeCompare(b.category) ||
            (a.name ?? '').localeCompare(b.name ?? '') ||
            (a.environmentId ?? '').localeCompare(b.environmentId ?? ''),
        );
        return result;
      },
    );
  }
}
