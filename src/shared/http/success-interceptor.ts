import { Injectable, StreamableFile } from '@nestjs/common';
import { brazilTimestamp, responseDates } from './dates.js';
import { PageResult } from '../application/records.js';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map } from 'rxjs';
import type { Response } from 'express';
import { RESPONSE_MESSAGE } from './responses.js';
import type { ApiRequest } from './types.js';
@Injectable()
export class SuccessInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<ApiRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const message =
      this.reflector.get<string>(RESPONSE_MESSAGE, context.getHandler()) ||
      'Solicitação concluída com sucesso.';
    return next.handle().pipe(
      map((data: unknown) => {
        if (data instanceof StreamableFile) return data;
        if (res.statusCode === 204) return undefined;
        return {
          data: responseDates(data instanceof PageResult ? data.items : data),
          message,
          meta: {
            requestId: req.requestId,
            timestamp: brazilTimestamp(new Date()),
            ...(data instanceof PageResult
              ? { pagination: data.pagination }
              : {}),
          },
        };
      }),
    );
  }
}
