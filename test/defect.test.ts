import { describe, it, expect } from 'vitest';
import {
  checkDefectVersion,
  validExternalUrl,
  resolutionOnStatusChange,
} from '../dist/modules/defect/domain/rules.js';
describe('Defect rules', () => {
  it('records closing as resolution while preserving prior dates and legacy no-ops', () => {
    const previous = new Date('2026-10-01T12:00:00.000Z');
    const now = new Date('2026-10-08T12:00:00.000Z');
    expect(
      resolutionOnStatusChange(
        { status: 'OPEN', resolvedAt: null },
        'RESOLVED',
        now,
      ),
    ).toEqual(now);
    expect(
      resolutionOnStatusChange(
        { status: 'RESOLVED', resolvedAt: previous },
        'CLOSED',
        now,
      ),
    ).toEqual(previous);
    expect(
      resolutionOnStatusChange(
        { status: 'CLOSED', resolvedAt: previous },
        'CLOSED',
        now,
      ),
    ).toEqual(previous);
    expect(
      resolutionOnStatusChange(
        { status: 'CLOSED', resolvedAt: null },
        'CLOSED',
        now,
      ),
    ).toBeNull();
    for (const status of ['IN_PROGRESS', 'REJECTED'] as const)
      expect(
        resolutionOnStatusChange({ status, resolvedAt: null }, 'CLOSED', now),
      ).toEqual(now);
    for (const next of ['OPEN', 'IN_PROGRESS', 'REJECTED'] as const)
      expect(
        resolutionOnStatusChange(
          { status: 'CLOSED', resolvedAt: previous },
          next,
          now,
        ),
      ).toBeNull();
    expect(
      resolutionOnStatusChange(
        { status: 'OPEN', resolvedAt: null },
        'CLOSED',
        now,
      ),
    ).toEqual(now);
    expect(
      resolutionOnStatusChange(
        { status: 'RESOLVED', resolvedAt: null },
        'RESOLVED',
        now,
      ),
    ).toBeNull();
    expect(
      resolutionOnStatusChange(
        { status: 'RESOLVED', resolvedAt: null },
        'CLOSED',
        now,
      ),
    ).toEqual(now);
    expect(
      resolutionOnStatusChange(
        { status: 'CLOSED', resolvedAt: previous },
        'RESOLVED',
        now,
      ),
    ).toEqual(now);
  });
  it('requires the current aggregate version', () => {
    expect(() => checkDefectVersion(3, 3)).not.toThrow();
    expect(() => checkDefectVersion(3, 2)).toThrow('O defeito foi alterado');
  });
  it('accepts absolute HTTP references and rejects credentials, active schemes and ambiguous URLs', () => {
    for (const url of [
      'https://dev.azure.com/org/project/_workitems/edit/123',
      'http://localhost:8080/issues/QA-1',
      'https://jira.example.com/browse/QA-1?view=detail#comment',
    ])
      expect(validExternalUrl(url)).toBe(true);
    for (const url of [
      null,
      42,
      '',
      '/issues/1',
      '//example.com/1',
      'javascript:alert(1)',
      'data:text/plain,hello',
      'ftp://example.com/a',
      'https://user:secret@example.com',
      'https://example.com\\@evil.test',
      ' https://example.com',
      'https://exa\nmple.com',
      'https://example.com/' + 'x'.repeat(2048),
    ])
      expect(validExternalUrl(url)).toBe(false);
  });
});
