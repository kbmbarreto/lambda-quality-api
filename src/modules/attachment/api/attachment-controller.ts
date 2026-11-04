import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
import {
  WorkspaceRequestGuard,
  UploadAccessGuard,
} from '../../workspace/api/guards.js';
import { ATTACHMENTS, Attachments } from '../application/attachments.js';
import { ApplicationError } from '../../../shared/domain/errors.js';
import * as D from '../../workspace/api/dtos.js';
const actor = (req: ApiRequest) => ({
  userId: req.identity!.userId,
  requestId: req.requestId,
});
interface MultipartFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}
// Busboy decodifica os headers multipart como latin1 por padrão.
function multipartFilename(value: string): string {
  if ([...value].some((char) => char.charCodeAt(0) > 255)) return value;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(
      Buffer.from(value, 'latin1'),
    );
  } catch {
    return value;
  }
}
@ApiTags('Anexos')
@ApiBearerAuth('access-token')
@ApiProblems([400, 401, 403, 404, 409, 413, 500, 503])
@UseGuards(BearerGuard, WorkspaceRequestGuard)
@Controller('workspaces/:workspaceId/attachments')
export class AttachmentController {
  constructor(@Inject(ATTACHMENTS) private readonly attachments: Attachments) {}
  @Get()
  @ApiOperation({
    operationId: 'listWorkspaceAttachments',
    summary:
      'Listar biblioteca; sort: createdAt, originalName, sizeBytes; permission: attachment.read',
  })
  @ApiListSuccess(D.AttachmentResponse, 'Anexos consultados com sucesso.')
  list(
    @Param('workspaceId') ws: string,
    @Query() query: D.ListQuery,
    @Req() req: ApiRequest,
  ) {
    return this.attachments.list(actor(req), ws, query);
  }
  @Post()
  @UseGuards(UploadAccessGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      additionalProperties: false,
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    operationId: 'uploadWorkspaceAttachment',
    summary: 'Upload PNG/JPEG/PDF/TXT/CSV; permission: attachment.upload',
    description:
      'Arquivo privado armazenado no Oracle OCI Object Storage. Multipart file pela API, sem URL pública ou credenciais OCI no cliente. Falhas de configuração, chave PEM, bucket privado ou acesso OCI não impedem a inicialização da API. O upload retorna 503 ATTACHMENT_STORAGE_UNAVAILABLE com detail: Não foi possível anexar o arquivo. O serviço de armazenamento está temporariamente indisponível. Tente novamente mais tarde. Nenhum metadado é criado em falha do storage.',
  })
  @ApiSuccess(D.AttachmentResponse, 201, 'Anexo enviado com sucesso.')
  async upload(
    @Param('workspaceId') ws: string,
    @UploadedFile() file: MultipartFile | undefined,
    @Body() _body: D.EmptyBody,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!file)
      throw new ApplicationError(
        400,
        'ATTACHMENT_FILE_REQUIRED',
        'Envie um arquivo no campo file.',
      );
    const row = await this.attachments.upload(actor(req), ws, {
      originalName: multipartFilename(file.originalname),
      contentType: file.mimetype,
      bytes: file.buffer,
    });
    res.setHeader('Location', `/api/v1/workspaces/${ws}/attachments/${row.id}`);
    return row;
  }
  @Get(':attachmentId')
  @ApiOperation({
    operationId: 'getWorkspaceAttachment',
    summary: 'Consultar metadados do anexo; permission: attachment.read',
  })
  @ApiSuccess(D.AttachmentResponse, 200, 'Anexo consultado com sucesso.')
  get(
    @Param('workspaceId') ws: string,
    @Param('attachmentId') id: string,
    @Query() _query: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.attachments.get(actor(req), ws, id);
  }
  @Get(':attachmentId/download')
  @ApiOperation({
    operationId: 'downloadWorkspaceAttachment',
    summary: 'Baixar arquivo privado; permission: attachment.read',
    description:
      'Stream privado do Oracle OCI pela API após autorização no Workspace. Sem redirecionamento ou URL pública; falha de configuração, chave ou acesso ao armazenamento retorna 503 ATTACHMENT_STORAGE_UNAVAILABLE sem impedir as demais funções da API. Se o stream já iniciou, uma falha interrompe a transferência.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Bytes do arquivo, sem envelope JSON; Content-Disposition: attachment.',
    content: Object.fromEntries(
      [
        'image/png',
        'image/jpeg',
        'application/pdf',
        'text/plain',
        'text/csv',
      ].map((type) => [type, { schema: { type: 'string', format: 'binary' } }]),
    ),
  })
  async download(
    @Param('workspaceId') ws: string,
    @Param('attachmentId') id: string,
    @Query() _query: D.EmptyBody,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.attachments.download(actor(req), ws, id);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const filename = encodeURIComponent(result.file.originalName).replace(
      /[!'()*]/g,
      (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return new StreamableFile(result.stream, {
      type: result.file.contentType,
      length: result.file.sizeBytes,
      disposition: `attachment; filename*=UTF-8''${filename}`,
    });
  }
  @Delete(':attachmentId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteWorkspaceAttachment',
    summary: 'Excluir logicamente; permission: attachment.delete',
  })
  @ApiResponse({ status: 204, description: 'Anexo excluído; sem corpo.' })
  remove(
    @Param('workspaceId') ws: string,
    @Param('attachmentId') id: string,
    @Body() _body: D.EmptyBody,
    @Req() req: ApiRequest,
  ) {
    return this.attachments.remove(actor(req), ws, id);
  }
}
