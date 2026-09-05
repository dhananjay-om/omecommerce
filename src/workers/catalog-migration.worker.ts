import { randomUUID, randomBytes } from 'node:crypto';
import { Worker, type Job } from 'bullmq';
import { CATALOG_MIGRATION_QUEUE } from '../shared/infrastructure/queue/queues.js';
import { getQueueConnectionOptions } from '../shared/infrastructure/queue/connection.js';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { redis } from '../shared/infrastructure/redis/client.js';
import { CacheAside } from '../shared/infrastructure/cache/cache-aside.js';
import { OutboxWriter } from '../shared/infrastructure/outbox/outbox-writer.js';
import { logger } from '../shared/infrastructure/logger.js';
import {
  PrismaProductRepository,
  PrismaAttributeRepository,
  PrismaAttributeSetRepository,
  PrismaProductVariantRepository,
} from '../modules/catalog/infrastructure/prisma-product.repository.js';
import { PrismaProductAttributeStore } from '../modules/catalog/infrastructure/product-attribute.store.js';
import { PrismaCategoryRepository, PrismaProductCategoryRepository } from '../modules/catalog/infrastructure/prisma-category.repository.js';
import { PrismaMediaAssetRepository, PrismaProductMediaRepository } from '../modules/catalog/infrastructure/prisma-media.repository.js';
import { S3MediaStorage } from '../modules/catalog/infrastructure/s3-media-storage.js';
import { CreateProduct } from '../modules/catalog/application/create-product.usecase.js';
import { CreateCategory } from '../modules/catalog/application/create-category.usecase.js';
import { CreateAttribute } from '../modules/catalog/application/create-attribute.usecase.js';
import { CreateAttributeSet } from '../modules/catalog/application/create-attribute-set.usecase.js';
import { CreateAttributeSetGroup } from '../modules/catalog/application/create-attribute-set-group.usecase.js';
import { AssignAttributeToGroup } from '../modules/catalog/application/assign-attribute-to-group.usecase.js';
import { AssignAttributeValue } from '../modules/catalog/application/assign-attribute-value.usecase.js';
import { GenerateProductVariants } from '../modules/catalog/application/generate-product-variants.usecase.js';
import { UpdateProductVariant } from '../modules/catalog/application/update-product-variant.usecase.js';
import { SetProductCategories } from '../modules/catalog/application/set-product-categories.usecase.js';
import { CreateMediaAsset } from '../modules/catalog/application/create-media-asset.usecase.js';
import { AttachProductMedia } from '../modules/catalog/application/attach-product-media.usecase.js';
import { ConflictError } from '../shared/domain/errors.js';
import type { AttributeInfo, AttributeSetInfo, AttributeOptionInfo } from '../modules/catalog/domain/repositories.js';
import { PrismaMigrationRunRepository } from '../modules/migration/infrastructure/prisma-migration-run.repository.js';
import { PrismaMigrationConnectionRepository } from '../modules/migration/infrastructure/prisma-migration-connection.repository.js';
import { PrismaMigrationExternalRefRepository } from '../modules/migration/infrastructure/prisma-migration-external-ref.repository.js';
import { buildSourceClient, buildCustomerSourceClient } from '../modules/migration/infrastructure/source-client-factory.js';
import type { SourceProduct, SourceCustomer } from '../modules/migration/domain/source-client.js';
import type { MigrationPlan, MigrationRunResult, CustomerMigrationRunResult } from '../modules/migration/application/dto.js';
import { PrismaCustomerRepository } from '../modules/customer/infrastructure/prisma-customer.repository.js';
import { PrismaCustomerAddressRepository } from '../modules/customer/infrastructure/prisma-customer-address.repository.js';
import { ScryptPasswordHasher } from '../modules/auth/infrastructure/scrypt-password-hasher.js';

