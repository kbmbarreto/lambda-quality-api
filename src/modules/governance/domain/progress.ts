import type {
  Assessment,
  ComplianceStatus,
  FrameworkSection,
  GovernanceFramework,
} from './models.js';
import { complianceScore } from './rules.js';
export interface ProgressControl {
  assessmentId: string;
  sectionId: string;
  status: ComplianceStatus;
  weight: number;
}
export interface ProgressSummary {
  state: 'EMPTY' | 'NOT_APPLICABLE' | 'AVAILABLE';
  totalControls: number;
  applicableControls: number;
  assessedControls: number;
  counts: Record<ComplianceStatus, number>;
  index: { value: number | null; numerator: number; denominator: number };
  completionPercent: number | null;
  assessmentPercent: number | null;
  completed: boolean;
}
export interface FrameworkProgress {
  generatedAt: string;
  indicatorType: 'INTERNAL';
  state: 'NO_ASSESSMENT' | Assessment['status'];
  framework: Pick<GovernanceFramework, 'id' | 'code' | 'name' | 'version'>;
  assessment: null | {
    id: string;
    name: string;
    status: Assessment['status'];
    version: number;
    definitionVersion: number;
    assessmentDate: string;
    closedAt: string | null;
  };
  definitionVersionDiffers: boolean;
  summary: ProgressSummary | null;
  sections: (Pick<
    FrameworkSection,
    'id' | 'parentSectionId' | 'code' | 'name' | 'position'
  > & {
    direct: ProgressSummary;
    subtree: ProgressSummary;
  })[];
}
const percent = (n: number, d: number) =>
  d ? Math.round((n / d) * 10000) / 100 : null;
export function combineProgress(summaries: ProgressSummary[]): ProgressSummary {
  const counts: ProgressSummary['counts'] = {
    NOT_ASSESSED: 0,
    NOT_MET: 0,
    PARTIALLY_MET: 0,
    MET: 0,
    NOT_APPLICABLE: 0,
  };
  let numerator = 0,
    denominator = 0;
  for (const s of summaries) {
    for (const status of Object.keys(counts) as ComplianceStatus[])
      counts[status] += s.counts[status];
    numerator += s.index.numerator;
    denominator += s.index.denominator;
  }
  const totalControls = Object.values(counts).reduce((n, v) => n + v, 0);
  const applicableControls = totalControls - counts.NOT_APPLICABLE;
  const assessedControls = totalControls - counts.NOT_ASSESSED;
  return {
    state: !totalControls
      ? 'EMPTY'
      : !applicableControls
        ? 'NOT_APPLICABLE'
        : 'AVAILABLE',
    totalControls,
    applicableControls,
    assessedControls,
    counts,
    index: {
      value: denominator
        ? Math.round((numerator / denominator) * 100) / 100
        : null,
      numerator,
      denominator,
    },
    completionPercent: percent(counts.MET, applicableControls),
    assessmentPercent: percent(assessedControls, totalControls),
    completed: applicableControls > 0 && counts.MET === applicableControls,
  };
}
export function progressSummary(controls: ProgressControl[]): ProgressSummary {
  const empty = combineProgress([]);
  for (const c of controls) {
    empty.counts[c.status]++;
    if (c.status !== 'NOT_APPLICABLE') {
      empty.index.numerator += (complianceScore(c.status) ?? 0) * c.weight;
      empty.index.denominator += c.weight;
    }
  }
  return combineProgress([empty]);
}
export function sectionPath(sections: FrameworkSection[], id: string) {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const path: { id: string; code: string; name: string }[] = [];
  let current = byId.get(id);
  while (current) {
    path.unshift({ id: current.id, code: current.code, name: current.name });
    current = current.parentSectionId
      ? byId.get(current.parentSectionId)
      : undefined;
  }
  return path;
}
export function frameworkProgress(
  framework: GovernanceFramework,
  assessment: Assessment | null,
  controls: ProgressControl[],
  generatedAt: string,
): FrameworkProgress {
  const sections = assessment?.frameworkSnapshot.sections ?? [];
  const byId = new Map(sections.map((s) => [s.id, s]));
  const direct = new Map<string, ProgressControl[]>(),
    subtree = new Map<string, ProgressControl[]>();
  for (const c of controls) {
    const directBucket = direct.get(c.sectionId) ?? [];
    directBucket.push(c);
    direct.set(c.sectionId, directBucket);
    let section = byId.get(c.sectionId);
    while (section) {
      const bucket = subtree.get(section.id) ?? [];
      bucket.push(c);
      subtree.set(section.id, bucket);
      section = section.parentSectionId
        ? byId.get(section.parentSectionId)
        : undefined;
    }
  }
  return {
    generatedAt,
    indicatorType: 'INTERNAL',
    state: assessment?.status ?? 'NO_ASSESSMENT',
    framework: {
      id: framework.id,
      code: framework.code,
      name: framework.name,
      version: framework.version,
    },
    assessment: assessment
      ? {
          id: assessment.id,
          name: assessment.name,
          status: assessment.status,
          version: assessment.version,
          definitionVersion: assessment.frameworkSnapshot.version,
          assessmentDate: assessment.assessmentDate,
          closedAt: assessment.closedAt?.toISOString() ?? null,
        }
      : null,
    definitionVersionDiffers:
      !!assessment &&
      assessment.frameworkSnapshot.version !== framework.version,
    summary: assessment ? progressSummary(controls) : null,
    sections: [...sections]
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .map((s) => ({
        id: s.id,
        parentSectionId: s.parentSectionId,
        code: s.code,
        name: s.name,
        position: s.position,
        direct: progressSummary(direct.get(s.id) ?? []),
        subtree: progressSummary(subtree.get(s.id) ?? []),
      })),
  };
}
