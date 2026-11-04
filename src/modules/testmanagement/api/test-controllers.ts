import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  HttpCode,
  Inject,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  applyDecorators,
  SetMetadata,
} from '@nestjs/common';
import type { Type } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { BearerGuard } from '../../identity/api/bearer-guard.js';
import { WorkspaceRequestGuard } from '../../workspace/api/guards.js';
import type { ApiRequest } from '../../../shared/http/types.js';
import {
  ApiSuccess,
  ApiListSuccess,
  ApiProblems,
  ResponseMeta,
  RESPONSE_MESSAGE,
} from '../../../shared/http/responses.js';
import { TEST_SUITES, TestSuites } from '../application/suites.js';
import { TEST_CASES, TestCases } from '../application/cases.js';
import * as D from './dtos.js';
const actor = (req: ApiRequest) => ({
  userId: req.identity!.userId,
  requestId: req.requestId,
});
function arraySuccess(model: Type<unknown>, message: string) {
  return applyDecorators(
    SetMetadata(RESPONSE_MESSAGE, message),
    ApiExtraModels(model, ResponseMeta),
    ApiResponse({
      status: 200,
      description: message,
      schema: {
        type: 'object',
        required: ['data', 'message', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          message: { type: 'string', example: message },
          meta: { $ref: getSchemaPath(ResponseMeta) },
        },
      },
    }),
  );
}

@ApiTags('Suítes de teste')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('workspaces/:workspaceId/projects/:projectId/test-suites')
export class TestSuiteController {
  constructor(@Inject(TEST_SUITES) private readonly service: TestSuites) {}
  @Get('')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listTestSuites',
    summary: 'Suítes consultadas com sucesso. Permission: testcase.read.',
  })
  @ApiListSuccess(D.SuiteResponse, 'Suítes consultadas com sucesso.')
  async listTestSuites(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: D.SuiteQuery,
    @Req() req: ApiRequest,
  ) {
    return this.service.list(actor(req), workspaceId, projectId, query);
  }
  @Post('')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createTestSuite',
    summary: 'Suíte criada com sucesso. Permission: testcase.create.',
  })
  @ApiSuccess(D.SuiteResponse, 201, 'Suíte criada com sucesso.')
  async createTestSuite(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() body: D.CreateSuiteDto,
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
      `/api/v1/workspaces/${workspaceId}/projects/${projectId}/test-suites/${result.id}`,
    );
    return result;
  }
  @Put('order')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'reorderTestSuites',
    summary: 'Suítes ordenadas com sucesso. Permission: testcase.update.',
  })
  @arraySuccess(D.SuiteResponse, 'Suítes ordenadas com sucesso.')
  async reorderTestSuites(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() body: D.ReorderSuitesDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.reorder(actor(req), workspaceId, projectId, body);
  }
  @Get(':suiteId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getTestSuite',
    summary: 'Suíte consultada com sucesso. Permission: testcase.read.',
  })
  @ApiSuccess(D.SuiteResponse, 200, 'Suíte consultada com sucesso.')
  async getTestSuite(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @Query() query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.get(actor(req), workspaceId, projectId, suiteId);
  }
  @Patch(':suiteId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateTestSuite',
    summary: 'Suíte atualizada com sucesso. Permission: testcase.update.',
  })
  @ApiSuccess(D.SuiteResponse, 200, 'Suíte atualizada com sucesso.')
  async updateTestSuite(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @Body() body: D.UpdateSuiteDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.update(
      actor(req),
      workspaceId,
      projectId,
      suiteId,
      body,
    );
  }
  @Post(':suiteId/move')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'moveTestSuite',
    summary: 'Suíte movida com sucesso. Permission: testcase.update.',
  })
  @ApiSuccess(D.SuiteResponse, 200, 'Suíte movida com sucesso.')
  async moveTestSuite(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @Body() body: D.MoveSuiteDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.move(actor(req), workspaceId, projectId, suiteId, body);
  }
  @Post(':suiteId/archive')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'archiveTestSuite',
    summary: 'Suíte arquivada com sucesso. Permission: testcase.archive.',
  })
  @ApiSuccess(D.SuiteResponse, 200, 'Suíte arquivada com sucesso.')
  async archiveTestSuite(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @Body() body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.archive(actor(req), workspaceId, projectId, suiteId);
  }
}

