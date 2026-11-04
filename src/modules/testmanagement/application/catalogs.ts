import { randomUUID } from 'node:crypto';
import { ApplicationError } from '../../../shared/domain/errors.js';
import { pageResult } from '../../../shared/application/records.js';
import type { ListInput } from '../../../shared/application/records.js';
import {
  WorkspaceAccess,
  conflict,
  listQuery,
  notFound,
} from '../../workspace/application/access.js';
import { normalizeName } from '../../workspace/domain/models.js';
import type { Actor } from '../../workspace/domain/models.js';
import type { CustomFieldDefinition, Tag } from '../domain/catalogs.js';
export const CATALOGS = Symbol('Catalogs');
export interface FieldInput {
  key: string;
  name: string;
  description?: string | null;
  type: CustomFieldDefinition['type'];
  target: 'TEST_CASE';
  required: boolean;
  position: number;
  options: string[];
}
export type FieldChanges = Partial<
  Pick<FieldInput, 'name' | 'description' | 'required' | 'position'>
>;
const tagView = (tag: Tag) => ({
  id: tag.id,
  workspaceId: tag.workspaceId,
  name: tag.name,
  createdAt: tag.createdAt,
  updatedAt: tag.updatedAt,
});
export class Catalogs {
  constructor(private readonly access: WorkspaceAccess) {}
  fields(actor: Actor, ws: string, input: ListInput) {
    return this.access.run(ws, actor, 'field.read', async (tx) => {
      const query = listQuery<CustomFieldDefinition>(
        input,
        ['name', 'position', 'createdAt'],
        'position',
      );
      if (input.status === 'ARCHIVED')
        query.compare = [{ field: 'archivedAt', op: 'notNull' }];
      else if (input.status !== 'ALL') query.where = { archivedAt: null };
      if (input.q) query.search = { fields: ['name', 'key'], value: input.q };
      return pageResult(
        await tx.fields.list(query),
        input,
        await tx.fields.count(query),
      );
    });
  }
  field(actor: Actor, ws: string, id: string) {
    return this.access.run(ws, actor, 'field.read', async (tx) => {
      const field = await tx.fields.find({ id });
      if (!field) throw notFound();
      return field;
    });
  }
  createField(actor: Actor, ws: string, input: FieldInput) {
    return this.access.run(ws, actor, 'field.manage', async (tx) => {
      const options = input.options.map((label) => label.trim());
      if (
        (input.type === 'SINGLE_SELECT' && options.length === 0) ||
        (input.type !== 'SINGLE_SELECT' && options.length !== 0) ||
        new Set(options.map(normalizeName)).size !== options.length
      )
        throw new ApplicationError(
          400,
          'CUSTOM_FIELD_OPTIONS_INVALID',
          'Informe opções distintas somente para campos SINGLE_SELECT.',
        );
      const now = new Date();
      const field = await tx.fields.create({
        id: randomUUID(),
        workspaceId: ws,
        key: input.key.toLowerCase(),
        name: input.name.trim(),
        description: input.description ?? null,
        type: input.type,
        target: input.target,
        required: input.required,
        position: input.position,
        options: options.map((label) => ({ id: randomUUID(), label })),
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      await this.access.audit(
        tx,
        actor,
        ws,
        'catalog.field_created',
        'CustomFieldDefinition',
        field.id,
      );
      return field;
    });
  }
  updateField(actor: Actor, ws: string, id: string, input: FieldChanges) {
    return this.access.run(ws, actor, 'field.manage', async (tx) => {
      const field = await tx.fields.find({ id });
      if (!field) throw notFound();
      if (field.archivedAt)
        conflict(
          'CUSTOM_FIELD_ARCHIVED',
          'Campos arquivados não podem ser alterados.',
        );
      await tx.fields.update(
        { id },
        {
          ...input,
          ...(input.name ? { name: input.name.trim() } : {}),
          updatedAt: new Date(),
        },
      );
      await this.access.audit(
        tx,
        actor,
        ws,
        'catalog.field_updated',
        'CustomFieldDefinition',
        id,
      );
      return tx.fields.find({ id });
    });
  }
  archiveField(actor: Actor, ws: string, id: string) {
    return this.access.run(ws, actor, 'field.manage', async (tx) => {
      const field = await tx.fields.find({ id });
      if (!field) throw notFound();
      await tx.fields.update(
        { id },
        { archivedAt: field.archivedAt || new Date(), updatedAt: new Date() },
      );
      await this.access.audit(
        tx,
        actor,
        ws,
        'catalog.field_archived',
        'CustomFieldDefinition',
        id,
      );
      return tx.fields.find({ id });
    });
  }
  tags(actor: Actor, ws: string, input: ListInput) {
    return this.access.run(ws, actor, 'tag.read', async (tx) => {
      const query = listQuery<Tag>(input, ['name', 'createdAt'], 'name');
      if (input.q) query.search = { fields: ['name'], value: input.q };
      return pageResult(
        (await tx.tags.list(query)).map(tagView),
        input,
        await tx.tags.count(query),
      );
    });
  }
  tag(actor: Actor, ws: string, id: string) {
    return this.access.run(ws, actor, 'tag.read', async (tx) => {
      const tag = await tx.tags.find({ id });
      if (!tag) throw notFound();
      return tagView(tag);
    });
  }
  createTag(actor: Actor, ws: string, name: string) {
    return this.access.run(ws, actor, 'tag.manage', async (tx) => {
      const now = new Date();
      const tag = await tx.tags.create({
        id: randomUUID(),
        workspaceId: ws,
        name: name.trim(),
        normalizedName: normalizeName(name),
        createdAt: now,
        updatedAt: now,
      });
      await this.access.audit(
        tx,
        actor,
        ws,
        'catalog.tag_created',
        'Tag',
        tag.id,
      );
      return tagView(tag);
    });
  }
  updateTag(actor: Actor, ws: string, id: string, name: string) {
    return this.access.run(ws, actor, 'tag.manage', async (tx) => {
      if (!(await tx.tags.find({ id }))) throw notFound();
      await tx.tags.update(
        { id },
        {
          name: name.trim(),
          normalizedName: normalizeName(name),
          updatedAt: new Date(),
        },
      );
      await this.access.audit(tx, actor, ws, 'catalog.tag_updated', 'Tag', id);
      return tagView((await tx.tags.find({ id }))!);
    });
  }
  removeTag(actor: Actor, ws: string, id: string) {
    return this.access.run(ws, actor, 'tag.manage', async (tx) => {
      if (!(await tx.tags.find({ id }))) throw notFound();
      if (await tx.testCaseTags.count({ where: { tagId: id } }))
        conflict(
          'TAG_IN_USE',
          'A tag está vinculada a casos de teste. Remova os vínculos antes de excluí-la.',
        );
      await tx.tags.remove({ id });
      await this.access.audit(tx, actor, ws, 'catalog.tag_removed', 'Tag', id);
    });
  }
}
