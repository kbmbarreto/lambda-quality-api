import { randomUUID } from 'node:crypto';
import type { Actor } from '../../workspace/domain/models.js';
import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import {
  WorkspaceAccess,
  notFound,
  listQuery,
} from '../../workspace/application/access.js';
import { pageResult } from '../../../shared/application/records.js';
import type {
  ListInput,
  Records,
} from '../../../shared/application/records.js';
import type {
  GovernanceFramework,
  FrameworkSection,
  GovernanceControl,
} from '../domain/models.js';
import {
  definedChanges,
  checkVersion,
  governanceConflict,
  invalid,
  validateTree,
} from '../domain/rules.js';
export interface FrameworkInput {
  code: string;
  name: string;
  versionLabel: string;
  description?: string | null;
}
export interface SectionInput {
  code: string;
  name: string;
  description?: string | null;
  parentSectionId?: string | null;
  position: number;
}
export interface ControlInput {
  sectionId: string;
  code: string;
  title: string;
  description?: string | null;
  weight?: number;
  active?: boolean;
}
export class GovernanceFrameworks {
  constructor(readonly access: WorkspaceAccess) {}
  async find(
    tx: WorkspaceTransaction,
    id: string,
    version?: number,
    write = false,
  ) {
    const row = await tx.frameworks.find({ id });
    if (!row) throw notFound();
    if (version !== undefined) checkVersion(row.version, version);
    if (write && row.status === 'ARCHIVED')
      governanceConflict(
        'GOVERNANCE_FRAMEWORK_ARCHIVED',
        'O framework está arquivado.',
      );
    return row;
  }
  async changed(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    row: GovernanceFramework,
    action: string,
  ) {
    await tx.frameworks.update(
      { id: row.id },
      { version: row.version + 1, updatedAt: new Date() },
    );
    await this.access.audit(
      tx,
      actor,
      ws,
      `governance.framework.${action}`,
      'GovernanceFramework',
      row.id,
    );
    return this.find(tx, row.id);
  }
  async page<T extends { id: string }>(
    records: Records<T>,
    input: ListInput,
    allowed: (keyof T & string)[],
    fallback: keyof T & string,
    where: Partial<T>,
    search: (keyof T)[],
  ) {
    const query = listQuery<T>(input, allowed, fallback);
    query.where = where;
    if (input.q) query.search = { fields: search, value: input.q };
    return pageResult(
      await records.list(query),
      input,
      await records.count(query),
    );
  }
  list(actor: Actor, ws: string, input: ListInput) {
    return this.access.run(ws, actor, 'governance.read', (tx) =>
      this.page(
        tx.frameworks,
        input,
        ['code', 'name', 'createdAt', 'updatedAt'],
        'name',
        input.status && input.status !== 'ALL'
          ? { status: input.status as GovernanceFramework['status'] }
          : {},
        ['code', 'name'],
      ),
    );
  }
  get(actor: Actor, ws: string, id: string) {
    return this.access.run(ws, actor, 'governance.read', (tx) =>
      this.find(tx, id),
    );
  }
  create(actor: Actor, ws: string, input: FrameworkInput) {
    return this.access.run(ws, actor, 'governance.manage', async (tx) => {
      const row = await tx.frameworks.create({
        id: randomUUID(),
        workspaceId: ws,
        ...input,
        description: input.description ?? null,
        status: 'DRAFT',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await this.access.audit(
        tx,
        actor,
        ws,
        'governance.framework.created',
        'GovernanceFramework',
        row.id,
      );
      return row;
    });
  }
  update(
    actor: Actor,
    ws: string,
    id: string,
    input: Partial<FrameworkInput> & {
      version: number;
      status?: GovernanceFramework['status'];
    },
  ) {
    return this.access.run(ws, actor, 'governance.manage', async (tx) => {
      const row = await this.find(tx, id, input.version, true);
      const { version: _version, ...rawChanges } = input;
      const changes = definedChanges(rawChanges);
      if (!Object.values(changes).some((v) => v !== undefined))
        invalid('Informe ao menos um campo para alterar.');
      if (changes.status === 'DRAFT' && row.status === 'ACTIVE')
        governanceConflict(
          'GOVERNANCE_STATE_INVALID',
          'O framework ativo não pode voltar para rascunho.',
        );
      if (
        changes.status === 'ACTIVE' &&
        !(await tx.governanceControls.count({
          where: { frameworkId: id, active: true },
        }))
      )
        governanceConflict(
          'GOVERNANCE_FRAMEWORK_EMPTY',
          'Ative ao menos um controle antes de ativar o framework.',
        );
      await tx.frameworks.update({ id }, changes);
      return this.changed(tx, actor, ws, row, 'updated');
    });
  }
  sections(actor: Actor, ws: string, id: string, input: ListInput) {
    return this.access.run(ws, actor, 'governance.read', async (tx) => {
      await this.find(tx, id);
      return this.page(
        tx.frameworkSections,
        input,
        ['position', 'code', 'name'],
        'position',
        { frameworkId: id },
        ['code', 'name'],
      );
    });
  }
  section(
    actor: Actor,
    ws: string,
    id: string,
    sectionId: string | null,
    input: Partial<SectionInput> & { version: number },
  ) {
    return this.access.run(ws, actor, 'governance.manage', async (tx) => {
      const root = await this.find(tx, id, input.version, true);
      const { version: _version, ...rawChanges } = input;
      const changes = definedChanges(rawChanges);
      const all = await tx.frameworkSections.list({
        where: { frameworkId: id },
      });
      let row: FrameworkSection;
      if (sectionId) {
        const found = all.find((s) => s.id === sectionId);
        if (!found) throw notFound();
        if (!Object.values(changes).some((v) => v !== undefined))
          invalid('Informe ao menos um campo para alterar.');
        row = { ...found, ...changes };
      } else {
        if (all.length >= 500)
          governanceConflict(
            'GOVERNANCE_LIMIT',
            'O framework admite até 500 seções.',
          );
        row = {
          id: randomUUID(),
          workspaceId: ws,
          frameworkId: id,
          code: input.code!,
          name: input.name!,
          description: input.description ?? null,
          parentSectionId: input.parentSectionId ?? null,
          position: input.position!,
        };
      }
      validateTree([...all.filter((s) => s.id !== row.id), row]);
      if (sectionId)
        await tx.frameworkSections.update(
          { id: sectionId, frameworkId: id },
          changes,
        );
      else await tx.frameworkSections.create(row);
      const framework = await this.changed(
        tx,
        actor,
        ws,
        root,
        sectionId ? 'section_updated' : 'section_created',
      );
      return { section: row, frameworkVersion: framework.version };
    });
  }
  controls(
    actor: Actor,
    ws: string,
    id: string,
    input: ListInput & { active?: boolean; sectionId?: string },
  ) {
    return this.access.run(ws, actor, 'governance.read', async (tx) => {
      await this.find(tx, id);
      const where: Partial<GovernanceControl> = { frameworkId: id };
      if (input.active !== undefined) where.active = input.active;
      if (input.sectionId) {
        if (
          !(await tx.frameworkSections.find({
            id: input.sectionId,
            frameworkId: id,
          }))
        )
          throw notFound();
        where.sectionId = input.sectionId;
      }
      return this.page(
        tx.governanceControls,
        input,
        ['creationOrder', 'code', 'title'],
        'creationOrder',
        where,
        ['code', 'title'],
      );
    });
  }
  control(
    actor: Actor,
    ws: string,
    id: string,
    controlId: string | null,
    input: Partial<ControlInput> & { version: number },
  ) {
    return this.access.run(ws, actor, 'governance.manage', async (tx) => {
      const root = await this.find(tx, id, input.version, true);
      const { version: _version, ...rawChanges } = input;
      const changes = definedChanges(rawChanges);
      let row: GovernanceControl;
      if (controlId) {
        const found = await tx.governanceControls.find({
          id: controlId,
          frameworkId: id,
        });
        if (!found) throw notFound();
        if (!Object.values(changes).some((v) => v !== undefined))
          invalid('Informe ao menos um campo para alterar.');
        row = { ...found, ...changes };
      } else {
        if (
          (await tx.governanceControls.count({ where: { frameworkId: id } })) >=
          1000
        )
          governanceConflict(
            'GOVERNANCE_LIMIT',
            'O framework admite até 1000 controles.',
          );
        row = {
          creationOrder: 0,
          id: randomUUID(),
          workspaceId: ws,
          frameworkId: id,
          sectionId: input.sectionId!,
          code: input.code!,
          title: input.title!,
          description: input.description ?? null,
          weight: input.weight ?? 1,
          active: input.active ?? true,
        };
      }
      if (
        !(await tx.frameworkSections.find({
          id: row.sectionId,
          frameworkId: id,
        }))
      )
        throw notFound();
      if (root.status === 'ACTIVE' && !row.active) {
        const remaining = (
          await tx.governanceControls.list({
            where: { frameworkId: id, active: true },
          })
        ).filter((c) => c.id !== row.id);
        if (!remaining.length)
          governanceConflict(
            'GOVERNANCE_FRAMEWORK_EMPTY',
            'O framework ativo deve manter ao menos um controle ativo.',
          );
      }
      if (controlId)
        await tx.governanceControls.update(
          { id: controlId, frameworkId: id },
          changes,
        );
      else row = await tx.governanceControls.create(row);
      const framework = await this.changed(
        tx,
        actor,
        ws,
        root,
        controlId ? 'control_updated' : 'control_created',
      );
      return { control: row, frameworkVersion: framework.version };
    });
  }
}
