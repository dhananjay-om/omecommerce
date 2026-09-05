import { z } from 'zod';

/** Normalizes a blank string to undefined — same reasoning as
 *  ai/interface/http/schemas.ts's own blankToUndefined: a form field left
 *  empty on an update means "leave the stored token unchanged," not "set
 *  it to an empty string." */
function blankToUndefined(schema: z.ZodTypeAny) {
  return z.preprocess((v) => (v === '' ? undefined : v), schema);
}

export const migrationChannelParamSchema = z.object({
  channel: z.enum(['SHOPIFY', 'MAGENTO']),
});

export const connectMigrationSourceSchema = z.object({
  storeUrl: z.string().trim().min(1).max(255),
  apiToken: blankToUndefined(z.string().min(1).max(1024).optional()),
  isActive: z.boolean().optional(),
});

export const analyzeMigrationRunSchema = z.object({
  channel: z.enum(['SHOPIFY', 'MAGENTO']),
  dataType: z.enum(['CATALOG', 'CUSTOMER', 'ORDER']),
});

export const migrationRunParamSchema = z.object({
  runId: z.string().uuid(),
});

export const listMigrationRunsQuerySchema = z.object({
  channel: z.enum(['SHOPIFY', 'MAGENTO']),
  // Optional — the Catalog and Customer migration pages each poll their
  // own history separately (two independent Check Migration / Start / Stop
  // flows sharing the same connection), so a run list needs to be
  // filterable by which flow it belongs to, not just which store.
  dataType: z.enum(['CATALOG', 'CUSTOMER', 'ORDER']).optional(),
});
