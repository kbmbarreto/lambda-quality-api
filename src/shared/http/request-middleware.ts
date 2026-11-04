import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { ApiRequest } from './types.js';
export function requestMiddleware(req: ApiRequest, res: Response, next: NextFunction): void {
  const supplied = req.headers['x-request-id'];
  req.requestId = typeof supplied === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(supplied) ? supplied : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  const start = performance.now();
  res.on('finish', () => {
    if (process.env.NODE_ENV !== 'test') console.log(JSON.stringify({ requestId: req.requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Math.round(performance.now() - start) }));
  });
  next();
}
