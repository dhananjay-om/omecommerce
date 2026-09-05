import type { MigrationConnectionRepository, MigrationRunRepository } from '../domain/repositories.js';
import { DomainError, NotFoundError } from '../../../shared/domain/errors.js';
import { buildCustomerSourceClient } from '../infrastructure/source-client-factory.js';
import type { AnalyzeMigrationCommand, MigrationRunView, CustomerMigrationPlan } from './dto.js';
import { toMigrationRunView } from './migration-run-view.js';

const SAMPLE_SIZE = 100;

/**
 * The Customer migration's own "Check Migration" action — deliberately NOT
 * an OpenAI call, unlike AnalyzeCatalog. Mapping a foreign customer record
 * onto this schema has no real ambiguity: email/first name/last name/
 * addresses map onto exactly one place each, every time, on every
 * platform — there's no "which local attribute does this concept mean"
 * question the way a foreign catalog's attribute/category names raise.
 * Spending an LLM call here would add latency and cost for a decision that
 * was never actually in doubt. Instead this samples the real customer list
 * to surface real numbers (how many will be skipped for missing email or a
 * conflicting one already on file) so the admin sees genuine data before
 * clicking Start, same spirit as AnalyzeCatalog's plan, just without an AI
 * step to get there.
 */
export class AnalyzeCustomers {
  constructor(
    private readonly connections: MigrationConnectionRepository,
    private readonly runs: MigrationRunRepository,
  ) {}

  async execute(cmd: AnalyzeMigrationCommand): Promise<MigrationRunView> {
    const connection = await this.connections.getByChannel(cmd.channel);
    if (!connection) throw new NotFoundError('migration connection', cmd.channel);

    const client = buildCustomerSourceClient(cmd.channel, connection.storeUrl, connection.apiToken);
    let totalCustomers: number;
    let sample: Awaited<ReturnType<typeof client.listCustomers>>['customers'];
    try {
      const [count, firstPage] = await Promise.all([client.countCustomers(), client.listCustomers(null)]);
      totalCustomers = count;
      sample = firstPage.customers.slice(0, SAMPLE_SIZE);
    } catch (err) {
      // Same "re-throw the real provider error, never a silent 500" posture
      // as AnalyzeCatalog's own equivalent catch.
      const message = err instanceof Error ? err.message : 'failed to read the source customer list';
      throw new DomainError(message, 'https://errors.ome/migration-analyze-failed', 502);
    }

    let withoutEmail = 0;
    const seenEmails = new Set<string>();
    let duplicatesInSample = 0;
    for (const c of sample) {
      if (!c.email) {
        withoutEmail++;
        continue;
      }
      const key = c.email.trim().toLowerCase();
      if (seenEmails.has(key)) duplicatesInSample++;
      seenEmails.add(key);
    }

    const warnings: string[] = [];
    if (withoutEmail > 0) {
      warnings.push(`${withoutEmail} customer(s) in the sample have no email and will be skipped — an email is required to sign in on this store.`);
    }
    warnings.push(
      'A migrated customer gets a random, unknown password (Shopify never exposes real passwords via its API — no platform migration can carry them over) — they will need a way to set a new one before they can sign in.',
    );
    warnings.push(
      'Phone number, tags, and marketing consent on the customer record itself are not migrated yet (this catalog\'s Customer record has no field for them) — only email, name, and saved addresses (which do carry their own phone) are.',
    );

    const plan: CustomerMigrationPlan = {
      summary: `Migrate ${totalCustomers} customer(s) from ${cmd.channel} — email, name, and saved addresses. A customer whose email already exists locally is skipped, never overwritten.`,
      totalCustomers,
      sampleSize: sample.length,
      duplicateEmailsInSample: duplicatesInSample,
      customersWithoutEmailInSample: withoutEmail,
      warnings,
    };

    const run = await this.runs.create({
      connectionId: connection.id,
      dataType: 'CUSTOMER',
      totalItems: totalCustomers,
      planJson: plan,
      createdBy: null,
    });
    return toMigrationRunView(run, cmd.channel);
  }
}
