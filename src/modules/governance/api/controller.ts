import {
  GOVERNANCE_PROGRESS,
  GovernanceProgress,
} from '../application/progress.js';
import {
  FrameworkProgressQuery,
  FrameworkProgressResponse,
} from './progress-dtos.js';
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  HttpCode,
  Inject,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import type { ApiRequest } from '../../../shared/http/types.js';
import {
  ApiSuccess,
  ApiListSuccess,
  ApiProblems,
} from '../../../shared/http/responses.js';
import { BearerGuard } from '../../identity/api/bearer-guard.js';
import { WorkspaceRequestGuard } from '../../workspace/api/guards.js';
import { ListQuery } from '../../workspace/api/dtos.js';
import { GovernanceFrameworks } from '../application/frameworks.js';
import { GovernanceAssessments } from '../application/assessments.js';
import { GovernanceGoalsActions } from '../application/goals-actions.js';
import {
  GOVERNANCE_FRAMEWORKS,
  GOVERNANCE_ASSESSMENTS,
  GOVERNANCE_GOALS,
} from '../application/tokens.js';
import {
  ActionPlanResponse,
  ActionQuery,
  AddEvidenceDto,
  AssessControlDto,
  AssessmentControlQuery,
  AssessmentQuery,
  AssessmentResponse,
  ControlAssessmentResponse,
  ControlMutationResponse,
  ControlQuery,
  CreateActionDto,
  CreateAssessmentDto,
  CreateControlDto,
  CreateFrameworkDto,
  CreateGoalDto,
  CreateSectionDto,
  DashboardResponse,
  EmptyBody,
  EvidenceLinkResponse,
  FrameworkQuery,
  FrameworkSectionResponse,
  GoalQuery,
  GovernanceControlResponse,
  GovernanceFrameworkResponse,
  GovernanceGoalResponse,
  MetricsResponse,
  SectionMutationResponse,
  UpdateActionDto,
  UpdateControlDto,
  UpdateFrameworkDto,
  UpdateGoalDto,
  UpdateSectionDto,
  VersionDto,
} from './dtos.js';
const actor = (req: ApiRequest) => ({
  userId: req.identity!.userId,
  requestId: req.requestId,
});
@Controller('workspaces/:workspaceId/governance')
@ApiTags('Governança')
@ApiBearerAuth('access-token')
@UseGuards(BearerGuard, WorkspaceRequestGuard)
export class GovernanceController {
  constructor(
    @Inject(GOVERNANCE_PROGRESS) private readonly progress: GovernanceProgress,
    @Inject(GOVERNANCE_FRAMEWORKS)
    private readonly frameworks: GovernanceFrameworks,
    @Inject(GOVERNANCE_ASSESSMENTS)
    private readonly assessments: GovernanceAssessments,
    @Inject(GOVERNANCE_GOALS) private readonly goals: GovernanceGoalsActions,
  ) {}
  @Get('frameworks')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listGovernanceFrameworks',
    summary: 'Registros consultados com sucesso. Permission: governance.read.',
  })
  @ApiListSuccess(
    GovernanceFrameworkResponse,
    'Registros consultados com sucesso.',
  )
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async listGovernanceFrameworks(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Query() input: FrameworkQuery,
  ) {
    return this.frameworks.list(actor(req), ws, input);
  }
  @Post('frameworks')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createGovernanceFramework',
    summary: 'Registro criado com sucesso. Permission: governance.manage.',
  })
  @ApiSuccess(GovernanceFrameworkResponse, 201, 'Registro criado com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async createGovernanceFramework(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Body() input: CreateFrameworkDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.frameworks.create(actor(req), ws, input);
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${ws}/governance/frameworks/${data.id}`,
    );
    return data;
  }
  @Get('frameworks/:frameworkId/progress')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getGovernanceFrameworkProgress',
    summary:
      'Progresso do framework consultado com sucesso. Permission: governance.read.',
  })
  @ApiSuccess(
    FrameworkProgressResponse,
    200,
    'Progresso do framework consultado com sucesso.',
  )
  @ApiProblems([400, 401, 403, 404])
  async getGovernanceFrameworkProgress(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('frameworkId') frameworkId: string,
    @Query() input: FrameworkProgressQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.progress.read(actor(req), ws, frameworkId, input.assessmentId);
  }
  @Get('frameworks/:id')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getGovernanceFramework',
    summary: 'Registro consultado com sucesso. Permission: governance.read.',
  })
  @ApiSuccess(
    GovernanceFrameworkResponse,
    200,
    'Registro consultado com sucesso.',
  )
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async getGovernanceFramework(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Query() _input: EmptyBody,
  ) {
    return this.frameworks.get(actor(req), ws, id);
  }
  @Patch('frameworks/:id')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateGovernanceFramework',
    summary: 'Registro atualizado com sucesso. Permission: governance.manage.',
  })
  @ApiSuccess(
    GovernanceFrameworkResponse,
    200,
    'Registro atualizado com sucesso.',
  )
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async updateGovernanceFramework(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Body() input: UpdateFrameworkDto,
  ) {
    return this.frameworks.update(actor(req), ws, id, input);
  }
  @Get('assessments')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listGovernanceAssessments',
    summary: 'Registros consultados com sucesso. Permission: governance.read.',
  })
  @ApiListSuccess(AssessmentResponse, 'Registros consultados com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async listGovernanceAssessments(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Query() input: AssessmentQuery,
  ) {
    return this.assessments.list(actor(req), ws, input);
  }
  @Post('assessments')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createGovernanceAssessment',
    summary: 'Registro criado com sucesso. Permission: governance.assess.',
  })
  @ApiSuccess(AssessmentResponse, 201, 'Registro criado com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async createGovernanceAssessment(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Body() input: CreateAssessmentDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.assessments.create(actor(req), ws, input);
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${ws}/governance/assessments/${data.id}`,
    );
    return data;
  }
  @Get('assessments/:id')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getGovernanceAssessment',
    summary: 'Registro consultado com sucesso. Permission: governance.read.',
  })
  @ApiSuccess(AssessmentResponse, 200, 'Registro consultado com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async getGovernanceAssessment(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Query() _input: EmptyBody,
  ) {
    return this.assessments.get(actor(req), ws, id);
  }
  @Get('goals')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listGovernanceGoals',
    summary: 'Registros consultados com sucesso. Permission: governance.read.',
    description:
      'Conclusão da meta por ações: DONE / ações não CANCELLED; sem ações válidas não atinge. status e actionProgress refletem os vínculos atuais. Métrica lastResult permanece informativa e não altera frameworks.',
  })
  @ApiListSuccess(GovernanceGoalResponse, 'Registros consultados com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async listGovernanceGoals(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Query() input: GoalQuery,
  ) {
    return this.goals.goals(actor(req), ws, input);
  }
  @Post('goals')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createGovernanceGoal',
    summary: 'Registro criado com sucesso. Permission: governance.manage.',
    description:
      'Conclusão da meta por ações: DONE / ações não CANCELLED; sem ações válidas não atinge. status e actionProgress refletem os vínculos atuais. Métrica lastResult permanece informativa e não altera frameworks.',
  })
  @ApiSuccess(GovernanceGoalResponse, 201, 'Registro criado com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async createGovernanceGoal(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Body() input: CreateGoalDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.goals.createGoal(actor(req), ws, input);
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${ws}/governance/goals/${data.id}`,
    );
    return data;
  }
  @Get('goals/:id')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getGovernanceGoal',
    summary: 'Registro consultado com sucesso. Permission: governance.read.',
    description:
      'Conclusão da meta por ações: DONE / ações não CANCELLED; sem ações válidas não atinge. status e actionProgress refletem os vínculos atuais. Métrica lastResult permanece informativa e não altera frameworks.',
  })
  @ApiSuccess(GovernanceGoalResponse, 200, 'Registro consultado com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async getGovernanceGoal(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Query() _input: EmptyBody,
  ) {
    return this.goals.getGoal(actor(req), ws, id);
  }
  @Patch('goals/:id')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateGovernanceGoal',
    summary: 'Registro atualizado com sucesso. Permission: governance.manage.',
    description:
      'Conclusão da meta por ações: DONE / ações não CANCELLED; sem ações válidas não atinge. status e actionProgress refletem os vínculos atuais. Métrica lastResult permanece informativa e não altera frameworks.',
  })
  @ApiSuccess(GovernanceGoalResponse, 200, 'Registro atualizado com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async updateGovernanceGoal(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Body() input: UpdateGoalDto,
  ) {
    return this.goals.updateGoal(actor(req), ws, id, input);
  }
  @Get('actions')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listGovernanceActions',
    summary: 'Registros consultados com sucesso. Permission: governance.read.',
  })
  @ApiListSuccess(ActionPlanResponse, 'Registros consultados com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async listGovernanceActions(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Query() input: ActionQuery,
  ) {
    return this.goals.actions(actor(req), ws, input);
  }
  @Post('actions')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createGovernanceAction',
    summary: 'Registro criado com sucesso. Permission: governance.manage.',
    description:
      'Atualiza automaticamente situação e versão das metas vinculadas na mesma transação. Reconsultar metas de origem/destino. Não altera lastResult ou avaliações/frameworks.',
  })
  @ApiSuccess(ActionPlanResponse, 201, 'Registro criado com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async createGovernanceAction(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Body() input: CreateActionDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.goals.createAction(actor(req), ws, input);
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${ws}/governance/actions/${data.id}`,
    );
    return data;
  }
  @Get('actions/:id')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getGovernanceAction',
    summary: 'Registro consultado com sucesso. Permission: governance.read.',
  })
  @ApiSuccess(ActionPlanResponse, 200, 'Registro consultado com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async getGovernanceAction(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Query() _input: EmptyBody,
  ) {
    return this.goals.getAction(actor(req), ws, id);
  }
  @Patch('actions/:id')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateGovernanceAction',
    summary: 'Registro atualizado com sucesso. Permission: governance.manage.',
    description:
      'Atualiza ações OPEN/IN_PROGRESS com version atual. goalId ausente mantém o vínculo; UUID v4 associa ou troca a meta; null remove. Meta deve ser acessível no mesmo Workspace, não cancelada e com Projeto ativo quando aplicável. controlAssessmentId permanece imutável. Atualiza automaticamente situação e versão das metas vinculadas na mesma transação. Reconsultar metas de origem/destino. Não altera lastResult ou avaliações/frameworks.',
  })
  @ApiSuccess(ActionPlanResponse, 200, 'Registro atualizado com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async updateGovernanceAction(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Body() input: UpdateActionDto,
  ) {
    return this.goals.updateAction(actor(req), ws, id, input);
  }
  @Get('frameworks/:id/sections')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listGovernanceSections',
    summary: 'Definições consultadas com sucesso. Permission: governance.read.',
  })
  @ApiListSuccess(
    FrameworkSectionResponse,
    'Definições consultadas com sucesso.',
  )
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async listGovernanceSections(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Query() input: ListQuery,
  ) {
    return this.frameworks.sections(actor(req), ws, id, input);
  }
  @Post('frameworks/:id/sections')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createGovernanceSection',
    summary: 'Definição criada com sucesso. Permission: governance.manage.',
  })
  @ApiSuccess(SectionMutationResponse, 201, 'Definição criada com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async createGovernanceSection(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Body() input: CreateSectionDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.frameworks.section(actor(req), ws, id, null, input);
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${ws}/governance/frameworks/${id}/sections`,
    );
    return data;
  }
  @Patch('frameworks/:id/sections/:childId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateGovernanceSection',
    summary: 'Definição atualizada com sucesso. Permission: governance.manage.',
  })
  @ApiSuccess(SectionMutationResponse, 200, 'Definição atualizada com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async updateGovernanceSection(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Param('childId') childId: string,
    @Body() input: UpdateSectionDto,
  ) {
    return this.frameworks.section(actor(req), ws, id, childId, input);
  }
  @Get('frameworks/:id/controls')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listGovernanceControls',
    description:
      'Ordenação padrão creationOrder,asc, sequência técnica de inserção. Também aceita code/title explícitos. creationOrder é imutável e não é informado pelo usuário.',
    summary: 'Definições consultadas com sucesso. Permission: governance.read.',
  })
  @ApiListSuccess(
    GovernanceControlResponse,
    'Definições consultadas com sucesso.',
  )
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async listGovernanceControls(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Query() input: ControlQuery,
  ) {
    return this.frameworks.controls(actor(req), ws, id, input);
  }
  @Post('frameworks/:id/controls')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createGovernanceControl',
    summary: 'Definição criada com sucesso. Permission: governance.manage.',
  })
  @ApiSuccess(ControlMutationResponse, 201, 'Definição criada com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async createGovernanceControl(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Body() input: CreateControlDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.frameworks.control(actor(req), ws, id, null, input);
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${ws}/governance/frameworks/${id}/controls`,
    );
    return data;
  }
  @Patch('frameworks/:id/controls/:childId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateGovernanceControl',
    summary: 'Definição atualizada com sucesso. Permission: governance.manage.',
  })
  @ApiSuccess(ControlMutationResponse, 200, 'Definição atualizada com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async updateGovernanceControl(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Param('childId') childId: string,
    @Body() input: UpdateControlDto,
  ) {
    return this.frameworks.control(actor(req), ws, id, childId, input);
  }
  @Post('assessments/:id/start')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'startGovernanceAssessment',
    summary: 'Avaliação iniciada com sucesso. Permission: governance.assess.',
  })
  @ApiSuccess(AssessmentResponse, 200, 'Avaliação iniciada com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async startGovernanceAssessment(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Body() input: VersionDto,
  ) {
    return this.assessments.start(actor(req), ws, id, input.version);
  }
  @Get('assessments/:id/controls')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listGovernanceControlAssessments',
    summary:
      'Controles avaliados consultados com sucesso. Permission: governance.read.',
  })
  @ApiListSuccess(
    ControlAssessmentResponse,
    'Controles avaliados consultados com sucesso.',
  )
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async listGovernanceControlAssessments(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Query() input: AssessmentControlQuery,
  ) {
    return this.assessments.controls(actor(req), ws, id, input);
  }
  @Put('assessments/:id/controls/:controlId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'assessGovernanceControl',
    summary: 'Controle avaliado com sucesso. Permission: governance.assess.',
  })
  @ApiSuccess(AssessmentResponse, 200, 'Controle avaliado com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async assessGovernanceControl(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Param('controlId') controlId: string,
    @Body() input: AssessControlDto,
  ) {
    return this.assessments.assess(actor(req), ws, id, controlId, input);
  }
  @Get('assessments/:id/controls/:controlId/evidence')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listGovernanceEvidence',
    summary: 'Evidências consultadas com sucesso. Permission: governance.read.',
  })
  @ApiListSuccess(EvidenceLinkResponse, 'Evidências consultadas com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async listGovernanceEvidence(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Param('controlId') controlId: string,
    @Query() input: ListQuery,
  ) {
    return this.assessments.evidence(actor(req), ws, id, controlId, input);
  }
  @Post('assessments/:id/controls/:controlId/evidence')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'addGovernanceEvidence',
    summary: 'Evidência adicionada com sucesso. Permission: governance.assess.',
  })
  @ApiSuccess(AssessmentResponse, 200, 'Evidência adicionada com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async addGovernanceEvidence(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Param('controlId') controlId: string,
    @Body() input: AddEvidenceDto,
  ) {
    return this.assessments.addEvidence(actor(req), ws, id, controlId, input);
  }
  @Delete('assessments/:id/controls/:controlId/evidence/:evidenceId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'removeGovernanceEvidence',
    summary: 'Evidência removida com sucesso. Permission: governance.assess.',
  })
  @ApiSuccess(AssessmentResponse, 200, 'Evidência removida com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async removeGovernanceEvidence(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Param('controlId') controlId: string,
    @Param('evidenceId') evidenceId: string,
    @Body() input: VersionDto,
  ) {
    return this.assessments.removeEvidence(
      actor(req),
      ws,
      id,
      controlId,
      evidenceId,
      input.version,
    );
  }
  @Post('assessments/:id/close')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'closeGovernanceAssessment',
    summary: 'Avaliação fechada com sucesso. Permission: governance.assess.',
  })
  @ApiSuccess(AssessmentResponse, 200, 'Avaliação fechada com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async closeGovernanceAssessment(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Body() input: VersionDto,
  ) {
    return this.assessments.close(actor(req), ws, id, input.version);
  }
  @Post('goals/:id/calculate')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'calculateGovernanceGoal',
    summary: 'Meta calculada com sucesso. Permission: governance.manage.',
    description:
      'Conclusão da meta por ações: DONE / ações não CANCELLED; sem ações válidas não atinge. status e actionProgress refletem os vínculos atuais. Métrica lastResult permanece informativa e não altera frameworks.',
  })
  @ApiSuccess(GovernanceGoalResponse, 200, 'Meta calculada com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async calculateGovernanceGoal(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Body() input: VersionDto,
  ) {
    return this.goals.calculate(actor(req), ws, id, input.version);
  }
  @Post('actions/:id/complete')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'completeGovernanceAction',
    summary: 'Ação concluída com sucesso. Permission: governance.manage.',
    description:
      'Atualiza automaticamente situação e versão das metas vinculadas na mesma transação. Reconsultar metas de origem/destino. Não altera lastResult ou avaliações/frameworks.',
  })
  @ApiSuccess(ActionPlanResponse, 200, 'Ação concluída com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async completeGovernanceAction(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('id') id: string,
    @Body() input: VersionDto,
  ) {
    return this.goals.updateAction(actor(req), ws, id, input, true);
  }
  @Get('metrics')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listGovernanceMetrics',
    summary:
      'Métricas disponíveis consultadas com sucesso. Permission: governance.read.',
  })
  @ApiSuccess(
    MetricsResponse,
    200,
    'Métricas disponíveis consultadas com sucesso.',
  )
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async listGovernanceMetrics(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Query() _input: EmptyBody,
  ) {
    return this.goals.metrics(actor(req), ws);
  }
  @Get('dashboard')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getGovernanceDashboard',
    summary: 'Dashboard consultado com sucesso. Permission: governance.read.',
    description:
      'Conclusão da meta por ações: DONE / ações não CANCELLED; sem ações válidas não atinge. status e actionProgress refletem os vínculos atuais. Métrica lastResult permanece informativa e não altera frameworks.',
  })
  @ApiSuccess(DashboardResponse, 200, 'Dashboard consultado com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async getGovernanceDashboard(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Query() _input: EmptyBody,
  ) {
    return this.goals.dashboard(actor(req), ws);
  }
}
