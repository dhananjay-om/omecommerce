import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../../domain/errors.js';
import { logger } from '../../infrastructure/logger.js';

/** Attach a trace id (W3C-ish) to every request for correlation (plan/03 §6). */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const traceId = (req.header('traceparent') ?? randomUUID()).slice(0, 64);
  res.locals.traceId = traceId;
  res.setHeader('x-trace-id', traceId);
  next();
}

/** 404 for unmatched routes. */
export function notFound(_req: Request, res: Response): void {
  res.status(404).json({
    type: 'https://errors.ome/not-found',
    title: 'Resource not found',
    status: 404,
    traceId: res.locals.traceId,
  });
}

/** RFC 9457 problem+json error handler (plan/03 §3). */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const traceId = res.locals.traceId as string | undefined;
  if (err instanceof DomainError) {
    res.status(err.status).json({
      type: err.type,
      title: err.message,
      status: err.status,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errors: (err as any).errors,
      traceId,
    });
    return;
  }
  logger.error({ err, traceId }, 'unhandled error');
  res.status(500).json({
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    traceId,
  });
}
