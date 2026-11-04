import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { CONFIG } from '../config/config.js';
import type { AppConfig } from '../config/config.js';
import { ApplicationError } from '../domain/errors.js';
import type { ApiRequest } from './types.js';
@Injectable()
export class AuthQueryGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<ApiRequest>();
    if (Object.keys(req.query).length)
      throw new ApplicationError(
        400,
        'VALIDATION_ERROR',
        'Este endpoint não aceita parâmetros de consulta.',
      );
    return true;
  }
}
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly entries = new Map<
    string,
    { count: number; expires: number }
  >();
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<ApiRequest>();
    if (Object.keys(req.query).length)
      throw new ApplicationError(
        400,
        'VALIDATION_ERROR',
        'Este endpoint não aceita parâmetros de consulta.',
      );
    const now = Date.now();
    if (this.entries.size >= 10000) {
      for (const [key, entry] of this.entries)
        if (entry.expires <= now) this.entries.delete(key);
      if (this.entries.size >= 10000)
        throw new ApplicationError(
          429,
          'RATE_LIMIT_EXCEEDED',
          'Muitas solicitações. Aguarde e tente novamente.',
          this.config.rate.window,
        );
    }
    const key = req.ip || 'unknown';
    let entry = this.entries.get(key);
    if (!entry || entry.expires <= now) {
      entry = { count: 0, expires: now + this.config.rate.window * 1000 };
      this.entries.set(key, entry);
    }
    entry.count++;
    if (entry.count > this.config.rate.limit)
      throw new ApplicationError(
        429,
        'RATE_LIMIT_EXCEEDED',
        'Muitas solicitações. Aguarde e tente novamente.',
        Math.ceil((entry.expires - now) / 1000),
      );
    return true;
  }
}
