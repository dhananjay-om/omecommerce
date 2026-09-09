import { z } from 'zod';

export const listJobRunsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional(),
});
