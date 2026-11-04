import type { PermissionCode } from '../../workspace/domain/models.js';
export const PROJECT_ROLES = ['VIEWER', 'EDITOR', 'MANAGER'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];
export const PROJECT_CAPABILITIES: Record<ProjectRole, PermissionCode[]> = {
  VIEWER: ['project.read', 'testcase.read', 'testrun.read', 'defect.read', 'testvault.read', 'testvault.reveal'],
  EDITOR: [
    'project.read',
    'project.update',
    'milestone.manage',
    'environment.manage',
    'testcase.read',
    'testcase.create',
    'testcase.update',
    'testrun.read',
    'testrun.execute',
    'defect.read',
    'defect.manage',
    'testvault.read',
    'testvault.reveal',
    'testvault.manage',
  ],
  MANAGER: [
    'project.read',
    'project.update',
    'project.archive',
    'testcase.archive',
    'testrun.manage',
    'project.manage_members',
    'milestone.manage',
    'environment.manage',
    'testcase.read',
    'testcase.create',
    'testcase.update',
    'testrun.read',
    'testrun.execute',
    'defect.read',
    'defect.manage',
    'testvault.read',
    'testvault.reveal',
    'testvault.manage',
  ],
};
export interface Project {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}
export interface ProjectMember {
  id: string;
  workspaceId: string;
  projectId: string;
  workspaceMemberId: string;
  projectRole: ProjectRole;
  createdAt: Date;
  updatedAt: Date;
}
export interface Milestone {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  description: string | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startDate: string | null;
  dueDate: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
export const ENVIRONMENT_CATEGORIES = [
  'PRODUCTION',
  'HOMOLOGATION',
  'OTHER',
] as const;
export type EnvironmentCategory = (typeof ENVIRONMENT_CATEGORIES)[number];
export interface Environment {
  category: EnvironmentCategory;
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  normalizedName: string;
  description: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
