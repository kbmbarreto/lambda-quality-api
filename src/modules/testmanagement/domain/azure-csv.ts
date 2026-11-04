import { ApplicationError } from '../../../shared/domain/errors.js';
export interface ImportedCase {
  azureId: string;
  title: string;
  description: string | null;
  steps: { action: string; expectedResult: string | null }[];
}
function invalid(row: number, detail: string): never {
  throw new ApplicationError(
    400,
    'TEST_CASE_IMPORT_INVALID',
    `CSV inválido, registro ${row}: ${detail}`,
  );
}
/** CSV com aspas escapadas e quebras internas. Não interpreta fórmulas ou HTML. */
function records(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  const endCell = () => {
    row.push(cell);
    cell = '';
    closed = false;
  };
  const endRow = () => {
    endCell();
    if (row.some((v) => v.trim())) rows.push(row);
    row = [];
    if (rows.length > 10001)
      invalid(rows.length, 'limite de 10000 registros excedido.');
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += ch;
    } else if (ch === ',') endCell();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else if (ch === '"') {
      if (cell || closed)
        invalid(rows.length + 1, 'aspas fora do início do campo.');
      quoted = true;
    } else {
      if (closed) invalid(rows.length + 1, 'texto após fechamento de aspas.');
      cell += ch;
    }
  }
  if (quoted) invalid(rows.length + 1, 'campo entre aspas não foi fechado.');
  if (cell || row.length || closed) endRow();
  return rows;
}
export function parseAzureCsv(text: string): ImportedCase[] {
  if (text.includes('\0')) invalid(1, 'caractere nulo não permitido.');
  const rows = records(text.replace(/^\uFEFF/, ''));
  if (!rows.length) invalid(1, 'arquivo vazio.');
  const header = rows[0].map((v) => v.trim().toLowerCase());
  const required = [
    'id',
    'work item type',
    'title',
    'test step',
    'step action',
    'step expected',
  ];
  if (
    new Set(header).size !== header.length ||
    required.some((v) => !header.includes(v))
  )
    invalid(1, 'cabeçalhos Azure DevOps obrigatórios ausentes ou repetidos.');
  const cases: ImportedCase[] = [],
    ids = new Set<string>();
  let current: ImportedCase | undefined;
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index],
      number = index + 1;
    if (row.length !== header.length)
      invalid(number, 'quantidade de colunas diferente do cabeçalho.');
    const value = (field: string) => (row[header.indexOf(field)] ?? '').trim();
    const id = value('id'),
      type = value('work item type'),
      title = value('title');
    if (id || type || title) {
      if (
        !/^\d+$/.test(id) ||
        type.toLowerCase() !== 'test case' ||
        !title ||
        title.length > 250
      )
        invalid(
          number,
          'informe ID numérico, Work Item Type Test Case e título de até 250 caracteres.',
        );
      if (ids.has(id)) invalid(number, 'ID de caso repetido.');
      ids.add(id);
      current = {
        azureId: id,
        title,
        description: value('description') || null,
        steps: [],
      };
      cases.push(current);
      if (cases.length > 200) invalid(number, 'limite de 200 casos excedido.');
    }
    const position = value('test step'),
      action = value('step action'),
      expected = value('step expected');
    if (position || action || expected) {
      if (!current) invalid(number, 'passo sem caso precedente.');
      if (
        !/^\d+$/.test(position) ||
        Number(position) !== current.steps.length + 1 ||
        !action
      )
        invalid(
          number,
          'passos devem começar em 1, ser consecutivos e ter ação.',
        );
      if (
        action.length > 10000 ||
        expected.length > 10000 ||
        current.steps.length >= 1000
      )
        invalid(
          number,
          'limites de tamanho ou quantidade de passos excedidos.',
        );
      current.steps.push({ action, expectedResult: expected || null });
    } else if (!id) invalid(number, 'registro não representa caso ou passo.');
  }
  if (!cases.length) invalid(2, 'nenhum caso de teste encontrado.');
  for (const item of cases) {
    if (
      item.steps.some((step) =>
        /^(?:Dado|Dada|Dados|Dadas|Quando|Então|Entao|E|Mas|Given|When|Then|And|But)\b/i.test(
          step.action,
        ),
      )
    )
      item.description = [
        item.description,
        item.steps.map((s) => s.action).join('\n'),
      ]
        .filter(Boolean)
        .join('\n\n');
    if ((item.description?.length ?? 0) > 10000)
      invalid(1, `descrição/BDD excede 10000 caracteres.`);
  }
  return cases;
}
