import { randomUUID } from 'node:crypto';
import type { Actor } from '../../workspace/domain/models.js';
import type { ListInput } from '../../../shared/application/records.js';
import { pageResult } from '../../../shared/application/records.js';
import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import {
  conflict,
  listQuery,
  notFound,
} from '../../workspace/application/access.js';
import { Projects } from '../../project/application/projects.js';
import type { TestSuite } from '../domain/models.js';
import { exactOrder, invalid, validateSuiteParent } from '../domain/rules.js';
export const TEST_SUITES = Symbol('TestSuites');
export class TestSuites {
  constructor(private readonly projects: Projects) {}
  async find(
    tx: WorkspaceTransaction,
    projectId: string,
    id: string,
    write = false,
  ) {
    const row = await tx.testSuites.find({ projectId, id });
    if (!row) throw notFound();
    if (write && row.archivedAt)
      conflict(
        'TEST_SUITE_ARCHIVED',
        'A suíte está arquivada e não permite alterações.',
      );
    return row;
  }
  async siblings(
    tx: WorkspaceTransaction,
    projectId: string,
    parentSuiteId: string | null,
  ) {
    return tx.testSuites.list({
      where: { projectId, parentSuiteId, archivedAt: null },
      order: { field: 'position', direction: 'asc' },
    });
  }
  async order(tx: WorkspaceTransaction, projectId: string, ids: string[]) {
    for (const [i, id] of ids.entries())
      await tx.testSuites.update(
        { id, projectId },
        { position: i + 1, updatedAt: new Date() },
      );
  }
  list(
    actor: Actor,
    ws: string,
    projectId: string,
    input: ListInput & { parentSuiteId?: string; root?: boolean },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.read',
      false,
      async (tx) => {
        const query = listQuery<TestSuite>(
          input,
          ['name', 'position', 'createdAt'],
          'position',
        );
        query.where = { projectId };
        if (input.status === 'ARCHIVED')
          query.compare = [{ field: 'archivedAt', op: 'notNull' }];
        else if (input.status !== 'ALL') query.where.archivedAt = null;
        if (input.parentSuiteId && input.root)
          invalid('Use parentSuiteId ou root, sem combinar ambos.');
        if (input.parentSuiteId) {
          await this.find(tx, projectId, input.parentSuiteId);
          query.where.parentSuiteId = input.parentSuiteId;
        }
        if (input.root) query.where.parentSuiteId = null;
        if (input.q) query.search = { fields: ['name'], value: input.q };
        return pageResult(
          await tx.testSuites.list(query),
          input,
          await tx.testSuites.count(query),
        );
      },
    );
  }
  get(actor: Actor, ws: string, projectId: string, id: string) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.read',
      false,
      (tx) => this.find(tx, projectId, id),
    );
  }
  create(
    actor: Actor,
    ws: string,
    projectId: string,
    input: {
      name: string;
      description?: string | null;
      parentSuiteId?: string | null;
    },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.create',
      true,
      async (tx) => {
        const parentSuiteId = input.parentSuiteId ?? null;
        if (parentSuiteId) await this.find(tx, projectId, parentSuiteId, true);
        const row = await tx.testSuites.create({
          id: randomUUID(),
          workspaceId: ws,
          projectId,
          parentSuiteId,
          name: input.name,
          description: input.description ?? null,
          position:
            (await this.siblings(tx, projectId, parentSuiteId)).length + 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          archivedAt: null,
        });
        await this.projects.access.audit(
          tx,
          actor,
          ws,
          'test.suite_created',
          'TestSuite',
          row.id,
        );
        return row;
      },
    );
  }
  update(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: { name?: string; description?: string | null },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.update',
      true,
      async (tx) => {
        await this.find(tx, projectId, id, true);
        await tx.testSuites.update(
          { id, projectId },
          { ...input, updatedAt: new Date() },
        );
        await this.projects.access.audit(
          tx,
          actor,
          ws,
          'test.suite_updated',
          'TestSuite',
          id,
        );
        return this.find(tx, projectId, id);
      },
    );
  }
  move(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: { parentSuiteId: string | null; position?: number },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.update',
      true,
      async (tx) => {
        const row = await this.find(tx, projectId, id, true);
        validateSuiteParent(
          await tx.testSuites.list({ where: { projectId } }),
          id,
          input.parentSuiteId,
        );
        const target = (await this.siblings(tx, projectId, input.parentSuiteId))
          .filter((s) => s.id !== id)
          .map((s) => s.id);
        const position = input.position ?? target.length + 1;
        if (position < 1 || position > target.length + 1)
          invalid('Posição fora dos limites dos irmãos.', 'TEST_ORDER_INVALID');
        target.splice(position - 1, 0, id);
        await tx.testSuites.update(
          { id, projectId },
          { parentSuiteId: input.parentSuiteId },
        );
        if (row.parentSuiteId !== input.parentSuiteId)
          await this.order(
            tx,
            projectId,
            (await this.siblings(tx, projectId, row.parentSuiteId)).map(
              (s) => s.id,
            ),
          );
        await this.order(tx, projectId, target);
        await this.projects.access.audit(
          tx,
          actor,
          ws,
          'test.suite_moved',
          'TestSuite',
          id,
        );
        return this.find(tx, projectId, id);
      },
    );
  }
  reorder(
    actor: Actor,
    ws: string,
    projectId: string,
    input: { parentSuiteId: string | null; ids: string[] },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.update',
      true,
      async (tx) => {
        if (input.parentSuiteId)
          await this.find(tx, projectId, input.parentSuiteId, true);
        exactOrder(
          (await this.siblings(tx, projectId, input.parentSuiteId)).map(
            (s) => s.id,
          ),
          input.ids,
        );
        await this.order(tx, projectId, input.ids);
        await this.projects.access.audit(
          tx,
          actor,
          ws,
          'test.suites_reordered',
          'Project',
          projectId,
        );
        return this.siblings(tx, projectId, input.parentSuiteId);
      },
    );
  }
  archive(actor: Actor, ws: string, projectId: string, id: string) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testcase.archive',
      true,
      async (tx) => {
        const row = await this.find(tx, projectId, id);
        if (!row.archivedAt) {
          if (
            (await tx.testSuites.count({
              where: { projectId, parentSuiteId: id, archivedAt: null },
            })) ||
            (await tx.testCases.count({
              where: { projectId, suiteId: id, archivedAt: null },
            }))
          )
            conflict(
              'TEST_SUITE_NOT_EMPTY',
              'Arquive ou mova os filhos e casos antes de arquivar a suíte.',
            );
          await tx.testSuites.update(
            { id, projectId },
            { archivedAt: new Date(), updatedAt: new Date() },
          );
          await this.order(
            tx,
            projectId,
            (await this.siblings(tx, projectId, row.parentSuiteId)).map(
              (s) => s.id,
            ),
          );
          await this.projects.access.audit(
            tx,
            actor,
            ws,
            'test.suite_archived',
            'TestSuite',
            id,
          );
        }
        return this.find(tx, projectId, id);
      },
    );
  }
}