/**
 * The single Worker on CATALOG_MIGRATION_QUEUE (its own queue — see
 * queues.ts's own doc comment on why this doesn't share BULK_JOBS_QUEUE).
 * Two job names now: `migrate-catalog` (runCatalogMigration) and
 * `migrate-customers` (runCustomerMigration), both `{ runId: string }` —
 * dispatched by `job.name` below, same "one Worker, several job types"
 * shape bulk-import.worker.ts already established on BULK_JOBS_QUEUE. They
 * share a queue (and so serialize against each other — BullMQ's default
 * Worker concurrency is 1) but each is its own independent run, gated by
 * its own run row's `dataType`.
 *
 * Applies the plan a prior Analyze call already built DETERMINISTICALLY —
 * no further AI calls happen in this loop for catalog migration (see
 * migration-plan-openai.ts's own doc comment on why the plan is decided
 * once, not per product), and customer migration never used AI to begin
 * with (see analyze-customers.usecase.ts's own doc comment on why): every
 * decision was already made, this just executes it with plain code, the
 * same "reuse the real create use cases, per-row try/catch, progress after
 * each row" shape bulk-import.worker.ts already established for CSV import.
 *
 * Progress is reported BOTH ways: `job.updateProgress()` after every single
 * row (BullMQ-native, cheap, what GetMigrationRun prefers while RUNNING)
 * and a MigrationRun DB row update every 10 rows (a fallback so the row is
 * never wildly stale even if nobody's actively polling the job — not every
 * single row, to avoid hammering Postgres on a large catalog/customer list).
 */
export function startCatalogMigrationWorker(): Worker {
  const products = new PrismaProductRepository(prisma);
  const attributes = new PrismaAttributeRepository(prisma);
  const attributeSets = new PrismaAttributeSetRepository(prisma);
  const attrStore = new PrismaProductAttributeStore(prisma);
  const variants = new PrismaProductVariantRepository(prisma);
  const categories = new PrismaCategoryRepository(prisma);
  const productCategories = new PrismaProductCategoryRepository(prisma);
  const mediaAssets = new PrismaMediaAssetRepository(prisma);
  const productMedia = new PrismaProductMediaRepository(prisma);
  const mediaStorage = new S3MediaStorage();
  const cache = new CacheAside(redis);
  const outbox = new OutboxWriter(prisma);
  const runs = new PrismaMigrationRunRepository(prisma);
  const connections = new PrismaMigrationConnectionRepository(prisma);
  const externalRefs = new PrismaMigrationExternalRefRepository(prisma);

  const deps: Deps = {
    products,
    attributes,
    attributeSets,
    categories,
    runs,
    connections,
    externalRefs,
    createProduct: new CreateProduct(products, outbox, attributes, attrStore),
    createCategory: new CreateCategory(categories),
    createAttribute: new CreateAttribute(attributes),
    createAttributeSet: new CreateAttributeSet(attributeSets),
    createAttributeSetGroup: new CreateAttributeSetGroup(attributeSets),
    assignAttributeToGroup: new AssignAttributeToGroup(attributeSets, attributes),
    assignAttributeValue: new AssignAttributeValue(products, attributes, attrStore, cache, outbox),
    generateProductVariants: new GenerateProductVariants(products, variants, attributeSets, attributes),
    updateProductVariant: new UpdateProductVariant(variants),
    setProductCategories: new SetProductCategories(products, categories, productCategories),
    createMediaAsset: new CreateMediaAsset(mediaAssets),
    attachProductMedia: new AttachProductMedia(products, mediaAssets, productMedia, mediaStorage, outbox),
    mediaStorage,
  };

  const customerDeps: CustomerDeps = {
    runs,
    connections,
    externalRefs,
    customers: new PrismaCustomerRepository(prisma),
    customerAddresses: new PrismaCustomerAddressRepository(prisma),
    passwordHasher: new ScryptPasswordHasher(),
  };

  const worker = new Worker(
    CATALOG_MIGRATION_QUEUE,
    async (job: Job): Promise<MigrationRunResult | CustomerMigrationRunResult> =>
      job.name === 'migrate-customers' ? runCustomerMigration(job, customerDeps) : runCatalogMigration(job, deps),
    { connection: getQueueConnectionOptions() },
  );
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id, jobName: job?.name }, 'data migration job failed'));
  return worker;
}

