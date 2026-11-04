import { SaxesParser } from 'saxes';
import { ApplicationError } from '../../../shared/domain/errors.js';
import type { ImportedResult } from '../domain/result-import.js';

const invalid = () =>
  new ApplicationError(
    400,
    'TEST_RESULT_IMPORT_INVALID',
    'Envie JUnit XML UTF-8 válido, sem DTD/entidades, com 1 a 500 resultados.',
  );
const uuid =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const human = /\b[A-Z][A-Z0-9_]{1,19}-[1-9][0-9]*\b/g;

/** SAX parsing is bounded by the upload size, depth and case count; no I/O or entity resolver. */
export function parseJUnit(buffer: Buffer): ImportedResult[] {
  let xml: string;
  try {
    xml = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw invalid();
  }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw invalid();
  const parser = new SaxesParser({ xmlns: false });
  const stack: string[] = [];
  const items: ImportedResult[] = [];
  let item: ImportedResult | null = null;
  let property: { name: string; value: string } | null = null;
  let detail = '';
  const propertyValue = () => {
    if (!item || !property) return;
    const value = property.value.trim();
    if (property.name === 'lambdaquality.caseId') {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value,
        )
      )
        item.blockers.push('INVALID_CASE_ID');
      else item.caseIds.push(value.toLowerCase());
    }
    if (property.name === 'lambdaquality.humanId') {
      if (!/^[A-Z][A-Z0-9_]{1,19}-[1-9][0-9]*$/.test(value))
        item.blockers.push('INVALID_HUMAN_ID');
      else item.humanIds.push(value);
    }
  };
  parser.on('doctype', () => {
    throw invalid();
  });
  parser.on('error', () => {
    throw invalid();
  });
  parser.on('xmldecl', (decl) => {
    if (decl.encoding && !/^utf-8$/i.test(decl.encoding)) throw invalid();
  });
  parser.on('opentag', (tag) => {
    const parent = stack.at(-1);
    if (!stack.length && !['testsuite', 'testsuites'].includes(tag.name))
      throw invalid();
    if (stack.length >= 64) throw invalid();
    const a = tag.attributes;
    if (tag.name === 'testcase') {
      if (
        item ||
        parent !== 'testsuite' ||
        items.length >= 500 ||
        !a.name ||
        a.name.length > 1000
      )
        throw invalid();
      item = {
        itemId: items.length + 1,
        name: a.name,
        className: a.classname || null,
        result: 'PASSED',
        caseIds: [...a.name.matchAll(uuid)].map((m) => m[0].toLowerCase()),
        humanIds: [...a.name.matchAll(human)].map((m) => m[0]),
        details: null,
        proposedRunCaseId: null,
        blockers: [],
      };
      if (item.className && item.className.length > 1000) throw invalid();
    } else if (item && parent === 'testcase') {
      if (tag.name === 'failure' || tag.name === 'error')
        item.result = 'FAILED';
      if (tag.name === 'skipped' && item.result !== 'FAILED')
        item.result = 'SKIPPED';
      if (['failure', 'error', 'skipped'].includes(tag.name))
        detail += a.message ? a.message + '\n' : '';
    }
    if (
      item &&
      tag.name === 'property' &&
      parent === 'properties' &&
      stack.at(-2) === 'testcase'
    )
      property = { name: a.name || '', value: a.value || '' };
    stack.push(tag.name);
  });
  const text = (value: string) => {
    if (property) property.value += value;
    if (item && ['failure', 'error', 'skipped'].includes(stack.at(-1)!))
      detail += value;
    if (detail.length > 10000) detail = detail.slice(0, 10000);
  };
  parser.on('text', text);
  parser.on('cdata', text);
  parser.on('closetag', (tag) => {
    if (tag.name === 'property') {
      propertyValue();
      property = null;
    }
    if (tag.name === 'testcase' && item) {
      item.caseIds = [...new Set(item.caseIds)];
      item.humanIds = [...new Set(item.humanIds)];
      item.details = detail.trim().slice(0, 10000) || null;
      items.push(item);
      item = null;
      detail = '';
    }
    stack.pop();
  });
  try {
    parser.write(xml).close();
  } catch {
    throw invalid();
  }
  if (!items.length) throw invalid();
  return items;
}
