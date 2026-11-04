import {
  Controller,
  Inject,
  UseGuards,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  Body,
  HttpCode,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { BearerGuard } from '../../identity/api/bearer-guard.js';
import { WorkspaceRequestGuard } from '../../workspace/api/guards.js';
import type { ApiRequest } from '../../../shared/http/types.js';
import {
  ApiListSuccess,
  ApiSuccess,
  ApiProblems,
} from '../../../shared/http/responses.js';
import { TEST_VAULT, TestVault } from '../application/vault.js';
import * as D from './dtos.js';
const actor = (req: ApiRequest) => ({
  userId: req.identity!.userId,
  requestId: req.requestId,
});
@ApiTags('Cofre de testes')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('workspaces/:workspaceId/projects/:projectId/test-vault')
export class VaultController {
  constructor(@Inject(TEST_VAULT) private readonly service: TestVault) {}
  @Get()
  @ApiOperation({
    operationId: 'listTestVaultEntries',
    summary: 'Consultar metadados do cofre. Permission: testvault.read.',
  })
  @ApiListSuccess(
    D.VaultEntryResponse,
    'Registros do cofre consultados com sucesso.',
  )
  list(
    @Param('workspaceId') ws: string,
    @Param('projectId') project: string,
    @Query() input: D.VaultQuery,
    @Req() req: ApiRequest,
  ) {
    return this.service.list(actor(req), ws, project, input);
  }
  @Post()
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createTestVaultEntry',
    summary:
      'Guardar dados de testes criptografados. Permission: testvault.manage.',
  })
  @ApiSuccess(
    D.VaultEntryResponse,
    201,
    'Registro do cofre criado com sucesso.',
  )
  async create(
    @Param('workspaceId') ws: string,
    @Param('projectId') project: string,
    @Body() input: D.CreateVaultDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.create(actor(req), ws, project, input);
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${ws}/projects/${project}/test-vault`,
    );
    return result;
  }
  @Patch(':entryId')
  @ApiOperation({
    operationId: 'updateTestVaultEntry',
    summary:
      'Atualizar dados de testes criptografados. Permission: testvault.manage.',
  })
  @ApiSuccess(
    D.VaultEntryResponse,
    200,
    'Registro do cofre atualizado com sucesso.',
  )
  update(
    @Param('workspaceId') ws: string,
    @Param('projectId') project: string,
    @Param('entryId') id: string,
    @Body() input: D.UpdateVaultDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.update(actor(req), ws, project, id, input);
  }
  @Post(':entryId/reveal')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'revealTestVaultEntry',
    summary:
      'Revelar dados sensíveis, com auditoria. Permission: testvault.reveal.',
    description:
      'Cache-Control: no-store. Não persistir credenciais no navegador/logs; limpar a memória ao fechar ou trocar contexto.',
  })
  @ApiSuccess(
    D.VaultRevealResponse,
    200,
    'Dados do cofre consultados com sucesso.',
  )
  reveal(
    @Param('workspaceId') ws: string,
    @Param('projectId') project: string,
    @Param('entryId') id: string,
    @Body() _input: D.VaultEmptyDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.reveal(actor(req), ws, project, id);
  }
  @Delete(':entryId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteTestVaultEntry',
    summary:
      'Excluir registro do cofre logicamente. Permission: testvault.manage.',
  })
  @ApiResponse({
    status: 204,
    description: 'Registro do cofre excluído com sucesso.',
  })
  remove(
    @Param('workspaceId') ws: string,
    @Param('projectId') project: string,
    @Param('entryId') id: string,
    @Body() input: D.VaultVersionDto,
    @Req() req: ApiRequest,
  ) {
    return this.service.remove(actor(req), ws, project, id, input.version);
  }
}