interface Deps {
  products: PrismaProductRepository;
  attributes: PrismaAttributeRepository;
  attributeSets: PrismaAttributeSetRepository;
  categories: PrismaCategoryRepository;
  runs: PrismaMigrationRunRepository;
  connections: PrismaMigrationConnectionRepository;
  externalRefs: PrismaMigrationExternalRefRepository;
  createProduct: CreateProduct;
  createCategory: CreateCategory;
  createAttribute: CreateAttribute;
  createAttributeSet: CreateAttributeSet;
  createAttributeSetGroup: CreateAttributeSetGroup;
  assignAttributeToGroup: AssignAttributeToGroup;
  assignAttributeValue: AssignAttributeValue;
  generateProductVariants: GenerateProductVariants;
  updateProductVariant: UpdateProductVariant;
  setProductCategories: SetProductCategories;
  createMediaAsset: CreateMediaAsset;
  attachProductMedia: AttachProductMedia;
  mediaStorage: S3MediaStorage;
}

async function runCatalogMigration(job: Job, deps: Deps): Promise<MigrationRunResult> {
  const { runId } = job.data as { runId: string };
  const run = await deps.runs.findById(BigInt(runId));
  if (!run) throw new Error(`migration run ${runId} not found`);
  const connection = await deps.connections.getById(run.connectionId);
  if (!connection) throw new Error(`migration connection ${run.connectionId} not found`);
  const plan = run.planJson as MigrationPlan;
  const client = buildSourceClient(connection.channel, connection.storeUrl, connection.apiToken);

  const result: MigrationRunResult = {
    categoriesCreated: 0,
    attributesCreated: 0,
    attributeSetsCreated: 0,
    productsCreated: 0,
    variantsCreated: 0,
    imagesAttached: 0,
    skipped: [],
    failed: [],
  };

  try {
    const [localCategories, localAttributes, localAttributeSets] = await Promise.all([
      deps.categories.list(),
      deps.attributes.list(),
      deps.attributeSets.listSets(),
    ]);
    const categoryByName = new Map(localCategories.map((c) => [c.nameDefault ?? c.slug, c]));
    const attributeByCode = new Map(localAttributes.map((a) => [a.code, a]));
    const attributeSetByCode = new Map(localAttributeSets.map((s) => [s.code, s]));
    const defaultAttributeSet = localAttributeSets.find((s) => s.isDefault) ?? localAttributeSets[0] ?? null;
    // Duplicate-prevention safety net, independent of the plan's own
    // (code-based) matching: the AI's `newAttributeCode`/`newAttributeSetCode`
    // is free-text and isn't guaranteed to be the same string across two
    // separate Analyze calls for the same real-world concept (e.g. "color"
    // one time, "colour_option" another) — the code-based findByCode/
    // findSetByCode lookup below would miss that and create a genuine
    // duplicate. This catches it by label/name instead (case-insensitive,
    // trimmed) BEFORE ever creating one, no matter what the plan said to
    // do — reusing a real match beats trusting a CREATE decision the plan
    // got wrong, same "never let a model mistake create a duplicate" spirit
    // as normalizePlan's own downgrade-a-hallucinated-match rule.
    const attributeByLabelLower = new Map(localAttributes.map((a) => [a.label.trim().toLowerCase(), a]));
    const attributeSetByNameLower = new Map(localAttributeSets.map((s) => [s.name.trim().toLowerCase(), s]));

    // --- Phase 1: categories (Shopify collections are flat, so every one is root-level) ---
    const categoryPublicIdByExternalId = new Map<string, string>();
    for (const cat of await client.listCategories()) {
      const existingRef = await deps.externalRefs.find(connection.id, 'CATEGORY', cat.externalId);
      if (existingRef) {
        categoryPublicIdByExternalId.set(cat.externalId, existingRef);
        continue;
      }
      const planEntry = plan.categoryPlan.find((c) => c.name === cat.name);
      let localPublicId: string;
      if (planEntry?.action === 'MATCH_EXISTING' && categoryByName.has(planEntry.matchedCategoryName)) {
        localPublicId = categoryByName.get(planEntry.matchedCategoryName)!.publicId;
      } else {
        const created = await deps.createCategory.execute({ nameDefault: cat.name });
        result.categoriesCreated++;
        localPublicId = created.publicId;
      }
      await deps.externalRefs.record(run.id, connection.id, 'CATEGORY', cat.externalId, localPublicId);
      categoryPublicIdByExternalId.set(cat.externalId, localPublicId);
    }

    // --- Phase 2: attribute sets (one per distinct source product type) ---
    const attributeSetByProductType = new Map<string, { id: bigint; groupId: bigint }>();
    for (const entry of plan.attributeSetPlan) {
      let set: AttributeSetInfo;
      const nameLower = entry.sourceProductType.trim().toLowerCase();
      if (entry.action === 'MATCH_EXISTING' && attributeSetByCode.has(entry.matchedAttributeSetCode)) {
        set = attributeSetByCode.get(entry.matchedAttributeSetCode)!;
      } else if (attributeSetByNameLower.has(nameLower)) {
        // The plan said CREATE (or pointed at a code that no longer
        // resolves), but a set with this exact name already exists —
        // reuse it instead of creating a duplicate.
        set = attributeSetByNameLower.get(nameLower)!;
      } else {
        const code = entry.action === 'CREATE' ? entry.newAttributeSetCode : entry.matchedAttributeSetCode;
        const existing = await deps.attributeSets.findSetByCode(code);
        if (existing) {
          set = existing;
        } else {
          const created = await deps.createAttributeSet.execute({ code, name: entry.sourceProductType });
          result.attributeSetsCreated++;
          set = { id: BigInt(created.id), code: created.code, name: created.name, isDefault: created.isDefault };
          attributeSetByCode.set(set.code, set);
          attributeSetByNameLower.set(nameLower, set);
        }
      }
      const existingGroup = await deps.attributeSets.findGroupByName(set.id, 'General');
      const groupId: bigint = existingGroup
        ? existingGroup.id
        : BigInt((await deps.createAttributeSetGroup.execute({ attributeSetId: set.id.toString(), name: 'General' })).id);
      // Best-effort: give a newly-touched set a real description field to
      // write into (see runCatalogMigration's own product-level description
      // assignment below) — reuses the shared global 'description' attribute
      // this catalog already has, never creates a second one. A set that
      // already has it (or has no such attribute available at all) is left
      // alone either way.
      const descriptionAttr = attributeByCode.get('description');
      if (descriptionAttr) {
        await deps.assignAttributeToGroup
          .execute({ attributeSetId: set.id.toString(), groupId: groupId.toString(), attributeCode: 'description' })
          .catch((err) => {
            if (!(err instanceof ConflictError)) throw err;
          });
      }
      attributeSetByProductType.set(entry.sourceProductType, { id: set.id, groupId });
    }

    // --- Phase 3: variant-axis attributes (one per distinct source option name) ---
    const attributeCodeByOptionName = new Map<string, string>();
    const attributeIdByCode = new Map<string, bigint>();
    const optionsCacheByAttributeCode = new Map<string, Map<string, bigint>>(); // value -> optionId
    for (const entry of plan.attributePlan) {
      let attribute: AttributeInfo;
      const labelLower = entry.sourceOptionName.trim().toLowerCase();
      if (entry.action === 'MATCH_EXISTING' && attributeByCode.has(entry.matchedAttributeCode)) {
        attribute = attributeByCode.get(entry.matchedAttributeCode)!;
      } else if (attributeByLabelLower.has(labelLower)) {
        // Same safety net as the attribute-set branch above: the plan said
        // CREATE, but an attribute with this exact label already exists —
        // reuse it rather than creating a second attribute for the same
        // real-world concept under a different code.
        attribute = attributeByLabelLower.get(labelLower)!;
      } else {
        const code = entry.action === 'CREATE' ? entry.newAttributeCode : entry.matchedAttributeCode;
        const existing = await deps.attributes.findByCode(code);
        if (existing) {
          attribute = existing;
        } else {
          const created = await deps.createAttribute.execute({
            code,
            label: entry.sourceOptionName,
            dataType: 'SELECT',
            inputType: 'DROPDOWN',
            isVariantForming: true,
            isFilterable: true,
          });
          result.attributesCreated++;
          attribute = { id: BigInt(created.id), code: created.code, label: created.label } as AttributeInfo;
          attributeByCode.set(attribute.code, attribute);
          attributeByLabelLower.set(labelLower, attribute);
        }
      }
      attributeCodeByOptionName.set(entry.sourceOptionName, attribute.code);
      attributeIdByCode.set(attribute.code, attribute.id);
      // Assign into EVERY attribute set this run touches, not just the one
      // it was first seen on — a Shopify "Color" option can appear across
      // several product types, and GenerateProductVariants requires the
      // axis attribute to be assigned into THIS product's own set.
      for (const { id: setId, groupId } of attributeSetByProductType.values()) {
        await deps.assignAttributeToGroup
          .execute({ attributeSetId: setId.toString(), groupId: groupId.toString(), attributeCode: attribute.code })
          .catch((err) => {
            if (!(err instanceof ConflictError)) throw err;
          });
      }
      const existingOptions = await deps.attributes.listOptions(attribute.code);
      optionsCacheByAttributeCode.set(attribute.code, new Map(existingOptions.map((o) => [o.value, o.id])));
    }

    async function ensureOptionId(attributeCode: string, value: string): Promise<bigint> {
      const cache = optionsCacheByAttributeCode.get(attributeCode)!;
      const existing = cache.get(value);
      if (existing) return existing;
      const attributeId = attributeIdByCode.get(attributeCode);
      if (!attributeId) throw new Error(`unknown attribute code "${attributeCode}"`);
      // upsertOptions returns the FULL refreshed option list (every existing
      // option plus the one just added), per its own established contract
      // (see catalog.module.ts's UpdateAttributeOptions route) — re-derive
      // the id for exactly the value just requested from that.
      const refreshed: AttributeOptionInfo[] = await deps.attributes.upsertOptions(attributeId, [{ value, label: value }]);
      const match = refreshed.find((o) => o.value === value);
      if (!match) throw new Error(`could not resolve option "${value}" on attribute "${attributeCode}" after creating it`);
      cache.set(value, match.id);
      return match.id;
    }

    // --- Phase 4: products, paginated ---
    let cursor: string | null = null;
    let processed = 0;
    let cancelled = false;
    productPages: do {
      const page = await client.listProducts(cursor);
      for (const sourceProduct of page.products) {
        // Cooperative stop, checked before every product — never a hard
        // kill mid-product (see this function's own doc comment on why:
        // a product's category/attribute/variant/media writes aren't one
        // DB transaction, so killing the job mid-way could leave a
        // half-created product). A single indexed PK read is cheap next
        // to the ~300ms Shopify rate-limit pacing already paid per
        // request, so checking this often stays responsive without
        // meaningfully slowing the run down.
        if (await deps.runs.isCancelRequested(run.id)) {
          cancelled = true;
          break productPages;
        }
        processed++;
        try {
          await processProduct(sourceProduct, {
            run,
            connection,
            deps,
            result,
            categoryPublicIdByExternalId,
            attributeSetByProductType,
            defaultAttributeSet,
            attributeCodeByOptionName,
            ensureOptionId,
          });
        } catch (err) {
          result.failed.push({ sku: sourceProduct.sku, externalId: sourceProduct.externalId, reason: err instanceof Error ? err.message : String(err) });
        }
        await job.updateProgress({ processed, skipped: result.skipped.length, failed: result.failed.length, total: run.totalItems ?? processed });
        if (processed % 10 === 0) {
          await deps.runs.updateProgress(run.id, processed, result.skipped.length, result.failed.length);
        }
      }
      cursor = page.nextCursor;
    } while (cursor);

    await deps.runs.updateProgress(run.id, processed, result.skipped.length, result.failed.length);
    if (cancelled) {
      await deps.runs.markCancelled(run.id, result);
    } else {
      await deps.runs.markCompleted(run.id, result);
    }
    return result;
  } catch (err) {
    result.fatalError = err instanceof Error ? err.message : String(err);
    // Whatever was already created stays created — each product above is
    // its own try/catch unit of work, a fatal error here (e.g. the source
    // API going down mid-run) doesn't roll back products #1..N-1.
    await deps.runs.markFailed(run.id, result);
    throw err;
  }
}

