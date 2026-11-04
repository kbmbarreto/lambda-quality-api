import { Prisma } from '../../../generated/prisma/client.js';
import type { DefectSummaryQueries } from '../application/summary.js';
import type { DefectSummaryAggregate } from '../domain/summary.js';
import type { Defect } from '../domain/models.js';
import type { RecordQuery } from '../../../shared/application/records.js';

export class PrismaDefectSummaryQueries implements DefectSummaryQueries {
  constructor(
    private readonly db: Prisma.TransactionClient,
    private readonly workspaceId: string | null,
  ) {}
  async aggregate(projectIds: string[], filter: RecordQuery<Defect>) {
    if (!projectIds.length) return [];
    const title = filter.search?.value;
    const pattern = title
      ? `%${title.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
      : null;
    // Duration uses actual UTC instants, not updated_at, calendar days or per-tenant averages.
    const eligible = Prisma.sql`status IN ('RESOLVED','CLOSED') AND resolved_at IS NOT NULL AND resolved_at >= created_at`;
    const rows = await this.db.$queryRaw<
      (Omit<
        DefectSummaryAggregate,
        'total' | 'resolutionSamples' | 'resolutionHours'
      > & {
        total: bigint;
        resolutionSamples: bigint;
        resolutionHours: unknown;
      })[]
    >(Prisma.sql`
      SELECT status,
        CASE WHEN environment_id IS NULL THEN 'UNSPECIFIED'
          WHEN JSON_UNQUOTE(JSON_EXTRACT(environment_snapshot,'$.category')) IN ('PRODUCTION','HOMOLOGATION','OTHER')
            THEN JSON_UNQUOTE(JSON_EXTRACT(environment_snapshot,'$.category'))
          ELSE 'UNSPECIFIED' END AS category,
        COUNT(*) AS total,
        SUM(CASE WHEN ${eligible} THEN TIMESTAMPDIFF(MICROSECOND,created_at,resolved_at) / 3600000000.0 ELSE 0 END) AS resolutionHours,
        SUM(CASE WHEN ${eligible} THEN 1 ELSE 0 END) AS resolutionSamples
      FROM defects WHERE project_id IN (${Prisma.join(projectIds)})
        ${this.workspaceId ? Prisma.sql`AND workspace_id = ${this.workspaceId}` : Prisma.empty}
        ${filter.where?.status ? Prisma.sql`AND status = ${filter.where.status}` : Prisma.empty}
        ${filter.where?.severity ? Prisma.sql`AND severity = ${filter.where.severity}` : Prisma.empty}
        ${pattern ? Prisma.sql`AND title LIKE ${pattern}` : Prisma.empty}
      GROUP BY status,category`);
    return rows.map((r) => ({
      ...r,
      total: Number(r.total),
      resolutionSamples: Number(r.resolutionSamples),
      resolutionHours: Number(r.resolutionHours),
    }));
  }
}
