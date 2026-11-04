import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import type { Actor } from '../../workspace/domain/models.js';
import { notFound } from '../../workspace/application/access.js';
import type {
  Assessment,
  GovernanceFramework,
  GoalActionTotals,
} from '../domain/models.js';
import type { ProgressControl } from '../domain/progress.js';
import { frameworkProgress } from '../domain/progress.js';
import { GovernanceFrameworks } from './frameworks.js';
export const GOVERNANCE_PROGRESS = Symbol('GovernanceProgress');
export interface GovernanceProgressQueries {
  actionTotals(goalIds: string[]): Promise<GoalActionTotals[]>;
  latest(frameworkIds: string[], closedOnly?: boolean): Promise<Assessment[]>;
  controls(assessmentIds: string[]): Promise<ProgressControl[]>;
  expiredEvidence(assessmentIds: string[], today: string): Promise<number>;
}
export class GovernanceProgress {
  constructor(
    readonly frameworks: GovernanceFrameworks,
    private readonly now: () => Date = () => new Date(),
  ) {}
  read(actor: Actor, ws: string, frameworkId: string, assessmentId?: string) {
    return this.frameworks.access.run(
      ws,
      actor,
      'governance.read',
      async (tx) => {
        const framework = await this.frameworks.find(tx, frameworkId);
        const assessment = assessmentId
          ? await tx.assessments.find({ id: assessmentId, frameworkId })
          : ((await tx.governanceProgress.latest([frameworkId]))[0] ?? null);
        if (assessmentId && !assessment) throw notFound();
        const controls = assessment
          ? await tx.governanceProgress.controls([assessment.id])
          : [];
        return frameworkProgress(
          framework,
          assessment,
          controls,
          this.now().toISOString(),
        );
      },
    );
  }
  async readMany(
    tx: WorkspaceTransaction,
    frameworks: GovernanceFramework[],
    generatedAt: string,
  ) {
    const assessments = await tx.governanceProgress.latest(
      frameworks.map((f) => f.id),
    );
    const controls = await tx.governanceProgress.controls(
      assessments.map((a) => a.id),
    );
    const byFramework = new Map(assessments.map((a) => [a.frameworkId, a]));
    const byAssessment = new Map<string, ProgressControl[]>();
    for (const c of controls) {
      const bucket = byAssessment.get(c.assessmentId) ?? [];
      bucket.push(c);
      byAssessment.set(c.assessmentId, bucket);
    }
    return frameworks.map((f) => {
      const a = byFramework.get(f.id) ?? null;
      return frameworkProgress(
        f,
        a,
        a ? (byAssessment.get(a.id) ?? []) : [],
        generatedAt,
      );
    });
  }
}