interface ProcessProductCtx {
  run: { id: bigint; totalItems: number | null };
  connection: { id: bigint };
  deps: Deps;
  result: MigrationRunResult;
  categoryPublicIdByExternalId: Map<string, string>;
  attributeSetByProductType: Map<string, { id: bigint; groupId: bigint }>;
  defaultAttributeSet: AttributeSetInfo | null;
  attributeCodeByOptionName: Map<string, string>;
  ensureOptionId: (attributeCode: string, value: string) => Promise<bigint>;
}

async function processProduct(source: SourceProduct, ctx: ProcessProductCtx): Promise<void> {
  const { run, connection, deps, result } = ctx;

  const existingRef = await deps.externalRefs.find(connection.id, 'PRODUCT', source.externalId);
  if (existingRef) {
    // Still backfill category assignment for an already-migrated product —
    // this is what makes re-running a migration actually fix a product
    // that imported correctly but landed in no category (e.g. the
    // /collects.json smart-collection bug this same file's ShopifyClient
    // fix addresses) instead of silently skipping it forever. Cheap and
    // safe: setProductCategories just replaces the assigned set, and only
    // runs at all when there's something real to assign.
    const categoryIds = source.categoryExternalIds.map((id) => ctx.categoryPublicIdByExternalId.get(id)).filter((id): id is string => !!id);
    if (categoryIds.length > 0) {
      await deps.setProductCategories.execute({ productPublicId: existingRef, categoryIds }).catch(() => {
        // Best-effort — an already-migrated product that's since been
        // deleted locally shouldn't fail the whole run over a backfill.
      });
    }
    result.skipped.push({ sku: source.sku, externalId: source.externalId, reason: 'already migrated in a previous run' });
    return;
  }

  const sku = source.sku ?? source.variants.find((v) => v.sku)?.sku ?? null;
  if (!sku) {
    result.skipped.push({ sku: null, externalId: source.externalId, reason: 'no SKU on the source product' });
    return;
  }

  const localExisting = await deps.products.findBySku(sku);
  if (localExisting) {
    result.skipped.push({ sku, externalId: source.externalId, reason: 'a product with this SKU already exists locally' });
    return;
  }

  const setInfo = ctx.attributeSetByProductType.get(source.productType ?? '') ?? (ctx.defaultAttributeSet ? { id: ctx.defaultAttributeSet.id, groupId: 0n } : null);
  if (!setInfo) throw new Error('no attribute set available to assign this product to');

  const isConfigurable = source.options.length > 0 && source.variants.length > 1;
  const created = await deps.createProduct.execute({
    type: isConfigurable ? 'CONFIGURABLE' : 'SIMPLE',
    sku,
    attributeSetId: setInfo.id.toString(),
    nameDefault: source.title,
    tags: source.tags,
  });
  result.productsCreated++;
  await deps.externalRefs.record(run.id, connection.id, 'PRODUCT', source.externalId, created.publicId);

  if (source.bodyHtml) {
    await deps.assignAttributeValue
      .execute({ productPublicId: created.publicId, attributeCode: 'description', scope: 'GLOBAL', value: source.bodyHtml })
      .catch(() => {
        // This attribute set doesn't have a 'description' field assigned —
        // fine, the product's title/SKU/tags/images still migrated correctly.
      });
  }

  const categoryIds = source.categoryExternalIds.map((id) => ctx.categoryPublicIdByExternalId.get(id)).filter((id): id is string => !!id);
  if (categoryIds.length > 0) {
    await deps.setProductCategories.execute({ productPublicId: created.publicId, categoryIds });
  }

  if (isConfigurable) {
    const axes = [];
    for (const opt of source.options) {
      const attributeCode = ctx.attributeCodeByOptionName.get(opt.name);
      if (!attributeCode) continue; // shouldn't happen — Analyze's plan covers every option name seen in the sample
      const optionIds: string[] = [];
      for (const value of opt.values) {
        optionIds.push((await ctx.ensureOptionId(attributeCode, value)).toString());
      }
      axes.push({ attributeCode, optionIds });
    }
    if (axes.length > 0) {
      const genResult = await deps.generateProductVariants.execute({ productPublicId: created.publicId, axes });
      result.variantsCreated += genResult.created;

      // Reconcile each generated variant's synthesized SKU with the source's
      // REAL per-variant SKU by matching on the axis option-label combo —
      // best-effort, never fatal (a SKU collision or unmatched combo just
      // keeps the synthesized SKU, still a valid, unique, real variant).
      for (const variant of genResult.variants) {
        const comboKey = [...variant.axisValues.map((a) => a.optionLabel)].sort().join('|');
        const sourceVariant = source.variants.find((v) => [...v.optionValues].sort().join('|') === comboKey);
        if (sourceVariant?.sku && sourceVariant.sku !== variant.sku) {
          await deps.updateProductVariant
            .execute({ productPublicId: created.publicId, variantPublicId: variant.publicId, sku: sourceVariant.sku })
            .catch(() => {
              // real SKU collides with something else locally — keep the synthesized one
            });
        }
      }
    }
  }
  // SIMPLE products already carry their real SKU as the product's own SKU
  // (set above) — CreateProduct creates their implicit single variant with
  // that same SKU, no separate reconciliation needed.

  for (const image of source.images) {
    try {
      const res = await fetch(image.url);
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get('content-type') ?? 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      const storageKey = `products/${randomUUID()}-migrated.${ext}`;
      await deps.mediaStorage.putObjectFromBuffer(storageKey, buffer, contentType);
      const asset = await deps.createMediaAsset.execute({ storageKey, mimeType: contentType, bytes: buffer.length });
      await deps.attachProductMedia.execute({ productPublicId: created.publicId, mediaPublicId: asset.publicId });
      result.imagesAttached++;
    } catch {
      // One bad image (a dead URL, an unsupported format) shouldn't fail an
      // otherwise-successful product — soft-skip, not pushed to result.failed.
    }
  }
}

