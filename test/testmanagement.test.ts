import { describe, expect, it } from 'vitest';
import {
  exactOrder,
  validateSuiteParent,
  validateFieldValues,
} from '../dist/modules/testmanagement/domain/rules.js';
import type { TestSuite } from '../dist/modules/testmanagement/domain/models.js';
import type { CustomFieldDefinition } from '../dist/modules/testmanagement/domain/catalogs.js';
const field = (
  type: CustomFieldDefinition['type'],
  required = false,
): CustomFieldDefinition => ({
  id: type,
  workspaceId: 'ws',
  key: type,
  name: type,
  description: null,
  type,
  target: 'TEST_CASE',
  required,
  position: 1,
  options: [{ id: 'option', label: 'Opção' }],
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});
describe('Test management invariants', () => {
  it('detects deep suite cycles, missing and archived parents', () => {
    const suites = [
      { id: 'a', parentSuiteId: null, archivedAt: null },
      { id: 'b', parentSuiteId: 'a', archivedAt: null },
      { id: 'c', parentSuiteId: 'b', archivedAt: null },
    ] as TestSuite[];
    expect(() => validateSuiteParent(suites, 'a', 'c')).toThrow('descendente');
    expect(() => validateSuiteParent(suites, 'a', 'a')).toThrow();
    expect(() => validateSuiteParent(suites, 'c', 'a')).not.toThrow();
    expect(() => validateSuiteParent(suites, 'a', null)).not.toThrow();
    expect(() => validateSuiteParent(suites, 'a', 'missing')).toThrow();
    expect(() =>
      validateSuiteParent(
        [{ ...suites[0], archivedAt: new Date() }],
        'new',
        'a',
      ),
    ).toThrow();
  });
  it('rejects incomplete, duplicate and foreign IDs in full ordering', () => {
    expect(() => exactOrder(['a', 'b'], ['b', 'a'])).not.toThrow();
    for (const order of [['a'], ['a', 'a'], ['a', 'foreign'], ['a', 'b', 'c']])
      expect(() => exactOrder(['a', 'b'], order)).toThrow();
  });
  it('validates all five field types without coercion and accepts false and zero as required values', () => {
    const definitions = [
      'TEXT',
      'NUMBER',
      'BOOLEAN',
      'DATE',
      'SINGLE_SELECT',
    ].map((type) => field(type as CustomFieldDefinition['type'], true));
    expect(() =>
      validateFieldValues(definitions, [
        { fieldId: 'TEXT', value: 'text' },
        { fieldId: 'NUMBER', value: 0 },
        { fieldId: 'BOOLEAN', value: false },
        { fieldId: 'DATE', value: '2028-02-29' },
        { fieldId: 'SINGLE_SELECT', value: 'option' },
      ]),
    ).not.toThrow();
    for (const [type, value] of [
      ['TEXT', 123],
      ['NUMBER', '123'],
      ['NUMBER', Infinity],
      ['BOOLEAN', 'false'],
      ['DATE', '2026-02-29'],
      ['DATE', '2026-02-30'],
      ['DATE', '0001-01-01'],
      ['SINGLE_SELECT', 'label'],
    ] as const)
      expect(() =>
        validateFieldValues([field(type)], [{ fieldId: type, value }]),
      ).toThrow();
  });
  it('rejects required omissions, blank text, duplicate values and archived definitions', () => {
    for (const value of [null, '', '  '])
      expect(() =>
        validateFieldValues(
          [field('TEXT', true)],
          [{ fieldId: 'TEXT', value }],
        ),
      ).toThrow('obrigatórios');
    expect(() => validateFieldValues([field('BOOLEAN', true)], [])).toThrow();
    expect(() =>
      validateFieldValues(
        [field('TEXT')],
        [
          { fieldId: 'TEXT', value: 'a' },
          { fieldId: 'TEXT', value: 'b' },
        ],
      ),
    ).toThrow();
    expect(() =>
      validateFieldValues(
        [{ ...field('TEXT'), archivedAt: new Date() }],
        [{ fieldId: 'TEXT', value: 'a' }],
      ),
    ).toThrow();
    expect(() =>
      validateFieldValues(
        [field('TEXT')],
        [{ fieldId: 'foreign', value: 'a' }],
      ),
    ).toThrow();
  });
});
