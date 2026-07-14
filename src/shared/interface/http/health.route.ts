import { Router } from 'express';
import { prisma } from '../../infrastructure/prisma/client.js';
import { redis } from '../../infrastructure/redis/client.js';

export const healthRouter = Router();

/** Liveness — process is up. */
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

/** Readiness — dependencies reachable. */
healthRouter.get('/health/ready', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }
  try {
    if (redis.status !== 'ready') await redis.connect().catch(() => undefined);
    const pong = await redis.ping();
    checks.redis = pong === 'PONG' ? 'ok' : 'error';
  } catch {
    checks.redis = 'error';
  }
  const healthy = Object.values(checks).every((v) => v === 'ok');
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ready' : 'degraded', checks });
});
