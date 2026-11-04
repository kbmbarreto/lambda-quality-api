import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IDENTITY_STORE } from '../../modules/identity/application/ports.js';
import type { IdentityStore } from '../../modules/identity/application/ports.js';
import { ApplicationError } from '../domain/errors.js';
import { ApiProblems, ApiSuccess } from './responses.js';
class HealthResponse { @ApiProperty({ enum: ['up'] }) status!: string }
@ApiTags('Saúde') @Controller('health')
export class HealthController {
  constructor(@Inject(IDENTITY_STORE) private readonly store: IdentityStore) {}
  @Get('live') @ApiOperation({ operationId: 'liveness', summary: 'Verificar o processo' })
  @ApiSuccess(HealthResponse, 200, 'Aplicação em execução.')
  live() { return { status: 'up' }; }
  @Get('ready') @ApiOperation({ operationId: 'readiness', summary: 'Verificar disponibilidade do banco e tabelas de identidade' })
  @ApiProblems([503]) @ApiSuccess(HealthResponse, 200, 'Aplicação pronta para atender.')
  async ready() {
    try { await this.store.health(); return { status: 'up' }; }
    catch { throw new ApplicationError(503, 'SERVICE_UNAVAILABLE', 'Aplicação temporariamente indisponível.'); }
  }
}
