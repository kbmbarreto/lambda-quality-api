import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { BearerGuard } from '../../identity/api/bearer-guard.js';
import type { ApiRequest } from '../../../shared/http/types.js';
import {
  ApiListSuccess,
  ApiProblems,
  ApiSuccess,
} from '../../../shared/http/responses.js';
import { WorkspaceRequestGuard } from '../../workspace/api/guards.js';
import { CATALOGS, Catalogs } from '../application/catalogs.js';
import * as D from '../../workspace/api/dtos.js';
const actor = (req: ApiRequest) => ({
  userId: req.identity!.userId,
  requestId: req.requestId,
});
@ApiTags('Campos personalizados e tags')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 409, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('workspaces/:workspaceId')
export class CatalogController {
  constructor(@Inject(CATALOGS) private readonly catalogs: Catalogs) {}
  @Get('custom-fields')
  @ApiOperation({
    operationId: 'listCustomFields',
    summary:
      'Listar definições; sort: position, name, createdAt; permission: field.read',
  })
  @ApiListSuccess(D.FieldResponse, 'Campos consultados com sucesso.')
  fields(
    @Param('workspaceId') ws: string,
    @Query() query: D.FieldQuery,
    @Req() req: ApiRequest,
  ) {
    return this.catalogs.fields(actor(req), ws, query);
  }
  @Post('custom-fields')
  @ApiOperation({
    operationId: 'createCustomField',
    summary: 'Criar definição; permission: field.manage',
  })
  @ApiSuccess(D.FieldResponse, 201, 'Campo criado com sucesso.')
  async createField(
    @Param('workspaceId') ws: string,
    @Body() body: D.CreateFieldDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const row = await this.catalogs.createField(actor(req), ws, body);
    res.setHeader(
      'Location',
      `/api/v1/workspaces/${ws}/custom-fields/${row.id}`,
    );
    return row;
  }
  @Get('custom-fields/:fieldId')
  @ApiOperation({
    operationId: 'getCustomField',
    summary: 'Consultar definição de campo',
  })
  @ApiSuccess(D.FieldResponse, 200, 'Campo consultado com sucesso.')
  field(
    @Param('workspaceId') ws: string,
    @Param('fieldId') id: string,
    @Query() _query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.catalogs.field(actor(req), ws, id);
  }
  @Patch('custom-fields/:fieldId')
  @ApiOperation({
    operationId: 'updateCustomField',
    summary:
      'Alterar nome, descrição, obrigatoriedade e posição; permission: field.manage',
  })
  @ApiSuccess(D.FieldResponse, 200, 'Campo atualizado com sucesso.')
  updateField(
    @Param('workspaceId') ws: string,
    @Param('fieldId') id: string,
    @Body() body: D.UpdateFieldDto,
    @Req() req: ApiRequest,
  ) {
    return this.catalogs.updateField(actor(req), ws, id, body);
  }
  @Post('custom-fields/:fieldId/archive')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'archiveCustomField',
    summary:
      'Arquivar definição preservando histórico; permission: field.manage',
  })
  @ApiSuccess(D.FieldResponse, 200, 'Campo arquivado com sucesso.')
  archiveField(
    @Param('workspaceId') ws: string,
    @Param('fieldId') id: string,
    @Body() _body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.catalogs.archiveField(actor(req), ws, id);
  }
  @Get('tags')
  @ApiOperation({
    operationId: 'listWorkspaceTags',
    summary: 'Listar tags; sort: name, createdAt; permission: tag.read',
  })
  @ApiListSuccess(D.TagResponse, 'Tags consultadas com sucesso.')
  tags(
    @Param('workspaceId') ws: string,
    @Query() query: D.ListQuery,
    @Req() req: ApiRequest,
  ) {
    return this.catalogs.tags(actor(req), ws, query);
  }
  @Post('tags')
  @ApiOperation({
    operationId: 'createWorkspaceTag',
    summary: 'Criar tag; permission: tag.manage',
  })
  @ApiSuccess(D.TagResponse, 201, 'Tag criada com sucesso.')
  async createTag(
    @Param('workspaceId') ws: string,
    @Body() body: D.TagDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const row = await this.catalogs.createTag(actor(req), ws, body.name);
    res.setHeader('Location', `/api/v1/workspaces/${ws}/tags/${row.id}`);
    return row;
  }
  @Get('tags/:tagId')
  @ApiOperation({ operationId: 'getWorkspaceTag', summary: 'Consultar tag' })
  @ApiSuccess(D.TagResponse, 200, 'Tag consultada com sucesso.')
  tag(
    @Param('workspaceId') ws: string,
    @Param('tagId') id: string,
    @Query() _query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.catalogs.tag(actor(req), ws, id);
  }
  @Patch('tags/:tagId')
  @ApiOperation({
    operationId: 'updateWorkspaceTag',
    summary: 'Renomear tag; permission: tag.manage',
  })
  @ApiSuccess(D.TagResponse, 200, 'Tag atualizada com sucesso.')
  updateTag(
    @Param('workspaceId') ws: string,
    @Param('tagId') id: string,
    @Body() body: D.TagDto,
    @Req() req: ApiRequest,
  ) {
    return this.catalogs.updateTag(actor(req), ws, id, body.name);
  }
  @Delete('tags/:tagId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteWorkspaceTag',
    summary: 'Remover tag; permission: tag.manage',
  })
  @ApiResponse({ status: 204, description: 'Tag removida; sem corpo.' })
  deleteTag(
    @Param('workspaceId') ws: string,
    @Param('tagId') id: string,
    @Body() _body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.catalogs.removeTag(actor(req), ws, id);
  }
}