// ============================================================================
// Customer migration — `migrate-customers` job, added alongside the catalog
// migration above (same file, same queue, dispatched by job.name — see
// startCatalogMigrationWorker's own doc comment on why). Deterministic:
// AnalyzeCustomers never calls AI (there's no mapping ambiguity to resolve —
// see its own doc comment), so there's no plan to "apply" here beyond the
// fixed email/name/address mapping every source platform shares.
// ============================================================================

interface CustomerDeps {
  runs: PrismaMigrationRunRepository;
  connections: PrismaMigrationConnectionRepository;
  externalRefs: PrismaMigrationExternalRefRepository;
  customers: PrismaCustomerRepository;
  customerAddresses: PrismaCustomerAddressRepository;
  passwordHasher: ScryptPasswordHasher;
}

/** Resolves the website new migrated customers belong to — this codebase
 *  now supports multiple websites (see the Multi-Store feature), but
 *  Shopify/Magento customers carry no per-website concept of their own, so
 *  there's nothing meaningful to map a source customer's "website" onto.
 *  Falls back through the same `isDefault` convention used elsewhere in
 *  this schema (Currency.isDefault, AttributeSet.isDefault, ...), then to
 *  the oldest website if somehow none is flagged default. Throws (a real,
 *  loud failure, not a silent bad-data create) if no website exists at
 *  all — that's a store-setup problem, not something this job can recover
 *  from on its own. */