@ApiTags('Casos de teste')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('workspaces/:workspaceId/projects/:projectId/test-cases')
export class TestCaseController {
  constructor(@Inject(TEST_CASES) private readonly service: TestCases) {}
  @Get('')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listTestCases',
    summary: 'Casos consultados com sucesso. Permission: testcase.read.',
  })
  @ApiListSuccess(D.CaseResponse, 'Casos consultados com sucesso.')
  async listTestCases(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: D.CaseQuery,
    @Req() req: ApiRequest,
  ) {
    return this.service.list(actor(req), workspaceId, projectId, query);
  }
  @Post('')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createTestCase',
    summary: 'Caso criado com sucesso. Permission: testcase.create.',
  })
  @ApiSuccess(D.CaseResponse, 201, 'Caso criado com sucesso.')
  async createTestCase(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() body: D.CreateCaseDto,
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
      `/api/v1/workspaces/${workspaceId}/projects/${projectId}/test-cases/${result.id}`,
    );
    return result;
  }
  @Get('summary')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getTestCaseSummary',
    summary:
      'Contagens de casos consultadas com sucesso. Permission: testcase.read.',
    description:
      'Contagens diretas por suíte, incluindo casos sem suíte (suiteId null). Sem status, exclui arquivados; ALL inclui todos. Não recebe paginação, busca ou filtro de suíte. Projetos arquivados permitem consulta.',
  })
  @ApiSuccess(
    D.CaseSummaryResponse,
    200,
    'Contagens de casos consultadas com sucesso.',
  )
  async getTestCaseSummary(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: D.CaseSummaryQuery,
    @Req() req: ApiRequest,
  ) {
    return this.service.summary(actor(req), workspaceId, projectId, query);
  }
  @Get(':caseId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getTestCase',
    summary: 'Caso consultado com sucesso. Permission: testcase.read.',
  })
  @ApiSuccess(D.CaseResponse, 200, 'Caso consultado com sucesso.')
  async getTestCase(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Query() query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.get(actor(req), workspaceId, projectId, caseId);
  }
  @Patch(':caseId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateTestCase',
    summary: 'Caso atualizado com sucesso. Permission: testcase.update.',
  })
  @ApiSuccess(D.CaseResponse, 200, 'Caso atualizado com sucesso.')
  async updateTestCase(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Body() body: D.UpdateCaseDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.update(
      actor(req),
      workspaceId,
      projectId,
      caseId,
      body,
    );
  }
  @Post(':caseId/move')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'moveTestCase',
    summary: 'Caso movido com sucesso. Permission: testcase.update.',
  })
  @ApiSuccess(D.CaseResponse, 200, 'Caso movido com sucesso.')
  async moveTestCase(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Body() body: D.MoveCaseDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.move(actor(req), workspaceId, projectId, caseId, body);
  }
  @Post(':caseId/clone')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'cloneTestCase',
    summary:
      'Caso clonado com sucesso. Permission: testcase.create + testcase.read.',
  })
  @ApiSuccess(D.CaseResponse, 201, 'Caso clonado com sucesso.')
  async cloneTestCase(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Body() body: D.CloneCaseDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.clone(
      actor(req),
      workspaceId,
      projectId,
      caseId,
      body,
    );
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${workspaceId}/projects/${projectId}/test-cases/${result.id}`,
    );
    return result;
  }
  @Post(':caseId/archive')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'archiveTestCase',
    summary: 'Caso arquivado com sucesso. Permission: testcase.archive.',
  })
  @ApiSuccess(D.CaseResponse, 200, 'Caso arquivado com sucesso.')
  async archiveTestCase(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Body() body: D.VersionDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.archive(
      actor(req),
      workspaceId,
      projectId,
      caseId,
      body.version,
    );
  }
  @Post(':caseId/restore')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'restoreTestCase',
    summary: 'Caso restaurado com sucesso. Permission: testcase.archive.',
  })
  @ApiSuccess(D.CaseResponse, 200, 'Caso restaurado com sucesso.')
  async restoreTestCase(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Body() body: D.RestoreCaseDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.restore(
      actor(req),
      workspaceId,
      projectId,
      caseId,
      body,
    );
  }
  @Get(':caseId/steps')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listTestSteps',
    summary: 'Passos consultados com sucesso. Permission: testcase.read.',
  })
  @arraySuccess(D.StepResponse, 'Passos consultados com sucesso.')
  async listTestSteps(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Query() query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.steps(actor(req), workspaceId, projectId, caseId);
  }
  @Post(':caseId/steps')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'addTestStep',
    summary: 'Passo adicionado com sucesso. Permission: testcase.update.',
  })
  @ApiSuccess(D.CaseResponse, 200, 'Passo adicionado com sucesso.')
  async addTestStep(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Body() body: D.CreateStepDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.addStep(
      actor(req),
      workspaceId,
      projectId,
      caseId,
      body,
    );
  }
  @Put(':caseId/steps/order')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'reorderTestSteps',
    summary: 'Passos ordenados com sucesso. Permission: testcase.update.',
  })
  @ApiSuccess(D.CaseResponse, 200, 'Passos ordenados com sucesso.')
  async reorderTestSteps(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Body() body: D.ReorderStepsDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.reorderSteps(
      actor(req),
      workspaceId,
      projectId,
      caseId,
      body,
    );
  }
  @Patch(':caseId/steps/:stepId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateTestStep',
    summary: 'Passo atualizado com sucesso. Permission: testcase.update.',
  })
  @ApiSuccess(D.CaseResponse, 200, 'Passo atualizado com sucesso.')
  async updateTestStep(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Param('stepId') stepId: string,
    @Body() body: D.UpdateStepDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.updateStep(
      actor(req),
      workspaceId,
      projectId,
      caseId,
      stepId,
      body,
    );
  }
  @Delete(':caseId/steps/:stepId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'deleteTestStep',
    summary: 'Passo removido com sucesso. Permission: testcase.update.',
  })
  @ApiSuccess(D.CaseResponse, 200, 'Passo removido com sucesso.')
  async deleteTestStep(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Param('stepId') stepId: string,
    @Body() body: D.VersionDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.removeStep(
      actor(req),
      workspaceId,
      projectId,
      caseId,
      stepId,
      body.version,
    );
  }
  @Put(':caseId/tags/:tagId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'linkTestCaseTag',
    summary: 'Tag vinculada com sucesso. Permission: testcase.update.',
  })
  @ApiSuccess(D.CaseResponse, 200, 'Tag vinculada com sucesso.')
  async linkTestCaseTag(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Param('tagId') tagId: string,
    @Body() body: D.VersionDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.link(
      actor(req),
      workspaceId,
      projectId,
      caseId,
      tagId,
      body.version,
      'tag',
      false,
    );
  }
  @Delete(':caseId/tags/:tagId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'unlinkTestCaseTag',
    summary: 'Tag desvinculada com sucesso. Permission: testcase.update.',
  })
  @ApiSuccess(D.CaseResponse, 200, 'Tag desvinculada com sucesso.')
  async unlinkTestCaseTag(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Param('tagId') tagId: string,
    @Body() body: D.VersionDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.link(
      actor(req),
      workspaceId,
      projectId,
      caseId,
      tagId,
      body.version,
      'tag',
      true,
    );
  }
  @Put(':caseId/attachments/:attachmentId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'linkTestCaseAttachment',
    summary:
      'Anexo vinculado com sucesso. Permission: testcase.update + attachment.read.',
  })
  @ApiSuccess(D.CaseResponse, 200, 'Anexo vinculado com sucesso.')
  async linkTestCaseAttachment(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Param('attachmentId') attachmentId: string,
    @Body() body: D.VersionDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.link(
      actor(req),
      workspaceId,
      projectId,
      caseId,
      attachmentId,
      body.version,
      'attachment',
      false,
    );
  }
  @Delete(':caseId/attachments/:attachmentId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'unlinkTestCaseAttachment',
    summary:
      'Anexo desvinculado com sucesso. Permission: testcase.update + attachment.read.',
  })
  @ApiSuccess(D.CaseResponse, 200, 'Anexo desvinculado com sucesso.')
  async unlinkTestCaseAttachment(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Param('attachmentId') attachmentId: string,
    @Body() body: D.VersionDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.link(
      actor(req),
      workspaceId,
      projectId,
      caseId,
      attachmentId,
      body.version,
      'attachment',
      true,
    );
  }
  @Put(':caseId/custom-fields')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'replaceTestCaseFieldValues',
    summary: 'Valores atualizados com sucesso. Permission: testcase.update.',
  })
  @ApiSuccess(D.CaseResponse, 200, 'Valores atualizados com sucesso.')
  async replaceTestCaseFieldValues(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('caseId') caseId: string,
    @Body() body: D.ValuesDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.putValues(
      actor(req),
      workspaceId,
      projectId,
      caseId,
      body,
    );
  }
}
