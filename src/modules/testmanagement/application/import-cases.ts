import { createHash, randomUUID } from 'node:crypto';
import { ApplicationError } from '../../../shared/domain/errors.js';
import type { Actor } from '../../workspace/domain/models.js';
import { Projects } from '../../project/application/projects.js';
import { TestCases } from './cases.js';
import { parseAzureCsv } from '../domain/azure-csv.js';
export const TEST_CASE_IMPORT = Symbol('TestCaseImport');
export interface ImportCaseResult {
  azureId: string;
  id: string;
  sequence: number;
  title: string;
  suiteId: null;
}
export interface CaseImportReceipt {
  id: string;
  workspaceId: string;
  projectId: string;
  fileHash: string;
  cases: ImportCaseResult[];
  createdBy: string;
  createdAt: Date;
}
export class TestCaseImport {
  constructor(
    readonly projects: Projects,
    private readonly cases: TestCases,
  ) {}
  authorize(actor: Actor, ws: string, projectId: string) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.create',
      true,
      async () => undefined,
    );
  }
  import(
    actor: Actor,
    ws: string,
    projectId: string,
    file?: { originalname: string; buffer: Buffer },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.create',
      true,
      async (tx, ctx) => {
        if (!file || !/\.csv$/i.test(file.originalname))
          throw new ApplicationError(
            400,
            'TEST_CASE_IMPORT_INVALID',
            'Envie um arquivo .csv no campo file.',
          );
        if (file.buffer.length > 5 * 1024 * 1024)
          throw new ApplicationError(
            413,
            'PAYLOAD_TOO_LARGE',
            'O CSV admite até 5 MiB.',
          );
        const fileHash = createHash('sha256').update(file.buffer).digest('hex');
        const previous = await tx.caseImports.find({ projectId, fileHash });
        if (previous)
          return {
            importedCount: previous.cases.length,
            alreadyImported: true,
            cases: previous.cases,
          };
        let text: string;
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
        } catch {
          throw new ApplicationError(
            400,
            'TEST_CASE_IMPORT_INVALID',
            'O CSV deve usar UTF-8.',
          );
        }
        const parsed = parseAzureCsv(text),
          imported: ImportCaseResult[] = [];
        for (const item of parsed) {
          const row = await this.cases.insert(tx, ctx, actor, ws, projectId, {
            title: item.title,
            description: item.description,
            preconditions: null,
            postconditions: null,
            severity: 'NORMAL',
            priority: 'MEDIUM',
            status: 'DRAFT',
            type: 'FUNCTIONAL',
            layer: 'E2E',
            behavior: null,
            automationStatus: 'MANUAL',
            suiteId: null,
            steps: item.steps,
          });
          imported.push({
            azureId: item.azureId,
            id: row.id,
            sequence: row.sequence,
            title: row.title,
            suiteId: null,
          });
          await this.projects.access.audit(
            tx,
            actor,
            ws,
            'test.case_imported',
            'TestCase',
            row.id,
          );
        }
        await tx.caseImports.create({
          id: randomUUID(),
          workspaceId: ws,
          projectId,
          fileHash,
          cases: imported,
          createdBy: actor.userId,
          createdAt: new Date(),
        });
        return {
          importedCount: imported.length,
          alreadyImported: false,
          cases: imported,
        };
      },
    );
  }
}
