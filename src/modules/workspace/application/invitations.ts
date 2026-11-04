import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { ApplicationError } from '../../../shared/domain/errors.js';
import { pageResult } from '../../../shared/application/records.js';
import type { ListInput } from '../../../shared/application/records.js';
import type { Actor, Invitation } from '../domain/models.js';
import {
  WorkspaceAccess,
  conflict,
  forbidden,
  listQuery,
  notFound,
} from './access.js';
import type { InvitationMail } from './ports.js';
export const INVITATIONS = Symbol('Invitations');
const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export class Invitations {
  private readonly key: Buffer;
  private timer?: ReturnType<typeof setInterval>;
  private processing = false;
  constructor(
    private readonly access: WorkspaceAccess,
    private readonly mail: InvitationMail,
    private readonly config: { secret: string; ttl: number; cooldown: number },
    private readonly now = () => new Date(),
  ) {
    this.key = createHash('sha256').update(config.secret).digest();
  }
  private seal(token: string): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    const bytes = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return [nonce, cipher.getAuthTag(), bytes]
      .map((value) => value.toString('base64url'))
      .join('.');
  }
  private unseal(payload: string): string {
    const [nonce, tag, bytes] = payload
      .split('.')
      .map((value) => Buffer.from(value, 'base64url'));
    const cipher = createDecipheriv('aes-256-gcm', this.key, nonce);
    cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(bytes), cipher.final()]).toString(
      'utf8',
    );
  }
  private project(invitation: Invitation) {
    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      email: invitation.email,
      status:
        invitation.status === 'PENDING' && invitation.expiresAt <= this.now()
          ? 'EXPIRED'
          : invitation.status,
      expiresAt: invitation.expiresAt,
      invitedBy: invitation.invitedBy,
      acceptedAt: invitation.acceptedAt,
      createdAt: invitation.createdAt,
      lastSentAt: invitation.lastSentAt,
      deliveryStatus: invitation.deliveryStatus,
    };
  }
  list(actor: Actor, ws: string, input: ListInput) {
    return this.access.run(
      ws,
      actor,
      'workspace.manage_members',
      async (tx) => {
        const query = listQuery<Invitation>(
          input,
          ['createdAt', 'email', 'expiresAt'],
          'createdAt',
        );
        if (input.q) query.search = { fields: ['email'], value: input.q };
        if (input.status)
          query.where = {
            status: (input.status === 'EXPIRED'
              ? 'PENDING'
              : input.status) as Invitation['status'],
          };
        if (['PENDING', 'EXPIRED'].includes(input.status || ''))
          query.compare = [
            {
              field: 'expiresAt',
              op: input.status === 'EXPIRED' ? 'lte' : 'gt',
              value: this.now(),
            },
          ];
        const rows = await tx.invitations.list(query);
        return pageResult(
          rows.map((row) => this.project(row)),
          input,
          await tx.invitations.count(query),
        );
      },
    );
  }
  get(actor: Actor, ws: string, id: string) {
    return this.access.run(
      ws,
      actor,
      'workspace.manage_members',
      async (tx) => {
        const invitation = await tx.invitations.find({ id });
        if (!invitation) throw notFound();
        return this.project(invitation);
      },
    );
  }
  async create(actor: Actor, ws: string, emailValue: string) {
    const email = emailValue.trim().toLowerCase();
    const id = await this.access.run(
      ws,
      actor,
      'workspace.manage_members',
      async (tx) => {
        const members = await tx.members.list();
        const users = await this.access.directory.getUsers(
          members.map((m) => m.userId),
        );
        const existing = users.find((u) => u.email === email);
        if (
          existing &&
          members.some(
            (m) => m.userId === existing.id && m.status !== 'REMOVED',
          )
        )
          conflict(
            'WORKSPACE_MEMBER_EXISTS',
            'O usuário já possui vínculo ativo ou suspenso neste Workspace.',
          );
        const prior = await tx.invitations.list({
          where: { email, status: 'PENDING' },
        });
        if (prior.some((i) => i.expiresAt > this.now()))
          conflict(
            'WORKSPACE_INVITATION_PENDING',
            'Já existe convite pendente. Utilize o reenvio.',
          );
        for (const invitation of prior)
          await tx.invitations.update(
            { id: invitation.id },
            { status: 'CANCELED', deliveryPayload: null },
          );
        const token = randomBytes(32).toString('base64url');
        const now = this.now();
        const invitation = await tx.invitations.create({
          id: randomUUID(),
          workspaceId: ws,
          email,
          tokenHash: tokenHash(token),
          status: 'PENDING',
          expiresAt: new Date(now.getTime() + this.config.ttl * 1000),
          invitedBy: actor.userId,
          acceptedBy: null,
          acceptedAt: null,
          createdAt: now,
          lastSentAt: now,
          deliveryStatus: 'PENDING',
          deliveryPayload: this.seal(token),
          deliveryAttempts: 0,
        });
        await this.access.audit(
          tx,
          actor,
          ws,
          'workspace.invitation_created',
          'Invitation',
          invitation.id,
        );
        return invitation.id;
      },
    );
    await this.deliver(ws, id);
    return this.access.run(ws, actor, 'workspace.manage_members', async (tx) =>
      this.project((await tx.invitations.find({ id }))!),
    );
  }
  async resend(actor: Actor, ws: string, id: string) {
    await this.access.run(ws, actor, 'workspace.manage_members', async (tx) => {
      const invitation = await tx.invitations.find({ id });
      if (!invitation) throw notFound();
      if (invitation.status !== 'PENDING')
        conflict(
          'WORKSPACE_INVITATION_CLOSED',
          'Este convite já foi aceito ou cancelado.',
        );
      const seconds = Math.ceil(
        (invitation.lastSentAt.getTime() +
          this.config.cooldown * 1000 -
          this.now().getTime()) /
          1000,
      );
      if (seconds > 0)
        throw new ApplicationError(
          429,
          'WORKSPACE_INVITATION_COOLDOWN',
          'Aguarde antes de reenviar o convite.',
          seconds,
        );
      const token = randomBytes(32).toString('base64url');
      const now = this.now();
      await tx.invitations.update(
        { id },
        {
          tokenHash: tokenHash(token),
          expiresAt: new Date(now.getTime() + this.config.ttl * 1000),
          lastSentAt: now,
          deliveryPayload: this.seal(token),
          deliveryStatus: 'PENDING',
          deliveryAttempts: 0,
        },
      );
      await this.access.audit(
        tx,
        actor,
        ws,
        'workspace.invitation_resent',
        'Invitation',
        id,
      );
    });
    await this.deliver(ws, id);
    return this.access.run(ws, actor, 'workspace.manage_members', async (tx) =>
      this.project((await tx.invitations.find({ id }))!),
    );
  }
  cancel(actor: Actor, ws: string, id: string) {
    return this.access.run(
      ws,
      actor,
      'workspace.manage_members',
      async (tx) => {
        const invitation = await tx.invitations.find({ id });
        if (!invitation) throw notFound();
        if (invitation.status === 'ACCEPTED')
          conflict(
            'WORKSPACE_INVITATION_CLOSED',
            'Convite já aceito; administre o vínculo do membro.',
          );
        await tx.invitations.update(
          { id },
          { status: 'CANCELED', deliveryPayload: null },
        );
        await this.access.audit(
          tx,
          actor,
          ws,
          'workspace.invitation_canceled',
          'Invitation',
          id,
        );
      },
    );
  }
  async accept(actor: Actor, token: string) {
    const hash = tokenHash(token);
    const lookup = await this.access.store.findInvitationByHash(hash);
    if (!lookup)
      throw new ApplicationError(
        400,
        'WORKSPACE_INVITATION_INVALID',
        'Convite inválido, expirado ou cancelado.',
      );
    const user = (await this.access.directory.getUsers([actor.userId]))[0];
    if (!user || user.status !== 'ACTIVE') throw forbidden();
    return this.access.store.transaction(lookup.workspaceId, async (tx) => {
      const workspace = await tx.workspaces.find({
        id: lookup.workspaceId,
        status: 'ACTIVE',
      });
      const invitation = await tx.invitations.find({
        id: lookup.id,
        tokenHash: hash,
      });
      if (
        !workspace ||
        !invitation ||
        invitation.email !== user.email ||
        !user.emailVerifiedAt
      )
        throw new ApplicationError(
          400,
          'WORKSPACE_INVITATION_INVALID',
          'Convite inválido, expirado ou cancelado.',
        );
      let member = await tx.members.find({ userId: actor.userId });
      if (
        invitation.status === 'ACCEPTED' &&
        invitation.acceptedBy === actor.userId &&
        member?.status === 'ACTIVE'
      )
        return member;
      if (invitation.status !== 'PENDING' || invitation.expiresAt <= this.now())
        throw new ApplicationError(
          400,
          'WORKSPACE_INVITATION_INVALID',
          'Convite inválido, expirado ou cancelado.',
        );
      if (member?.status === 'SUSPENDED')
        conflict(
          'WORKSPACE_MEMBER_SUSPENDED',
          'Solicite a reativação ao administrador.',
        );
      if (member?.status === 'ACTIVE')
        conflict(
          'WORKSPACE_MEMBER_EXISTS',
          'Você já participa deste Workspace.',
        );
      if (member) {
        await tx.memberRoles.remove({ memberId: member.id });
        await tx.groupMembers.remove({ memberId: member.id });
        await tx.members.update(
          { id: member.id },
          { status: 'ACTIVE', joinedAt: this.now() },
        );
        member = { ...member, status: 'ACTIVE', joinedAt: this.now() };
      } else
        member = await tx.members.create({
          id: randomUUID(),
          workspaceId: workspace.id,
          userId: actor.userId,
          status: 'ACTIVE',
          joinedAt: this.now(),
        });
      const role = await tx.roles.find({
        normalizedName: 'member',
        systemRole: true,
      });
      if (!role) throw new Error('Member system role missing.');
      await tx.memberRoles.create({
        id: randomUUID(),
        workspaceId: workspace.id,
        memberId: member.id,
        roleId: role.id,
      });
      await tx.invitations.update(
        { id: invitation.id },
        {
          status: 'ACCEPTED',
          acceptedBy: actor.userId,
          acceptedAt: this.now(),
          deliveryPayload: null,
        },
      );
      await this.access.audit(
        tx,
        actor,
        workspace.id,
        'workspace.invitation_accepted',
        'Invitation',
        invitation.id,
      );
      return member;
    });
  }
  async deliver(ws: string, id: string, automatic = false): Promise<void> {
    await this.access.store.transaction(ws, async (tx) => {
      const invitation = await tx.invitations.find({ id });
      const workspace = await tx.workspaces.find({ id: ws });
      if (!invitation?.deliveryPayload) return;
      if (
        !workspace ||
        workspace.status !== 'ACTIVE' ||
        invitation.status !== 'PENDING' ||
        invitation.expiresAt <= this.now() ||
        invitation.deliveryAttempts >= 5
      ) {
        await tx.invitations.update(
          { id },
          { deliveryPayload: null, deliveryStatus: 'FAILED' },
        );
        return;
      }
      if (
        automatic &&
        invitation.lastSentAt.getTime() +
          30000 * 2 ** invitation.deliveryAttempts >
          this.now().getTime()
      )
        return;
      try {
        const token = this.unseal(invitation.deliveryPayload);
        await this.mail.send({
          email: invitation.email,
          token,
          workspaceName: workspace.name,
          expiresAt: invitation.expiresAt,
        });
        await tx.invitations.update(
          { id },
          {
            deliveryStatus: 'SENT',
            deliveryPayload: null,
            deliveryAttempts: invitation.deliveryAttempts + 1,
            lastSentAt: this.now(),
          },
        );
      } catch {
        await tx.invitations.update(
          { id },
          {
            deliveryStatus: 'FAILED',
            deliveryAttempts: invitation.deliveryAttempts + 1,
            lastSentAt: this.now(),
          },
        );
      }
    });
  }
  async processPending(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      for (const row of await this.access.store.pendingDeliveries(100))
        await this.deliver(row.workspaceId, row.id, true);
    } finally {
      this.processing = false;
    }
  }
  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.processPending().catch(() => undefined);
    }, 30000);
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
