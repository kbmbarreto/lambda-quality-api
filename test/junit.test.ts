import { describe, it, expect } from 'vitest';
import { parseJUnit } from '../dist/modules/execution/infrastructure/junit-parser.js';
const id = '33333333-3333-4333-8333-333333333333';
const parse = (xml: string) => parseJUnit(Buffer.from(xml));
describe('Bounded JUnit XML parsing', () => {
  it('extracts explicit identifiers, Unicode, encoded text and failure precedence from nested suites', () => {
    const rows = parse(
      `<testsuites><testsuite><testsuite><testcase name="QA-12 · ${id}" classname="Funcional"><properties><property name="lambdaquality.caseId" value="${id}"/><property name="lambdaquality.humanId">QA-12</property></properties></testcase><testcase name="Falhou"><skipped/><error message="erro &amp; detalhe"><![CDATA[stack <line>]]></error></testcase><testcase name="Ignorado"><skipped/></testcase></testsuite></testsuite></testsuites>`,
    );
    expect(rows.map((r) => r.result)).toEqual(['PASSED', 'FAILED', 'SKIPPED']);
    expect(rows[0]).toMatchObject({
      caseIds: [id],
      humanIds: ['QA-12'],
      proposedRunCaseId: null,
    });
    expect(rows[1].details).toContain('erro & detalhe');
    expect(rows[1].details).toContain('stack <line>');
  });
  it.each([
    '',
    '<testcase name="x"/>',
    '<testsuite/>',
    '<testsuite><testcase/></testsuite>',
    '<testsuite><testcase name="x"></testsuite>',
    '<testsuite><testcase name="x">&unknown;</testcase></testsuite>',
    '<?xml version="1.0" encoding="UTF-16"?><testsuite><testcase name="x"/></testsuite>',
    '<!DOCTYPE testsuite SYSTEM "file:///secret"><testsuite><testcase name="x"/></testsuite>',
    '<!DOCTYPE testsuite [<!ENTITY x "data">]><testsuite><testcase name="&x;"/></testsuite>',
    '<testsuite><testcase name="a"><testcase name="b"/></testcase></testsuite>',
  ])('rejects unsafe, malformed or unsupported XML (%#)', (xml) => {
    expect(() => parse(xml)).toThrow('JUnit XML');
  });
  it('rejects invalid UTF-8, excessive nesting and more than 500 records and truncates failure details', () => {
    expect(() => parseJUnit(Buffer.from([0xff]))).toThrow();
    expect(() =>
      parse(
        '<testsuite>'.repeat(65) +
          '<testcase name="x"/>' +
          '</testsuite>'.repeat(65),
      ),
    ).toThrow();
    expect(
      parse(
        '<testsuite>' + '<testcase name="x"/>'.repeat(500) + '</testsuite>',
      ),
    ).toHaveLength(500);
    expect(() =>
      parse(
        '<testsuite>' + '<testcase name="x"/>'.repeat(501) + '</testsuite>',
      ),
    ).toThrow();
    expect(
      parse(
        '<testsuite><testcase name="x"><failure>' +
          'x'.repeat(15000) +
          '</failure></testcase></testsuite>',
      )[0].details,
    ).toHaveLength(10000);
  });
  it('does not turn titles or malformed property IDs into a proposed case association', () => {
    expect(
      parse(
        '<testsuite><testcase name="Mesmo título"><properties><property name="lambdaquality.caseId" value="invalid"/></properties></testcase></testsuite>',
      )[0],
    ).toMatchObject({
      caseIds: [],
      humanIds: [],
      blockers: ['INVALID_CASE_ID'],
      proposedRunCaseId: null,
    });
  });
});
