import { describe, expect, it } from 'vitest';
import { validateDates } from '../dist/modules/project/application/settings.js';
describe('Milestone calendar invariants', () => {
  it('accepts leap days and open date ranges', () => {
    expect(() => validateDates('2028-02-29', null)).not.toThrow();
    expect(() => validateDates(null, '2026-10-02')).not.toThrow();
    expect(() => validateDates('2026-10-02', '2026-10-02')).not.toThrow();
  });
  it('rejects normalized invalid dates, timestamps and reversed ranges', () => {
    for (const value of [
      '2026-02-29',
      '2026-02-30',
      '2026-13-01',
      '0001-01-01',
      '2026-10-02T00:00:00Z',
    ])
      expect(() => validateDates(value, null)).toThrow();
    expect(() => validateDates('2026-10-03', '2026-10-02')).toThrow();
  });
});
