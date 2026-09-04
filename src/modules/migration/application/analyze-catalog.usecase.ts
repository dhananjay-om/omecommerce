import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { AttributeRepository, AttributeSetRepository, CategoryRepository } from '../../catalog/domain/repositories.js';
import type { MigrationConnectionRepository, MigrationRunRepository } from '../domain/repositories.js';
import { DomainError, NotFoundError } from '../../../shared/domain/errors.js';
import { getOpenAiClient } from '../../ai/infrastructure/dynamic-openai-client.js';
import { generateMigrationPlan } from '../infrastructure/migration-plan-openai.js';
import { buildSourceClient } from '../infrastructure/source-client-factory.js';
import type { AnalyzeCatalogCommand, MigrationRunView } from './dto.js';
import { toMigrationRunView } from './migration-run-view.js';

const SAMPLE_SIZE = 50;

/**
 * The "Check Migration" action — runs ONCE per migration, calling OpenAI a
 * single time (see migration-plan-openai.ts's own doc comment on why the
 * plan is built once and applied deterministically, not re-decided per
 * product). Counts the REAL total catalog size but only samples a bounded
 * number of products to see every distinct option/product-type/category —
 * the plan is then persisted onto a new READY MigrationRun so "Start" is a
 * single click with no re-analysis.
 */
export class AnalyzeCatalog {
  constructor(
    private readonly db: Db,
    private readonly connections: MigrationConnectionRepository,
    private readonly runs: MigrationRunRepository,
    private readonly attributes: AttributeRepository,
    private readonly attributeSets: AttributeSetRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(cmd: AnalyzeCatalogCommand): Promise<MigrationRunView> {
    const connection = await this.connections.getByChannel(cmd.channel);
    if (!connection) throw new NotFoundError('migration connection', cmd.channel);

    const handle = await getOpenAiClient(this.db);
    if (!handle) {
      throw new DomainError(
        'Data Migration needs an OpenAI key to build a mapping plan — configure one in AI Settings first.',
        'https://errors.ome/ai-not-configured',
        404,
      );
    }

    const client = buildSourceClient(cmd.channel, connection.storeUrl, connection.apiToken);
    let totalProducts: number, sample: Awaited<ReturnType<typeof client.sampleProducts>>, sourceCategories: Awaited<ReturnType<typeof client.listCategories>>;
    try {
      [totalProducts, sample, sourceCategories] = await Promise.all([
        client.countProducts(),
        client.sampleProducts(SAMPLE_SIZE),
        client.listCategories(),
      ]);
    } catch (err) {
      // A raw fetch/API error here used to surface as an opaque unhandled
      // 500 instead of a clean message — same class of bug this codebase's
      // own AI Assistant fix already caught once for an unwrapped OpenAI
      // call (see that use case's own doc comment). Re-thrown, not
      // swallowed, same "real provider error, not a silent failure"
      // posture as TestMigrationConnection.
      const message = err instanceof Error ? err.message : 'failed to read the source catalog';
      throw new DomainError(message, 'https://errors.ome/migration-analyze-failed', 502);
    }

    const optionSamples = new Map<string, Set<string>>();
    const productTypes = new Set<string>();
    let productsWithoutSku = 0;
    for (const p of sample) {
      if (!p.sku && p.variants.every((v) => !v.sku)) productsWithoutSku++;
      if (p.productType) productTypes.add(p.productType);
      for (const opt of p.options) {
        const values = optionSamples.get(opt.name) ?? new Set<string>();
        for (const v of opt.values.slice(0, 5)) values.add(v);
        optionSamples.set(opt.name, values);
      }
    }

    const [existingAttributes, existingAttributeSets, existingCategories] = await Promise.all([
      this.attributes.list(),
      this.attributeSets.listSets(),
      this.categories.list(),
    ]);

    const plan = await generateMigrationPlan(handle, {
      channel: cmd.channel,
      totalProducts,
      sourceOptionNames: [...optionSamples.entries()].map(([name, values]) => ({ name, sampleValues: [...values] })),
      sourceProductTypes: [...productTypes],
      sourceCategoryNames: sourceCategories.map((c) => c.name),
      existingAttributes: existingAttributes
        .filter((a) => a.dataType === 'SELECT')
        .map((a) => ({ code: a.code, label: a.label })),
      existingAttributeSets: existingAttributeSets.map((s) => ({ code: s.code, name: s.name })),
      existingCategoryNames: existingCategories.map((c) => c.nameDefault ?? c.slug),
      productsWithoutSku,
    });

    const run = await this.runs.create({
      connectionId: connection.id,
      dataType: 'CATALOG',
      totalItems: totalProducts,
      planJson: plan,
      createdBy: null,
    });
    return toMigrationRunView(run, cmd.channel);
  }
}
