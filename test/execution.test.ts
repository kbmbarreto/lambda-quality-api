import { describe, expect, it } from 'vitest';
import {
  checkVersion,
  selectionIds,
  requirePassingSteps,
  requireCompleteResults,
} from '../dist/modules/execution/domain/rules.js';
import type { TestResult } from '../dist/modules/execution/domain/models.js';
describe('Manual execution rules', () => {
  it('requires the current aggregate version', () => {
    expect(() => checkVersion(2, 2, 'RUN')).not.toThrow();
    for (const kind of ['PLAN', 'RUN'] as const)
      expect(() => checkVersion(2, 1, kind)).toThrow('recurso foi alterado');
  });
  it('requires distinct bounded selections and permits empty draft plans', () => {
    expect(() => selectionIds([], true)).not.toThrow();
    expect(() => selectionIds([])).toThrow();
    expect(() => selectionIds(['a', 'a'])).toThrow();
    expect(() =>
      selectionIds(Array.from({ length: 501 }, (_, i) => String(i))),
    ).toThrow();
    expect(() => selectionIds(['a', 'b'])).not.toThrow();
  });
  it('requires passing or skipped steps only when explicitly approving a case', () => {
    expect(() => requirePassingSteps('PASSED', [])).not.toThrow();
    expect(() =>
      requirePassingSteps('PASSED', ['PASSED', 'SKIPPED']),
    ).not.toThrow();
    for (const result of ['NOT_TESTED', 'FAILED', 'BLOCKED'] as TestResult[])
      expect(() => requirePassingSteps('PASSED', [result])).toThrow();
    for (const result of [
      'FAILED',
      'BLOCKED',
      'SKIPPED',
      'NOT_TESTED',
    ] as TestResult[])
      expect(() => requirePassingSteps(result, ['NOT_TESTED'])).not.toThrow();
  });
  it('allows completing with failures and blocks missing overall case results', () => {
    expect(() =>
      requireCompleteResults(['PASSED', 'FAILED', 'BLOCKED', 'SKIPPED']),
    ).not.toThrow();
    expect(() => requireCompleteResults([])).toThrow();
    expect(() => requireCompleteResults(['PASSED', 'NOT_TESTED'])).toThrow();
  });
});
