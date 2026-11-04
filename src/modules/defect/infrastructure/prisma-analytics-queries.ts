import { Prisma } from '../../../generated/prisma/client.js';
import type { DefectAnalyticsQueries } from '../application/analytics.js';
import type {
  DefectAggregate,
  DefectAnalyticsInput,
} from '../domain/analytics.js';
export class PrismaDefectAnalyticsQueries implements DefectAnalyticsQueries {
  constructor(
    private readonly db: Prisma.TransactionClient,
    private readonly workspaceId: string | null,
  ) {}
  async aggregate(projectIds: string[], input: DefectAnalyticsInput) {
    if (!projectIds.length) return [];
    if (!this.workspaceId)
      throw new Error('Defect analytics requires a tenant.');
    const end = new Date(`${input.to}T23:59:59.999Z`);
    const rows = await this.db.$queryRaw<
      (Omit<DefectAggregate, 'total'> & { total: bigint })[]
    >(Prisma.sql`
      SELECT * FROM (
        SELECT project_id AS projectId, DATE_FORMAT(created_at, '%Y-%m') AS month, environment_id AS environmentId,
          CASE WHEN environment_id IS NULL THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(environment_snapshot, '$.name')) END AS environmentName,
          CASE WHEN environment_id IS NULL THEN 'UNSPECIFIED' ELSE JSON_UNQUOTE(JSON_EXTRACT(environment_snapshot, '$.category')) END AS category,
          status, COUNT(*) AS total FROM defects
        WHERE workspace_id = ${this.workspaceId} AND project_id IN (${Prisma.join(projectIds)})
          AND created_at >= ${new Date(`${input.from}T00:00:00.000Z`)} AND created_at <= ${end}
        GROUP BY project_id, month, environment_id, environmentName, category, status
      ) report ${input.category ? Prisma.sql`WHERE category = ${input.category}` : Prisma.empty}`);
    return rows.map((r) => ({ ...r, total: Number(r.total) }));
  }
}
