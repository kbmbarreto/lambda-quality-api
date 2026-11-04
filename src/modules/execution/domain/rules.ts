import { ApplicationError } from '../../../shared/domain/errors.js';
import type { TestResult } from './models.js';
export function checkVersion(
  actual: number,
  expected: number,
  kind: 'PLAN' | 'RUN',
) {
  if (actual !== expected)
    throw new ApplicationError(
      409,
      `TEST_${kind}_VERSION_CONFLICT`,
      'O recurso foi alterado. Consulte a versão atual antes de tentar novamente.',
    );
}
export function requirePassingSteps(result: TestResult, steps: TestResult[]) {
  if (
    result === 'PASSED' &&
    steps.some((r) => r !== 'PASSED' && r !== 'SKIPPED')
  )
    throw new ApplicationError(
      409,
      'TEST_RUN_STEPS_INCOMPLETE',
      'Para aprovar o caso, conclua todos os passos como PASSED ou SKIPPED.',
    );
}
export function requireCompleteResults(results: TestResult[]) {
  if (!results.length || results.includes('NOT_TESTED'))
    throw new ApplicationError(
      409,
      'TEST_RUN_INCOMPLETE',
      'Registre um resultado final para todos os casos antes de concluir a execução.',
    );
}
export function selectionIds(ids: string[], allowEmpty = false) {
  if (
    (!allowEmpty && !ids.length) ||
    ids.length > 500 ||
    new Set(ids).size !== ids.length
  )
    throw new ApplicationError(
      400,
      'TEST_SELECTION_INVALID',
      'Informe até 500 casos distintos, respeitando a seleção obrigatória.',
    );
}
