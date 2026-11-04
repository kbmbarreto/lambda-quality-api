import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { BearerGuard } from '../../identity/api/bearer-guard.js';
import { WorkspaceRequestGuard } from '../../workspace/api/guards.js';
import { ApiProblems, ApiSuccess } from '../../../shared/http/responses.js';
import type { ApiRequest } from '../../../shared/http/types.js';
import {
  DASHBOARD_OVERVIEW,
  DashboardOverviewService,
} from '../application/overview.js';
import { DashboardOverviewQuery, DashboardOverviewResponse } from './dtos.js';
@ApiTags('Visão geral do produto')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    @Inject(DASHBOARD_OVERVIEW)
    private readonly service: DashboardOverviewService,
  ) {}
  @Get('overview')
  @HttpCode(200)
  @ApiQuery({
    name: 'days',
    required: false,
    description:
      '7, 30 ou 90 dias exatos; ALL consulta todo o histórico autorizado.',
    schema: {
      oneOf: [
        { type: 'integer', enum: [7, 30, 90] },
        { type: 'string', enum: ['ALL'] },
      ],
      default: 30,
    },
  })
  @ApiOperation({
    operationId: 'getDashboardOverview',
    summary: 'Visão geral consultada com sucesso.',
    description:
      'Fontes autorizadas por grants atuais e participação, sem grant global. Somente Workspaces/projetos ativos. Janelas UTC [from,to) de 7/30/90 dias; ALL remove o limite inferior, mantém to=generatedAt e todos os previousValue null. supportedDays anuncia [7,30,90,ALL]. Primeiro instante autorizado de execução, defeito, resultado exercitado ou atividade; from null sem histórico. Limites de blocos preservados. Histórico de catálogo e cobertura indisponível: previousValue null. Cobertura de execução distinta; resultados de Runs criadas no período. activeTestCases: total global ACTIVE não arquivado com testcase.read, independente de days e project.read, antes do limite de projetos. Automação: proporção consolidada de AUTOMATED nessa base. Progresso e situação das metas por ações atuais, sem escrita em GET; lastResult informativo. Frameworks não são alterados. Sem paginação.',
  })
  @ApiSuccess(
    DashboardOverviewResponse,
    200,
    'Visão geral consultada com sucesso.',
  )
  overview(@Query() query: DashboardOverviewQuery, @Req() req: ApiRequest) {
    return this.service.overview(
      { userId: req.identity!.userId, requestId: req.requestId },
      query,
    );
  }
}
