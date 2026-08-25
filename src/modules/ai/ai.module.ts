import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaAiInsightRepository } from './infrastructure/prisma-ai-insight.repository.js';
import { PrismaAiInsightQueryRepository } from './infrastructure/prisma-ai-insight-query.repository.js';
import { PrismaAiSettingsRepository } from './infrastructure/prisma-ai-settings.repository.js';
import { PrismaProductForecastRepository } from './infrastructure/prisma-product-forecast.repository.js';
import { PrismaProductForecastQueryRepository } from './infrastructure/prisma-product-forecast-query.repository.js';
import { PrismaAnalyticsQueryRepository } from '../analytics/infrastructure/prisma-analytics-query.repository.js';
import { RefreshWebsiteInsights } from './application/refresh-website-insights.usecase.js';
import { RunNightlyAiRefresh } from './application/run-nightly-ai-refresh.usecase.js';
import { RefreshWebsiteForecasts } from './application/refresh-website-forecasts.usecase.js';
import { RunNightlyForecastRefresh } from './application/run-nightly-forecast-refresh.usecase.js';
import { ListInsights } from './application/list-insights.usecase.js';
import { ListForecasts } from './application/list-forecasts.usecase.js';
import { GetAiSettings } from './application/get-ai-settings.usecase.js';
import { UpdateAiSettings } from './application/update-ai-settings.usecase.js';
import { TestAiConnection } from './application/test-ai-connection.usecase.js';
import { ChatWithAssistant } from './application/chat-with-assistant.usecase.js';
import { listInsightsQuerySchema, updateAiSettingsSchema, assistantChatSchema, listForecastsQuerySchema } from './interface/http/schemas.js';
import { todayDateKey } from '../analytics/domain/date-key.js';

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
export function createAiRefreshDeps(db: Db): { runNightlyAiRefresh: RunNightlyAiRefresh; runNightlyForecastRefresh: RunNightlyForecastRefresh } {
  const analyticsQuery = new PrismaAnalyticsQueryRepository(db);
  const aiInsights = new PrismaAiInsightRepository(db, analyticsQuery);
  const refreshWebsiteInsights = new RefreshWebsiteInsights(aiInsights);
  const productForecasts = new PrismaProductForecastRepository(db);
  const refreshWebsiteForecasts = new RefreshWebsiteForecasts(productForecasts);
  return {
    runNightlyAiRefresh: new RunNightlyAiRefresh(aiInsights, refreshWebsiteInsights),
    // Reuses aiInsights.listWebsiteIds() for the website loop (see
    // RunNightlyForecastRefresh's own doc comment) rather than duplicating
    // that method on ProductForecastRepository too.
    runNightlyForecastRefresh: new RunNightlyForecastRefresh(aiInsights, refreshWebsiteForecasts),
  };
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

  // Reuses the exact worker-side composition (createAiRefreshDeps, right
  // above) for the on-demand "Refresh now" buttons — same
  // RunNightlyAiRefresh/RunNightlyForecastRefresh the nightly job calls,
  // just triggered from a request instead of a cron tick, so there's only
  // ever one code path that actually runs the rules/metrics.
  const { runNightlyAiRefresh, runNightlyForecastRefresh } = createAiRefreshDeps(db);

  const forecastsQuery = new PrismaProductForecastQueryRepository(db);
  const listForecasts = new ListForecasts(forecastsQuery);

  const analyticsQuery = new PrismaAnalyticsQueryRepository(db);
  const chatWithAssistant = new ChatWithAssistant(db, analyticsQuery);

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
  admin.post(
    '/ai/insights/refresh',
    view,
    asyncHandler(async (_req, res) => {
      // Today's dateKey, not "yesterday" like the nightly job — someone
      // clicking "Refresh now" wants to see where things stand today,
      // including a partial day, not wait for a fully-closed one.
      await runNightlyAiRefresh.execute(todayDateKey(new Date()));
      res.status(204).send();
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

  admin.post(
    '/ai/assistant/chat',
    view,
    asyncHandler(async (req, res) => {
      const body = parse(assistantChatSchema, req.body);
      res.json({ data: await chatWithAssistant.execute(body) });
    }),
  );

  admin.get(
    '/ai/forecasts',
    view,
    asyncHandler(async (req, res) => {
      res.json({ data: await listForecasts.execute(parse(listForecastsQuerySchema, req.query)) });
    }),
  );
  admin.post(
    '/ai/forecasts/refresh',
    view,
    asyncHandler(async (_req, res) => {
      await runNightlyForecastRefresh.execute(todayDateKey(new Date()));
      res.status(204).send();
    }),
  );

  return { admin };
}
