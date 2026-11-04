import { ApplicationError } from '../../../shared/domain/errors.js';
import type { CustomFieldDefinition } from './catalogs.js';
import type { FieldValueInput, TestSuite } from './models.js';
export function invalid(message: string, code = 'VALIDATION_ERROR'): never {
  throw new ApplicationError(400, code, message);
}
export function exactOrder(current: string[], requested: string[]) {
  if (
    current.length !== requested.length ||
    new Set(requested).size !== requested.length ||
    requested.some((id) => !current.includes(id))
  )
    invalid(
      'Informe todos os identificadores atuais, sem duplicatas.',
      'TEST_ORDER_INVALID',
    );
}
export function validateSuiteParent(
  suites: TestSuite[],
  id: string,
  parent: string | null,
) {
  const seen = new Set([id]);
  while (parent) {
    if (seen.has(parent))
      throw new ApplicationError(
        409,
        'TEST_SUITE_CYCLE',
        'Uma suíte não pode ser movida para si ou um descendente.',
      );
    seen.add(parent);
    const suite = suites.find((row) => row.id === parent && !row.archivedAt);
    if (!suite)
      throw new ApplicationError(
        404,
        'RESOURCE_NOT_FOUND',
        'Recurso não encontrado.',
      );
    parent = suite.parentSuiteId;
  }
}
export function validateFieldValues(
  definitions: CustomFieldDefinition[],
  values: FieldValueInput[],
) {
  if (new Set(values.map((v) => v.fieldId)).size !== values.length)
    invalid('Não repita campos personalizados.', 'CUSTOM_FIELD_VALUE_INVALID');
  for (const entry of values) {
    const field = definitions.find(
      (f) =>
        f.id === entry.fieldId && f.target === 'TEST_CASE' && !f.archivedAt,
    );
    if (!field)
      throw new ApplicationError(
        404,
        'RESOURCE_NOT_FOUND',
        'Recurso não encontrado.',
      );
    const v = entry.value;
    if (v === null) continue;
    const valid =
      field.type === 'TEXT'
        ? typeof v === 'string' && v.length <= 10000
        : field.type === 'NUMBER'
          ? typeof v === 'number' && Number.isFinite(v)
          : field.type === 'BOOLEAN'
            ? typeof v === 'boolean'
            : field.type === 'SINGLE_SELECT'
              ? typeof v === 'string' && field.options.some((o) => o.id === v)
              : typeof v === 'string' &&
                /^\d{4}-\d{2}-\d{2}$/.test(v) &&
                v >= '1000-01-01' &&
                Number.isFinite(Date.parse(v)) &&
                new Date(v).toISOString().slice(0, 10) === v;
    if (!valid)
      invalid(
        'Valor incompatível com o tipo ou as opções do campo personalizado.',
        'CUSTOM_FIELD_VALUE_INVALID',
      );
  }
  for (const field of definitions.filter(
    (f) => !f.archivedAt && f.target === 'TEST_CASE' && f.required,
  )) {
    const value = values.find((v) => v.fieldId === field.id)?.value;
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && !value.trim())
    )
      invalid(
        'Preencha todos os campos personalizados obrigatórios.',
        'CUSTOM_FIELD_REQUIRED',
      );
  }
}
