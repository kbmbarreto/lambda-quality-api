import { describe, it, expect } from 'vitest';
import {
  actionProgress,
  actionGoalStatus,
  assessmentIndex,
  goalStatus,
  validateTree,
  validDate,
} from '../dist/modules/governance/domain/rules.js';
import type {
  ControlAssessment,
  FrameworkSection,
} from '../dist/modules/governance/domain/models.js';
const control = (status: ControlAssessment['status'], weight: number) =>
  ({ status, controlSnapshot: { weight } }) as ControlAssessment;
const section = (id: string, parentSectionId: string | null) =>
  ({ id, parentSectionId }) as FrameworkSection;
describe('Governance rules', () => {
  it('calculates weighted internal score without N/A and does not treat unassessed controls as compliant', () => {
    expect(
      assessmentIndex([
        control('MET', 3),
        control('PARTIALLY_MET', 1),
        control('NOT_APPLICABLE', 1000),
      ]),
    ).toMatchObject({
      value: 87.5,
      numerator: 350,
      denominator: 4,
      assessedControls: 3,
      totalControls: 3,
    });
    expect(
      assessmentIndex([control('MET', 1), control('NOT_ASSESSED', 1)]).value,
    ).toBe(50);
    expect(
      assessmentIndex([control('MET', 1), control('NOT_MET', 2)]).value,
    ).toBe(33.33);
    expect(assessmentIndex([control('NOT_APPLICABLE', 1)]).value).toBeNull();
    expect(assessmentIndex([]).value).toBeNull();
  });
  it('checks the entire section tree including descendants moved beyond the depth limit', () => {
    const tree = [section('a', null), section('b', 'a'), section('c', 'b')];
    expect(() => validateTree(tree)).not.toThrow();
    expect(() => validateTree([section('a', 'c'), ...tree.slice(1)])).toThrow(
      'descendente',
    );
    expect(() => validateTree([section('a', 'missing')])).toThrow(
      'Recurso não encontrado',
    );
    const deep = Array.from({ length: 20 }, (_, i) =>
      section(String(i), i ? String(i - 1) : null),
    );
    expect(() => validateTree(deep)).not.toThrow();
    expect(() => validateTree([...deep, section('20', '19')])).toThrow(
      '20 níveis',
    );
  });
  it('compares goal boundaries exactly and evaluates deadlines by UTC calendar day', () => {
    const now = new Date('2026-10-03T23:59:59Z');
    expect(goalStatus(80, 'GTE', 80, '2026-10-01', now)).toBe('ACHIEVED');
    expect(goalStatus(80, 'GT', 80, '2026-10-02', now)).toBe('MISSED');
    expect(goalStatus(0, 'EQ', 0, null, now)).toBe('ACHIEVED');
    expect(goalStatus(1, 'LT', 1, '2026-10-03', now)).toBe('ACTIVE');
    expect(goalStatus(null, 'LTE', 100, null, now)).toBe('ACTIVE');
    expect(goalStatus(null, 'GTE', 0, '2026-10-02', now)).toBe('MISSED');
  });
  it('derives goal completion from exact action counts, excluding cancelled actions and preserving cancelled goals', () => {
    const now = new Date('2026-10-07T12:00:00Z');
    const goal = { status: 'ACTIVE' as const, deadline: null };
    expect(actionProgress()).toMatchObject({ totalActions: 0, percent: null });
    const partial = actionProgress({
      goalId: 'g',
      total: 3,
      completed: 1,
      cancelled: 2,
    });
    expect(partial).toMatchObject({
      percent: 33.33,
      completedActions: 1,
      cancelledActions: 2,
    });
    expect(actionGoalStatus(goal, partial, now)).toBe('ACTIVE');
    const done = actionProgress({
      goalId: 'g',
      total: 1,
      completed: 1,
      cancelled: 5,
    });
    expect(
      actionGoalStatus({ ...goal, deadline: '2020-01-01' }, done, now),
    ).toBe('ACHIEVED');
    expect(
      actionGoalStatus(
        { ...goal, deadline: '2020-01-01' },
        actionProgress(),
        now,
      ),
    ).toBe('MISSED');
    expect(actionGoalStatus({ ...goal, status: 'CANCELLED' }, done, now)).toBe(
      'CANCELLED',
    );
    expect(
      actionProgress({
        goalId: 'g',
        total: 100000,
        completed: 99999,
        cancelled: 0,
      }).percent,
    ).toBe(99.99);
  });
  it('validates real calendar dates including leap days and excludes normalized invalid dates', () => {
    for (const date of ['2028-02-29', '1000-01-01', '9999-12-31'])
      expect(validDate(date)).toBe(true);
    for (const date of [
      '2027-02-29',
      '2026-02-30',
      '2026-13-01',
      '2026-1-01',
      '0999-01-01',
      null,
      42,
    ])
      expect(validDate(date)).toBe(false);
  });
});
