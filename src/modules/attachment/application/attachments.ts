import { createHash, randomUUID } from 'node:crypto';
import { ApplicationError } from '../../../shared/domain/errors.js';
import { pageResult } from '../../../shared/application/records.js';
import type { ListInput } from '../../../shared/application/records.js';
import {
  WorkspaceAccess,
  listQuery,
  notFound,
} from '../../workspace/application/access.js';
import type { Actor } from '../../workspace/domain/models.js';
import type { Attachment, Upload } from '../domain/models.js';
import type { FileStorage } from './storage.js';
export const ATTACHMENTS = Symbol('Attachments');
const view = (file: Attachment) => ({
  id: file.id,
  workspaceId: file.workspaceId,
  originalName: file.originalName,
  contentType: file.contentType,
  sizeBytes: file.sizeBytes,
  checksum: file.checksum,
  uploadedBy: file.uploadedBy,
  createdAt: file.createdAt,
});
function validContent(bytes: Uint8Array, mime: string): boolean {
  const buffer = Buffer.from(bytes);
  if (mime === 'image/png')
    return (
      buffer.length >= 24 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      buffer.toString('ascii', 12, 16) === 'IHDR'
    );
  if (mime === 'image/jpeg')
    return (
      buffer.length >= 4 &&
      buffer[0] === 255 &&
      buffer[1] === 216 &&
      buffer[2] === 255 &&
      buffer.at(-2) === 255 &&
      buffer.at(-1) === 217
    );
  if (mime === 'application/pdf')
    return (
      buffer.subarray(0, 5).toString('ascii') === '%PDF-' &&
      buffer
        .subarray(Math.max(0, buffer.length - 1024))
        .includes(Buffer.from('%%EOF'))
    );
  if (['text/plain', 'text/csv'].includes(mime)) {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return !Array.from(text).some(
        (char) =>
          char.charCodeAt(0) < 32 && ![9, 10, 13].includes(char.charCodeAt(0)),
      );
    } catch {
      return false;
    }
  }
  return false;
}
export class Attachments {
  constructor(
    private readonly access: WorkspaceAccess,
    private readonly storage: FileStorage,
    private readonly maxBytes: number,
  ) {}
  list(actor: Actor, ws: string, input: ListInput) {
    return this.access.run(ws, actor, 'attachment.read', async (tx) => {
      const query = listQuery<Attachment>(
        input,
        ['originalName', 'createdAt', 'sizeBytes'],
        'createdAt',
      );
      query.where = { deletedAt: null };
      if (input.q) query.search = { fields: ['originalName'], value: input.q };
      return pageResult(
        (await tx.attachments.list(query)).map(view),
        input,
        await tx.attachments.count(query),
      );
    });
  }
  get(actor: Actor, ws: string, id: string) {
    return this.access.run(ws, actor, 'attachment.read', async (tx) => {
      const file = await tx.attachments.find({ id, deletedAt: null });
      if (!file) throw notFound();
      return view(file);
    });
  }
  async upload(actor: Actor, ws: string, input: Upload) {
    if (!input.bytes.length)
      throw new ApplicationError(
        400,
        'ATTACHMENT_EMPTY',
        'O arquivo não pode estar vazio.',
      );
    if (input.bytes.length > this.maxBytes)
      throw new ApplicationError(
        413,
        'PAYLOAD_TOO_LARGE',
        'O arquivo excede o limite permitido.',
      );
    if (!validContent(input.bytes, input.contentType))
      throw new ApplicationError(
        400,
        'ATTACHMENT_TYPE_INVALID',
        'Tipo de arquivo não permitido ou conteúdo incompatível.',
      );
    const originalName = input.originalName
      .split(/[\\/]/)
      .at(-1)!
      .normalize('NFC');
    if (
      !originalName.trim() ||
      originalName.length > 255 ||
      Array.from(originalName).some(
        (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
      )
    )
      throw new ApplicationError(
        400,
        'VALIDATION_ERROR',
        'Nome de arquivo inválido.',
      );
    const storageKey = `${randomUUID()}.blob`;
    let stored = false;
    try {
      return await this.access.run(
        ws,
        actor,
        'attachment.upload',
        async (tx) => {
          try {
            await this.storage.put(storageKey, input.bytes);
            stored = true;
          } catch {
            throw new ApplicationError(
              503,
              'ATTACHMENT_STORAGE_UNAVAILABLE',
              'Não foi possível anexar o arquivo. O serviço de armazenamento está temporariamente indisponível. Tente novamente mais tarde.',
            );
          }
          const file = await tx.attachments.create({
            id: randomUUID(),
            workspaceId: ws,
            storageKey,
            originalName,
            contentType: input.contentType,
            sizeBytes: input.bytes.length,
            checksum: createHash('sha256').update(input.bytes).digest('hex'),
            uploadedBy: actor.userId,
            createdAt: new Date(),
            deletedAt: null,
          });
          await this.access.audit(
            tx,
            actor,
            ws,
            'attachment.uploaded',
            'Attachment',
            file.id,
          );
          return view(file);
        },
      );
    } catch (error) {
      if (stored) await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }
  }
  download(actor: Actor, ws: string, id: string) {
    return this.access.run(ws, actor, 'attachment.read', async (tx) => {
      const file = await tx.attachments.find({ id, deletedAt: null });
      if (!file) throw notFound();
      try {
        const stream = await this.storage.open(file.storageKey);
        try {
          await this.access.audit(
            tx,
            actor,
            ws,
            'attachment.downloaded',
            'Attachment',
            file.id,
          );
        } catch (error) {
          stream.destroy();
          throw error;
        }
        return { file: view(file), stream };
      } catch {
        throw new ApplicationError(
          503,
          'ATTACHMENT_STORAGE_UNAVAILABLE',
          'Não foi possível acessar o arquivo.',
        );
      }
    });
  }
  remove(actor: Actor, ws: string, id: string) {
    return this.access.run(ws, actor, 'attachment.delete', async (tx) => {
      const file = await tx.attachments.find({ id });
      if (!file) throw notFound();
      await tx.attachments.update(
        { id },
        { deletedAt: file.deletedAt || new Date() },
      );
      await this.access.audit(
        tx,
        actor,
        ws,
        'attachment.deleted',
        'Attachment',
        id,
      );
    });
  }
  async cleanup(retentionDays: number): Promise<void> {
    const now = Date.now();
    const before = new Date(now - retentionDays * 86400000);
    for (const file of await this.access.store.deletedAttachments(before))
      await this.storage.remove(file.storageKey);
    const keys = new Set(await this.access.store.storageKeys());
    for (const file of await this.storage.list())
      if (!keys.has(file.key) && file.modifiedAt.getTime() < now - 86400000)
        await this.storage.remove(file.key);
  }
}
