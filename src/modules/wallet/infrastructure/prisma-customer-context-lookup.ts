import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { CustomerContextLookup, CustomerContext } from '../domain/repositories.js';

/**
 * Read-only cross-module lookup: resolves a customer's own website + that
 * website's base currency (own trivial copy, not Customer module's
 * repository). A wallet always lives in the customer's own website/currency
 * — no separate websiteCode/currency params needed on any wallet endpoint.
 */
export class PrismaCustomerContextLookup implements CustomerContextLookup {
  constructor(private readonly db: Db) {}

  async resolveByPublicId(customerPublicId: string): Promise<CustomerContext | null> {
    // Customer.websiteId is a bare scalar (no Prisma relation, project-wide
    // scope-column convention) — two queries, not a relation include.
    const customer = await this.db.customer.findFirst({ where: { publicId: customerPublicId }, select: { id: true, websiteId: true } });
    if (!customer) return null;
    const website = await this.db.website.findFirst({ where: { id: customer.websiteId }, select: { baseCurrency: true } });
    if (!website) return null;
    return { customerId: customer.id, websiteId: customer.websiteId, currency: website.baseCurrency };
  }
}
