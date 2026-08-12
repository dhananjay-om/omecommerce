import type { Request, Response, NextFunction } from 'express';
import type { TokenService, AuthTokenPayload } from '../../domain/ports.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminUser?: AuthTokenPayload;
    }
  }
}

/**
 * Requires a valid `Authorization: Bearer <token>` JWT. Protects the entire
 * `/admin/v1` surface (mounted once in app.ts) — plan/12 §5 "Auth/RBAC before
 * public write endpoints".
 */
export function authenticate(tokens: TokenService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) {
      res.status(401).json({
        type: 'https://errors.ome/unauthenticated',
        title: 'Missing Authorization: Bearer <token> header',
        status: 401,
        traceId: res.locals.traceId,
      });
      return;
    }
    const payload = tokens.verify(token);
    if (!payload) {
      res.status(401).json({
        type: 'https://errors.ome/unauthenticated',
        title: 'Invalid or expired token',
        status: 401,
        traceId: res.locals.traceId,
      });
      return;
    }
    req.adminUser = payload;
    next();
  };
}

/** Requires the authenticated admin to hold a specific permission code. */
export function authorize(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.adminUser?.permissions.includes(permission)) {
      res.status(403).json({
        type: 'https://errors.ome/forbidden',
        title: `missing required permission: ${permission}`,
        status: 403,
        traceId: res.locals.traceId,
      });
      return;
    }
    next();
  };
}
