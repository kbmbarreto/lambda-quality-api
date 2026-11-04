import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ApplicationError } from '../../../shared/domain/errors.js';
import type { ApiRequest } from '../../../shared/http/types.js';
import type { Response } from 'express';
import { WORKSPACE_ACCESS, WorkspaceAccess } from '../application/access.js';
@Injectable()
export class WorkspaceRequestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Cache-Control', 'no-store');
    const req = context.switchToHttp().getRequest<ApiRequest>();
    for (const value of Object.values(req.params))
      if (
        typeof value !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value,
        )
      )
        throw new ApplicationError(
          400,
          'VALIDATION_ERROR',
          'Informe identificadores UUID v4 válidos.',
        );
    if (req.method !== 'GET' && Object.keys(req.query).length)
      throw new ApplicationError(
        400,
        'VALIDATION_ERROR',
        'Esta operação não aceita parâmetros de consulta.',
      );
    return true;
  }
}
@Injectable()
export class UploadAccessGuard implements CanActivate {
  constructor(
    @Inject(WORKSPACE_ACCESS) private readonly access: WorkspaceAccess,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<ApiRequest>();
    await this.access.run(
      req.params.workspaceId as string,
      { userId: req.identity!.userId, requestId: req.requestId },
      'attachment.upload',
      async () => undefined,
    );
    return true;
  }
}
