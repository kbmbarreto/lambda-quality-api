import { describe, it, expect } from 'vitest';
import {
  dashboardPeriod,
  goalProgress,
  percentage,
} from '../dist/modules/dashboard/application/overview.js';
import type { DashboardGoalRow } from '../dist/modules/dashboard/domain/models.js';
describe('Dashboard semantics', () => {
  it('uses exact UTC windows through timezone and calendar changes', () => {
    for (const days of [7, 30, 90] as const) {
      const now = new Date('2026-10-04T00:15:00-03:00');
      const period = dashboardPeriod(now, days);
      expect(period.to).toBe('2026-10-04T03:15:00.000Z');
      expect(period.previousTo).toBe(period.from);
      expect(Date.parse(period.to) - Date.parse(period.from!)).toBe(
        days * 86400000,
      );
      expect(Date.parse(period.from!) - Date.parse(period.previousFrom!)).toBe(
        days * 86400000,
      );
    }
  });
  it('advertises ALL without inventing a lower boundary or previous window', () => {
    expect(dashboardPeriod(new Date('2026-10-07T12:00:00Z'), 'ALL')).toEqual({
      days: 'ALL',
      supportedDays: [7, 30, 90, 'ALL'],
      from: null,
      to: '2026-10-07T12:00:00.000Z',
      previousFrom: null,
      previousTo: null,
    });
  });
  it('distinguishes no denominator from zero percent and rounds percentages', () => {
    expect(percentage(0, 0)).toBeNull();
    expect(percentage(0, 3)).toBe(0);
    expect(percentage(1, 3)).toBe(33.33);
    expect(percentage(2, 3)).toBe(66.67);
  });
  it('uses current action progress independently of metric results, criteria and target', () => {
    expect(
      goalProgress({
        actionProgress: { percent: 33.33 },
        operator: 'LTE',
        targetValue: 0,
        lastResult: { value: 100 },
      } as DashboardGoalRow),
    ).toBe(33.33);
    expect(
      goalProgress({
        actionProgress: { percent: 100 },
        lastResult: null,
      } as DashboardGoalRow),
    ).toBe(100);
    expect(
      goalProgress({
        actionProgress: { percent: null },
        lastResult: { value: 100 },
      } as DashboardGoalRow),
    ).toBeNull();
  });
});
