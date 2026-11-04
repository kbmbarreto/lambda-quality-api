import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  HttpCode,
  Inject,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { BearerGuard } from '../../identity/api/bearer-guard.js';
import { WorkspaceRequestGuard } from '../../workspace/api/guards.js';
import type { ApiRequest } from '../../../shared/http/types.js';
import {
  ApiSuccess,
  ApiListSuccess,
  ApiProblems,
} from '../../../shared/http/responses.js';
import { TEST_PLANS, TestPlans } from '../application/plans.js';
import { TEST_RUNS, TestRuns } from '../application/runs.js';
import * as D from './dtos.js';
const actor = (req: ApiRequest) => ({
  userId: req.identity!.userId,
  requestId: req.requestId,
});
@ApiTags('Planos de teste')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('workspaces/:workspaceId/projects/:projectId/test-plans')
export class TestPlanController {
  constructor(
    @Inject(TEST_PLANS) private readonly service: TestPlans,
    @Inject(TEST_RUNS) private readonly runs: TestRuns,
  ) {}
  @Get('')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listTestPlans',
    summary: 'Planos consultados com sucesso. Permission: testrun.read.',
  })
  @ApiListSuccess(D.PlanResponse, 'Planos consultados com sucesso.')
  async listTestPlans(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: D.PlanQuery,
    @Req() req: ApiRequest,
  ) {
    return this.service.list(actor(req), workspaceId, projectId, query);
  }
  @Post('')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createTestPlan',
    summary: 'Plano criado com sucesso. Permission: testrun.manage.',
  })
  @ApiSuccess(D.PlanResponse, 201, 'Plano criado com sucesso.')
  async createTestPlan(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() body: D.CreatePlanDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.create(
      actor(req),
      workspaceId,
      projectId,
      body,
    );
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${workspaceId}/projects/${projectId}/test-plans/${result.id}`,
    );
    return result;
  }
  @Get(':planId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getTestPlan',
    summary: 'Plano consultado com sucesso. Permission: testrun.read.',
  })
  @ApiSuccess(D.PlanResponse, 200, 'Plano consultado com sucesso.')
  async getTestPlan(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
    @Query() query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.get(actor(req), workspaceId, projectId, planId);
  }
  @Patch(':planId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateTestPlan',
    summary: 'Plano atualizado com sucesso. Permission: testrun.manage.',
  })
  @ApiSuccess(D.PlanResponse, 200, 'Plano atualizado com sucesso.')
  async updateTestPlan(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
    @Body() body: D.UpdatePlanDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.update(
      actor(req),
      workspaceId,
      projectId,
      planId,
      body,
    );
  }
  @Get(':planId/cases')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listTestPlanCases',
    summary: 'Seleção consultada com sucesso. Permission: testrun.read.',
  })
  @ApiListSuccess(D.PlanCaseResponse, 'Seleção consultada com sucesso.')
  async listTestPlanCases(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
    @Query() query: D.PlanCasesQuery,
    @Req() req: ApiRequest,
  ) {
    return this.service.cases(
      actor(req),
      workspaceId,
      projectId,
      planId,
      query,
    );
  }
  @Post(':planId/cases')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'addCaseToPlan',
    summary:
      'Caso selecionado com sucesso. Permission: testrun.manage + testcase.read.',
  })
  @ApiSuccess(D.PlanResponse, 200, 'Caso selecionado com sucesso.')
  async addCaseToPlan(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
    @Body() body: D.AddPlanCaseDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.addCase(
      actor(req),
      workspaceId,
      projectId,
      planId,
      body,
    );
  }
  @Post(':planId/cases/bulk')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'addTestPlanCasesBulk',
    summary:
      'Casos adicionados em lote com sucesso. Permission: testrun.manage + testcase.read.',
    description:
      'Inclusão atômica em plano DRAFT; até 500 casos distintos no total, sem duplicados já selecionados. Ordem do body preservada; incrementa a versão uma vez.',
  })
  @ApiSuccess(D.PlanResponse, 200, 'Casos adicionados em lote com sucesso.')
  addTestPlanCasesBulk(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
    @Body() body: D.AddPlanCasesDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.addCases(
      actor(req),
      workspaceId,
      projectId,
      planId,
      body,
    );
  }
  @Delete(':planId/cases/:caseId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'removeCaseFromPlan',
    summary: 'Caso removido do plano com sucesso. Permission: testrun.manage.',
  })
  @ApiSuccess(D.PlanResponse, 200, 'Caso removido do plano com sucesso.')
  async removeCaseFromPlan(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Body() body: D.VersionDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.removeCase(
      actor(req),
      workspaceId,
      projectId,
      planId,
      caseId,
      body.version,
    );
  }
  @Put(':planId/cases/order')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'reorderTestPlanCases',
    summary: 'Seleção ordenada com sucesso. Permission: testrun.manage.',
  })
  @ApiSuccess(D.PlanResponse, 200, 'Seleção ordenada com sucesso.')
  async reorderTestPlanCases(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
    @Body() body: D.ReorderPlanCasesDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.reorder(
      actor(req),
      workspaceId,
      projectId,
      planId,
      body,
    );
  }
  @Post(':planId/activate')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'activateTestPlan',
    summary:
      'Plano ativado com sucesso. Permission: testrun.manage + testcase.read.',
  })
  @ApiSuccess(D.PlanResponse, 200, 'Plano ativado com sucesso.')
  async activateTestPlan(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
    @Body() body: D.VersionDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.transition(
      actor(req),
      workspaceId,
      projectId,
      planId,
      body.version,
      'ACTIVE',
    );
  }
  @Post(':planId/complete')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'completeTestPlan',
    summary: 'Plano concluído com sucesso. Permission: testrun.manage.',
  })
  @ApiSuccess(D.PlanResponse, 200, 'Plano concluído com sucesso.')
  async completeTestPlan(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
    @Body() body: D.VersionDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.transition(
      actor(req),
      workspaceId,
      projectId,
      planId,
      body.version,
      'COMPLETED',
    );
  }
  @Post(':planId/archive')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'archiveTestPlan',
    summary: 'Plano arquivado com sucesso. Permission: testrun.manage.',
  })
  @ApiSuccess(D.PlanResponse, 200, 'Plano arquivado com sucesso.')
  async archiveTestPlan(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
    @Body() body: D.VersionDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.transition(
      actor(req),
      workspaceId,
      projectId,
      planId,
      body.version,
      'ARCHIVED',
    );
  }
  @Post(':planId/runs')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createTestRunFromPlan',
    summary:
      'Execução criada com sucesso. Permission: testrun.manage + testcase.read.',
  })
  @ApiSuccess(D.RunResponse, 201, 'Execução criada com sucesso.')
  async createTestRunFromPlan(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('planId') planId: string,
    @Body() body: D.CreatePlanRunDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.runs.fromPlan(
      actor(req),
      workspaceId,
      projectId,
      planId,
      body,
    );
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${workspaceId}/projects/${projectId}/test-runs/${result.id}`,
    );
    return result;
  }
}
@ApiTags('Execuções de teste')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('workspaces/:workspaceId/projects/:projectId/test-runs')
export class TestRunController {
  constructor(@Inject(TEST_RUNS) private readonly service: TestRuns) {}
  @Get('')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listTestRuns',
    summary: 'Execuções consultadas com sucesso. Permission: testrun.read.',
  })
  @ApiListSuccess(D.RunResponse, 'Execuções consultadas com sucesso.')
  async listTestRuns(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: D.RunQuery,
    @Req() req: ApiRequest,
  ) {
    return this.service.list(actor(req), workspaceId, projectId, query);
  }
  @Post('')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createAdHocTestRun',
    summary:
      'Execução criada com sucesso. Permission: testrun.manage + testcase.read.',
  })
  @ApiSuccess(D.RunResponse, 201, 'Execução criada com sucesso.')
  async createAdHocTestRun(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() body: D.CreateRunDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.create(
      actor(req),
      workspaceId,
      projectId,
      body,
    );
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${workspaceId}/projects/${projectId}/test-runs/${result.id}`,
    );
    return result;
  }
  @Get(':runId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getTestRun',
    summary: 'Execução consultada com sucesso. Permission: testrun.read.',
  })
  @ApiSuccess(D.RunResponse, 200, 'Execução consultada com sucesso.')
  async getTestRun(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Query() query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.get(actor(req), workspaceId, projectId, runId);
  }
  @Get(':runId/cases')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listTestRunCases',
    summary:
      'Casos da execução consultados com sucesso. Permission: testrun.read.',
  })
  @ApiListSuccess(
    D.RunCaseResponse,
    'Casos da execução consultados com sucesso.',
  )
  async listTestRunCases(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Query() query: D.RunCasesQuery,
    @Req() req: ApiRequest,
  ) {
    return this.service.listCases(
      actor(req),
      workspaceId,
      projectId,
      runId,
      query,
    );
  }
  @Get(':runId/cases/:runCaseId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getTestRunCase',
    summary:
      'Caso da execução consultado com sucesso. Permission: testrun.read.',
  })
  @ApiSuccess(
    D.RunCaseResponse,
    200,
    'Caso da execução consultado com sucesso.',
  )
  async getTestRunCase(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Param('runCaseId') runCaseId: string,
    @Query() query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.getCase(
      actor(req),
      workspaceId,
      projectId,
      runId,
      runCaseId,
    );
  }
  @Post(':runId/start')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'startTestRun',
    summary: 'Execução iniciada com sucesso. Permission: testrun.execute.',
  })
  @ApiSuccess(D.RunResponse, 200, 'Execução iniciada com sucesso.')
  async startTestRun(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Body() body: D.VersionDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.transition(
      actor(req),
      workspaceId,
      projectId,
      runId,
      body.version,
      'IN_PROGRESS',
    );
  }
  @Post(':runId/complete')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'completeTestRun',
    description:
      'Todos os casos precisam de resultado final. PASSED manual exige passos PASSED/SKIPPED; PASSED externo JUNIT auditado pode preservar passos pendentes. Concluir torna a execução imutável.',
    summary: 'Execução concluída com sucesso. Permission: testrun.execute.',
  })
  @ApiSuccess(D.RunResponse, 200, 'Execução concluída com sucesso.')
  async completeTestRun(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Body() body: D.VersionDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.transition(
      actor(req),
      workspaceId,
      projectId,
      runId,
      body.version,
      'COMPLETED',
    );
  }
  @Post(':runId/abort')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'abortTestRun',
    summary: 'Execução abortada com sucesso. Permission: testrun.manage.',
  })
  @ApiSuccess(D.RunResponse, 200, 'Execução abortada com sucesso.')
  async abortTestRun(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Body() body: D.VersionDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.transition(
      actor(req),
      workspaceId,
      projectId,
      runId,
      body.version,
      'ABORTED',
    );
  }
  @Put(':runId/cases/:runCaseId/result')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'recordTestRunCaseResult',
    description:
      'Registro manual: PASSED exige passos PASSED/SKIPPED. Limpa resultOrigin externo para MANUAL e externalResult=null; mantém a regra mesmo após importação JUnit.',
    summary:
      'Resultado do caso registrado com sucesso. Permission: testrun.execute.',
  })
  @ApiSuccess(D.RunResponse, 200, 'Resultado do caso registrado com sucesso.')
  async recordTestRunCaseResult(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Param('runCaseId') runCaseId: string,
    @Body() body: D.ResultDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.caseResult(
      actor(req),
      workspaceId,
      projectId,
      runId,
      runCaseId,
      body,
    );
  }
  @Put(':runId/cases/:runCaseId/steps/:runStepId/result')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'recordTestRunStepResult',
    description:
      'Registro manual de passo invalida o resultado do caso para NOT_TESTED/MANUAL e externalResult=null. Snapshots e recibos de importação anteriores permanecem preservados.',
    summary:
      'Resultado do passo registrado com sucesso. Permission: testrun.execute.',
  })
  @ApiSuccess(D.RunResponse, 200, 'Resultado do passo registrado com sucesso.')
  async recordTestRunStepResult(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Param('runCaseId') runCaseId: string,
    @Param('runStepId') runStepId: string,
    @Body() body: D.StepResultDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.stepResult(
      actor(req),
      workspaceId,
      projectId,
      runId,
      runCaseId,
      runStepId,
      body,
    );
  }
  @Get(':runId/comments')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listExecutionComments',
    summary: 'Comentários consultados com sucesso. Permission: testrun.read.',
  })
  @ApiListSuccess(
    D.ExecutionCommentResponse,
    'Comentários consultados com sucesso.',
  )
  async listExecutionComments(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Query() query: D.CommentQuery,
    @Req() req: ApiRequest,
  ) {
    return this.service.comments(
      actor(req),
      workspaceId,
      projectId,
      runId,
      query,
    );
  }
  @Post(':runId/comments')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'addExecutionComment',
    summary: 'Comentário registrado com sucesso. Permission: testrun.execute.',
  })
  @ApiSuccess(D.RunResponse, 200, 'Comentário registrado com sucesso.')
  async addExecutionComment(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Body() body: D.CommentDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.comment(
      actor(req),
      workspaceId,
      projectId,
      runId,
      body,
    );
  }
}
