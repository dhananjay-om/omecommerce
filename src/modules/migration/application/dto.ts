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

export interface AnalyzeCatalogCommand {
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
  plan: MigrationPlan | null;
  result: MigrationRunResult | null;
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
