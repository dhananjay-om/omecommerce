import { z } from 'zod';

// z.coerce.boolean() on a query-string value is a known footgun in this
// codebase — Boolean("false") is true (any non-empty string is truthy),
// so a literal ?unreadOnly=false would coerce to `true`, the opposite of
// what it says. An explicit enum parsed to a real boolean at the call
// site avoids that class of bug entirely (same fix already applied once
// to the review-moderation isApproved filter).
export const listNotificationsQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