async function resolveDefaultWebsiteId(db: typeof prisma): Promise<bigint> {
  const preferred = await db.website.findFirst({ where: { isDefault: true, deletedAt: null }, select: { id: true } });
  if (preferred) return preferred.id;
  const fallback = await db.website.findFirst({ where: { deletedAt: null }, orderBy: { id: 'asc' }, select: { id: true } });
  if (!fallback) throw new Error('no website exists to assign migrated customers to');
  return fallback.id;
}

async function runCustomerMigration(job: Job, deps: CustomerDeps): Promise<CustomerMigrationRunResult> {
  const { runId } = job.data as { runId: string };
  const run = await deps.runs.findById(BigInt(runId));
  if (!run) throw new Error(`migration run ${runId} not found`);
  const connection = await deps.connections.getById(run.connectionId);
  if (!connection) throw new Error(`migration connection ${run.connectionId} not found`);
  const client = buildCustomerSourceClient(connection.channel, connection.storeUrl, connection.apiToken);
  const websiteId = await resolveDefaultWebsiteId(prisma);

  const result: CustomerMigrationRunResult = {
    customersCreated: 0,
    addressesCreated: 0,
    skipped: [],
    failed: [],
  };

  try {
    let cursor: string | null = null;
    let processed = 0;
    let cancelled = false;
    customerPages: do {
      const page = await client.listCustomers(cursor);
      for (const source of page.customers) {
        // Cooperative stop, checked before every customer — same "never a
        // hard kill mid-row" reasoning as the catalog migration's own loop
        // (a customer's address rows aren't created in the same DB
        // transaction as the customer itself).
        if (await deps.runs.isCancelRequested(run.id)) {
          cancelled = true;
          break customerPages;
        }
        processed++;
        try {
          await processCustomer(source, { run, connection, deps, result, websiteId });
        } catch (err) {
          result.failed.push({ email: source.email, externalId: source.externalId, reason: err instanceof Error ? err.message : String(err) });
        }
        await job.updateProgress({ processed, skipped: result.skipped.length, failed: result.failed.length, total: run.totalItems ?? processed });
        if (processed % 10 === 0) {
          await deps.runs.updateProgress(run.id, processed, result.skipped.length, result.failed.length);
        }
      }
      cursor = page.nextCursor;
    } while (cursor);

    await deps.runs.updateProgress(run.id, processed, result.skipped.length, result.failed.length);
    if (cancelled) {
      await deps.runs.markCancelled(run.id, result);
    } else {
      await deps.runs.markCompleted(run.id, result);
    }
    return result;
  } catch (err) {
    result.fatalError = err instanceof Error ? err.message : String(err);
    // Whatever was already created stays created — same "each row is its
    // own unit of work" posture as the catalog migration.
    await deps.runs.markFailed(run.id, result);
    throw err;
  }
}

