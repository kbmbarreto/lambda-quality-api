import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Query,
  Req,
  Res,
  Inject,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { BearerGuard } from '../../identity/api/bearer-guard.js';
import { WorkspaceRequestGuard } from '../../workspace/api/guards.js';
import type { ApiRequest } from '../../../shared/http/types.js';
import {
  ApiSuccess,
  ApiListSuccess,
  ApiProblems,
} from '../../../shared/http/responses.js';
import { PROJECTS, Projects } from '../application/projects.js';
import { PROJECT_SETTINGS, ProjectSettings } from '../application/settings.js';
import * as D from './dtos.js';
const actor = (req: ApiRequest) => ({
  userId: req.identity!.userId,
  requestId: req.requestId,
});

@ApiTags('Projetos')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 409, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('workspaces/:workspaceId/projects')
export class ProjectController {
  constructor(@Inject(PROJECTS) private readonly service: Projects) {}
  @Get('')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listProjects',
    summary:
      'Listar projetos visíveis; sort: name,key,createdAt; permission: project.read',
  })
  @ApiListSuccess(D.ProjectResponse, 'Projetos consultados com sucesso.')
  async list(
    @Param('workspaceId') workspaceId: string,
    @Query() query: D.ProjectQuery,
    @Req() req: ApiRequest,
  ) {
    return this.service.list(actor(req), workspaceId, query);
  }
  @Post('')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createProject',
    summary: 'Criar projeto e vínculo MANAGER; permission: project.create',
  })
  @ApiSuccess(D.ProjectResponse, 201, 'Projeto criado com sucesso.')
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() body: D.CreateProjectDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.create(actor(req), workspaceId, body);
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${workspaceId}/projects/${result.id}`,
    );
    return result;
  }
  @Get(':projectId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getProject',
    summary: 'Consultar projeto e capabilities; permission: project.read',
  })
  @ApiSuccess(D.ProjectResponse, 200, 'Projeto consultado com sucesso.')
  async get(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.get(actor(req), workspaceId, projectId);
  }
  @Patch(':projectId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateProject',
    summary: 'Alterar nome/descrição; key imutável; permission: project.update',
  })
  @ApiSuccess(D.ProjectResponse, 200, 'Projeto atualizado com sucesso.')
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() body: D.UpdateProjectDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.update(actor(req), workspaceId, projectId, body);
  }
  @Post(':projectId/archive')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'archiveProject',
    summary: 'Arquivar sem apagar histórico; permission: project.archive',
  })
  @ApiSuccess(D.ProjectResponse, 200, 'Projeto arquivado com sucesso.')
  async archive(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.archive(actor(req), workspaceId, projectId);
  }
  @Get(':projectId/members')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listProjectMembers',
    summary:
      'Listar participantes; sort: createdAt,projectRole; permission: project.read',
  })
  @ApiListSuccess(
    D.ProjectMemberListResponse,
    'Participantes consultados com sucesso.',
  )
  async members(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: D.ProjectMemberQuery,
    @Req() req: ApiRequest,
  ) {
    return this.service.members(actor(req), workspaceId, projectId, query);
  }
  @Put(':projectId/members/:workspaceMemberId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'assignProjectMember',
    summary:
      'Atribuir/alterar role local de participante; permission: project.manage_members',
  })
  @ApiSuccess(
    D.ProjectMemberResponse,
    200,
    'Participante atualizado com sucesso.',
  )
  async putMember(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('workspaceMemberId') workspaceMemberId: string,
    @Body() body: D.AssignProjectMemberDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.putMember(
      actor(req),
      workspaceId,
      projectId,
      workspaceMemberId,
      body.projectRole,
    );
  }
  @Delete(':projectId/members/:workspaceMemberId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'removeProjectMember',
    summary:
      'Revogar acesso local do participante; permission: project.manage_members',
  })
  @ApiResponse({ status: 204, description: 'Sem corpo.' })
  async removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('workspaceMemberId') workspaceMemberId: string,
    @Body() body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.removeMember(
      actor(req),
      workspaceId,
      projectId,
      workspaceMemberId,
    );
  }
}

@ApiTags('Marcos de projeto')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 409, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('workspaces/:workspaceId/projects/:projectId/milestones')
export class MilestoneController {
  constructor(
    @Inject(PROJECT_SETTINGS) private readonly service: ProjectSettings,
  ) {}
  @Get('')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listMilestones',
    summary:
      'Listar marcos; sort: name,createdAt,dueDate; permission: project.read',
  })
  @ApiListSuccess(D.MilestoneResponse, 'Marcos consultados com sucesso.')
  async milestones(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: D.MilestoneQuery,
    @Req() req: ApiRequest,
  ) {
    return this.service.milestones(actor(req), workspaceId, projectId, query);
  }
  @Post('')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createMilestone',
    summary: 'Criar marco PLANNED; permission: milestone.manage',
  })
  @ApiSuccess(D.MilestoneResponse, 201, 'Marco criado com sucesso.')
  async createMilestone(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() body: D.CreateMilestoneDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.createMilestone(
      actor(req),
      workspaceId,
      projectId,
      body,
    );
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${workspaceId}/projects/${projectId}/milestones/${result.id}`,
    );
    return result;
  }
  @Get(':milestoneId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getMilestone',
    summary: 'Consultar marco do projeto; permission: project.read',
  })
  @ApiSuccess(D.MilestoneResponse, 200, 'Marco consultado com sucesso.')
  async milestone(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @Query() query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.milestone(
      actor(req),
      workspaceId,
      projectId,
      milestoneId,
    );
  }
  @Patch(':milestoneId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateMilestone',
    summary: 'Alterar marco não concluído; permission: milestone.manage',
  })
  @ApiSuccess(D.MilestoneResponse, 200, 'Marco atualizado com sucesso.')
  async updateMilestone(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: D.UpdateMilestoneDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.updateMilestone(
      actor(req),
      workspaceId,
      projectId,
      milestoneId,
      body,
    );
  }
  @Post(':milestoneId/complete')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'completeMilestone',
    summary:
      'Concluir marco de forma idempotente; permission: milestone.manage',
  })
  @ApiSuccess(D.MilestoneResponse, 200, 'Marco concluído com sucesso.')
  async completeMilestone(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.completeMilestone(
      actor(req),
      workspaceId,
      projectId,
      milestoneId,
    );
  }
  @Delete(':milestoneId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteMilestone',
    summary: 'Excluir marco logicamente; permission: milestone.manage',
  })
  @ApiResponse({ status: 204, description: 'Sem corpo.' })
  async removeMilestone(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.removeMilestone(
      actor(req),
      workspaceId,
      projectId,
      milestoneId,
    );
  }
}

