import type { Request, Response, NextFunction } from 'express';
import { IdempotencyService, hashRequestBody } from './idempotency.service.js';
import { prisma } from '../prisma/client.js';

const service = new IdempotencyService(prisma);

/**
 * Guards a route against duplicate submission via the `Idempotency-Key` header
 * (plan/03 §6, plan/00 §4.8). Optional: requests without the header proceed
 * unguarded (idempotency is opt-in from the client's side, standard practice).
 * `routeName` should be a stable identifier for the route (method + path
 * template), not the raw URL, so two different resources under the same route
 * template don't collide — the (route, key) pair together with the client's
 * chosen key is what's unique, so routeName only needs to disambiguate route
 * templates from each other, not individual resources within one template.
 */
export function idempotent(routeName: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.header('Idempotency-Key');
    if (!key) {
      next();
      return;
    }

    const requestHash = hashRequestBody(req.body);
    const result = await service.claim(routeName, key, requestHash);

    if (result.outcome === 'replay') {
      res.status(result.status).json(result.body);
      return;
    }
    if (result.outcome === 'conflict') {
      res.status(409).json({
        type: 'https://errors.ome/idempotency-key-conflict',
        title: 'Idempotency-Key was reused with a different request body',
        status: 409,
        traceId: res.locals.traceId,
      });
      return;
    }
    if (result.outcome === 'in_progress') {
      res.status(409).json({
        type: 'https://errors.ome/idempotency-in-progress',
        title: 'A request with this Idempotency-Key is already being processed',
        status: 409,
        traceId: res.locals.traceId,
      });
      return;
    }

    // Claimed — intercept the eventual response to complete/fail the claim.
    // Client errors (4xx) are deterministic outcomes and are cached for replay,
    // same as success; only 5xx marks FAILED so a retry can re-attempt.
    const originalJson = res.json.bind(res);
    let settled = false;
    res.json = ((body: unknown) => {
      settled = true;
      const finish = res.statusCode >= 500 ? service.fail(routeName, key) : service.complete(routeName, key, res.statusCode, body);
      finish.catch(() => undefined);
      return originalJson(body);
    }) as Response['json'];

    res.on('finish', () => {
      if (settled) return;
      // A response with no JSON body (e.g. res.status(204).send()).
      const finish = res.statusCode >= 500 ? service.fail(routeName, key) : service.complete(routeName, key, res.statusCode, null);
      finish.catch(() => undefined);
    });

    next();
  };
}