interface ProcessCustomerCtx {
  run: { id: bigint };
  connection: { id: bigint };
  deps: CustomerDeps;
  result: CustomerMigrationRunResult;
  websiteId: bigint;
}

async function processCustomer(source: SourceCustomer, ctx: ProcessCustomerCtx): Promise<void> {
  const { run, connection, deps, result } = ctx;

  const existingRef = await deps.externalRefs.find(connection.id, 'CUSTOMER', source.externalId);
  if (existingRef) {
    result.skipped.push({ email: source.email, externalId: source.externalId, reason: 'already migrated in a previous run' });
    return;
  }

  const email = source.email?.trim().toLowerCase() ?? null;
  if (!email) {
    result.skipped.push({ email: null, externalId: source.externalId, reason: 'no email on the source customer — an email is required to sign in here' });
    return;
  }

  const localExisting = await deps.customers.findByWebsiteAndEmail(ctx.websiteId, email);
  if (localExisting) {
    result.skipped.push({ email, externalId: source.externalId, reason: 'a customer with this email already exists locally' });
    return;
  }

  // Shopify (and every other platform) never exposes a real password via
  // its API — it's one-way hashed on their end too. A random, unknown
  // password is the only honest option here; see analyze-customers.
  // usecase.ts's own warning about this shown to the admin before Start.
  const randomPassword = randomBytes(24).toString('hex');
  const passwordHash = await deps.passwordHasher.hash(randomPassword);

  const created = await deps.customers.create({
    websiteId: ctx.websiteId,
    email,
    passwordHash,
    firstName: source.firstName,
    lastName: source.lastName,
  });
  result.customersCreated++;
  await deps.externalRefs.record(run.id, connection.id, 'CUSTOMER', source.externalId, created.publicId);

  for (const addr of source.addresses) {
    // Required locally: name, line1, city, postalCode, country. A Shopify
    // address missing any of these (rare, but real-world data is messy) is
    // silently skipped for just that one address — never fails the whole
    // customer over one incomplete saved address.
    const name = [addr.firstName, addr.lastName].filter(Boolean).join(' ').trim() || [source.firstName, source.lastName].filter(Boolean).join(' ').trim();
    if (!name || !addr.address1 || !addr.city || !addr.zip || !addr.countryCode) continue;
    try {
      await deps.customerAddresses.create({
        customerId: created.id,
        name,
        company: addr.company,
        line1: addr.address1,
        line2: addr.address2,
        city: addr.city,
        region: addr.province,
        postalCode: addr.zip,
        country: addr.countryCode,
        phone: addr.phone,
        isDefaultShipping: addr.isDefault,
        isDefaultBilling: addr.isDefault,
      });
      result.addressesCreated++;
    } catch {
      // One bad address shouldn't fail an otherwise-successful customer —
      // same soft-skip posture as a bad product image in the catalog job.
    }
  }
}
