import {
  Controller,
  Get,
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
import type { ApiRequest } from '../../../shared/http/types.js';
import { ApiProblems, ApiSuccess } from '../../../shared/http/responses.js';
import { BearerGuard } from '../../identity/api/bearer-guard.js';
import { WorkspaceRequestGuard } from '../../workspace/api/guards.js';
import {
  DEFECT_ANALYTICS,
  DefectAnalyticsService,
} from '../application/analytics.js';
import {
  DefectAnalyticsQuery,
  DefectAnalyticsResponse,
} from './analytics-dtos.js';
@Controller('workspaces/:workspaceId/defects')
@ApiTags('Defeitos')
@ApiBearerAuth('access-token')
@UseGuards(BearerGuard, WorkspaceRequestGuard)
export class DefectAnalyticsController {
  constructor(
    @Inject(DEFECT_ANALYTICS) private readonly service: DefectAnalyticsService,
  ) {}
  @Get('analytics')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getDefectAnalytics',
    summary:
      'Indicadores de defeitos por mês, projeto e ambiente. Permission: defect.read.',
  })
  @ApiSuccess(
    DefectAnalyticsResponse,
    200,
    'Indicadores de defeitos consultados com sucesso.',
  )
  @ApiProblems([400, 401, 403, 404])
  read(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Query() input: DefectAnalyticsQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.service.read(
      { userId: req.identity!.userId, requestId: req.requestId },
      ws,
      input,
    );
  }
}
