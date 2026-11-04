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
import { WORKSPACES, Workspaces } from '../application/workspaces.js';
import { INVITATIONS, Invitations } from '../application/invitations.js';
import * as D from './dtos.js';
const actor = (req: ApiRequest) => ({
  userId: req.identity!.userId,
  requestId: req.requestId,
});
@ApiTags('Workspaces e membros')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 409, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('workspaces')
export class WorkspaceController {
  constructor(
    @Inject(WORKSPACES) private readonly workspaces: Workspaces,
    @Inject(INVITATIONS) private readonly invitations: Invitations,
  ) {}
  @Post()
  @ApiOperation({
    operationId: 'createWorkspace',
    summary: 'Criar Workspace e vínculo de Owner',
  })
  @ApiSuccess(D.WorkspaceResponse, 201, 'Workspace criado com sucesso.')
  async create(
    @Body() body: D.CreateWorkspaceDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const row = await this.workspaces.create(actor(req), body);
    res.setHeader('Location', `/api/v1/workspaces/${row.id}`);
    return row;
  }
  @Get()
  @ApiOperation({
    operationId: 'listWorkspaces',
    summary: 'Listar Workspaces acessíveis; sort: name, slug, createdAt',
  })
  @ApiListSuccess(D.WorkspaceResponse, 'Workspaces consultados com sucesso.')
  list(@Query() query: D.ListQuery, @Req() req: ApiRequest) {
    return this.workspaces.list(actor(req), query);
  }
  @Get(':workspaceId')
  @ApiOperation({
    operationId: 'getWorkspace',
    summary: 'Consultar Workspace e permissions atuais',
  })
  @ApiSuccess(D.WorkspaceResponse, 200, 'Workspace consultado com sucesso.')
  get(
    @Param('workspaceId') ws: string,
    @Query() _query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.workspaces.get(actor(req), ws);
  }
  @Patch(':workspaceId')
  @ApiOperation({
    operationId: 'updateWorkspace',
    summary: 'Alterar dados; permission: workspace.update',
  })
  @ApiSuccess(D.WorkspaceResponse, 200, 'Workspace atualizado com sucesso.')
  update(
    @Param('workspaceId') ws: string,
    @Body() body: D.UpdateWorkspaceDto,
    @Req() req: ApiRequest,
  ) {
    return this.workspaces.update(actor(req), ws, body);
  }
  @Post(':workspaceId/ownership/transfer')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'transferWorkspaceOwnership',
    summary: 'Transferir ownership; somente Owner',
  })
  @ApiSuccess(D.WorkspaceResponse, 200, 'Ownership transferido com sucesso.')
  transfer(
    @Param('workspaceId') ws: string,
    @Body() body: D.TransferDto,
    @Req() req: ApiRequest,
  ) {
    return this.workspaces.transfer(actor(req), ws, body.memberId);
  }
  @Get(':workspaceId/members')
  @ApiOperation({
    operationId: 'listWorkspaceMembers',
    summary: 'Listar membros; sort: joinedAt, status',
  })
  @ApiListSuccess(D.MemberResponse, 'Membros consultados com sucesso.')
  members(
    @Param('workspaceId') ws: string,
    @Query() query: D.MemberQuery,
    @Req() req: ApiRequest,
  ) {
    return this.workspaces.members(actor(req), ws, query);
  }
  @Get(':workspaceId/members/:memberId')
  @ApiOperation({
    operationId: 'getWorkspaceMember',
    summary: 'Consultar membro, roles e grupos',
  })
  @ApiSuccess(D.MemberResponse, 200, 'Membro consultado com sucesso.')
  member(
    @Param('workspaceId') ws: string,
    @Param('memberId') member: string,
    @Query() _query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.workspaces.member(actor(req), ws, member);
  }
  @Patch(':workspaceId/members/:memberId')
  @ApiOperation({
    operationId: 'updateWorkspaceMemberStatus',
    summary: 'Suspender/reativar vínculo; permission: workspace.manage_members',
  })
  @ApiSuccess(D.MemberResponse, 200, 'Status do membro atualizado com sucesso.')
  status(
    @Param('workspaceId') ws: string,
    @Param('memberId') member: string,
    @Body() body: D.MemberStatusDto,
    @Req() req: ApiRequest,
  ) {
    return this.workspaces.changeMember(actor(req), ws, member, body.status);
  }
  @Delete(':workspaceId/members/:memberId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'removeWorkspaceMember',
    summary: 'Remover vínculo; preserva User e outros Workspaces',
  })
  @ApiResponse({ status: 204, description: 'Vínculo removido; sem corpo.' })
  remove(
    @Param('workspaceId') ws: string,
    @Param('memberId') member: string,
    @Body() _body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.workspaces
      .changeMember(actor(req), ws, member, 'REMOVED')
      .then(() => undefined);
  }
  @Get(':workspaceId/invitations')
  @ApiOperation({
    operationId: 'listWorkspaceInvitations',
    summary:
      'Listar convites; sort: createdAt, email, expiresAt; permission: workspace.manage_members',
  })
  @ApiListSuccess(D.InvitationResponse, 'Convites consultados com sucesso.')
  invites(
    @Param('workspaceId') ws: string,
    @Query() query: D.InvitationQuery,
    @Req() req: ApiRequest,
  ) {
    return this.invitations.list(actor(req), ws, query);
  }
  @Get(':workspaceId/invitations/:invitationId')
  @ApiOperation({
    operationId: 'getWorkspaceInvitation',
    summary: 'Consultar estado do convite e envio',
  })
  @ApiSuccess(D.InvitationResponse, 200, 'Convite consultado com sucesso.')
  invitation(
    @Param('workspaceId') ws: string,
    @Param('invitationId') id: string,
    @Query() _query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.invitations.get(actor(req), ws, id);
  }
  @Post(':workspaceId/invitations')
  @HttpCode(202)
  @ApiOperation({
    operationId: 'createWorkspaceInvitation',
    summary: 'Registrar convite e enviar por SendGrid',
  })
  @ApiSuccess(
    D.InvitationResponse,
    202,
    'Convite registrado. Consulte o status de envio.',
  )
  async invite(
    @Param('workspaceId') ws: string,
    @Body() body: D.InviteDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const row = await this.invitations.create(actor(req), ws, body.email);
    res.setHeader('Location', `/api/v1/workspaces/${ws}/invitations/${row.id}`);
    return row;
  }
  @ApiProblems([429])
  @Post(':workspaceId/invitations/:invitationId/resend')
  @HttpCode(202)
  @ApiOperation({
    operationId: 'resendWorkspaceInvitation',
    summary: 'Reenviar convite e invalidar token anterior',
  })
  @ApiSuccess(
    D.InvitationResponse,
    202,
    'Reenvio registrado. Consulte o status de envio.',
  )
  resend(
    @Param('workspaceId') ws: string,
    @Param('invitationId') id: string,
    @Body() _body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.invitations.resend(actor(req), ws, id);
  }
  @Delete(':workspaceId/invitations/:invitationId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'cancelWorkspaceInvitation',
    summary: 'Cancelar convite pendente',
  })
  @ApiResponse({ status: 204, description: 'Convite cancelado; sem corpo.' })
  cancel(
    @Param('workspaceId') ws: string,
    @Param('invitationId') id: string,
    @Body() _body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.invitations.cancel(actor(req), ws, id);
  }
}
@ApiTags('Convites')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 409, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('invitations')
export class InvitationController {
  constructor(@Inject(INVITATIONS) private readonly invitations: Invitations) {}
  @Post('accept')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'acceptWorkspaceInvitation',
    summary: 'Aceitar convite com e-mail autenticado correspondente',
  })
  @ApiSuccess(D.MembershipResponse, 200, 'Convite aceito com sucesso.')
  accept(@Body() body: D.AcceptInviteDto, @Req() req: ApiRequest) {
    return this.invitations.accept(actor(req), body.token);
  }
}
