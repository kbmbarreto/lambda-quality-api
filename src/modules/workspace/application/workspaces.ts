import { randomUUID } from 'node:crypto';
import { pageResult } from '../../../shared/application/records.js';
import type { ListInput } from '../../../shared/application/records.js';
import { ApplicationError } from '../../../shared/domain/errors.js';
import {
  WorkspaceAccess,
  conflict,
  forbidden,
  listQuery,
  notFound,
} from './access.js';
import { MEMBER_PERMISSIONS, PERMISSIONS } from '../domain/models.js';
import type { Actor, Workspace, Member } from '../domain/models.js';
import type { WorkspaceTransaction } from './ports.js';
export const WORKSPACES = Symbol('Workspaces');
export class Workspaces {
  constructor(private readonly access: WorkspaceAccess) {}
  async create(actor: Actor, input: { name: string; slug: string }) {
    const user = (await this.access.directory.getUsers([actor.userId]))[0];
    if (!user || user.status !== 'ACTIVE') throw forbidden();
    return this.access.store.transaction(null, async (tx) => {
      const now = new Date();
      const workspace = await tx.workspaces.create({
        id: randomUUID(),
        name: input.name.trim(),
        slug: input.slug.trim().toLowerCase(),
        status: 'ACTIVE',
        ownerMemberId: null,
        createdAt: now,
        updatedAt: now,
      });
      const member = await tx.members.create({
        id: randomUUID(),
        workspaceId: workspace.id,
        userId: actor.userId,
        status: 'ACTIVE',
        joinedAt: now,
      });
      for (const [name, codes] of [
        ['Administrator', [...PERMISSIONS]],
        ['Member', MEMBER_PERMISSIONS],
      ] as const) {
        const role = await tx.roles.create({
          id: randomUUID(),
          workspaceId: workspace.id,
          name,
          normalizedName: name.toLowerCase(),
          description: null,
          systemRole: true,
          createdAt: now,
        });
        for (const permissionCode of codes)
          await tx.rolePermissions.create({
            id: randomUUID(),
            workspaceId: workspace.id,
            roleId: role.id,
            permissionCode,
          });
        if (name === 'Administrator')
          await tx.memberRoles.create({
            id: randomUUID(),
            workspaceId: workspace.id,
            memberId: member.id,
            roleId: role.id,
          });
      }
      await tx.workspaces.update(
        { id: workspace.id },
        { ownerMemberId: member.id },
      );
      await this.access.audit(
        tx,
        actor,
        workspace.id,
        'workspace.created',
        'Workspace',
        workspace.id,
      );
      return {
        ...workspace,
        ownerMemberId: member.id,
        memberId: member.id,
        isOwner: true,
        permissions: [...PERMISSIONS],
      };
    });
  }
  async list(actor: Actor, input: ListInput) {
    const query = listQuery<Workspace>(
      input,
      ['name', 'createdAt', 'slug'],
      'name',
    );
    let rows = await this.access.store.visibleWorkspaces(actor.userId);
    if (input.q)
      rows = rows.filter((row) =>
        `${row.name} ${row.slug}`
          .toLowerCase()
          .includes(input.q!.toLowerCase()),
      );
    const field = query.order!.field;
    const factor = query.order!.direction === 'asc' ? 1 : -1;
    rows.sort(
      (a, b) =>
        (a[field] instanceof Date && b[field] instanceof Date
          ? (a[field] as Date).getTime() - (b[field] as Date).getTime()
          : String(a[field]).localeCompare(String(b[field]))) * factor ||
        a.id.localeCompare(b.id),
    );
    const visible = [];
    for (const row of rows) {
      try {
        visible.push(await this.get(actor, row.id));
      } catch (error) {
        if (
          !(error instanceof ApplicationError) ||
          ![403, 404].includes(error.status)
        )
          throw error;
      }
    }
    return pageResult(
      visible.slice(query.skip, query.skip! + input.size),
      input,
      visible.length,
    );
  }
  get(actor: Actor, id: string) {
    return this.access.run(id, actor, 'workspace.read', async (_tx, ctx) => ({
      ...ctx.workspace,
      memberId: ctx.member.id,
      isOwner: ctx.isOwner,
      permissions: ctx.permissions,
    }));
  }
  update(actor: Actor, id: string, input: { name?: string; slug?: string }) {
    return this.access.run(id, actor, 'workspace.update', async (tx) => {
      await tx.workspaces.update(
        { id },
        {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.slug !== undefined
            ? { slug: input.slug.toLowerCase() }
            : {}),
          updatedAt: new Date(),
        },
      );
      await this.access.audit(
        tx,
        actor,
        id,
        'workspace.updated',
        'Workspace',
        id,
      );
      return tx.workspaces.find({ id });
    });
  }
  transfer(actor: Actor, id: string, memberId: string) {
    return this.access.run(id, actor, 'workspace.update', async (tx, ctx) => {
      if (!ctx.isOwner) throw forbidden();
      const target = await tx.members.find({ id: memberId, status: 'ACTIVE' });
      if (!target) throw notFound();
      const user = (await this.access.directory.getUsers([target.userId]))[0];
      if (!user || user.status !== 'ACTIVE')
        conflict('WORKSPACE_OWNER_INACTIVE', 'O novo Owner deve estar ativo.');
      await tx.workspaces.update(
        { id },
        { ownerMemberId: memberId, updatedAt: new Date() },
      );
      await this.access.audit(
        tx,
        actor,
        id,
        'workspace.ownership_transferred',
        'Workspace',
        id,
      );
      return tx.workspaces.find({ id });
    });
  }
  private async projectMember(
    tx: WorkspaceTransaction,
    member: Member,
    ownerId: string | null,
  ) {
    const user = (await this.access.directory.getUsers([member.userId]))[0];
    if (!user) throw notFound();
    const direct = await tx.memberRoles.list({
      where: { memberId: member.id },
    });
    const participation = await tx.groupMembers.list({
      where: { memberId: member.id },
    });
    const inherited = await tx.groupRoles.list({
      in: { field: 'groupId', values: participation.map((g) => g.groupId) },
    });
    const roles = await tx.roles.list({
      in: {
        field: 'id',
        values: [...new Set([...direct, ...inherited].map((r) => r.roleId))],
      },
    });
    const groups = await tx.groups.list({
      in: { field: 'id', values: participation.map((g) => g.groupId) },
    });
    return {
      ...member,
      user,
      isOwner: ownerId === member.id,
      roles: [
        ...direct.map((r) => ({
          id: r.roleId,
          name: roles.find((role) => role.id === r.roleId)!.name,
          source: 'DIRECT' as const,
          groupId: null,
        })),
        ...inherited.map((r) => ({
          id: r.roleId,
          name: roles.find((role) => role.id === r.roleId)!.name,
          source: 'GROUP' as const,
          groupId: r.groupId,
        })),
      ],
      groups: groups.map((g) => ({ id: g.id, name: g.name })),
    };
  }
  members(actor: Actor, id: string, input: ListInput) {
    return this.access.run(id, actor, 'workspace.read', async (tx, ctx) => {
      const query = listQuery<Member>(
        input,
        ['joinedAt', 'status'],
        'joinedAt',
      );
      query.where = {
        ...(input.status ? { status: input.status as Member['status'] } : {}),
      };
      let candidates: string[] | undefined;
      if (input.roleId) {
        if (!(await tx.roles.find({ id: input.roleId }))) throw notFound();
        const direct = await tx.memberRoles.list({
          where: { roleId: input.roleId },
        });
        const groups = await tx.groupRoles.list({
          where: { roleId: input.roleId },
        });
        const inherited = await tx.groupMembers.list({
          in: { field: 'groupId', values: groups.map((g) => g.groupId) },
        });
        candidates = [
          ...new Set([...direct, ...inherited].map((r) => r.memberId)),
        ];
      }
      if (input.groupId) {
        if (!(await tx.groups.find({ id: input.groupId }))) throw notFound();
        const ids = (
          await tx.groupMembers.list({ where: { groupId: input.groupId } })
        ).map((r) => r.memberId);
        candidates = candidates
          ? candidates.filter((candidate) => ids.includes(candidate))
          : ids;
      }
      if (input.q) {
        const members = await tx.members.list({
          where: query.where,
          ...(candidates
            ? { in: { field: 'id' as const, values: candidates } }
            : {}),
        });
        const users = await this.access.directory.getUsers(
          members.map((m) => m.userId),
        );
        const matching = users
          .filter((u) =>
            `${u.displayName} ${u.email}`
              .toLowerCase()
              .includes(input.q!.toLowerCase()),
          )
          .map((u) => u.id);
        candidates = members
          .filter((m) => matching.includes(m.userId))
          .map((m) => m.id);
      }
      if (candidates) query.in = { field: 'id', values: candidates };
      const total = await tx.members.count(query);
      const members = await tx.members.list(query);
      const rows = [];
      for (const member of members)
        rows.push(
          await this.projectMember(tx, member, ctx.workspace.ownerMemberId),
        );
      return pageResult(rows, input, total);
    });
  }
  member(actor: Actor, id: string, memberId: string) {
    return this.access.run(id, actor, 'workspace.read', async (tx, ctx) => {
      const member = await tx.members.find({ id: memberId });
      if (!member) throw notFound();
      return this.projectMember(tx, member, ctx.workspace.ownerMemberId);
    });
  }
  changeMember(
    actor: Actor,
    id: string,
    memberId: string,
    status: Member['status'],
  ) {
    return this.access.run(
      id,
      actor,
      'workspace.manage_members',
      async (tx, ctx) => {
        const member = await tx.members.find({ id: memberId });
        if (!member) throw notFound();
        if (ctx.workspace.ownerMemberId === memberId)
          conflict(
            'WORKSPACE_OWNER_PROTECTED',
            'Transfira o Workspace antes de suspender ou remover o Owner.',
          );
        if (member.status === 'REMOVED' && status !== 'REMOVED')
          conflict(
            'WORKSPACE_MEMBER_REMOVED',
            'Envie um novo convite para o membro removido.',
          );
        await tx.members.update({ id: memberId }, { status });
        if (status === 'REMOVED') {
          await tx.memberRoles.remove({ memberId });
          await tx.groupMembers.remove({ memberId });
          await tx.projectMembers.remove({ workspaceMemberId: memberId });
        }
        await this.access.audit(
          tx,
          actor,
          id,
          'workspace.member_status_changed',
          'WorkspaceMember',
          memberId,
        );
        return this.projectMember(
          tx,
          { ...member, status },
          ctx.workspace.ownerMemberId,
        );
      },
    );
  }
}
