export const PERMISSIONS = [
  'workspace.read',
  'workspace.update',
  'workspace.manage_members',
  'workspace.manage_roles',
  'workspace.manage_groups',
  'field.read',
  'field.manage',
  'tag.read',
  'tag.manage',
  'attachment.read',
  'attachment.upload',
  'attachment.delete',
  'project.read',
  'project.create',
  'project.update',
  'project.archive',
  'project.manage_members',
  'project.manage_all',
  'milestone.manage',
  'environment.manage',
  'testcase.read',
  'testcase.create',
  'testcase.update',
  'testcase.archive',
  'testrun.read',
  'testrun.execute',
  'testrun.manage',
  'defect.read',
  'defect.manage',
  'governance.read',
  'governance.assess',
  'governance.manage',
  'testvault.read',
  'testvault.manage',
  'testvault.reveal',
] as const;
export type PermissionCode = (typeof PERMISSIONS)[number];
export const MEMBER_PERMISSIONS: PermissionCode[] = [
  'workspace.read',
  'field.read',
  'tag.read',
  'attachment.read',
  'project.read',
  'testcase.read',
  'testrun.read',
  'defect.read',
  'governance.read',
];
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  ownerMemberId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface Member {
  id: string;
  workspaceId: string;
  userId: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
  joinedAt: Date;
}
export interface Role {
  id: string;
  workspaceId: string;
  name: string;
  normalizedName: string;
  description: string | null;
  systemRole: boolean;
  createdAt: Date;
}
export interface Group {
  id: string;
  workspaceId: string;
  name: string;
  normalizedName: string;
  description: string | null;
  createdAt: Date;
}
export interface MemberRole {
  id: string;
  workspaceId: string;
  memberId: string;
  roleId: string;
}
export interface GroupMember {
  id: string;
  workspaceId: string;
  groupId: string;
  memberId: string;
}
export interface GroupRole {
  id: string;
  workspaceId: string;
  groupId: string;
  roleId: string;
}
export interface RolePermission {
  id: string;
  workspaceId: string;
  roleId: string;
  permissionCode: string;
}
export interface Invitation {
  id: string;
  workspaceId: string;
  email: string;
  tokenHash: string;
  status: 'PENDING' | 'ACCEPTED' | 'CANCELED';
  expiresAt: Date;
  invitedBy: string;
  acceptedBy: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
  lastSentAt: Date;
  deliveryStatus: 'PENDING' | 'SENT' | 'FAILED';
  deliveryPayload: string | null;
  deliveryAttempts: number;
}
export interface TenantAudit {
  id: string;
  workspaceId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: Date;
  correlationId: string;
}
export interface Actor {
  userId: string;
  requestId: string;
}
export interface AccessContext {
  workspace: Workspace;
  member: Member;
  permissions: PermissionCode[];
  isOwner: boolean;
}
export function normalizeName(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase('en-US');
}
