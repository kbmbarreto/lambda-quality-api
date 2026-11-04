import { randomUUID } from 'node:crypto';
import { ApplicationError } from '../../../shared/domain/errors.js';
import type {
  RecordQuery,
  ListInput,
} from '../../../shared/application/records.js';
import type { IdentityDirectory } from '../../identity/application/directory.js';
import type { WorkspaceStore, WorkspaceTransaction } from './ports.js';
import { PERMISSIONS } from '../domain/models.js';
import type {
  Actor,
  AccessContext,
  PermissionCode,
  Member,
} from '../domain/models.js';
export const WORKSPACE_ACCESS = Symbol('WorkspaceAccess');
export const notFound = () =>
  new ApplicationError(404, 'RESOURCE_NOT_FOUND', 'Recurso não encontrado.');
export const forbidden = () =>
  new ApplicationError(
    403,
    'AUTH_FORBIDDEN',
    'Você não possui permissão para esta operação.',
  );
export function conflict(code: string, message: string): never {
  throw new ApplicationError(409, code, message);
}
export function listQuery<T>(
  input: ListInput,
  fields: string[],
  fallback: string,
): RecordQuery<T> {
  const [field, direction, extra] = (input.sort || `${fallback},asc`).split(
    ',',
  );
  if (!fields.includes(field) || !['asc', 'desc'].includes(direction) || extra)
    throw new ApplicationError(
      400,
      'VALIDATION_ERROR',
      'Ordenação inválida para esta listagem.',
    );
  return {
    order: { field: field as keyof T, direction: direction as 'asc' | 'desc' },
    skip: (input.page - 1) * input.size,
    take: input.size,
  };
}
export class WorkspaceAccess {
  constructor(
    readonly store: WorkspaceStore,
    readonly directory: IdentityDirectory,
  ) {}
  async permissions(
    tx: WorkspaceTransaction,
    member: Member,
  ): Promise<PermissionCode[]> {
    const direct = await tx.memberRoles.list({
      where: { memberId: member.id },
    });
    const groups = await tx.groupMembers.list({
      where: { memberId: member.id },
    });
    const inherited = await tx.groupRoles.list({
      in: { field: 'groupId', values: groups.map((g) => g.groupId) },
    });
    const roleIds = [
      ...new Set([...direct, ...inherited].map((r) => r.roleId)),
    ];
    const permissions = await tx.rolePermissions.list({
      in: { field: 'roleId', values: roleIds },
    });
    return [...new Set(permissions.map((r) => r.permissionCode))]
      .filter((p): p is PermissionCode =>
        PERMISSIONS.includes(p as PermissionCode),
      )
      .sort();
  }
  async resolve(
    tx: WorkspaceTransaction,
    workspaceId: string,
    actor: Actor,
  ): Promise<AccessContext> {
    const workspace = await tx.workspaces.find({ id: workspaceId });
    const member = await tx.members.find({
      workspaceId,
      userId: actor.userId,
      status: 'ACTIVE',
    });
    if (!workspace || workspace.status !== 'ACTIVE' || !member)
      throw notFound();
    const isOwner = workspace.ownerMemberId === member.id;
    return {
      workspace,
      member,
      isOwner,
      permissions: isOwner
        ? [...PERMISSIONS]
        : await this.permissions(tx, member),
    };
  }
  async run<T>(
    workspaceId: string,
    actor: Actor,
    permission: PermissionCode,
    work: (tx: WorkspaceTransaction, access: AccessContext) => Promise<T>,
  ): Promise<T> {
    return this.store.transaction(workspaceId, async (tx) => {
      const access = await this.resolve(tx, workspaceId, actor);
      if (!access.permissions.includes(permission)) throw forbidden();
      return work(tx, access);
    });
  }
  async audit(
    tx: WorkspaceTransaction,
    actor: Actor,
    workspaceId: string,
    action: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    await tx.audit({
      id: randomUUID(),
      workspaceId,
      actorUserId: actor.userId,
      action,
      entityType,
      entityId,
      occurredAt: new Date(),
      correlationId: actor.requestId,
    });
  }
  ensureGrant(access: AccessContext, codes: string[]): void {
    if (codes.some((code) => !PERMISSIONS.includes(code as PermissionCode)))
      throw new ApplicationError(
        400,
        'VALIDATION_ERROR',
        'Permission desconhecida.',
      );
    if (
      codes.some((code) => !access.permissions.includes(code as PermissionCode))
    )
      throw forbidden();
  }
}
