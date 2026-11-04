import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsUUID, ValidateIf, IsIn } from 'class-validator';
import { BearerGuard } from '../../identity/api/bearer-guard.js';
import { WorkspaceRequestGuard } from '../../workspace/api/guards.js';
import type { ApiRequest } from '../../../shared/http/types.js';
import { ApiListSuccess, ApiProblems } from '../../../shared/http/responses.js';
import { ListQuery } from '../../workspace/api/dtos.js';
import {
  DashboardProjects,
  DASHBOARD_PROJECTS,
} from '../application/projects.js';
export class DashboardProjectsQuery extends ListQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_o: unknown, v: unknown) => v !== undefined)
  @IsUUID('4')
  workspaceId?: string;
  @ApiPropertyOptional({
    enum: ['ACTIVE', 'ARCHIVED', 'ALL'],
    default: 'ACTIVE',
  })
  @ValidateIf((_o: unknown, v: unknown) => v !== undefined)
  @IsIn(['ACTIVE', 'ARCHIVED', 'ALL'])
  status?: string;
}
export class DashboardProjectInventoryResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty() workspaceName!: string;
  @ApiProperty() name!: string;
  @ApiProperty() key!: string;
  @ApiProperty({ enum: ['ACTIVE', 'ARCHIVED'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: [String] }) permissions!: string[];
  @ApiProperty({ type: Number, nullable: true, minimum: 0 }) activeTestCases!:
    number | null;
  @ApiProperty({ type: Number, nullable: true, minimum: 0 })
  automatedTestCases!: number | null;
  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 100 })
  automationCoverage!: number | null;
}
@ApiTags('Visão geral do produto')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('dashboard/projects')
export class DashboardProjectsController {
  constructor(
    @Inject(DASHBOARD_PROJECTS) private readonly service: DashboardProjects,
  ) {}
  @Get()
  @ApiOperation({
    operationId: 'listDashboardProjects',
    summary: 'Projetos consultados com sucesso.',
    description:
      'Inventário completo paginado; project.read e participação antes de filtrar/contar/paginar. status ACTIVE por padrão; ARCHIVED/ALL inclui históricos. workspaceId/q; sort name/key/createdAt,asc|desc, padrão name,asc, desempate id ASC. Indicadores ACTIVE/AUTOMATED apenas com testcase.read; null sem grant; zero em contagens autorizadas vazias; cobertura null sem base, até duas casas. Independente de days e sem limite da overview.',
  })
  @ApiListSuccess(
    DashboardProjectInventoryResponse,
    'Projetos consultados com sucesso.',
  )
  list(@Query() query: DashboardProjectsQuery, @Req() req: ApiRequest) {
    return this.service.list(
      { userId: req.identity!.userId, requestId: req.requestId },
      query,
    );
  }
}
