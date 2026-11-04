import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdir, rmdir } from 'node:fs/promises';
import { MailService } from '@sendgrid/mail';
import { LocalStorage } from '../dist/modules/attachment/infrastructure/local-storage.js';
import { SendgridInvitations } from '../dist/modules/workspace/infrastructure/sendgrid-invitations.js';
import { listQuery } from '../dist/modules/workspace/application/access.js';
import { normalizeName } from '../dist/modules/workspace/domain/models.js';
import { testConfig } from './helpers.js';
const cleanup: { storage: LocalStorage; key: string; root: string }[] = [];
afterEach(async () => {
  for (const item of cleanup.splice(0)) {
    await item.storage.remove(item.key);
    await rmdir(item.root);
  }
  vi.restoreAllMocks();
});
describe('Workspace infrastructure and query rules', () => {
  it('stores private files exclusively and prevents traversal or accidental overwrite', async () => {
    const root = `.local/file-test-${randomUUID()}`;
    await mkdir(root, { recursive: true });
    const storage = new LocalStorage(root);
    const key = `${randomUUID()}.blob`;
    cleanup.push({ storage, key, root });
    await storage.put(key, Buffer.from('private evidence'));
    await expect(
      storage.put(key, Buffer.from('overwrite')),
    ).rejects.toMatchObject({ code: 'EEXIST' });
    await expect(storage.open('../../.env')).rejects.toThrow(
      'Invalid storage key',
    );
    const stream = await storage.open(key);
    const chunks = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe('private evidence');
    expect((await storage.list()).map((row) => row.key)).toEqual([key]);
    await storage.remove(key);
    await storage.remove(key);
  });
  it('sends an invitation link with the token in its fragment and tracking disabled', async () => {
    const send = vi
      .spyOn(MailService.prototype, 'send')
      .mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }, {}]);
    const mail = new SendgridInvitations(
      { ...testConfig.mail, apiKey: 'SG.test-key' },
      'https://front.example.com/invitations/accept',
    );
    await mail.send({
      email: 'member@example.com',
      token: 'opaque-token',
      workspaceName: 'Equipe de testes',
      expiresAt: new Date('2026-10-04T12:00:00Z'),
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('/accept#token=opaque-token'),
        trackingSettings: {
          clickTracking: { enable: false, enableText: false },
          openTracking: { enable: false },
        },
      }),
    );
  });
  it('rejects unrecognized sort fields and normalizes human names without changing meaning', () => {
    expect(() =>
      listQuery(
        { page: 1, size: 20, sort: 'passwordHash,asc' },
        ['name'],
        'name',
      ),
    ).toThrow('Ordenação inválida');
    expect(() =>
      listQuery(
        { page: 1, size: 20, sort: 'name,asc,extra' },
        ['name'],
        'name',
      ),
    ).toThrow();
    expect(normalizeName('  Ｓmoke  ')).toBe('smoke');
  });
});
