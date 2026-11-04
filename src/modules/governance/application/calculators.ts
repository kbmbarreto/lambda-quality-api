import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import type { GovernanceGoal, GoalType, GoalResult } from '../domain/models.js';
import { AutomationMetrics } from '../../testmanagement/application/metrics.js';
import { CriticalDefectMetrics } from '../../defect/application/metrics.js';
import { progressSummary, sectionPath } from '../domain/progress.js';
export interface GoalCalculationContext {
  tx: WorkspaceTransaction;
  projectIds: string[];
  now: Date;
}
export interface GoalCalculator {
  supports(): GoalType;
  calculate(
    goal: GovernanceGoal,
    ctx: GoalCalculationContext,
  ): Promise<GoalResult>;
}
export class AutomationCoverageCalculator implements GoalCalculator {
  supports(): GoalType {
    return 'AUTOMATION_COVERAGE';
  }
  constructor(private readonly source = new AutomationMetrics()) {}
  async calculate(_goal: GovernanceGoal, ctx: GoalCalculationContext) {
    let numerator = 0,
      denominator = 0;
    for (const id of ctx.projectIds) {
      const metric = await this.source.read(ctx.tx, id);
      numerator += metric.numerator;
      denominator += metric.denominator;
    }
    return {
      value: denominator
        ? Math.round((numerator / denominator) * 10000) / 100
        : null,
      numerator,
      denominator,
      calculatedAt: ctx.now.toISOString(),
      sourceIds: ctx.projectIds,
    };
  }
}
export class CriticalDefectsCalculator implements GoalCalculator {
  supports(): GoalType {
    return 'CRITICAL_DEFECTS';
  }
  constructor(private readonly source = new CriticalDefectMetrics()) {}
  async calculate(_goal: GovernanceGoal, ctx: GoalCalculationContext) {
    let value = 0;
    for (const id of ctx.projectIds)
      value += await this.source.read(ctx.tx, id);
    return {
      value,
      numerator: value,
      denominator: null,
      calculatedAt: ctx.now.toISOString(),
      sourceIds: ctx.projectIds,
    };
  }
}
export class GovernanceScoreCalculator implements GoalCalculator {
  supports(): GoalType {
    return 'GOVERNANCE_SCORE';
  }
  async calculate(goal: GovernanceGoal, ctx: GoalCalculationContext) {
    const latest = (
      await ctx.tx.governanceProgress.latest([goal.frameworkId!], true)
    )[0];
    const base: GoalResult = {
      value: null,
      numerator: null,
      denominator: null,
      calculatedAt: ctx.now.toISOString(),
      sourceIds: latest ? [latest.id] : [],
    };
    if (!latest)
      return {
        ...base,
        reason: 'NO_CLOSED_ASSESSMENT' as const,
        ...(goal.sectionId ? { section: null } : {}),
      };
    let controls = await ctx.tx.governanceProgress.controls([latest.id]);
    if (goal.sectionId) {
      const sections = latest.frameworkSnapshot.sections;
      const section = sections.find((s) => s.id === goal.sectionId);
      if (!section)
        return {
          ...base,
          reason: 'SECTION_NOT_IN_SNAPSHOT' as const,
          section: null,
        };
      base.section = {
        id: section.id,
        name: section.name,
        path: sectionPath(sections, section.id),
      };
      const subtree = new Set(
        sections
          .filter((s) =>
            sectionPath(sections, s.id).some((p) => p.id === section.id),
          )
          .map((s) => s.id),
      );
      controls = controls.filter((c) => subtree.has(c.sectionId));
    }
    const score = progressSummary(controls);
    return {
      ...base,
      value: score.index.value,
      numerator: score.index.numerator,
      denominator: score.index.denominator,
      ...(score.state === 'EMPTY'
        ? { reason: 'EMPTY_SECTION' as const }
        : score.state === 'NOT_APPLICABLE'
          ? { reason: 'NO_APPLICABLE_CONTROLS' as const }
          : {}),
    };
  }
}
