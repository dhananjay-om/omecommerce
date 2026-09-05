import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { MigrationConnectionRepository, MigrationRunRepository } from '../domain/repositories.js';
import { DomainError, NotFoundError } from '../../../shared/domain/errors.js';
import { buildOrderSourceClient } from '../infrastructure/source-client-factory.js';
import type { AnalyzeMigrationCommand, MigrationRunView, OrderMigrationPlan } from './dto.js';
import { toMigrationRunView } from './migration-run-view.js';

const SAMPLE_SIZE = 100;

/**
 * Order migration's own "Check Migration" action — deterministic, same
 * reasoning as AnalyzeCustomers: mapping an order's own fields (totals,
 * status, addresses) has no ambiguity to resolve with AI. The one genuine
 * unknown before Start is committed to is whether the source's line-item
 * SKUs actually match anything in the LOCAL catalog — this samples real
 * orders and checks real SKUs against the real `product_variant` table
 * (the same table Catalog migration itself populates) to surface that
 * honestly before the admin clicks Start, rather than after.
 */
export class AnalyzeOrders {
  constructor(
    private readonly db: Db,
    private readonly connections: MigrationConnectionRepository,
    private readonly runs: MigrationRunRepository,
  ) {}

  async execute(cmd: AnalyzeMigrationCommand): Promise<MigrationRunView> {
    const connection = await this.connections.getByChannel(cmd.channel);
    if (!connection) throw new NotFoundError('migration connection', cmd.channel);

    const client = buildOrderSourceClient(cmd.channel, connection.storeUrl, connection.apiToken);
    let totalOrders: number;
    let sample: Awaited<ReturnType<typeof client.listOrders>>['orders'];
    try {
      const [count, firstPage] = await Promise.all([client.countOrders(), client.listOrders(null)]);
      totalOrders = count;
      sample = firstPage.orders.slice(0, SAMPLE_SIZE);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'failed to read the source order list';
      throw new DomainError(message, 'https://errors.ome/migration-analyze-failed', 502);
    }

    const sampleSkus = new Set<string>();
    for (const o of sample) {
      for (const line of o.lineItems) {
        if (line.sku) sampleSkus.add(line.sku);
      }
    }
    const matchedRows = sampleSkus.size
      ? await this.db.productVariant.findMany({ where: { sku: { in: [...sampleSkus] }, deletedAt: null }, select: { sku: true } })
      : [];
    const matchedSkus = new Set(matchedRows.map((r) => r.sku));

    let ordersWithUnmatchedLines = 0;
    let ordersWithNoMatchableLines = 0;
    let oldest: string | null = null;
    let newest: string | null = null;
    for (const o of sample) {
      const skus = o.lineItems.map((l) => l.sku).filter((s): s is string => !!s);
      const matchedCount = skus.filter((s) => matchedSkus.has(s)).length;
      if (matchedCount < skus.length) ordersWithUnmatchedLines++;
      if (skus.length > 0 && matchedCount === 0) ordersWithNoMatchableLines++;
      if (!oldest || o.createdAt < oldest) oldest = o.createdAt;
      if (!newest || o.createdAt > newest) newest = o.createdAt;
    }

    const warnings: string[] = [];
    if (ordersWithNoMatchableLines > 0) {
      warnings.push(
        `${ordersWithNoMatchableLines} order(s) in the sample have no line item matching a product already in this catalog — these will be skipped entirely (never imported empty). Run Catalog migration first if you haven't.`,
      );
    }
    if (ordersWithUnmatchedLines > ordersWithNoMatchableLines) {
      warnings.push(
        `${ordersWithUnmatchedLines - ordersWithNoMatchableLines} order(s) in the sample have SOME line items that won't match — those orders still import, but only with the line items that do match; the order's recorded totals stay the real historical totals either way.`,
      );
    }
    warnings.push(
      'Imported orders are historical records only — no payment is captured, no stock is reserved or decremented, no confirmation email is sent, and no loyalty/referral credit is earned for them. Their financial/fulfillment status is copied from the source as a label, not replayed.',
    );
    warnings.push(
      'A line item is matched to a local product by SKU only — an order whose customer email matches an already-migrated customer is linked to that account; otherwise it imports as a guest order (the email itself is always kept).',
    );

    const plan: OrderMigrationPlan = {
      summary: `Migrate ${totalOrders} order(s) from ${cmd.channel} as historical records — real totals, addresses, and status, matched to your local catalog by SKU. No payment/fulfillment actions are replayed.`,
      totalOrders,
      sampleSize: sample.length,
      ordersWithUnmatchedLinesInSample: ordersWithUnmatchedLines,
      ordersWithNoMatchableLinesInSample: ordersWithNoMatchableLines,
      oldestOrderDate: oldest,
      newestOrderDate: newest,
      warnings,
    };

    const run = await this.runs.create({
      connectionId: connection.id,
      dataType: 'ORDER',
      totalItems: totalOrders,
      planJson: plan,
      createdBy: null,
    });
    return toMigrationRunView(run, cmd.channel);
  }
}
