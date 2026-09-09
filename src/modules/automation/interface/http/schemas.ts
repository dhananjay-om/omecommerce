import { z } from 'zod';

export const listJobRunsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional(),
});

export const TRIGGER_TYPES = [
  'ORDER_PLACED',
  'ORDER_PAID',
  'ORDER_CANCELLED',
  'ORDER_REFUNDED',
  'ORDER_SHIPPED',
  'ORDER_CLOSED',
  'STOCK_CHANGED',
  'CUSTOMER_REGISTERED',
] as const;

const conditionSchema = z.object({
  field: z.string().min(1).max(64),
  comparator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains']),
  value: z.string().max(256),
});

const actionSchema = z.object({
  type: z.enum(['EMAIL', 'WEBHOOK', 'ORDER_NOTE']),
  config: z.record(z.string(), z.string().max(4000)).default({}),
});

export const createAutomationRuleSchema = z.object({
  name: z.string().trim().min(1).max(256),
  description: z.string().max(1024).nullish(),
  triggerType: z.enum(TRIGGER_TYPES),
  conditions: z.array(conditionSchema).max(10).default([]),
  actions: z.array(actionSchema).min(1).max(10),
  isActive: z.boolean().optional(),
});

export const updateAutomationRuleSchema = z.object({
  name: z.string().trim().min(1).max(256).optional(),
  description: z.string().max(1024).nullish(),
  conditions: z.array(conditionSchema).max(10).optional(),
  actions: z.array(actionSchema).min(1).max(10).optional(),
  isActive: z.boolean().optional(),
});

export const listAutomationRuleRunsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional(),
});
