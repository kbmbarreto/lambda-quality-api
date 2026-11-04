import {
  Controller,
  Post,
  HttpCode,
  Inject,
  Param,
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
  ApiProperty,
} from '@nestjs/swagger';
import { BearerGuard } from '../../identity/api/bearer-guard.js';
import { WorkspaceRequestGuard } from '../../workspace/api/guards.js';
import type { ApiRequest } from '../../../shared/http/types.js';
import { ApiSuccess, ApiProblems } from '../../../shared/http/responses.js';
import {
  TEST_CASE_IMPORT,
  TestCaseImport,
} from '../application/import-cases.js';
@Injectable()
export class CaseImportGuard implements CanActivate {
  constructor(
    @Inject(TEST_CASE_IMPORT) private readonly service: TestCaseImport,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<ApiRequest>();
    await this.service.authorize(
      { userId: req.identity!.userId, requestId: req.requestId },
      req.params.workspaceId as string,
      req.params.projectId as string,
    );
    return true;
  }
}
class ImportedCaseResponse {
  @ApiProperty() azureId!: string;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() sequence!: number;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) suiteId!: null;
}
class CaseImportResponse {
  @ApiProperty() importedCount!: number;
  @ApiProperty() alreadyImported!: boolean;
  @ApiProperty({ type: [ImportedCaseResponse] }) cases!: ImportedCaseResponse[];
}
@ApiTags('Casos de teste')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard, CaseImportGuard)
@Controller(
  'workspaces/:workspaceId/projects/:projectId/test-cases/import/azure-devops',
)
export class CaseImportController {
  constructor(
    @Inject(TEST_CASE_IMPORT) private readonly service: TestCaseImport,
  ) {}
  @Post()
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
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
          description: 'Somente CSV Azure DevOps UTF-8, até 5 MiB/200 casos.',
        },
      },
    },
  })
  @ApiOperation({
    operationId: 'importAzureDevOpsTestCases',
    summary:
      'Importar casos CSV no projeto, sem suíte; BDD na descrição. Permission: testcase.create.',
    description:
      'Atômico; o mesmo arquivo/projeto retorna o recibo anterior sem duplicação. Sem consulta ao Azure ou criação de plano. Usa padrões DRAFT/MANUAL e valida campos personalizados obrigatórios existentes.',
  })
  @ApiSuccess(CaseImportResponse, 200, 'Casos importados com sucesso.')
  import(
    @Param('workspaceId') ws: string,
    @Param('projectId') projectId: string,
    @Req() req: ApiRequest,
    @UploadedFile() file?: { originalname: string; buffer: Buffer },
  ) {
    return this.service.import(
      { userId: req.identity!.userId, requestId: req.requestId },
      ws,
      projectId,
      file,
    );
  }
}
