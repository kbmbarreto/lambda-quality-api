import { ApplicationError } from '../../../shared/domain/errors.js';
import type {
  ControlAssessment,
  FrameworkSection,
  GoalOperator,
  GoalStatus,
  GoalActionTotals,
  GoalActionProgress,
} from './models.js';
export function invalid(message: string): never {
  throw new ApplicationError(400, 'VALIDATION_ERROR', message);
}
export function governanceConflict(code: string, message: string): never {
  throw new ApplicationError(409, code, message);
}
export function checkVersion(actual: number, expected: number) {
  if (actual !== expected)
    governanceConflict(
      'GOVERNANCE_VERSION_CONFLICT',
      'O recurso foi alterado. Consulte a versão atual antes de tentar novamente.',
    );
}
export { validDate } from '../../../shared/domain/calendar-date.js';
export function validateTree(sections: FrameworkSection[]) {
  for (const section of sections) {
    const seen = new Set([section.id]);
    let parent = section.parentSectionId,
      depth = 1;
    while (parent) {
      if (seen.has(parent))
        governanceConflict(
          'GOVERNANCE_SECTION_CYCLE',
          'A seção não pode apontar para si ou um descendente.',
        );
      seen.add(parent);
      const row = sections.find((s) => s.id === parent);
      if (!row)
        throw new ApplicationError(
          404,
          'RESOURCE_NOT_FOUND',
          'Recurso não encontrado.',
        );
      if (++depth > 20)
        governanceConflict(
          'GOVERNANCE_SECTION_DEPTH',
          'A árvore admite até 20 níveis.',
        );
      parent = row.parentSectionId;
    }
  }
}
export function complianceScore(status: ControlAssessment['status']) {
  return status === 'MET'
    ? 100
    : status === 'PARTIALLY_MET'
      ? 50
      : status === 'NOT_MET'
        ? 0
        : null;
}
export function assessmentIndex(controls: ControlAssessment[]) {
  const applicable = controls.filter((c) => c.status !== 'NOT_APPLICABLE');
  const denominator = applicable.reduce(
    (sum, c) => sum + c.controlSnapshot.weight,
    0,
  );
  const numerator = applicable.reduce(
    (sum, c) =>
      sum + (complianceScore(c.status) ?? 0) * c.controlSnapshot.weight,
    0,
  );
  return {
    value: denominator
      ? Math.round((numerator / denominator) * 100) / 100
      : null,
    numerator,
    denominator,
    assessedControls: controls.filter((c) => c.status !== 'NOT_ASSESSED')
      .length,
    totalControls: controls.length,
  };
}
export function goalStatus(
  value: number | null,
  operator: GoalOperator,
  target: number,
  deadline: string | null,
  now: Date,
): GoalStatus {
  const met =
    value !== null &&
    {
      GT: value > target,
      GTE: value >= target,
      EQ: value === target,
      LTE: value <= target,
      LT: value < target,
    }[operator];
  return met
    ? 'ACHIEVED'
    : deadline && deadline < now.toISOString().slice(0, 10)
      ? 'MISSED'
      : 'ACTIVE';
}

export function definedChanges<T extends object>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as T;
}

export function actionProgress(totals?: GoalActionTotals): GoalActionProgress {
  const total = totals?.total ?? 0;
  const completed = totals?.completed ?? 0;
  return {
    basis: 'ACTIONS',
    totalActions: total,
    completedActions: completed,
    cancelledActions: totals?.cancelled ?? 0,
    percent: total
      ? completed === total
        ? 100
        : Math.min(99.99, Math.round((completed / total) * 10000) / 100)
      : null,
  };
}
export function actionGoalStatus(
  goal: { status: GoalStatus; deadline: string | null },
  progress: GoalActionProgress,
  now = new Date(),
): GoalStatus {
  if (goal.status === 'CANCELLED') return 'CANCELLED';
  if (
    progress.totalActions > 0 &&
    progress.completedActions === progress.totalActions
  )
    return 'ACHIEVED';
  return goal.deadline && goal.deadline < now.toISOString().slice(0, 10)
    ? 'MISSED'
    : 'ACTIVE';
}
