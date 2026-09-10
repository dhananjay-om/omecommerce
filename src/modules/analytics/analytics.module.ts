import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaAnalyticsRepository } from './infrastructure/prisma-analytics.repository.js';
import { PrismaAnalyticsQueryRepository } from './infrastructure/prisma-analytics-query.repository.js';
import { PrismaAlertRuleRepository } from './infrastructure/prisma-alert-rule.repository.js';
import { PrismaSavedReportRepository } from './infrastructure/prisma-saved-report.repository.js';
import { PrismaAdminUserLookup } from '../order/infrastructure/prisma-lookups.js';
import { RefreshWebsiteDay } from './application/refresh-website-day.usecase.js';
import { RunNightlyRefresh } from './application/run-nightly-refresh.usecase.js';
import { EvaluateAlertRules } from './application/evaluate-alert-rules.usecase.js';
import { createNotifyAdminsDeps } from '../notification/notification.module.js';
import {
  GetSalesTrend,
  GetOrderStatusBreakdown,
  GetTopProducts,
  GetTopCategories,
  GetPaymentMethodBreakdown,
  GetReturnsTrend,
  GetFulfillmentTrend,
  GetLowStockNow,
  GetRfmSegments,
  GetReconciliationLog,
  GetCustomerActivityTrend,
  GetTopCustomers,
  GetInventoryTrend,
  GetCouponPerformance,
  GetCouponRedemptionTrend,
  GetReferralFunnel,
  GetTopReferrers,
  GetTaxBreakdown,
  GetStoredValueLiability,
  GetCreditAccountSummary,
} from './application/query-analytics.usecases.js';
import { CreateAlertRule, UpdateAlertRule, ListAlertRules, GetAlertRuleByPublicId, DeleteAlertRule, ListAlertHistory } from './application/alert-rule.usecases.js';
import { RunAdHocReport, reportToCsv } from './application/report-builder.usecase.js';
import { CreateSavedReport, ListSavedReports, DeleteSavedReport } from './application/saved-report.usecases.js';
import { REPORT_METRICS } from './domain/report-metrics.js';
import {
  analyticsDateRangeQuerySchema,
  analyticsTopNQuerySchema,
  lowStockQuerySchema,
  createAlertRuleSchema,
  updateAlertRuleSchema,
  reportRunQuerySchema,
  createSavedReportSchema,
} from './interface/http/schemas.js';

export interface AnalyticsRouters {
  admin: Router;
}

/** Worker-side composition root for the event-driven projector
 *  (src/workers/analytics-projector.worker.ts) — mirrors order.module.ts's
 *  createOrderEmailDeps(db) shape exactly. */
export function createAnalyticsProjectorDeps(db: Db): { refreshWebsiteDay: RefreshWebsiteDay } {
  const analytics = new PrismaAnalyticsRepository(db);
  return { refreshWebsiteDay: new RefreshWebsiteDay(analytics) };
}

/** Worker-side composition root for the nightly batch refresh
 *  (src/workers/analytics-refresh.worker.ts). */
export function createAnalyticsRefreshDeps(db: Db): { runNightlyRefresh: RunNightlyRefresh; evaluateAlertRules: EvaluateAlertRules } {
  const analytics = new PrismaAnalyticsRepository(db);
  const analyticsQuery = new PrismaAnalyticsQueryRepository(db);
  const alertRules = new PrismaAlertRuleRepository(db);
  const refreshWebsiteDay = new RefreshWebsiteDay(analytics);
  const { notifyAdmins } = createNotifyAdminsDeps(db);
  return {
    runNightlyRefresh: new RunNightlyRefresh(analytics, refreshWebsiteDay),
    evaluateAlertRules: new EvaluateAlertRules(alertRules, analyticsQuery, notifyAdmins),
  };
}

/** Composition root for the admin-only Analytics & Reporting REST API
 *  (plan/19 §9) — dashboards read from here; the actual aggregation work
 *  happens off the request path, in the projector/refresh workers above. */
