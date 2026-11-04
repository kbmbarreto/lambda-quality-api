import {
  Controller,
  Get,
  Post,
  HttpCode,
  Inject,
  Param,
  Query,
  Body,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Injectable,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { BearerGuard } from '../../identity/api/bearer-guard.js';
import { WorkspaceRequestGuard } from '../../workspace/api/guards.js';
import type { ApiRequest } from '../../../shared/http/types.js';
import { ApiSuccess, ApiProblems } from '../../../shared/http/responses.js';
import { EmptyBody } from '../../workspace/api/dtos.js';
import {
  RESULT_IMPORTS,
  ResultImports,
} from '../application/result-imports.js';
import {
  ApplyResultImportDto,
  ApplyResultImportResponse,
  ResultImportResponse,
} from './import-dtos.js';
const actor = (req: ApiRequest) => ({
  userId: req.identity!.userId,
  requestId: req.requestId,
});
@Injectable()
export class ResultImportGuard implements CanActivate {
  constructor(
    @Inject(RESULT_IMPORTS) private readonly service: ResultImports,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<ApiRequest>();
    await this.service.authorize(
      actor(req),
      req.params.workspaceId as string,
      req.params.projectId as string,
      req.params.runId as string,
    );
    return true;
  }
}
@ApiTags('Execuções de teste')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller(
  'workspaces/:workspaceId/projects/:projectId/test-runs/:runId/result-imports',
)
export class ResultImportController {
  constructor(
    @Inject(RESULT_IMPORTS) private readonly service: ResultImports,
  ) {}
  @Post('preview')
  @HttpCode(200)
  @UseGuards(ResultImportGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            '.xml JUnit UTF-8, até 2 MiB/500 resultados; sem DTD/entidades.',
        },
      },
    },
  })
  @ApiOperation({
    operationId: 'previewTestRunResultImport',
    summary:
      'Prévia JUnit gerada com sucesso. Permission: testrun.read + testrun.execute.',
    description:
      'Projeto ativo, execução IN_PROGRESS originada de plano. Não altera resultados/versão/passos. Persiste prévia privada por 30 minutos, com nome/hash SHA-256 e resultados, sem guardar XML bruto ou publicar anexos. Identificadores explícitos; sem associação por título. Prévia pertence ao autor.',
  })
  @ApiSuccess(ResultImportResponse, 200, 'Prévia JUnit gerada com sucesso.')
  preview(
    @Param('workspaceId') ws: string,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Req() req: ApiRequest,
    @UploadedFile() file?: { originalname: string; buffer: Buffer },
  ) {
    return this.service.preview(actor(req), ws, projectId, runId, file);
  }
  @Post(':previewId/apply')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'applyTestRunResultImport',
    summary:
      'Resultados JUnit importados com sucesso. Permission: testrun.read + testrun.execute.',
    description:
      'JSON até 128 KiB. Aplicação atômica de até 500 mappings distintos; versão deve coincidir com execução e prévia. overwrite=false; true autoriza substituir. requestKey UUID v4 idempotente por execução; payload divergente gera 409. Resultados externos PASSED aceitam passos pendentes sem alterá-los; mantém comentários e snapshots, não encerra execução. Origem JUNIT audita importação. Replay confirmado não escreve, inclusive após conclusão/arquivamento.',
  })
  @ApiSuccess(
    ApplyResultImportResponse,
    200,
    'Resultados JUnit importados com sucesso.',
  )
  apply(
    @Param('workspaceId') ws: string,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Param('previewId') previewId: string,
    @Body() body: ApplyResultImportDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.apply(
      actor(req),
      ws,
      projectId,
      runId,
      previewId,
      body,
    );
  }
  @Get(':previewId')
  @ApiOperation({
    operationId: 'getTestRunResultImport',
    summary:
      'Importação JUnit consultada com sucesso. Permission: testrun.read.',
    description:
      'Somente o autor da prévia, com acesso atual à execução/projeto. Consulta recibo APPLIED, prévia PREVIEW ou EXPIRED, inclusive após encerramento ou arquivamento, sem recalcular resultados. Confere resposta incerta pelo requestKey/appliedVersion/mappings.',
  })
  @ApiSuccess(
    ResultImportResponse,
    200,
    'Importação JUnit consultada com sucesso.',
  )
  get(
    @Param('workspaceId') ws: string,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Param('previewId') previewId: string,
    @Query() query: EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.service.get(actor(req), ws, projectId, runId, previewId);
  }
}
