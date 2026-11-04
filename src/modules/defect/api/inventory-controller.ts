import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
} from '@nestjs/swagger';
import { IsUUID, IsOptional, IsIn, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { BearerGuard } from '../../identity/api/bearer-guard.js';
import { WorkspaceRequestGuard } from '../../workspace/api/guards.js';
import type { ApiRequest } from '../../../shared/http/types.js';
import {
  ApiListSuccess,
  ApiSuccess,
  ApiProblems,
} from '../../../shared/http/responses.js';
import { PageQuery } from '../../workspace/api/dtos.js';
import { DefectEnvironmentResponse } from './dtos.js';
import { DEFECT_STATUSES } from '../domain/models.js';
import { SEVERITIES } from '../../testmanagement/domain/models.js';
import { DefectInventory, DEFECT_INVENTORY } from '../application/inventory.js';
import {
  DefectSummaryService,
  DEFECT_SUMMARY,
} from '../application/summary.js';
import { DefectSummaryResponse } from './summary-dtos.js';
export class DefectInventoryFilterQuery {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  q?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Informe UUID v4 válido.' })
  workspaceId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Informe UUID v4 válido.' })
  projectId?: string;
  @ApiPropertyOptional({ enum: [...DEFECT_STATUSES, 'ALL'] })
  @IsOptional()
  @IsIn([...DEFECT_STATUSES, 'ALL'], {
    message: 'Informe uma situação válida.',
  })
  status?: string;
  @ApiPropertyOptional({ enum: SEVERITIES })
  @IsOptional()
  @IsIn(SEVERITIES, { message: 'Informe uma severidade válida.' })
  severity?: (typeof SEVERITIES)[number];
}
export class DefectInventoryQuery extends IntersectionType(
  PageQuery,
  DefectInventoryFilterQuery,
) {}
export class DefectInventoryResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workspaceId!: string;
  @ApiProperty() workspaceName!: string;
  @ApiProperty({ format: 'uuid' }) projectId!: string;
  @ApiProperty() projectName!: string;
  @ApiProperty() projectKey!: string;
  @ApiProperty({ enum: ['ACTIVE', 'ARCHIVED'] }) projectStatus!: string;
  @ApiProperty() sequence!: number;
  @ApiProperty() humanId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: DEFECT_STATUSES }) status!: string;
  @ApiProperty({ enum: SEVERITIES }) severity!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) environmentId!:
    string | null;
  @ApiProperty({ type: DefectEnvironmentResponse, nullable: true })
  environmentSnapshot!: DefectEnvironmentResponse | null;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: string | null;
}
@ApiTags('Defeitos')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('defects')
export class DefectInventoryController {
  constructor(
    @Inject(DEFECT_INVENTORY) private readonly service: DefectInventory,
    @Inject(DEFECT_SUMMARY) private readonly summary: DefectSummaryService,
  ) {}
  @Get()
  @ApiOperation({
    operationId: 'listDefectInventory',
    summary:
      'Listar todos os defeitos atualmente autorizados, com Workspace/projeto e paginação.',
  })
  @ApiListSuccess(DefectInventoryResponse, 'Defeitos consultados com sucesso.')
  list(@Query() query: DefectInventoryQuery, @Req() req: ApiRequest) {
    return this.service.list(
      { userId: req.identity!.userId, requestId: req.requestId },
      query,
    );
  }
  @Get('summary')
  @ApiOperation({
    operationId: 'getDefectInventorySummary',
    summary: 'Indicadores consultados com sucesso.',
    description:
      'Todo o histórico autorizado, inclusive projetos arquivados; defect.read efetivo e visibilidade antes de filtrar/agregar. workspaceId/projectId/q/status/severity, mesma semântica de GET defects, padrão ALL. Sem paginação/ordenação/datas. Escopo informado não autorizado retorna 404. Todos os estados/categorias, inclusive zeros. Média ponderada por bugs RESOLVED/CLOSED com resolvedAt confiável >=createdAt, em horas UTC corridas, base CREATED_TO_RESOLVED, duas casas. Sem amostra: averageHours=null/sampleSize=0; zero real é zero. Reabertura/rejeição invalida resolução; CLOSED sem resolução anterior registra o instante do fechamento. Legados sem data ficam fora da amostra; edição/anexos não alteram resolvedAt. Erros de banco retornam falha, nunca totais parciais.',
  })
  @ApiSuccess(
    DefectSummaryResponse,
    200,
    'Indicadores consultados com sucesso.',
  )
  readSummary(
    @Query() query: DefectInventoryFilterQuery,
    @Req() req: ApiRequest,
  ) {
    return this.summary.read(
      { userId: req.identity!.userId, requestId: req.requestId },
      query,
    );
  }
}
