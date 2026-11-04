import { createHash, randomUUID } from 'node:crypto';
import { ApplicationError } from '../../../shared/domain/errors.js';
import {
  conflict,
  forbidden,
  notFound,
} from '../../workspace/application/access.js';
import type { Actor } from '../../workspace/domain/models.js';
import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import { Projects } from '../../project/application/projects.js';
import type { ImportedResult, ResultImport } from '../domain/result-import.js';
import { TestRuns } from './runs.js';

export const RESULT_IMPORTS = Symbol('ResultImports');
export interface ImportApplyInput {
  version: number;
  requestKey: string;
  overwrite: boolean;
  mappings: { itemId: number; runCaseId: string }[];
}
export class ResultImports {
  constructor(
    private readonly projects: Projects,
    private readonly runs: TestRuns,
    private readonly parse: (buffer: Buffer) => ImportedResult[],
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async editable(
    tx: WorkspaceTransaction,
    projectId: string,
    runId: string,
    version?: number,
  ) {
    const run = await this.runs.find(tx, projectId, runId, version, true);
    if (!run.testPlanId)
      conflict(
        'TEST_RESULT_IMPORT_PLAN_REQUIRED',
        'A importação exige uma execução originada de plano.',
      );
    return run;
  }
  authorize(actor: Actor, ws: string, projectId: string, runId: string) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.execute',
      true,
      async (tx, ctx) => {
        if (!ctx.capabilities.includes('testrun.read')) throw forbidden();
        await this.editable(tx, projectId, runId);
      },
    );
  }
  private view(row: ResultImport) {
    return {
      previewId: row.id,
      runId: row.testRunId,
      version: row.runVersion,
      fileName: row.fileName,
      fileHash: row.fileHash,
      tool: 'JUNIT',
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      status: row.appliedAt
        ? 'APPLIED'
        : row.expiresAt <= this.now()
          ? 'EXPIRED'
          : 'PREVIEW',
      items: row.items,
      appliedAt: row.appliedAt,
      appliedVersion: row.appliedVersion,
      requestKey: row.requestKey,
      mappings: row.mappings,
      importedCount: row.mappings?.length ?? 0,
    };
  }
  private async receipt(
    tx: WorkspaceTransaction,
    actor: Actor,
    projectId: string,
    runId: string,
    previewId: string,
  ) {
    const row = await tx.resultImports.find({
      id: previewId,
      projectId,
      testRunId: runId,
      createdBy: actor.userId,
    });
    if (!row) throw notFound();
    return row;
  }
  preview(
    actor: Actor,
    ws: string,
    projectId: string,
    runId: string,
    file?: { originalname: string; buffer: Buffer },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.execute',
      true,
      async (tx, ctx) => {
        if (!ctx.capabilities.includes('testrun.read')) throw forbidden();
        const run = await this.editable(tx, projectId, runId);
        if (
          !file ||
          !/\.xml$/i.test(file.originalname) ||
          file.originalname.length > 250 ||
          (file.originalname.includes('/') || file.originalname.includes('\\')) ||
          [...file.originalname].some(
            (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
          )
        )
          throw new ApplicationError(
            400,
            'TEST_RESULT_IMPORT_INVALID',
            'Envie um arquivo .xml no campo file, com nome de até 250 caracteres.',
          );
        if (file.buffer.length > 2 * 1024 * 1024)
          throw new ApplicationError(
            413,
            'PAYLOAD_TOO_LARGE',
            'O JUnit XML admite até 2 MiB.',
          );
        const items = this.parse(file.buffer);
        const cases = await this.runs.cases(tx, projectId, runId);
        for (const item of items) {
          const candidates = cases.filter(
            (c) =>
              item.caseIds.includes(c.testCaseId.toLowerCase()) ||
              item.humanIds.includes(c.humanIdSnapshot),
          );
          const identifiers = item.caseIds.length + item.humanIds.length;
          if (!identifiers) item.blockers.push('IDENTIFIER_MISSING');
          else if (!candidates.length) item.blockers.push('CASE_NOT_IN_RUN');
          else if (
            candidates.length !== 1 ||
            item.caseIds.some(
              (id) => id !== candidates[0].testCaseId.toLowerCase(),
            ) ||
            item.humanIds.some((id) => id !== candidates[0].humanIdSnapshot)
          )
            item.blockers.push('AMBIGUOUS_IDENTIFIER');
          else if (!item.blockers.length)
            item.proposedRunCaseId = candidates[0].id;
        }
        const counts = new Map<string, number>();
        for (const item of items)
          if (item.proposedRunCaseId)
            counts.set(
              item.proposedRunCaseId,
              (counts.get(item.proposedRunCaseId) || 0) + 1,
            );
        for (const item of items)
          if (
            item.proposedRunCaseId &&
            counts.get(item.proposedRunCaseId)! > 1
          ) {
            item.blockers.push('DUPLICATE_RESULT');
            item.proposedRunCaseId = null;
          }
        const now = this.now();
        const row = await tx.resultImports.create({
          id: randomUUID(),
          workspaceId: ws,
          projectId,
          testRunId: runId,
          runVersion: run.version,
          fileName: file.originalname,
          fileHash: createHash('sha256').update(file.buffer).digest('hex'),
          items,
          createdBy: actor.userId,
          createdAt: now,
          expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
          requestKey: null,
          requestHash: null,
          appliedAt: null,
          appliedVersion: null,
          mappings: null,
        });
        return this.view(row);
      },
    );
  }
  get(
    actor: Actor,
    ws: string,
    projectId: string,
    runId: string,
    previewId: string,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.read',
      false,
      async (tx) => {
        await this.runs.find(tx, projectId, runId);
        return this.view(
          await this.receipt(tx, actor, projectId, runId, previewId),
        );
      },
    );
  }
  apply(
    actor: Actor,
    ws: string,
    projectId: string,
    runId: string,
    previewId: string,
    input: ImportApplyInput,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testrun.execute',
      false,
      async (tx, ctx) => {
        if (!ctx.capabilities.includes('testrun.read')) throw forbidden();
        const receipt = await this.receipt(
          tx,
          actor,
          projectId,
          runId,
          previewId,
        );
        const mappings = [...input.mappings].sort(
          (a, b) => a.itemId - b.itemId,
        );
        const requestHash = createHash('sha256')
          .update(
            JSON.stringify({
              version: input.version,
              overwrite: input.overwrite,
              mappings,
            }),
          )
          .digest('hex');
        const previous = await tx.resultImports.find({
          projectId,
          testRunId: runId,
          requestKey: input.requestKey,
        });
        if (previous) {
          if (
            previous.id !== receipt.id ||
            previous.requestHash !== requestHash ||
            previous.createdBy !== actor.userId
          )
            conflict(
              'TEST_RESULT_IMPORT_KEY_CONFLICT',
              'A chave de requisição já foi utilizada com outros dados.',
            );
          return {
            run: await this.runs.view(
              tx,
              await this.runs.find(tx, projectId, runId),
            ),
            import: this.view(previous),
            alreadyApplied: true,
          };
        }
        if (receipt.appliedAt)
          conflict(
            'TEST_RESULT_IMPORT_ALREADY_APPLIED',
            'Esta prévia já foi aplicada. Consulte o recibo.',
          );
        if (ctx.project.status === 'ARCHIVED')
          conflict(
            'PROJECT_ARCHIVED',
            'O projeto está arquivado e não permite alterações.',
          );
        if (receipt.expiresAt <= this.now())
          conflict(
            'TEST_RESULT_IMPORT_EXPIRED',
            'A prévia expirou. Envie o relatório novamente.',
          );
        const run = await this.editable(tx, projectId, runId, input.version);
        if (receipt.runVersion !== input.version)
          conflict(
            'TEST_RUN_VERSION_CONFLICT',
            'A execução mudou desde a prévia. Gere uma nova prévia antes de aplicar.',
          );
        if (
          !mappings.length ||
          mappings.length > 500 ||
          new Set(mappings.map((m) => m.itemId)).size !== mappings.length ||
          new Set(mappings.map((m) => m.runCaseId)).size !== mappings.length
        )
          throw new ApplicationError(
            400,
            'TEST_RESULT_IMPORT_MAPPING_INVALID',
            'Selecione de 1 a 500 resultados e destinos distintos.',
          );
        const selected = [];
        for (const mapping of mappings) {
          const item = receipt.items.find((i) => i.itemId === mapping.itemId);
          if (!item)
            throw new ApplicationError(
              400,
              'TEST_RESULT_IMPORT_MAPPING_INVALID',
              'Resultado inexistente na prévia.',
            );
          const row = await this.runs.runCase(
            tx,
            projectId,
            runId,
            mapping.runCaseId,
          );
          if (!input.overwrite && row.result !== 'NOT_TESTED')
            conflict(
              'TEST_RESULT_IMPORT_OVERWRITE_REQUIRED',
              'Confirme explicitamente a substituição dos resultados existentes.',
            );
          selected.push({ mapping, item });
        }
        const appliedAt = this.now();
        for (const { mapping, item } of selected) {
          await tx.testRunCases.update(
            { id: mapping.runCaseId, projectId, testRunId: runId },
            {
              result: item.result,
              resultOrigin: 'JUNIT',
              externalResult: {
                origin: 'JUNIT',
                importId: receipt.id,
                itemId: item.itemId,
                fileName: receipt.fileName,
                fileHash: receipt.fileHash,
                name: item.name,
                className: item.className,
                details: item.details,
              },
              executedBy: actor.userId,
              executedAt: appliedAt,
              updatedAt: appliedAt,
            },
          );
        }
        await this.runs.changed(tx, actor, ws, run, 'results_imported');
        await tx.resultImports.update(
          { id: receipt.id, projectId, testRunId: runId },
          {
            requestKey: input.requestKey,
            requestHash,
            appliedAt,
            appliedVersion: run.version + 1,
            mappings,
          },
        );
        return {
          run: await this.runs.view(
            tx,
            await this.runs.find(tx, projectId, runId),
          ),
          import: this.view(
            await this.receipt(tx, actor, projectId, runId, previewId),
          ),
          alreadyApplied: false,
        };
      },
    );
  }
}
