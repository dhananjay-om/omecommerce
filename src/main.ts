import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './shared/infrastructure/logger.js';
import { prisma } from './shared/infrastructure/prisma/client.js';
import { redis } from './shared/infrastructure/redis/client.js';
import { startWorkers } from './workers/index.js';
import { createSearchModule } from './modules/search/search.module.js';

async function main(): Promise<void> {
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'OMEcommerce API listening');
  });

  // A second, throwaway instance — createApp() already builds its own real
  // one internally for the mounted HTTP routes, but doesn't expose it (its
  // return type is the bare Express app, relied on as-is by every
  // integration test). Constructing routers here that never get mounted is
  // cheap; the `authorize` stub is never invoked since reindexIfEmpty() below
  // calls straight into the usecase, never through an HTTP route/middleware.
  // Wrapped in its own try/catch (not just relying on reindexIfEmpty()'s own
  // internal one) so even a synchronous construction failure — e.g. a
  // misconfigured OpenSearch client — can't take the whole boot down with it.
  try {
    await createSearchModule(prisma, () => (_req, _res, next) => next()).reindexIfEmpty();
  } catch (err) {
    logger.warn({ err }, 'startup search reindex check failed');
  }

  const workers = await startWorkers();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    server.close();
    await workers.stop();
    await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'fatal boot error');
  process.exit(1);
});
