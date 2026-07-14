import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './shared/infrastructure/logger.js';
import { prisma } from './shared/infrastructure/prisma/client.js';
import { redis } from './shared/infrastructure/redis/client.js';

async function main(): Promise<void> {
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'OMEcommerce API listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    server.close();
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
