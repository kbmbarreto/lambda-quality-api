import { randomUUID } from 'node:crypto';
import { ApplicationError } from '../../../shared/domain/errors.js';
import { pageResult } from '../../../shared/application/records.js';
import type { ListInput } from '../../../shared/application/records.js';
import {
  listQuery,
  notFound,
  conflict,
} from '../../workspace/application/access.js';
import type { Actor } from '../../workspace/domain/models.js';
import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import { Projects } from '../../project/application/projects.js';
import type { VaultCipher, VaultEntry, VaultSecret } from '../domain/models.js';
export const TEST_VAULT = Symbol('TestVault');
export interface CreateVaultInput extends VaultSecret {
  name: string;
  environmentId?: string | null;
}
export interface UpdateVaultInput {
  version: number;
  name?: string;
  environmentId?: string | null;
  secret?: VaultSecret;
}
export class TestVault {
  constructor(
    private readonly projects: Projects,
    private readonly cipher: VaultCipher,
  ) {}
  view(row: VaultEntry) {
    const { encryptedPayload: _payload, keyId: _key, ...metadata } = row;
    return metadata;
  }
  private async find(
    tx: WorkspaceTransaction,
    projectId: string,
    id: string,
    version?: number,
  ) {
    const row = await tx.vaultEntries.find({ projectId, id, deletedAt: null });
    if (!row) throw notFound();
    if (version !== undefined && row.version !== version)
      conflict(
        'TEST_VAULT_VERSION_CONFLICT',
        'O registro do cofre foi alterado. Atualize antes de salvar.',
      );
    return row;
  }
  private async environment(
    tx: WorkspaceTransaction,
    projectId: string,
    id: string | null,
  ) {
    if (!id) return;
    const env = await tx.environments.find({ id, projectId, deletedAt: null });
    if (!env) throw notFound();
    if (!env.active || env.category === 'PRODUCTION')
      throw new ApplicationError(
        400,
        'TEST_VAULT_ENVIRONMENT_INVALID',
        'Selecione um ambiente ativo não produtivo.',
      );
  }
  list(
    actor: Actor,
    ws: string,
    projectId: string,
    input: ListInput & { environmentId?: string },
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testvault.read',
      false,
      async (tx) => {
        const query = listQuery<VaultEntry>(
          input,
          ['name', 'createdAt', 'updatedAt'],
          'name',
        );
        query.where = { projectId, deletedAt: null };
        if (input.environmentId) {
          await this.environment(tx, projectId, input.environmentId);
          query.where.environmentId = input.environmentId;
        }
        if (input.q) query.search = { fields: ['name'], value: input.q };
        return pageResult(
          (await tx.vaultEntries.list(query)).map((row) => this.view(row)),
          input,
          await tx.vaultEntries.count(query),
        );
      },
    );
  }
  create(actor: Actor, ws: string, projectId: string, input: CreateVaultInput) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testvault.manage',
      true,
      async (tx) => {
        await this.environment(tx, projectId, input.environmentId ?? null);
        const id = randomUUID(),
          now = new Date();
        const { username, password, url, notes } = input;
        const row = await tx.vaultEntries.create({
          id,
          workspaceId: ws,
          projectId,
          environmentId: input.environmentId ?? null,
          name: input.name,
          ...this.cipher.encrypt(
            { username, password, url, notes },
            { workspaceId: ws, projectId, id },
          ),
          version: 1,
          createdBy: actor.userId,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });
        await this.projects.access.audit(
          tx,
          actor,
          ws,
          'testvault.created',
          'TestVaultEntry',
          id,
        );
        return this.view(row);
      },
    );
  }
  update(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    input: UpdateVaultInput,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testvault.manage',
      true,
      async (tx) => {
        const row = await this.find(tx, projectId, id, input.version);
        if (
          input.name === undefined &&
          input.environmentId === undefined &&
          input.secret === undefined
        )
          throw new ApplicationError(
            400,
            'VALIDATION_ERROR',
            'Informe ao menos um campo para alterar.',
          );
        if (input.environmentId !== undefined)
          await this.environment(tx, projectId, input.environmentId);
        const encrypted = input.secret
          ? this.cipher.encrypt(input.secret, row)
          : {};
        await tx.vaultEntries.update(
          { id, projectId },
          {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.environmentId !== undefined
              ? { environmentId: input.environmentId }
              : {}),
            ...encrypted,
            version: row.version + 1,
            updatedAt: new Date(),
          },
        );
        await this.projects.access.audit(
          tx,
          actor,
          ws,
          'testvault.updated',
          'TestVaultEntry',
          id,
        );
        return this.view(await this.find(tx, projectId, id));
      },
    );
  }
  reveal(actor: Actor, ws: string, projectId: string, id: string) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testvault.reveal',
      false,
      async (tx) => {
        const row = await this.find(tx, projectId, id);
        const secret = this.cipher.decrypt(row);
        await this.projects.access.audit(
          tx,
          actor,
          ws,
          'testvault.revealed',
          'TestVaultEntry',
          id,
        );
        return { id, version: row.version, ...secret };
      },
    );
  }
  remove(
    actor: Actor,
    ws: string,
    projectId: string,
    id: string,
    version: number,
  ) {
    return this.projects.run(
      actor,
      ws,
      projectId,
      'testvault.manage',
      true,
      async (tx) => {
        const row = await this.find(tx, projectId, id, version);
        await tx.vaultEntries.update(
          { id, projectId },
          {
            deletedAt: new Date(),
            updatedAt: new Date(),
            version: row.version + 1,
          },
        );
        await this.projects.access.audit(
          tx,
          actor,
          ws,
          'testvault.deleted',
          'TestVaultEntry',
          id,
        );
      },
    );
  }
}
