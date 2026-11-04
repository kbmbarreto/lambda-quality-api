import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { IDENTITY_SERVICE, IdentityService } from '../application/identity-service.js';
import { ApplicationError } from '../../../shared/domain/errors.js';
import type { ApiRequest } from '../../../shared/http/types.js';
@Injectable()
export class BearerGuard implements CanActivate {
  constructor(@Inject(IDENTITY_SERVICE) private readonly identity: IdentityService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const header = request.headers.authorization;
    if (!header) throw new ApplicationError(401, 'AUTH_UNAUTHENTICATED', 'Autenticação necessária.');
    const match = /^Bearer ([^\s]+)$/i.exec(header);
    if (!match || match[1].length > 8192) throw new ApplicationError(401, 'AUTH_INVALID_ACCESS_TOKEN', 'Token de acesso inválido.');
    request.identity = await this.identity.authenticate(match[1]);
    return true;
  }
}
