import { randomUUID } from 'node:crypto';
import { pageResult } from '../../../shared/application/records.js';
import type { ListInput } from '../../../shared/application/records.js';
import type { Actor, Role, Group, AccessContext } from '../domain/models.js';
import { normalizeName, PERMISSIONS } from '../domain/models.js';
import type { WorkspaceTransaction } from './ports.js';
import { WorkspaceAccess, conflict, listQuery, notFound } from './access.js';
export const WORKSPACE_ROLES = Symbol('WorkspaceRoles');
export interface RoleInput {
  name: string;
  description?: string | null;
  permissionCodes: string[];
}
export interface GroupInput {
  name: string;
  description?: string | null;
}
export class RolesGroups {
  constructor(private readonly access: WorkspaceAccess) {}
  permissions() {
    return PERMISSIONS.map((code) => ({
      code,
      description: {
        'testvault.read': 'Consultar metadados do cofre de testes',
        'testvault.manage': 'Gerenciar dados criptografados do cofre de testes',
        'testvault.reveal': 'Revelar credenciais do cofre de testes',
        'workspace.read': 'Consultar Workspace, membros, roles e grupos.',
        'workspace.update': 'Alterar dados do Workspace.',
        'workspace.manage_members': 'Administrar membros e convites.',
        'workspace.manage_roles': 'Administrar roles e concessões diretas.',
        'workspace.manage_groups': 'Administrar grupos e concessões coletivas.',
        'field.read': 'Consultar campos personalizados.',
        'field.manage': 'Administrar campos personalizados.',
        'tag.read': 'Consultar tags.',
        'tag.manage': 'Administrar tags.',
        'attachment.read': 'Consultar e baixar anexos.',
        'attachment.upload': 'Enviar anexos.',
        'attachment.delete': 'Excluir anexos.',
        'project.read': 'Consultar projetos visíveis.',
        'project.create': 'Criar projetos.',
        'project.update': 'Alterar projetos visíveis.',
        'project.archive': 'Arquivar projetos visíveis.',
        'project.manage_members': 'Administrar participantes do projeto.',
        'project.manage_all':
          'Acessar todos os projetos do Workspace sem vínculo local.',
        'milestone.manage': 'Administrar marcos de projetos visíveis.',
        'governance.read': 'Consultar governança.',
        'governance.assess': 'Avaliar controles e evidências.',
        'governance.manage': 'Administrar frameworks, metas e ações.',
        'defect.read': 'Consultar defeitos e seus vínculos.',
        'defect.manage': 'Criar e alterar defeitos, estados e vínculos.',
        'testrun.read': 'Consultar planos, execuções e resultados.',
        'testrun.execute': 'Iniciar, executar e concluir execuções.',
        'testrun.manage': 'Administrar planos, criar e abortar execuções.',
        'testcase.read': 'Consultar suítes, casos e passos.',
        'testcase.create': 'Criar suítes e casos de teste.',
        'testcase.update': 'Alterar suítes, casos, passos e vínculos.',
        'testcase.archive': 'Arquivar suítes e arquivar/restaurar casos.',
        'environment.manage': 'Administrar ambientes de projetos visíveis.',
      }[code],
    }));
  }
  private async projectRole(tx: WorkspaceTransaction, role: Role) {
    const permissions = await tx.rolePermissions.list({
      where: { roleId: role.id },
    });
    return {
      id: role.id,
      workspaceId: role.workspaceId,
      name: role.name,
      description: role.description,
      systemRole: role.systemRole,
      createdAt: role.createdAt,
      permissionCodes: permissions.map((p) => p.permissionCode).sort(),
    };
  }
  private async roleCodes(tx: WorkspaceTransaction, roleId: string) {
    return (await tx.rolePermissions.list({ where: { roleId } })).map(
      (p) => p.permissionCode,
    );
  }
  private async projectGroup(tx: WorkspaceTransaction, group: Group) {
    const rows = await tx.groupRoles.list({ where: { groupId: group.id } });
    return {
      id: group.id,
      workspaceId: group.workspaceId,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt,
      roleIds: rows.map((r) => r.roleId),
      memberCount: await tx.groupMembers.count({
        where: { groupId: group.id },
      }),
    };
  }
  listRoles(actor: Actor, ws: string, input: ListInput) {
    return this.access.run(ws, actor, 'workspace.read', async (tx) => {
      const query = listQuery<Role>(input, ['name', 'createdAt'], 'name');
      if (input.q) query.search = { fields: ['name'], value: input.q };
      const roles = await tx.roles.list(query);
      const rows = [];
      for (const role of roles) rows.push(await this.projectRole(tx, role));
      return pageResult(rows, input, await tx.roles.count(query));
    });
  }
  getRole(actor: Actor, ws: string, id: string) {
    return this.access.run(ws, actor, 'workspace.read', async (tx) => {
      const role = await tx.roles.find({ id });
      if (!role) throw notFound();
      return this.projectRole(tx, role);
    });
  }
  createRole(actor: Actor, ws: string, input: RoleInput) {
    return this.access.run(
      ws,
      actor,
      'workspace.manage_roles',
      async (tx, ctx) => {
        this.access.ensureGrant(ctx, input.permissionCodes);
        if (
          ['owner', 'administrator', 'member'].includes(
            normalizeName(input.name),
          )
        )
          conflict(
            'WORKSPACE_SYSTEM_ROLE_PROTECTED',
            'Este nome é reservado para roles de sistema.',
          );
        const role = await tx.roles.create({
          id: randomUUID(),
          workspaceId: ws,
          name: input.name.trim(),
          normalizedName: normalizeName(input.name),
          description: input.description ?? null,
          systemRole: false,
          createdAt: new Date(),
        });
        for (const permissionCode of [...new Set(input.permissionCodes)])
          await tx.rolePermissions.create({
            id: randomUUID(),
            workspaceId: ws,
            roleId: role.id,
            permissionCode,
          });
        await this.access.audit(
          tx,
          actor,
          ws,
          'workspace.role_created',
          'Role',
          role.id,
        );
        return this.projectRole(tx, role);
      },
    );
  }
  updateRole(actor: Actor, ws: string, id: string, input: Partial<RoleInput>) {
    return this.access.run(
      ws,
      actor,
      'workspace.manage_roles',
      async (tx, ctx) => {
        const role = await tx.roles.find({ id });
        if (!role) throw notFound();
        if (role.systemRole)
          conflict(
            'WORKSPACE_SYSTEM_ROLE_PROTECTED',
            'Roles de sistema não podem ser alteradas.',
          );
        this.access.ensureGrant(ctx, await this.roleCodes(tx, id));
        if (
          input.name &&
          ['owner', 'administrator', 'member'].includes(
            normalizeName(input.name),
          )
        )
          conflict(
            'WORKSPACE_SYSTEM_ROLE_PROTECTED',
            'Este nome é reservado para roles de sistema.',
          );
        if (input.permissionCodes) {
          this.access.ensureGrant(ctx, input.permissionCodes);
          await tx.rolePermissions.remove({ roleId: id });
          for (const permissionCode of [...new Set(input.permissionCodes)])
            await tx.rolePermissions.create({
              id: randomUUID(),
              workspaceId: ws,
              roleId: id,
              permissionCode,
            });
        }
        await tx.roles.update(
          { id },
          {
            ...(input.name
              ? {
                  name: input.name.trim(),
                  normalizedName: normalizeName(input.name),
                }
              : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
          },
        );
        await this.access.audit(
          tx,
          actor,
          ws,
          'workspace.role_updated',
          'Role',
          id,
        );
        return this.projectRole(tx, (await tx.roles.find({ id }))!);
      },
    );
  }
  removeRole(actor: Actor, ws: string, id: string) {
    return this.access.run(
      ws,
      actor,
      'workspace.manage_roles',
      async (tx, ctx) => {
        const role = await tx.roles.find({ id });
        if (!role) throw notFound();
        if (role.systemRole)
          conflict(
            'WORKSPACE_SYSTEM_ROLE_PROTECTED',
            'Roles de sistema não podem ser removidas.',
          );
        this.access.ensureGrant(ctx, await this.roleCodes(tx, id));
        if (
          (await tx.memberRoles.count({ where: { roleId: id } })) ||
          (await tx.groupRoles.count({ where: { roleId: id } }))
        )
          conflict(
            'WORKSPACE_ROLE_IN_USE',
            'Revogue os vínculos antes de remover a role.',
          );
        await tx.rolePermissions.remove({ roleId: id });
        await tx.roles.remove({ id });
        await this.access.audit(
          tx,
          actor,
          ws,
          'workspace.role_removed',
          'Role',
          id,
        );
      },
    );
  }
  memberRole(
    actor: Actor,
    ws: string,
    memberId: string,
    roleId: string,
    assign: boolean,
  ) {
    return this.access.run(
      ws,
      actor,
      'workspace.manage_roles',
      async (tx, ctx) => {
        const member = await tx.members.find({ id: memberId });
        const role = await tx.roles.find({ id: roleId });
        if (!member || member.status === 'REMOVED' || !role) throw notFound();
        this.access.ensureGrant(ctx, await this.roleCodes(tx, roleId));
        const where = { memberId, roleId };
        if (assign && !(await tx.memberRoles.find(where)))
          await tx.memberRoles.create({
            id: randomUUID(),
            workspaceId: ws,
            ...where,
          });
        if (!assign) await tx.memberRoles.remove(where);
        await this.access.audit(
          tx,
          actor,
          ws,
          assign
            ? 'workspace.member_role_assigned'
            : 'workspace.member_role_revoked',
          'WorkspaceMember',
          memberId,
        );
      },
    );
  }
  listGroups(actor: Actor, ws: string, input: ListInput) {
    return this.access.run(ws, actor, 'workspace.read', async (tx) => {
      const query = listQuery<Group>(input, ['name', 'createdAt'], 'name');
      if (input.q) query.search = { fields: ['name'], value: input.q };
      const groups = await tx.groups.list(query);
      const rows = [];
      for (const group of groups) rows.push(await this.projectGroup(tx, group));
      return pageResult(rows, input, await tx.groups.count(query));
    });
  }
  getGroup(actor: Actor, ws: string, id: string) {
    return this.access.run(ws, actor, 'workspace.read', async (tx) => {
      const group = await tx.groups.find({ id });
      if (!group) throw notFound();
      return this.projectGroup(tx, group);
    });
  }
  createGroup(actor: Actor, ws: string, input: GroupInput) {
    return this.access.run(ws, actor, 'workspace.manage_groups', async (tx) => {
      const group = await tx.groups.create({
        id: randomUUID(),
        workspaceId: ws,
        name: input.name.trim(),
        normalizedName: normalizeName(input.name),
        description: input.description ?? null,
        createdAt: new Date(),
      });
      await this.access.audit(
        tx,
        actor,
        ws,
        'workspace.group_created',
        'Group',
        group.id,
      );
      return this.projectGroup(tx, group);
    });
  }
  private async ensureGroupGrant(
    tx: WorkspaceTransaction,
    ctx: AccessContext,
    groupId: string,
  ): Promise<void> {
    const roles = await tx.groupRoles.list({ where: { groupId } });
    for (const role of roles)
      this.access.ensureGrant(ctx, await this.roleCodes(tx, role.roleId));
  }
  updateGroup(
    actor: Actor,
    ws: string,
    id: string,
    input: Partial<GroupInput>,
  ) {
    return this.access.run(
      ws,
      actor,
      'workspace.manage_groups',
      async (tx, ctx) => {
        const group = await tx.groups.find({ id });
        if (!group) throw notFound();
        await this.ensureGroupGrant(tx, ctx, id);
        await tx.groups.update(
          { id },
          {
            ...(input.name
              ? {
                  name: input.name.trim(),
                  normalizedName: normalizeName(input.name),
                }
              : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
          },
        );
        await this.access.audit(
          tx,
          actor,
          ws,
          'workspace.group_updated',
          'Group',
          id,
        );
        return this.projectGroup(tx, (await tx.groups.find({ id }))!);
      },
    );
  }
  removeGroup(actor: Actor, ws: string, id: string) {
    return this.access.run(
      ws,
      actor,
      'workspace.manage_groups',
      async (tx, ctx) => {
        if (!(await tx.groups.find({ id }))) throw notFound();
        await this.ensureGroupGrant(tx, ctx, id);
        await tx.groupRoles.remove({ groupId: id });
        await tx.groupMembers.remove({ groupId: id });
        await tx.groups.remove({ id });
        await this.access.audit(
          tx,
          actor,
          ws,
          'workspace.group_removed',
          'Group',
          id,
        );
      },
    );
  }
  groupMembers(actor: Actor, ws: string, id: string, input: ListInput) {
    return this.access.run(ws, actor, 'workspace.read', async (tx) => {
      if (!(await tx.groups.find({ id }))) throw notFound();
      const query = listQuery<{ id: string; memberId: string }>(
        input,
        ['memberId'],
        'memberId',
      );
      const rows = await tx.groupMembers.list({
        ...query,
        where: { groupId: id },
      });
      return pageResult(
        rows.map((row) => ({ memberId: row.memberId })),
        input,
        await tx.groupMembers.count({ where: { groupId: id } }),
      );
    });
  }
  groupMember(
    actor: Actor,
    ws: string,
    groupId: string,
    memberId: string,
    assign: boolean,
  ) {
    return this.access.run(
      ws,
      actor,
      'workspace.manage_groups',
      async (tx, ctx) => {
        if (!(await tx.groups.find({ id: groupId }))) throw notFound();
        const member = await tx.members.find({ id: memberId });
        if (!member || member.status === 'REMOVED') throw notFound();
        await this.ensureGroupGrant(tx, ctx, groupId);
        const where = { groupId, memberId };
        if (assign && !(await tx.groupMembers.find(where)))
          await tx.groupMembers.create({
            id: randomUUID(),
            workspaceId: ws,
            ...where,
          });
        if (!assign) await tx.groupMembers.remove(where);
        await this.access.audit(
          tx,
          actor,
          ws,
          assign
            ? 'workspace.group_member_added'
            : 'workspace.group_member_removed',
          'Group',
          groupId,
        );
      },
    );
  }
  groupRole(
    actor: Actor,
    ws: string,
    groupId: string,
    roleId: string,
    assign: boolean,
  ) {
    return this.access.run(
      ws,
      actor,
      'workspace.manage_groups',
      async (tx, ctx) => {
        if (
          !(await tx.groups.find({ id: groupId })) ||
          !(await tx.roles.find({ id: roleId }))
        )
          throw notFound();
        await this.ensureGroupGrant(tx, ctx, groupId);
        this.access.ensureGrant(ctx, await this.roleCodes(tx, roleId));
        const where = { groupId, roleId };
        if (assign && !(await tx.groupRoles.find(where)))
          await tx.groupRoles.create({
            id: randomUUID(),
            workspaceId: ws,
            ...where,
          });
        if (!assign) await tx.groupRoles.remove(where);
        await this.access.audit(
          tx,
          actor,
          ws,
          assign
            ? 'workspace.group_role_assigned'
            : 'workspace.group_role_revoked',
          'Group',
          groupId,
        );
      },
    );
  }
}
