import type { RecordQuery } from '../../../shared/application/records.js';
import type { Defect } from '../domain/models.js';

export interface DefectInventoryFilters {
  workspaceId?: string;
  projectId?: string;
  q?: string;
  status?: string;
  severity?: Defect['severity'];
}

/** One semantic contract for the paged inventory and its unpaged summary. */
export function defectInventoryFilter(
  input: DefectInventoryFilters,
): RecordQuery<Defect> {
  const query: RecordQuery<Defect> = { where: {} };
  if (input.status && input.status !== 'ALL')
    query.where!.status = input.status as Defect['status'];
  if (input.severity) query.where!.severity = input.severity;
  if (input.q) query.search = { fields: ['title'], value: input.q };
  return query;
}
