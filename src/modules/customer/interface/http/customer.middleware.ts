import type { Request, Response, NextFunction } from 'express';
import type { CustomerTokenService, CustomerTokenPayload } from '../../domain/ports.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      customer?: CustomerTokenPayload;
    }
  }
}

/**
 * Requires a valid `Authorization: Bearer <token>` customer JWT. Unlike auth's
 * `authenticate`, this is NOT mounted globally on /store/v1 — guest browsing,
 * cart, checkout, and search must stay unauthenticated. Apply it per-route
 * (GET /me, /me/orders, /me/addresses, wishlist routes) instead.
 */
export function authenticateCustomer(tokens: CustomerTokenService) {
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
    req.customer = payload;
    next();
  };
}
