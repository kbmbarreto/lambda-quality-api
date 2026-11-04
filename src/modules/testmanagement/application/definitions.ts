import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import { conflict, notFound } from '../../workspace/application/access.js';
import { validateFieldValues } from '../domain/rules.js';
import type { FieldValueSnapshot } from '../domain/models.js';
export const TEST_DEFINITIONS = Symbol('TestDefinitions');
// Public transactional read port for execution; all references retain project/tenant scope.
export class TestDefinitions {
  async cases(
    tx: WorkspaceTransaction,
    projectId: string,
    ids: string[],
    active = false,
  ) {
    const rows = [];
    for (const id of ids) {
      const row = await tx.testCases.find({ id, projectId });
      if (!row) throw notFound();
      if (
        row.status === 'ARCHIVED' ||
        row.status === 'DEPRECATED' ||
        (active && row.status !== 'ACTIVE')
      )
        conflict(
          'TEST_CASE_NOT_EXECUTABLE',
          'Selecione casos disponíveis; ativação e execução exigem casos ACTIVE.',
        );
      rows.push(row);
    }
    return rows;
  }
  async snapshot(tx: WorkspaceTransaction, projectId: string, id: string) {
    const [testCase] = await this.cases(tx, projectId, [id], true);
    const where = { projectId, testCaseId: id };
    const definitions = await tx.fields.list({
      where: { target: 'TEST_CASE' },
    });
    const values = await tx.testCaseFieldValues.list({ where });
    validateFieldValues(
      definitions,
      values
        .filter((v) =>
          definitions.some((d) => d.id === v.fieldId && !d.archivedAt),
        )
        .map((v) => ({ fieldId: v.fieldId, value: v.value })),
    );
    const customFieldsSnapshot: FieldValueSnapshot[] = values.map((value) => {
      const field = definitions.find((d) => d.id === value.fieldId);
      if (!field) throw notFound();
      return {
        fieldId: field.id,
        key: field.key,
        name: field.name,
        type: field.type,
        required: field.required,
        options: field.options,
        archivedAt: field.archivedAt?.toISOString() ?? null,
        value: value.value,
      };
    });
    const tagsSnapshot = [];
    for (const link of await tx.testCaseTags.list({ where })) {
      const tag = await tx.tags.find({ id: link.tagId });
      if (!tag) throw notFound();
      tagsSnapshot.push({ id: tag.id, name: tag.name });
    }
    return {
      testCase,
      customFieldsSnapshot,
      tagsSnapshot,
      steps: await tx.testSteps.list({
        where,
        order: { field: 'position', direction: 'asc' },
      }),
    };
  }
}
