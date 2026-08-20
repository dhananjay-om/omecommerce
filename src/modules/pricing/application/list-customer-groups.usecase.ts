import type { CustomerGroupRepository } from '../domain/repositories.js';
import type { CustomerGroupView } from './dto.js';

/** Admin Customer Groups page (plan/18) — the pricing/B2B side of the picture:
 *  Company.customerGroupCode and a PriceList's own customerGroupCode both reference
 *  groups created here. */
export class ListCustomerGroups {
  constructor(private readonly groups: CustomerGroupRepository) {}

  async execute(): Promise<CustomerGroupView[]> {
    const rows = await this.groups.list();
    return rows.map((g) => ({ publicId: g.publicId, code: g.code, name: g.name, isDefault: g.isDefault }));
  }
}
