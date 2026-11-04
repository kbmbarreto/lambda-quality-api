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
import { RUN_STATUSES } from '../domain/models.js';
import { RunResponse } from './dtos.js';
import { RunInventory, RUN_INVENTORY } from '../application/inventory.js';
export class RunInventoryQuery extends ListQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_o: unknown, v: unknown) => v !== undefined)
  @IsUUID('4')
  workspaceId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_o: unknown, v: unknown) => v !== undefined)
  @IsUUID('4')
  projectId?: string;
  @ApiPropertyOptional({ enum: [...RUN_STATUSES, 'ALL'] })
  @ValidateIf((_o: unknown, v: unknown) => v !== undefined)
  @IsIn([...RUN_STATUSES, 'ALL'])
  status?: string;
}
export class RunInventoryResponse extends RunResponse {
  @ApiProperty() workspaceName!: string;
  @ApiProperty() projectName!: string;
  @ApiProperty() projectKey!: string;
  @ApiProperty({ enum: ['ACTIVE', 'ARCHIVED'] }) projectStatus!: string;
}
@ApiTags('Execuções de teste')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('test-runs')
export class RunInventoryController {
  constructor(@Inject(RUN_INVENTORY) private readonly service: RunInventory) {}
  @Get()
  @ApiOperation({
    operationId: 'listTestRunInventory',
    summary: 'Execuções consultadas com sucesso.',
    description:
      'Inventário paginado de projetos visíveis, incluindo arquivados; testrun.read efetivo antes de filtrar/contar/paginar. workspaceId/projectId/status/q; status omitido ou ALL inclui todos. sort: name/createdAt/startedAt/finishedAt,asc|desc, padrão createdAt,desc; desempate id ASC. Resumos agregados somente da página.',
  })
  @ApiListSuccess(RunInventoryResponse, 'Execuções consultadas com sucesso.')
  list(@Query() query: RunInventoryQuery, @Req() req: ApiRequest) {
    return this.service.list(
      { userId: req.identity!.userId, requestId: req.requestId },
      query,
    );
  }
}
