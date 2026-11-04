import { ApplicationError } from '../../../shared/domain/errors.js';
import type { Defect } from './models.js';

export function resolutionOnStatusChange(
  current: Pick<Defect, 'status' | 'resolvedAt'>,
  next: Defect['status'],
  now: Date,
): Date | null {
  if (next === current.status) return current.resolvedAt;
  if (next === 'RESOLVED') return now;
  if (next === 'CLOSED') return current.resolvedAt ?? now;
  return null;
}
export function checkDefectVersion(actual: number, expected: number) {
  if (actual !== expected)
    throw new ApplicationError(
      409,
      'DEFECT_VERSION_CONFLICT',
      'O defeito foi alterado. Consulte a versão atual antes de tentar novamente.',
    );
}
export function validExternalUrl(value: unknown): boolean {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    /[\s\\]/u.test(value) ||
    Array.from(value).some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    return false;
  try {
    const url = new URL(value);
    return (
      /^https?:\/\//i.test(value) &&
      ['http:', 'https:'].includes(url.protocol) &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