@ApiTags('Ambientes de projeto')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 409, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('workspaces/:workspaceId/projects/:projectId/environments')
export class EnvironmentController {
  constructor(
    @Inject(PROJECT_SETTINGS) private readonly service: ProjectSettings,
  ) {}
  @Get('')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listEnvironments',
    summary: 'Listar ambientes; sort: name,createdAt; permission: project.read',
  })
  @ApiListSuccess(D.EnvironmentResponse, 'Ambientes consultados com sucesso.')
  async environments(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: D.EnvironmentQuery,
    @Req() req: ApiRequest,
  ) {
    return this.service.environments(actor(req), workspaceId, projectId, query);
  }
  @Post('')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createEnvironment',
    summary: 'Criar ambiente; permission: environment.manage',
  })
  @ApiSuccess(D.EnvironmentResponse, 201, 'Ambiente criado com sucesso.')
  async createEnvironment(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() body: D.CreateEnvironmentDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.createEnvironment(
      actor(req),
      workspaceId,
      projectId,
      body,
    );
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${workspaceId}/projects/${projectId}/environments/${result.id}`,
    );
    return result;
  }
  @Get(':environmentId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getEnvironment',
    summary: 'Consultar ambiente do projeto; permission: project.read',
  })
  @ApiSuccess(D.EnvironmentResponse, 200, 'Ambiente consultado com sucesso.')
  async environment(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Query() query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.environment(
      actor(req),
      workspaceId,
      projectId,
      environmentId,
    );
  }
  @Patch(':environmentId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateEnvironment',
    summary: 'Alterar/desativar ambiente; permission: environment.manage',
  })
  @ApiSuccess(D.EnvironmentResponse, 200, 'Ambiente atualizado com sucesso.')
  async updateEnvironment(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Body() body: D.UpdateEnvironmentDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.updateEnvironment(
      actor(req),
      workspaceId,
      projectId,
      environmentId,
      body,
    );
  }
  @Delete(':environmentId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteEnvironment',
    summary: 'Excluir ambiente logicamente; permission: environment.manage',
  })
  @ApiResponse({ status: 204, description: 'Sem corpo.' })
  async removeEnvironment(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Body() body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.removeEnvironment(
      actor(req),
      workspaceId,
      projectId,
      environmentId,
    );
  }
}
