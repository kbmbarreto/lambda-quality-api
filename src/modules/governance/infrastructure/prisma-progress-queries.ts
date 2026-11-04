import { Prisma } from '../../../generated/prisma/client.js';
import type { GovernanceProgressQueries } from '../application/progress.js';
import type { Assessment } from '../domain/models.js';
import type { ProgressControl } from '../domain/progress.js';
/** Only selected assessments and minimal control projections leave persistence. */
export class PrismaGovernanceProgressQueries implements GovernanceProgressQueries {
  constructor(
    private readonly db: Prisma.TransactionClient,
    private readonly workspaceId: string | null,
  ) {}
  private get ws() {
    if (!this.workspaceId) throw new Error('Governance requires a tenant.');
    return this.workspaceId;
  }
  async actionTotals(goalIds: string[]) {
    if (!goalIds.length) return [];
    const rows = await this.db.$queryRaw<
      { goalId: string; total: bigint; completed: bigint; cancelled: bigint }[]
    >(Prisma.sql`
      SELECT goal_id AS goalId, SUM(status <> 'CANCELLED') AS total,
        SUM(status = 'DONE') AS completed, SUM(status = 'CANCELLED') AS cancelled
      FROM action_plans WHERE workspace_id = ${this.ws} AND goal_id IN (${Prisma.join(goalIds)})
      GROUP BY goal_id`);
    return rows.map((r) => ({
      goalId: r.goalId,
      total: Number(r.total),
      completed: Number(r.completed),
      cancelled: Number(r.cancelled),
    }));
  }
  async latest(
    frameworkIds: string[],
    closedOnly = false,
  ): Promise<Assessment[]> {
    if (!frameworkIds.length) return [];
    const ids = await this.db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY framework_id ORDER BY
          (status = 'IN_PROGRESS') DESC,
          CASE WHEN status = 'IN_PROGRESS' THEN created_at ELSE closed_at END DESC, id ASC) AS rank_position
        FROM assessments WHERE workspace_id = ${this.ws} AND framework_id IN (${Prisma.join(frameworkIds)})
          AND ${closedOnly ? Prisma.sql`status = 'CLOSED'` : Prisma.sql`status IN ('IN_PROGRESS', 'CLOSED')`}
      ) ranked WHERE rank_position = 1`);
    if (!ids.length) return [];
    const rows = await this.db.assessment.findMany({
      where: { workspaceId: this.ws, id: { in: ids.map((r) => r.id) } },
    });
    return rows.map((r) => ({
      ...r,
      status: r.status as Assessment['status'],
      assessmentDate: r.assessmentDate.toISOString().slice(0, 10),
      frameworkSnapshot:
        r.frameworkSnapshot as unknown as Assessment['frameworkSnapshot'],
    }));
  }
  async controls(assessmentIds: string[]) {
    if (!assessmentIds.length) return [];
    const rows = await this.db.$queryRaw<ProgressControl[]>(Prisma.sql`
      SELECT assessment_id AS assessmentId,
        JSON_UNQUOTE(JSON_EXTRACT(control_snapshot, '$.sectionId')) AS sectionId, status,
        CAST(JSON_UNQUOTE(JSON_EXTRACT(control_snapshot, '$.weight')) AS DOUBLE) AS weight
      FROM control_assessments WHERE workspace_id = ${this.ws} AND assessment_id IN (${Prisma.join(assessmentIds)})`);
    return rows.map((r) => ({ ...r, weight: Number(r.weight) }));
  }
  async expiredEvidence(assessmentIds: string[], today: string) {
    if (!assessmentIds.length) return 0;
    const rows = await this.db.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COUNT(*) AS total FROM evidence_links e JOIN control_assessments c
        ON c.workspace_id = e.workspace_id AND c.id = e.control_assessment_id
      WHERE e.workspace_id = ${this.ws} AND c.assessment_id IN (${Prisma.join(assessmentIds)}) AND e.valid_until < ${today}`);
    return Number(rows[0].total);
  }
}