export function createAnalyticsModule(db: Db, authorize: (permission: string) => RequestHandler): AnalyticsRouters {
  const analyticsQuery = new PrismaAnalyticsQueryRepository(db);
  const alertRules = new PrismaAlertRuleRepository(db);
  const savedReports = new PrismaSavedReportRepository(db);

  const getSalesTrend = new GetSalesTrend(analyticsQuery);
  const getOrderStatusBreakdown = new GetOrderStatusBreakdown(analyticsQuery);
  const getTopProducts = new GetTopProducts(analyticsQuery);
  const getTopCategories = new GetTopCategories(analyticsQuery);
  const getPaymentMethodBreakdown = new GetPaymentMethodBreakdown(analyticsQuery);
  const getReturnsTrend = new GetReturnsTrend(analyticsQuery);
  const getFulfillmentTrend = new GetFulfillmentTrend(analyticsQuery);
  const getLowStockNow = new GetLowStockNow(analyticsQuery);
  const getRfmSegments = new GetRfmSegments(analyticsQuery);
  const getReconciliationLog = new GetReconciliationLog(analyticsQuery);
  const getCustomerActivityTrend = new GetCustomerActivityTrend(analyticsQuery);
  const getTopCustomers = new GetTopCustomers(analyticsQuery);
  const getInventoryTrend = new GetInventoryTrend(analyticsQuery);
  const getCouponPerformance = new GetCouponPerformance(analyticsQuery);
  const getCouponRedemptionTrend = new GetCouponRedemptionTrend(analyticsQuery);
  const getReferralFunnel = new GetReferralFunnel(analyticsQuery);
  const getTopReferrers = new GetTopReferrers(analyticsQuery);
  const getTaxBreakdown = new GetTaxBreakdown(analyticsQuery);
  const getStoredValueLiability = new GetStoredValueLiability(analyticsQuery);
  const getCreditAccountSummary = new GetCreditAccountSummary(analyticsQuery);

  const createAlertRule = new CreateAlertRule(alertRules);
  const updateAlertRule = new UpdateAlertRule(alertRules);
  const listAlertRules = new ListAlertRules(alertRules);
  const getAlertRuleByPublicId = new GetAlertRuleByPublicId(alertRules);
  const deleteAlertRule = new DeleteAlertRule(alertRules);
  const listAlertHistory = new ListAlertHistory(alertRules);

  const runAdHocReport = new RunAdHocReport(analyticsQuery);
  const createSavedReport = new CreateSavedReport(savedReports);
  const listSavedReports = new ListSavedReports(savedReports);
  const deleteSavedReport = new DeleteSavedReport(savedReports);
  const adminUserLookup = new PrismaAdminUserLookup(db);

  const admin = Router();
  const view = authorize('analytics:view');
  const manageAlerts = authorize('alerts:manage');
  const exportReports = authorize('reports:export');

  admin.get(
    '/analytics/sales',
    view,
    asyncHandler(async (req, res) => {
      res.json({ data: await getSalesTrend.execute(parse(analyticsDateRangeQuerySchema, req.query)) });
    }),
  );
  admin.get(
    '/analytics/order-status',
    view,
    asyncHandler(async (req, res) => {
      res.json({ data: await getOrderStatusBreakdown.execute(parse(analyticsDateRangeQuerySchema, req.query)) });
    }),
  );
  admin.get(
    '/analytics/top-products',
    view,
    asyncHandler(async (req, res) => {
      const query = parse(analyticsTopNQuerySchema, req.query);
      res.json({ data: await getTopProducts.execute(query, query.limit ?? 10) });
    }),
  );
  admin.get(
    '/analytics/top-categories',
    view,
    asyncHandler(async (req, res) => {
      const query = parse(analyticsTopNQuerySchema, req.query);
      res.json({ data: await getTopCategories.execute(query, query.limit ?? 10) });
    }),
  );
  admin.get(
    '/analytics/payment-methods',
    view,
    asyncHandler(async (req, res) => {
      res.json({ data: await getPaymentMethodBreakdown.execute(parse(analyticsDateRangeQuerySchema, req.query)) });
    }),
  );
  admin.get(
    '/analytics/returns',
    view,
    asyncHandler(async (req, res) => {
      res.json({ data: await getReturnsTrend.execute(parse(analyticsDateRangeQuerySchema, req.query)) });
    }),
  );
  admin.get(
    '/analytics/fulfillment',
    view,
    asyncHandler(async (req, res) => {
      res.json({ data: await getFulfillmentTrend.execute(parse(analyticsDateRangeQuerySchema, req.query)) });
    }),
  );
  admin.get(
    '/analytics/inventory/low-stock',
    view,
    asyncHandler(async (req, res) => {
      const query = parse(lowStockQuerySchema, req.query);
      res.json({ data: await getLowStockNow.execute(query.limit ?? 50) });
    }),
  );
  admin.get(
    '/analytics/customers/rfm',
    view,
    asyncHandler(async (_req, res) => {
      res.json({ data: await getRfmSegments.execute() });
    }),
  );
  admin.get(
    '/analytics/reconciliation',
    view,
    asyncHandler(async (req, res) => {
      res.json({ data: await getReconciliationLog.execute(parse(analyticsDateRangeQuerySchema, req.query)) });
    }),
  );
  admin.get(
    '/analytics/customers/activity',
    view,
    asyncHandler(async (req, res) => {
      res.json({ data: await getCustomerActivityTrend.execute(parse(analyticsDateRangeQuerySchema, req.query)) });
    }),
  );
  admin.get(
    '/analytics/customers/top',
    view,
    asyncHandler(async (req, res) => {
      const query = parse(analyticsTopNQuerySchema, req.query);
      res.json({ data: await getTopCustomers.execute(query, query.limit ?? 10) });
    }),
  );
  admin.get(
    '/analytics/inventory/trend',
    view,
    asyncHandler(async (req, res) => {
      res.json({ data: await getInventoryTrend.execute(parse(analyticsDateRangeQuerySchema, req.query)) });
    }),
  );

  admin.get(
    '/analytics/alert-rules',
    manageAlerts,
    asyncHandler(async (_req, res) => {
      res.json({ data: await listAlertRules.execute() });
    }),
  );
  admin.get(
    '/analytics/alert-rules/:publicId',
    manageAlerts,
    asyncHandler(async (req, res) => {
      res.json({ data: await getAlertRuleByPublicId.execute(req.params.publicId!) });
    }),
  );
  admin.get(
    '/analytics/alert-rules/:publicId/history',
    manageAlerts,
    asyncHandler(async (req, res) => {
      res.json({ data: await listAlertHistory.execute(req.params.publicId!) });
    }),
  );
  admin.post(
    '/analytics/alert-rules',
    manageAlerts,
    asyncHandler(async (req, res) => {
      const body = parse(createAlertRuleSchema, req.body);
      res.status(201).json({ data: await createAlertRule.execute(body) });
    }),
  );
  admin.put(
    '/analytics/alert-rules/:publicId',
    manageAlerts,
    asyncHandler(async (req, res) => {
      const body = parse(updateAlertRuleSchema, req.body);
      res.json({ data: await updateAlertRule.execute({ publicId: req.params.publicId!, ...body }) });
    }),
  );
  admin.delete(
    '/analytics/alert-rules/:publicId',
    manageAlerts,
    asyncHandler(async (req, res) => {
      await deleteAlertRule.execute(req.params.publicId!);
      res.status(204).send();
    }),
  );

  // --- Marketing Analytics ---------------------------------------------
  admin.get(
    '/analytics/marketing/coupons',
    view,
    asyncHandler(async (req, res) => {
      const query = parse(analyticsTopNQuerySchema, req.query);
      res.json({ data: await getCouponPerformance.execute(query, query.limit ?? 10) });
    }),
  );
  admin.get(
    '/analytics/marketing/coupon-trend',
    view,
    asyncHandler(async (req, res) => {
      res.json({ data: await getCouponRedemptionTrend.execute(parse(analyticsDateRangeQuerySchema, req.query)) });
    }),
  );
  admin.get(
    '/analytics/marketing/referral-funnel',
    view,
    asyncHandler(async (req, res) => {
      res.json({ data: await getReferralFunnel.execute(parse(analyticsDateRangeQuerySchema, req.query)) });
    }),
  );
  admin.get(
    '/analytics/marketing/top-referrers',
    view,
    asyncHandler(async (req, res) => {
      const query = parse(analyticsTopNQuerySchema, req.query);
      res.json({ data: await getTopReferrers.execute(query, query.limit ?? 10) });
    }),
  );

  // --- Financial Analytics ---------------------------------------------
  admin.get(
    '/analytics/financial/tax-breakdown',
    view,
    asyncHandler(async (req, res) => {
      res.json({ data: await getTaxBreakdown.execute(parse(analyticsDateRangeQuerySchema, req.query)) });
    }),
  );
  admin.get(
    '/analytics/financial/stored-value-liability',
    view,
    asyncHandler(async (_req, res) => {
      res.json({ data: await getStoredValueLiability.execute() });
    }),
  );
  admin.get(
    '/analytics/financial/credit-accounts',
    view,
    asyncHandler(async (_req, res) => {
      res.json({ data: await getCreditAccountSummary.execute() });
    }),
  );

  // --- Report Builder ----------------------------------------------------
  admin.get(
    '/analytics/report-metrics',
    view,
    asyncHandler(async (_req, res) => {
      res.json({ data: REPORT_METRICS });
    }),
  );
  admin.get(
    '/analytics/reports/run',
    view,
    asyncHandler(async (req, res) => {
      const query = parse(reportRunQuerySchema, req.query);
      res.json({ data: await runAdHocReport.execute(query.metricCode, query, query.limit ?? 20) });
    }),
  );
  // Separate permission from `view` — reports:export existed in the
  // catalog, unused by any feature, until this route.
  admin.get(
    '/analytics/reports/export',
    exportReports,
    asyncHandler(async (req, res) => {
      const query = parse(reportRunQuerySchema, req.query);
      const result = await runAdHocReport.execute(query.metricCode, query, query.limit ?? 1000);
      const csv = reportToCsv(result);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.metricCode.toLowerCase()}.csv"`);
      res.send(csv);
    }),
  );
  admin.get(
    '/analytics/saved-reports',
    view,
    asyncHandler(async (_req, res) => {
      res.json({ data: await listSavedReports.execute() });
    }),
  );
  admin.post(
    '/analytics/saved-reports',
    view,
    asyncHandler(async (req, res) => {
      const body = parse(createSavedReportSchema, req.body);
      const actor = await adminUserLookup.findByPublicId(req.adminUser!.adminUserPublicId);
      res.status(201).json({ data: await createSavedReport.execute({ ...body, createdBy: actor?.id ?? null }) });
    }),
  );
  admin.delete(
    '/analytics/saved-reports/:publicId',
    view,
    asyncHandler(async (req, res) => {
      await deleteSavedReport.execute(req.params.publicId!);
      res.status(204).send();
    }),
  );

  return { admin };
}
