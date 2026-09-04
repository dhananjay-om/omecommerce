import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaMigrationConnectionRepository } from './infrastructure/prisma-migration-connection.repository.js';
import { PrismaMigrationRunRepository } from './infrastructure/prisma-migration-run.repository.js';
import { PrismaAttributeRepository, PrismaAttributeSetRepository } from '../catalog/infrastructure/prisma-product.repository.js';
import { PrismaCategoryRepository } from '../catalog/infrastructure/prisma-category.repository.js';
import { ConnectMigrationSource } from './application/connect-migration-source.usecase.js';
import { GetMigrationConnection } from './application/get-migration-connection.usecase.js';
import { TestMigrationConnection } from './application/test-migration-connection.usecase.js';
import { AnalyzeCatalog } from './application/analyze-catalog.usecase.js';
import { StartCatalogMigration } from './application/start-catalog-migration.usecase.js';
import { GetMigrationRun } from './application/get-migration-run.usecase.js';
import { ListMigrationRuns } from './application/list-migration-runs.usecase.js';
import {
  migrationChannelParamSchema,
  connectMigrationSourceSchema,
  analyzeCatalogSchema,
  migrationRunParamSchema,
  listMigrationRunsQuerySchema,
} from './interface/http/schemas.js';

export interface MigrationRouters {
  admin: Router;
}

export function createMigrationModule(db: Db, authorize: (permission: string) => RequestHandler): MigrationRouters {
  const connections = new PrismaMigrationConnectionRepository(db);
  const runs = new PrismaMigrationRunRepository(db);
  const attributes = new PrismaAttributeRepository(db);
  const attributeSets = new PrismaAttributeSetRepository(db);
  const categories = new PrismaCategoryRepository(db);

  const connectMigrationSource = new ConnectMigrationSource(connections);
  const getMigrationConnection = new GetMigrationConnection(connections);
  const testMigrationConnection = new TestMigrationConnection(connections);
  const analyzeCatalog = new AnalyzeCatalog(db, connections, runs, attributes, attributeSets, categories);
  const startCatalogMigration = new StartCatalogMigration(connections, runs);
  const getMigrationRun = new GetMigrationRun(connections, runs);
  const listMigrationRuns = new ListMigrationRuns(connections, runs);

  const admin = Router();
  const manage = authorize('migration:manage');

  admin.get(
    '/migration/connections/:channel',
    manage,
    asyncHandler(async (req, res) => {
      const { channel } = parse(migrationChannelParamSchema, req.params);
      res.json({ data: await getMigrationConnection.execute(channel) });
    }),
  );

  admin.put(
    '/migration/connections/:channel',
    manage,
    asyncHandler(async (req, res) => {
      const { channel } = parse(migrationChannelParamSchema, req.params);
      const body = parse(connectMigrationSourceSchema, req.body);
      res.json({ data: await connectMigrationSource.execute({ channel, ...body }) });
    }),
  );

  admin.post(
    '/migration/connections/:channel/test',
    manage,
    asyncHandler(async (req, res) => {
      const { channel } = parse(migrationChannelParamSchema, req.params);
      res.json({ data: await testMigrationConnection.execute(channel) });
    }),
  );

  admin.post(
    '/migration/runs',
    manage,
    asyncHandler(async (req, res) => {
      const body = parse(analyzeCatalogSchema, req.body);
      res.status(201).json({ data: await analyzeCatalog.execute({ channel: body.channel }) });
    }),
  );

  admin.post(
    '/migration/runs/:runId/start',
    manage,
    asyncHandler(async (req, res) => {
      const { runId } = parse(migrationRunParamSchema, req.params);
      res.json({ data: await startCatalogMigration.execute(runId) });
    }),
  );

  admin.get(
    '/migration/runs/:runId',
    manage,
    asyncHandler(async (req, res) => {
      const { runId } = parse(migrationRunParamSchema, req.params);
      res.json({ data: await getMigrationRun.execute(runId) });
    }),
  );

  admin.get(
    '/migration/runs',
    manage,
    asyncHandler(async (req, res) => {
      const { channel } = parse(listMigrationRunsQuerySchema, req.query);
      res.json({ data: await listMigrationRuns.execute(channel) });
    }),
  );

  return { admin };
}
