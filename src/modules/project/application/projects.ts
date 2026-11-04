import { randomUUID } from 'node:crypto';
import { pageResult } from '../../../shared/application/records.js';
import type { ListInput } from '../../../shared/application/records.js';
import {
  WorkspaceAccess,
  forbidden,
  notFound,
  conflict,
  listQuery,
} from '../../workspace/application/access.js';
import type { WorkspaceTransaction } from '../../workspace/application/ports.js';
import type {
  Actor,
  AccessContext,
  PermissionCode,
} from '../../workspace/domain/models.js';
import { PROJECT_CAPABILITIES } from '../domain/models.js';
import type { Project, ProjectRole } from '../domain/models.js';
export const PROJECTS = Symbol('Projects');
export interface ProjectContext {
  project: Project;
  access: AccessContext;
  capabilities: PermissionCode[];
  projectRole: ProjectRole | null;
}
export class Projects {
  constructor(readonly access: WorkspaceAccess) {}
  /** Public metric scope; the consumer must authorize each ID through resolve. */
  async activeIds(tx: WorkspaceTransaction): Promise<string[]> {
    return (await tx.projects.list({ where: { status: 'ACTIVE' } })).map(
      (row) => row.id,
    );
  }
  async resolve(
    tx: WorkspaceTransaction,
    actor: Actor,
    ws: string,
    id: string,
  ): Promise<ProjectContext> {
    const access = await this.access.resolve(tx, ws, actor);
    const project = await tx.projects.find({ id });
    const member = await tx.projectMembers.find({
      projectId: id,
      workspaceMemberId: access.member.id,
    });
    const all = access.permissions.includes('project.manage_all');
    if (!project || (!all && !member)) throw notFound();
    const allowed = all
      ? PROJECT_CAPABILITIES.MANAGER
      : PROJECT_CAPABILITIES[member!.projectRole];
    return {
      project,
      access,
      projectRole: member?.projectRole || null,
      capabilities: allowed.filter((code) => access.permissions.includes(code)),
    };
  }
  /** Public batched scope, using the same current membership and local capabilities as resolve. */
  async visibleContexts(
    tx: WorkspaceTransaction,
    access: AccessContext,
  ): Promise<ProjectContext[]> {
    const projects = await tx.projects.list();
    const members = await tx.projectMembers.list({
      where: { workspaceMemberId: access.member.id },
    });
    const byProject = new Map(
      members.map((member) => [member.projectId, member]),
    );
    const all = access.permissions.includes('project.manage_all');
    return projects.flatMap((project) => {
      const member = byProject.get(project.id);
      if (!all && !member) return [];
      const allowed = all
        ? PROJECT_CAPABILITIES.MANAGER
        : PROJECT_CAPABILITIES[member!.projectRole];
      return [
        {
          project,
          access,
          projectRole: member?.projectRole || null,
          capabilities: allowed.filter((code) =>
            access.permissions.includes(code),
          ),
        },
      ];
    });
  }
  run<T>(
    actor: Actor,
    ws: string,
    id: string,
    permission: PermissionCode,
    write: boolean,
    work: (tx: WorkspaceTransaction, ctx: ProjectContext) => Promise<T>,
  ) {
    return this.access.store.transaction(ws, async (tx) => {
      const ctx = await this.resolve(tx, actor, ws, id);
      if (!ctx.capabilities.includes(permission)) throw forbidden();
      if (write && ctx.project.status === 'ARCHIVED')
        conflict(
          'PROJECT_ARCHIVED',
          'O projeto está arquivado e não permite alterações.',
        );
      return work(tx, ctx);
    });
  }
  view(ctx: ProjectContext) {
    return {
      ...ctx.project,
      projectRole: ctx.projectRole,
      permissions: ctx.capabilities,
    };
  }
  create(
    actor: Actor,
    ws: string,
    input: { key: string; name: string; description?: string | null },
  ) {
    return this.access.run(ws, actor, 'project.create', async (tx, access) => {
      const now = new Date();
      const project = await tx.projects.create({
        id: randomUUID(),
        workspaceId: ws,
        key: input.key.trim().toUpperCase(),
        name: input.name.trim(),
        description: input.description ?? null,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      });
      await tx.projectMembers.create({
        id: randomUUID(),
        workspaceId: ws,
        projectId: project.id,
        workspaceMemberId: access.member.id,
        projectRole: 'MANAGER',
        createdAt: now,
        updatedAt: now,
      });
      await this.access.audit(
        tx,
        actor,
        ws,
        'project.created',
        'Project',
        project.id,
      );
      return this.view(await this.resolve(tx, actor, ws, project.id));
    });
  }
  list(actor: Actor, ws: string, input: ListInput) {
    return this.access.store.transaction(ws, async (tx) => {
      const access = await this.access.resolve(tx, ws, actor);
      if (!access.permissions.includes('project.read')) throw forbidden();
      const query = listQuery<Project>(
        input,
        ['name', 'key', 'createdAt'],
        'name',
      );
      if (input.status !== 'ALL')
        query.where = {
          status: (input.status || 'ACTIVE') as Project['status'],
        };
      if (input.q) query.search = { fields: ['name', 'key'], value: input.q };
      if (!access.permissions.includes('project.manage_all')) {
        const memberships = await tx.projectMembers.list({
          where: { workspaceMemberId: access.member.id },
        });
        query.in = { field: 'id', values: memberships.map((m) => m.projectId) };
      }
      const total = await tx.projects.count(query);
      const rows = await tx.projects.list(query);
      const items = [];
      for (const row of rows)
        items.push(this.view(await this.resolve(tx, actor, ws, row.id)));
      return pageResult(items, input, total);
    });
  }
  get(actor: Actor, ws: string, id: string) {
    return this.run(actor, ws, id, 'project.read', false, async (_tx, ctx) =>
      this.view(ctx),
    );
  }
  update(
    actor: Actor,
    ws: string,
    id: string,
    input: { name?: string; description?: string | null },
  ) {
    return this.run(actor, ws, id, 'project.update', true, async (tx) => {
      await tx.projects.update({ id }, { ...input, updatedAt: new Date() });
      await this.access.audit(tx, actor, ws, 'project.updated', 'Project', id);
      return this.view(await this.resolve(tx, actor, ws, id));
    });
  }
  archive(actor: Actor, ws: string, id: string) {
    return this.run(
      actor,
      ws,
      id,
      'project.archive',
      false,
      async (tx, ctx) => {
        if (ctx.project.status !== 'ARCHIVED') {
          await tx.projects.update(
            { id },
            {
              status: 'ARCHIVED',
              archivedAt: new Date(),
              updatedAt: new Date(),
            },
          );
          await this.access.audit(
            tx,
            actor,
            ws,
            'project.archived',
            'Project',
            id,
          );
        }
        return this.view(await this.resolve(tx, actor, ws, id));
      },
    );
  }
  members(actor: Actor, ws: string, id: string, input: ListInput) {
    return this.run(actor, ws, id, 'project.read', false, async (tx) => {
      const query = listQuery<import('../domain/models.js').ProjectMember>(
        input,
        ['createdAt', 'projectRole'],
        'createdAt',
      );
      query.where = { projectId: id };
      const records = await tx.projectMembers.list(query);
      const rows = [];
      for (const member of records) {
        const workspaceMember = await tx.members.find({
          id: member.workspaceMemberId,
        });
        const user = (
          await this.access.directory.getUsers([workspaceMember!.userId])
        )[0];
        rows.push({
          ...member,
          workspaceMemberStatus: workspaceMember!.status,
          user,
        });
      }
      return pageResult(rows, input, await tx.projectMembers.count(query));
    });
  }
  putMember(
    actor: Actor,
    ws: string,
    id: string,
    workspaceMemberId: string,
    projectRole: ProjectRole,
  ) {
    return this.run(
      actor,
      ws,
      id,
      'project.manage_members',
      true,
      async (tx, ctx) => {
        if (
          PROJECT_CAPABILITIES[projectRole].some(
            (code) =>
              !code.startsWith('testvault.') &&
              !ctx.capabilities.includes(code),
          )
        )
          throw forbidden();
        const member = await tx.members.find({
          id: workspaceMemberId,
          status: 'ACTIVE',
        });
        if (!member) throw notFound();
        const user = (await this.access.directory.getUsers([member.userId]))[0];
        if (!user || user.status !== 'ACTIVE')
          conflict(
            'PROJECT_MEMBER_INACTIVE',
            'O participante deve estar ativo.',
          );
        const current = await tx.projectMembers.find({
          projectId: id,
          workspaceMemberId,
        });
        // Novos grants do cofre só contam quando ampliam o acesso efetivo do alvo.
        // Permite continuar atribuindo VIEWER a quem não recebeu grants do cofre.
        const target = await this.access.resolve(tx, ws, {
          ...actor,
          userId: member.userId,
        });
        const previous = target.permissions.includes('project.manage_all')
          ? PROJECT_CAPABILITIES.MANAGER
          : current
            ? PROJECT_CAPABILITIES[current.projectRole]
            : [];
        if (
          PROJECT_CAPABILITIES[projectRole].some(
            (code) =>
              code.startsWith('testvault.') &&
              target.permissions.includes(code) &&
              !previous.includes(code) &&
              !ctx.capabilities.includes(code),
          )
        )
          throw forbidden();
        if (current) {
          await tx.projectMembers.update(
            { id: current.id },
            { projectRole, updatedAt: new Date() },
          );
        } else
          await tx.projectMembers.create({
            id: randomUUID(),
            workspaceId: ws,
            projectId: id,
            workspaceMemberId,
            projectRole,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        await this.access.audit(
          tx,
          actor,
          ws,
          'project.member_assigned',
          'Project',
          id,
        );
        return tx.projectMembers.find({ projectId: id, workspaceMemberId });
      },
    );
  }
  removeMember(
    actor: Actor,
    ws: string,
    id: string,
    workspaceMemberId: string,
  ) {
    return this.run(
      actor,
      ws,
      id,
      'project.manage_members',
      true,
      async (tx) => {
        if (!(await tx.members.find({ id: workspaceMemberId })))
          throw notFound();
        await tx.projectMembers.remove({ projectId: id, workspaceMemberId });
        await this.access.audit(
          tx,
          actor,
          ws,
          'project.member_removed',
          'Project',
          id,
        );
      },
    );
  }
}
