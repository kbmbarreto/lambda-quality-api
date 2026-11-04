import { describe, expect, it } from 'vitest';
import {
  combineProgress,
  frameworkProgress,
  progressSummary,
} from '../dist/modules/governance/domain/progress.js';
import type { ProgressControl } from '../dist/modules/governance/domain/progress.js';
import type {
  Assessment,
  FrameworkSection,
  GovernanceFramework,
} from '../dist/modules/governance/domain/models.js';
import { reportMonths } from '../dist/modules/defect/application/analytics.js';
const control = (
  status: ProgressControl['status'],
  weight = 1,
  sectionId = 'root',
): ProgressControl => ({ assessmentId: 'a', sectionId, status, weight });
describe('Snapshot framework progress', () => {
  it('keeps weighted attendance, completion and assessment distinct', () => {
    expect(
      progressSummary([
        control('MET'),
        control('MET'),
        control('PARTIALLY_MET'),
        control('NOT_ASSESSED'),
      ]),
    ).toMatchObject({
      index: { value: 62.5, numerator: 250, denominator: 4 },
      completionPercent: 50,
      assessmentPercent: 75,
      completed: false,
    });
    expect(
      progressSummary([
        control('MET', 3),
        control('PARTIALLY_MET'),
        control('NOT_APPLICABLE', 1000),
      ]),
    ).toMatchObject({
      index: { value: 87.5, numerator: 350, denominator: 4 },
      applicableControls: 2,
      assessedControls: 3,
    });
  });
  it('represents empty and all-not-applicable inventories without artificial completion', () => {
    expect(progressSummary([])).toMatchObject({
      state: 'EMPTY',
      index: { value: null },
      completionPercent: null,
      assessmentPercent: null,
      completed: false,
    });
    expect(progressSummary([control('NOT_APPLICABLE')])).toMatchObject({
      state: 'NOT_APPLICABLE',
      index: { value: null, denominator: 0 },
      completionPercent: null,
      assessmentPercent: 100,
      completed: false,
    });
    expect(
      progressSummary([control('MET'), control('NOT_APPLICABLE')]).completed,
    ).toBe(true);
  });
  it('never derives completion from rounded percentages and combines raw weights', () => {
    const large = progressSummary([
      ...Array.from({ length: 20000 }, () => control('MET')),
      control('NOT_MET'),
    ]);
    expect(large.completionPercent).toBe(100);
    expect(large.completed).toBe(false);
    const a = progressSummary([control('MET', 9)]),
      b = progressSummary([control('NOT_MET')]);
    expect(combineProgress([a, b]).index.value).toBe(90);
  });
  it('aggregates direct, child and grandchild controls once and keeps historical section names', () => {
    const sections = [
      {
        id: 'root',
        parentSectionId: null,
        name: 'Snapshot root',
        code: 'R',
        position: 1,
      },
      {
        id: 'child',
        parentSectionId: 'root',
        name: 'Child',
        code: 'C',
        position: 1,
      },
      {
        id: 'grand',
        parentSectionId: 'child',
        name: 'Grandchild',
        code: 'G',
        position: 1,
      },
      {
        id: 'empty',
        parentSectionId: null,
        name: 'Empty',
        code: 'E',
        position: 2,
      },
    ] as FrameworkSection[];
    const assessment = {
      id: 'a',
      status: 'IN_PROGRESS',
      frameworkSnapshot: { version: 1, sections },
    } as Assessment;
    const framework = {
      id: 'f',
      code: 'F',
      name: 'Current',
      version: 2,
    } as GovernanceFramework;
    const result = frameworkProgress(
      framework,
      assessment,
      [
        control('MET', 3),
        control('PARTIALLY_MET', 2, 'child'),
        control('NOT_ASSESSED', 1, 'grand'),
      ],
      '2026-10-04T00:00:00.000Z',
    );
    expect(result.summary?.index.value).toBe(66.67);
    expect(result.summary?.totalControls).toBe(3);
    expect(result.sections.find((s) => s.id === 'root')).toMatchObject({
      name: 'Snapshot root',
      direct: { totalControls: 1 },
      subtree: { totalControls: 3 },
    });
    expect(result.sections.find((s) => s.id === 'child')).toMatchObject({
      direct: { totalControls: 1 },
      subtree: { totalControls: 2 },
    });
    expect(result.sections.find((s) => s.id === 'empty')?.subtree.state).toBe(
      'EMPTY',
    );
    expect(result.definitionVersionDiffers).toBe(true);
    expect(
      frameworkProgress(framework, null, [], result.generatedAt),
    ).toMatchObject({
      state: 'NO_ASSESSMENT',
      summary: null,
      assessment: null,
      sections: [],
    });
  });
  it('validates inclusive reporting dates and fills chronological month buckets', () => {
    expect(reportMonths('2026-12-31', '2027-02-01')).toEqual([
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
    for (const [from, to] of [
      ['2026-02-30', '2026-03-01'],
      ['2026-10-02', '2026-10-01'],
      ['2023-01-01', '2026-01-01'],
    ])
      expect(() => reportMonths(from, to)).toThrow();
  });
});
