import type { TestResult } from './models.js';

export interface ImportedResult {
  itemId: number;
  name: string;
  className: string | null;
  result: Exclude<TestResult, 'NOT_TESTED' | 'BLOCKED'>;
  caseIds: string[];
  humanIds: string[];
  details: string | null;
  proposedRunCaseId: string | null;
  blockers: string[];
}
export interface ResultImport {
  id: string;
  workspaceId: string;
  projectId: string;
  testRunId: string;
  runVersion: number;
  fileName: string;
  fileHash: string;
  items: ImportedResult[];
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  requestKey: string | null;
  requestHash: string | null;
  appliedAt: Date | null;
  appliedVersion: number | null;
  mappings: { itemId: number; runCaseId: string }[] | null;
}
export interface ExternalResult {
  origin: 'JUNIT';
  importId: string;
  itemId: number;
  fileName: string;
  fileHash: string;
  name: string;
  className: string | null;
  details: string | null;
}
