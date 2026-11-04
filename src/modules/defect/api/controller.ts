import { DefectHistoryQuery, DefectHistoryResponse } from './history-dtos.js';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  HttpCode,
  Inject,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import type { ApiRequest } from '../../../shared/http/types.js';
import {
  ApiSuccess,
  ApiListSuccess,
  ApiProblems,
} from '../../../shared/http/responses.js';
import { BearerGuard } from '../../identity/api/bearer-guard.js';
import { WorkspaceRequestGuard } from '../../workspace/api/guards.js';
import { Defects, DEFECTS } from '../application/defects.js';
import {
  CreateDefectDto,
  CreateFailureDefectDto,
  UpdateDefectDto,
  ExternalLinkDto,
  AddDefectAttachmentDto,
  DefectQuery,
  DefectResponse,
  EmptyBody,
  VersionDto,
} from './dtos.js';
const actor = (req: ApiRequest) => ({
  userId: req.identity!.userId,
  requestId: req.requestId,
});
@Controller('workspaces/:workspaceId/projects/:projectId/defects')
@ApiTags('Defeitos')
@ApiBearerAuth('access-token')
@UseGuards(BearerGuard, WorkspaceRequestGuard)
export class DefectController {
  constructor(@Inject(DEFECTS) private readonly defects: Defects) {}
  @Get('')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listDefects',
    summary: 'Defeitos consultados com sucesso. Permission: defect.read.',
  })
  @ApiListSuccess(DefectResponse, 'Defeitos consultados com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async listDefects(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('projectId') projectId: string,
    @Query() input: DefectQuery,
  ) {
    return this.defects.list(actor(req), ws, projectId, input);
  }
  @Post('')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createDefect',
    summary: 'Defeito criado com sucesso. Permission: defect.manage.',
  })
  @ApiSuccess(DefectResponse, 201, 'Defeito criado com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async createDefect(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('projectId') projectId: string,
    @Body() input: CreateDefectDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.defects.create(actor(req), ws, projectId, input);
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${ws}/projects/${projectId}/defects/${data.id}`,
    );
    return data;
  }
  @Post('from-failure')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createDefectFromFailure',
    summary:
      'Defeito criado a partir da falha com sucesso. Permission: defect.manage + testrun.read.',
  })
  @ApiSuccess(
    DefectResponse,
    201,
    'Defeito criado a partir da falha com sucesso.',
  )
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async createDefectFromFailure(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('projectId') projectId: string,
    @Body() input: CreateFailureDefectDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.defects.fromFailure(
      actor(req),
      ws,
      projectId,
      input,
    );
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${ws}/projects/${projectId}/defects/${data.id}`,
    );
    return data;
  }
  @Get(':defectId/history')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'listDefectHistory',
    summary:
      'Histórico do defeito consultado com sucesso. Permission: defect.read.',
    description:
      'Histórico completo paginado, append-only, com criação, comentários, transições e demais alterações do defeito. page/size (até 100), sort createdAt,asc (padrão) ou desc; desempate id,asc. Mesmo acesso do detalhe, inclusive projetos arquivados. Legado recuperado da auditoria preserva autor/data, mas fromStatus/toStatus/comment/displayName são null quando desconhecidos; não fabrica transições nem nomes. Nome de novos eventos é snapshot e não revela email. Não exige grant global de auditoria.',
  })
  @ApiListSuccess(
    DefectHistoryResponse,
    'Histórico do defeito consultado com sucesso.',
  )
  @ApiProblems([400, 401, 403, 404, 500, 503])
  history(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('projectId') projectId: string,
    @Param('defectId') id: string,
    @Query() input: DefectHistoryQuery,
  ) {
    return this.defects.history(actor(req), ws, projectId, id, input);
  }
  @Get(':defectId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getDefect',
    summary: 'Defeito consultado com sucesso. Permission: defect.read.',
  })
  @ApiSuccess(DefectResponse, 200, 'Defeito consultado com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async getDefect(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('projectId') projectId: string,
    @Param('defectId') defectId: string,
    @Query() _input: EmptyBody,
  ) {
    return this.defects.get(actor(req), ws, projectId, defectId);
  }
  @Patch(':defectId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateDefect',
    description:
      'comment opcional, trim 1–10000, texto simples. Aceita somente comentário e incrementa version; status+comentário cria um único evento UPDATED, transacional com alteração/auditoria. Somente status atual sem comentário é no-op. Sem chave de idempotência; após resposta incerta consultar detalhe/histórico antes de reenviar. Toda transição para RESOLVED registra resolvedAt do servidor; CLOSED também registra quando não há resolução anterior. Mesmo estado e edição de metadados/anexos preservam a data. RESOLVED→CLOSED preserva resolução existente; fechamento sem resolução registra o instante atual; OPEN/IN_PROGRESS/REJECTED invalidam. Legados sem datas confiáveis não recebem backfill nem updatedAt como aproximação.',
    summary: 'Defeito atualizado com sucesso. Permission: defect.manage.',
  })
  @ApiSuccess(DefectResponse, 200, 'Defeito atualizado com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async updateDefect(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('projectId') projectId: string,
    @Param('defectId') defectId: string,
    @Body() input: UpdateDefectDto,
  ) {
    return this.defects.update(actor(req), ws, projectId, defectId, input);
  }
  @Post(':defectId/external-link')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'linkDefectExternalIssue',
    summary:
      'Referência externa registrada com sucesso. Permission: defect.manage.',
  })
  @ApiSuccess(DefectResponse, 200, 'Referência externa registrada com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async linkDefectExternalIssue(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('projectId') projectId: string,
    @Param('defectId') defectId: string,
    @Body() input: ExternalLinkDto,
  ) {
    return this.defects.externalLink(
      actor(req),
      ws,
      projectId,
      defectId,
      input,
    );
  }
  @Delete(':defectId/external-link')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'unlinkDefectExternalIssue',
    summary:
      'Referência externa removida com sucesso. Permission: defect.manage.',
  })
  @ApiSuccess(DefectResponse, 200, 'Referência externa removida com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async unlinkDefectExternalIssue(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('projectId') projectId: string,
    @Param('defectId') defectId: string,
    @Body() input: VersionDto,
  ) {
    return this.defects.unlinkExternal(
      actor(req),
      ws,
      projectId,
      defectId,
      input.version,
    );
  }
  @Post(':defectId/attachments')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'addDefectAttachment',
    summary:
      'Anexo associado ao defeito com sucesso. Permission: defect.manage + attachment.read.',
  })
  @ApiSuccess(DefectResponse, 200, 'Anexo associado ao defeito com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async addDefectAttachment(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('projectId') projectId: string,
    @Param('defectId') defectId: string,
    @Body() input: AddDefectAttachmentDto,
  ) {
    return this.defects.attachment(
      actor(req),
      ws,
      projectId,
      defectId,
      input.attachmentId,
      input.version,
      true,
    );
  }
  @Delete(':defectId/attachments/:attachmentId')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'removeDefectAttachment',
    summary:
      'Anexo removido do defeito com sucesso. Permission: defect.manage.',
  })
  @ApiSuccess(DefectResponse, 200, 'Anexo removido do defeito com sucesso.')
  @ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
  async removeDefectAttachment(
    @Req() req: ApiRequest,
    @Param('workspaceId') ws: string,
    @Param('projectId') projectId: string,
    @Param('defectId') defectId: string,
    @Param('attachmentId') attachmentId: string,
    @Body() input: VersionDto,
  ) {
    return this.defects.attachment(
      actor(req),
      ws,
      projectId,
      defectId,
      attachmentId,
      input.version,
      false,
    );
  }
}
