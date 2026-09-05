import type { MigrationChannel, MigrationRunStatus } from '../domain/repositories.js';

export interface MigrationConnectionView {
  channel: MigrationChannel;
  storeUrl: string;
  /** Never the raw token — mirrors AiSettingsView's own hasApiKey convention. */
  hasApiToken: boolean;
  isActive: boolean;
  lastTestedAt: string | null;
  updatedAt: string;
}

export interface ConnectMigrationSourceCommand {
  channel: MigrationChannel;
  storeUrl: string;
  /** Omitted on an update keeps the currently-saved token — same contract
   *  as AI Settings' apiKey. */
  apiToken?: string;
  isActive?: boolean;
}

/** The AI-generated mapping plan (AnalyzeCatalog's output) — built ONCE,
 *  snapshotted onto the MigrationRun row, then applied deterministically by
 *  catalog-migration.worker.ts. See migration-plan-openai.ts's own doc
 *  comment for why this is a single LLM call, not one per product. */
export interface MigrationPlan {
  summary: string;
  totalProducts: number;
  categoryPlan: Array<
    { name: string; action: 'CREATE' } | { name: string; action: 'MATCH_EXISTING'; matchedCategoryName: string }
  >;
  attributePlan: Array<
    | { sourceOptionName: string; action: 'CREATE'; newAttributeCode: string; sampleValues: string[] }
    | { sourceOptionName: string; action: 'MATCH_EXISTING'; matchedAttributeCode: string; sampleValues: string[] }
  >;
  attributeSetPlan: Array<
    | { sourceProductType: string; action: 'CREATE'; newAttributeSetCode: string }
    | { sourceProductType: string; action: 'MATCH_EXISTING'; matchedAttributeSetCode: string }
  >;
  warnings: string[];
}

/** Shared by AnalyzeCatalog and AnalyzeCustomers — both take exactly a
 *  channel, nothing dataType-specific (dataType is decided by which use
 *  case is called, not passed in). */
export interface AnalyzeMigrationCommand {
  channel: MigrationChannel;
}

export interface MigrationRunView {
  publicId: string;
  channel: MigrationChannel;
  dataType: string;
  status: MigrationRunStatus;
  totalItems: number | null;
  processedItems: number;
  skippedItems: number;
  failedItems: number;
  /** Shaped by `dataType` — CATALOG runs carry a MigrationPlan, CUSTOMER
   *  runs a CustomerMigrationPlan. The frontend switches on `dataType`,
   *  same as it already switches on `status`. */
  plan: MigrationPlan | CustomerMigrationPlan | null;
  result: MigrationRunResult | CustomerMigrationRunResult | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** Populated once a run reaches COMPLETED or FAILED. Every skip/failure
 *  names a real reason (see catalog-migration.worker.ts) — never a silent
 *  drop. */
export interface MigrationRunResult {
  categoriesCreated: number;
  attributesCreated: number;
  attributeSetsCreated: number;
  productsCreated: number;
  variantsCreated: number;
  imagesAttached: number;
  skipped: Array<{ sku: string | null; externalId: string; reason: string }>;
  failed: Array<{ sku: string | null; externalId: string; reason: string }>;
  fatalError?: string;
}

/** AnalyzeCustomers' output — deterministic, not AI-generated (see that use
 *  case's own doc comment on why mapping a customer record has no real
 *  ambiguity the way a foreign catalog's attribute/category names do). */
export interface CustomerMigrationPlan {
  summary: string;
  totalCustomers: number;
  sampleSize: number;
  duplicateEmailsInSample: number;
  customersWithoutEmailInSample: number;
  warnings: string[];
}

/** Populated once a CUSTOMER run reaches COMPLETED/FAILED/CANCELLED — same
 *  "every skip/failure names a real reason" contract as MigrationRunResult. */
export interface CustomerMigrationRunResult {
  customersCreated: number;
  addressesCreated: number;
  skipped: Array<{ email: string | null; externalId: string; reason: string }>;
  failed: Array<{ email: string | null; externalId: string; reason: string }>;
  fatalError?: string;
}
