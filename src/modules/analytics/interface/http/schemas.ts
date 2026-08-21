import { z } from 'zod';
import { ALERT_METRIC_CODES, ALERT_COMPARATORS } from '../../application/alert-rule.usecases.js';

const DATE_ONLY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a date, e.g. "2026-07-01"');

export const analyticsDateRangeQuerySchema = z.object({
  dateFrom: DATE_ONLY,
  dateTo: DATE_ONLY,
  websiteId: z.string().regex(/^\d+$/).optional(),
});

export const analyticsTopNQuerySchema = analyticsDateRangeQuerySchema.extend({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const lowStockQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export const createAlertRuleSchema = z.object({
  metricCode: z.enum(ALERT_METRIC_CODES),
  comparator: z.enum(ALERT_COMPARATORS),
  thresholdValue: z.string().regex(/^\d+(\.\d{1,4})?$/, 'expected a plain decimal, e.g. "1000" or "0.05"'),
  windowDays: z.number().int().positive().max(365).optional(),
  recipientEmails: z.array(z.string().email()).min(1).max(20),
  isActive: z.boolean().optional(),
});

export const updateAlertRuleSchema = z.object({
  comparator: z.enum(ALERT_COMPARATORS).optional(),
  thresholdValue: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  windowDays: z.number().int().positive().max(365).optional(),
  recipientEmails: z.array(z.string().email()).min(1).max(20).optional(),
  isActive: z.boolean().optional(),
});
