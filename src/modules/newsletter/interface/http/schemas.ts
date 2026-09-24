import { z } from 'zod';

const EMAIL = z.string().trim().toLowerCase().email().max(254);
const STATUS = z.enum(['SUBSCRIBED', 'UNSUBSCRIBED']);

export const subscribeSchema = z.object({
  email: EMAIL,
  source: z.string().trim().min(1).max(32).optional(),
  websiteCode: z.string().trim().min(1).max(64).optional(),
});

export const unsubscribeSchema = z.object({ token: z.string().min(10).max(128) });

export const adminAddSubscriberSchema = z.object({ email: EMAIL });

export const setStatusSchema = z.object({ status: STATUS });

// `status` is validated as an explicit enum, never z.coerce.*, for the
// same query-string reasons noted elsewhere in this codebase.
export const listSubscribersQuerySchema = z.object({
  search: z.string().optional(),
  status: STATUS.optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
});

export const exportSubscribersQuerySchema = z.object({
  search: z.string().optional(),
  status: STATUS.optional(),
});
