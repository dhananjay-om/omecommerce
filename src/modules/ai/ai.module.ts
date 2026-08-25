import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaAiInsightRepository } from './infrastructure/prisma-ai-insight.repository.js';
import { PrismaAiInsightQueryRepository } from './infrastructure/prisma-ai-insight-query.repository.js';
import { PrismaAiSettingsRepository } from './infrastructure/prisma-ai-settings.repository.js';
import { PrismaAnalyticsQueryRepository } from '../analytics/infrastructure/prisma-analytics-query.repository.js';
import { RefreshWebsiteInsights } from './application/refresh-website-insights.usecase.js';
import { RunNightlyAiRefresh } from './application/run-nightly-ai-refresh.usecase.js';
import { ListInsights } from './application/list-insights.usecase.js';
import { GetAiSettings } from './application/get-ai-settings.usecase.js';
import { UpdateAiSettings } from './application/update-ai-settings.usecase.js';
import { TestAiConnection } from './application/test-ai-connection.usecase.js';
import { listInsightsQuerySchema, updateAiSettingsSchema } from './interface/http/schemas.js';

export interface AiRouters {
  admin: Router;
}

/** Worker-side composition root for the nightly AI Insights refresh
 *  (src/workers/ai-refresh.worker.ts) — mirrors analytics.module.ts's
 *  createAnalyticsRefreshDeps(db) shape exactly. Depends on
 *  PrismaAnalyticsQueryRepository directly (the rule engine reads through
 *  it) rather than reaching into analytics.module.ts's own composition —
 *  that module's exported functions build analytics-specific deps
 *  (RefreshWebsiteDay etc.), not a bare query repository, so instantiating
 *  it here directly is simpler than adding an export just for this. */
export function createAiRefreshDeps(db: Db): { runNightlyAiRefresh: RunNightlyAiRefresh } {
  const analyticsQuery = new PrismaAnalyticsQueryRepository(db);
  const aiInsights = new PrismaAiInsightRepository(db, analyticsQuery);
  const refreshWebsiteInsights = new RefreshWebsiteInsights(aiInsights);
  return { runNightlyAiRefresh: new RunNightlyAiRefresh(aiInsights, refreshWebsiteInsights) };
}

/** Composition root for the admin-only AI Insights REST API — mirrors
 *  analytics.module.ts's createAnalyticsModule exactly. The rule engine
 *  itself runs off the request path, in the nightly refresh worker above;
 *  this only reads back what it already computed. */
export function createAiModule(db: Db, authorize: (permission: string) => RequestHandler): AiRouters {
  const aiInsightsQuery = new PrismaAiInsightQueryRepository(db);
  const listInsights = new ListInsights(aiInsightsQuery);

  const aiSettings = new PrismaAiSettingsRepository(db);
  const getAiSettings = new GetAiSettings(aiSettings);
  const updateAiSettings = new UpdateAiSettings(aiSettings);
  const testAiConnection = new TestAiConnection(db);

  const admin = Router();
  const view = authorize('ai:view');
  const manage = authorize('ai:manage');

  admin.get(
    '/ai/insights',
    view,
    asyncHandler(async (req, res) => {
      res.json({ data: await listInsights.execute(parse(listInsightsQuerySchema, req.query)) });
    }),
  );

  admin.get(
    '/ai/settings',
    manage,
    asyncHandler(async (_req, res) => {
      res.json({ data: await getAiSettings.execute() });
    }),
  );
  admin.put(
    '/ai/settings',
    manage,
    asyncHandler(async (req, res) => {
      const body = parse(updateAiSettingsSchema, req.body);
      res.json({ data: await updateAiSettings.execute({ ...body, provider: 'openai' }) });
    }),
  );
  admin.post(
    '/ai/settings/test',
    manage,
    asyncHandler(async (_req, res) => {
      res.json({ data: await testAiConnection.execute() });
    }),
  );

  return { admin };
}
