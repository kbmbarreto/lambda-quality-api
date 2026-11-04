import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { BearerGuard } from '../../identity/api/bearer-guard.js';
import type { ApiRequest } from '../../../shared/http/types.js';
import {
  ApiListSuccess,
  ApiProblems,
  ApiSuccess,
} from '../../../shared/http/responses.js';
import { WorkspaceRequestGuard } from './guards.js';
import { WORKSPACE_ROLES, RolesGroups } from '../application/roles-groups.js';
import * as D from './dtos.js';
const actor = (req: ApiRequest) => ({
  userId: req.identity!.userId,
  requestId: req.requestId,
});
@ApiTags('Roles e grupos')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 409, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller()
export class AccessController {
  constructor(@Inject(WORKSPACE_ROLES) private readonly roles: RolesGroups) {}
  @Get('permissions')
  @ApiOperation({
    operationId: 'getPermissionCatalog',
    summary: 'Consultar catálogo global de permissions disponíveis',
  })
  @ApiSuccess(
    D.PermissionCatalogResponse,
    200,
    'Permissions consultadas com sucesso.',
  )
  permissions(@Query() _query: D.EmptyBody) {
    return { permissions: this.roles.permissions() };
  }
  @Get('workspaces/:workspaceId/roles')
  @ApiOperation({
    operationId: 'listWorkspaceRoles',
    summary: 'Listar roles; sort: name, createdAt',
  })
  @ApiListSuccess(D.RoleResponse, 'Roles consultadas com sucesso.')
  listRoles(
    @Param('workspaceId') ws: string,
    @Query() query: D.ListQuery,
    @Req() req: ApiRequest,
  ) {
    return this.roles.listRoles(actor(req), ws, query);
  }
  @Post('workspaces/:workspaceId/roles')
  @ApiOperation({
    operationId: 'createWorkspaceRole',
    summary: 'Criar role customizada; permission: workspace.manage_roles',
  })
  @ApiSuccess(D.RoleResponse, 201, 'Role criada com sucesso.')
  async createRole(
    @Param('workspaceId') ws: string,
    @Body() body: D.CreateRoleDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const row = await this.roles.createRole(actor(req), ws, body);
    res.setHeader('Location', `/api/v1/workspaces/${ws}/roles/${row.id}`);
    return row;
  }
  @Get('workspaces/:workspaceId/roles/:roleId')
  @ApiOperation({
    operationId: 'getWorkspaceRole',
    summary: 'Consultar role e permissions',
  })
  @ApiSuccess(D.RoleResponse, 200, 'Role consultada com sucesso.')
  getRole(
    @Param('workspaceId') ws: string,
    @Param('roleId') id: string,
    @Query() _query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.roles.getRole(actor(req), ws, id);
  }
  @Patch('workspaces/:workspaceId/roles/:roleId')
  @ApiOperation({
    operationId: 'updateWorkspaceRole',
    summary: 'Alterar role customizada; permission: workspace.manage_roles',
  })
  @ApiSuccess(D.RoleResponse, 200, 'Role atualizada com sucesso.')
  updateRole(
    @Param('workspaceId') ws: string,
    @Param('roleId') id: string,
    @Body() body: D.UpdateRoleDto,
    @Req() req: ApiRequest,
  ) {
    return this.roles.updateRole(actor(req), ws, id, body);
  }
  @Delete('workspaces/:workspaceId/roles/:roleId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteWorkspaceRole',
    summary: 'Remover role customizada sem vínculos',
  })
  @ApiResponse({ status: 204, description: 'Role removida; sem corpo.' })
  deleteRole(
    @Param('workspaceId') ws: string,
    @Param('roleId') id: string,
    @Body() _body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.roles.removeRole(actor(req), ws, id);
  }
  @Put('workspaces/:workspaceId/members/:memberId/roles/:roleId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'assignWorkspaceMemberRole',
    summary: 'Atribuir role direta; permission: workspace.manage_roles',
  })
  @ApiResponse({ status: 204, description: 'Role atribuída; sem corpo.' })
  assignRole(
    @Param('workspaceId') ws: string,
    @Param('memberId') member: string,
    @Param('roleId') role: string,
    @Body() _body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.roles.memberRole(actor(req), ws, member, role, true);
  }
  @Delete('workspaces/:workspaceId/members/:memberId/roles/:roleId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'revokeWorkspaceMemberRole',
    summary: 'Revogar role direta; permission: workspace.manage_roles',
  })
  @ApiResponse({ status: 204, description: 'Role revogada; sem corpo.' })
  revokeRole(
    @Param('workspaceId') ws: string,
    @Param('memberId') member: string,
    @Param('roleId') role: string,
    @Body() _body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.roles.memberRole(actor(req), ws, member, role, false);
  }
  @Get('workspaces/:workspaceId/groups')
  @ApiOperation({
    operationId: 'listWorkspaceGroups',
    summary: 'Listar grupos; sort: name, createdAt',
  })
  @ApiListSuccess(D.GroupResponse, 'Grupos consultados com sucesso.')
  groups(
    @Param('workspaceId') ws: string,
    @Query() query: D.ListQuery,
    @Req() req: ApiRequest,
  ) {
    return this.roles.listGroups(actor(req), ws, query);
  }
  @Post('workspaces/:workspaceId/groups')
  @ApiOperation({
    operationId: 'createWorkspaceGroup',
    summary: 'Criar grupo; permission: workspace.manage_groups',
  })
  @ApiSuccess(D.GroupResponse, 201, 'Grupo criado com sucesso.')
  async createGroup(
    @Param('workspaceId') ws: string,
    @Body() body: D.CreateGroupDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const row = await this.roles.createGroup(actor(req), ws, body);
    res.setHeader('Location', `/api/v1/workspaces/${ws}/groups/${row.id}`);
    return row;
  }
  @Get('workspaces/:workspaceId/groups/:groupId')
  @ApiOperation({
    operationId: 'getWorkspaceGroup',
    summary: 'Consultar grupo',
  })
  @ApiSuccess(D.GroupResponse, 200, 'Grupo consultado com sucesso.')
  group(
    @Param('workspaceId') ws: string,
    @Param('groupId') id: string,
    @Query() _query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.roles.getGroup(actor(req), ws, id);
  }
  @Patch('workspaces/:workspaceId/groups/:groupId')
  @ApiOperation({
    operationId: 'updateWorkspaceGroup',
    summary: 'Alterar grupo; permission: workspace.manage_groups',
  })
  @ApiSuccess(D.GroupResponse, 200, 'Grupo atualizado com sucesso.')
  updateGroup(
    @Param('workspaceId') ws: string,
    @Param('groupId') id: string,
    @Body() body: D.UpdateGroupDto,
    @Req() req: ApiRequest,
  ) {
    return this.roles.updateGroup(actor(req), ws, id, body);
  }
  @Delete('workspaces/:workspaceId/groups/:groupId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteWorkspaceGroup',
    summary: 'Remover grupo e concessões; preserva membros',
  })
  @ApiResponse({ status: 204, description: 'Grupo removido; sem corpo.' })
  deleteGroup(
    @Param('workspaceId') ws: string,
    @Param('groupId') id: string,
    @Body() _body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.roles.removeGroup(actor(req), ws, id);
  }
  @Get('workspaces/:workspaceId/groups/:groupId/members')
  @ApiOperation({
    operationId: 'listWorkspaceGroupMembers',
    summary: 'Listar participantes; sort: memberId',
  })
  @ApiListSuccess(
    D.GroupParticipantResponse,
    'Participantes consultados com sucesso.',
  )
  members(
    @Param('workspaceId') ws: string,
    @Param('groupId') id: string,
    @Query() query: D.PageQuery,
    @Req() req: ApiRequest,
  ) {
    return this.roles.groupMembers(actor(req), ws, id, query);
  }
  @Put('workspaces/:workspaceId/groups/:groupId/members/:memberId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'addWorkspaceGroupMember',
    summary: 'Adicionar membro ao grupo; permission: workspace.manage_groups',
  })
  @ApiResponse({
    status: 204,
    description: 'Participação registrada; sem corpo.',
  })
  addMember(
    @Param('workspaceId') ws: string,
    @Param('groupId') group: string,
    @Param('memberId') member: string,
    @Body() _body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.roles.groupMember(actor(req), ws, group, member, true);
  }
  @Delete('workspaces/:workspaceId/groups/:groupId/members/:memberId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'removeWorkspaceGroupMember',
    summary: 'Remover membro do grupo; permission: workspace.manage_groups',
  })
  @ApiResponse({
    status: 204,
    description: 'Participação removida; sem corpo.',
  })
  removeMember(
    @Param('workspaceId') ws: string,
    @Param('groupId') group: string,
    @Param('memberId') member: string,
    @Body() _body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.roles.groupMember(actor(req), ws, group, member, false);
  }
  @Put('workspaces/:workspaceId/groups/:groupId/roles/:roleId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'assignWorkspaceGroupRole',
    summary: 'Atribuir role ao grupo; permission: workspace.manage_groups',
  })
  @ApiResponse({
    status: 204,
    description: 'Role atribuída ao grupo; sem corpo.',
  })
  assignGroupRole(
    @Param('workspaceId') ws: string,
    @Param('groupId') group: string,
    @Param('roleId') role: string,
    @Body() _body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.roles.groupRole(actor(req), ws, group, role, true);
  }
  @Delete('workspaces/:workspaceId/groups/:groupId/roles/:roleId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'revokeWorkspaceGroupRole',
    summary: 'Revogar role do grupo; permission: workspace.manage_groups',
  })
  @ApiResponse({
    status: 204,
    description: 'Role revogada do grupo; sem corpo.',
  })
  revokeGroupRole(
    @Param('workspaceId') ws: string,
    @Param('groupId') group: string,
    @Param('roleId') role: string,
    @Body() _body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.roles.groupRole(actor(req), ws, group, role, false);
  }
}
