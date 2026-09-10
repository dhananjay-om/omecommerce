import { z } from 'zod';

export const listAuditLogsQuerySchema = z.object({
  entityType: z.string().min(1).max(64).optional(),
  action: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});
