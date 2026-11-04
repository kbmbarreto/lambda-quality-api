import { brazilTimestamp } from './dates.js';
import { Catch, HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { ApplicationError } from '../domain/errors.js';
import type { ApiRequest } from './types.js';
@Catch()
export class ProblemFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<ApiRequest>();
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let detail = 'Não foi possível concluir a solicitação.';
    let fields: unknown;
    if (exception instanceof ApplicationError) {
      ({ status, code, message: detail } = exception);
      if (exception.retryAfter)
        res.setHeader('Retry-After', exception.retryAfter);
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code =
        status === 404
          ? 'RESOURCE_NOT_FOUND'
          : status === 400
            ? 'VALIDATION_ERROR'
            : status === 413
              ? 'PAYLOAD_TOO_LARGE'
              : 'HTTP_ERROR';
      detail =
        status === 404
          ? 'Recurso não encontrado.'
          : 'Revise os dados da solicitação.';
      const response = exception.getResponse();
      if (typeof response === 'object' && 'errors' in response)
        fields = response.errors;
    } else if (
      exception instanceof SyntaxError &&
      'status' in exception &&
      exception.status === 400
    ) {
      status = 400;
      code = 'VALIDATION_ERROR';
      detail = 'O corpo da solicitação deve conter JSON válido.';
    } else if (
      typeof exception === 'object' &&
      exception !== null &&
      'type' in exception &&
      exception.type === 'entity.too.large'
    ) {
      status = 413;
      code = 'PAYLOAD_TOO_LARGE';
      detail = 'O corpo da solicitação excede o limite permitido.';
    } else if (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception
    ) {
      if (exception.code === 'P2002') {
        status = 409;
        code = 'RESOURCE_CONFLICT';
        detail = 'Não foi possível concluir a operação devido a um conflito.';
      }
      if (
        ['P1001', 'P1002', 'P1008', 'P1017', 'P2021', 'P2024'].includes(
          String(exception.code),
        )
      ) {
        status = 503;
        code = 'SERVICE_UNAVAILABLE';
        detail = 'Serviço temporariamente indisponível.';
      }
    }
    if (status === 401 && req.headers.authorization)
      res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
    else if (status === 401 && code === 'AUTH_UNAUTHENTICATED')
      res.setHeader('WWW-Authenticate', 'Bearer');
    const title =
      status === 400
        ? 'Dados inválidos'
        : status === 401
          ? 'Autenticação necessária'
          : status === 404
            ? 'Recurso não encontrado'
            : status === 429
              ? 'Limite de solicitações'
              : status >= 500
                ? 'Falha ao processar solicitação'
                : 'Solicitação não concluída';
    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: `urn:lambdaquality:problem:${code.toLowerCase().replaceAll('_', '-')}`,
        title,
        status,
        detail,
        instance: req.path,
        code,
        requestId: req.requestId,
        timestamp: brazilTimestamp(new Date()),
        ...(fields ? { errors: fields } : {}),
      });
  }
}
