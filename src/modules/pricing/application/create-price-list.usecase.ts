import type {
  PriceListRepository,
  CustomerGroupRepository,
  WebsiteLookup,
  CurrencyLookup,
} from '../domain/repositories.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/errors.js';
import type { CreatePriceListCommand, PriceListView } from './dto.js';

export class CreatePriceList {
  constructor(
    private readonly priceLists: PriceListRepository,
    private readonly customerGroups: CustomerGroupRepository,
    private readonly websites: WebsiteLookup,
    private readonly currencies: CurrencyLookup,
  ) {}

  async execute(cmd: CreatePriceListCommand): Promise<PriceListView> {
    const code = cmd.code.trim();
    if (await this.priceLists.findByCode(code)) {
      throw new ConflictError(`price list code already exists: ${code}`);
    }

    if (!(await this.currencies.byCode(cmd.currency))) {
      throw new NotFoundError('Currency', cmd.currency);
    }

    let customerGroupId: bigint | null = null;
    if (cmd.customerGroupCode) {
      const group = await this.customerGroups.findByCode(cmd.customerGroupCode);
      if (!group) throw new NotFoundError('CustomerGroup', cmd.customerGroupCode);
      customerGroupId = group.id;
    }

    let websiteId: bigint | null = null;
    if (cmd.websiteCode) {
      const website = await this.websites.byCode(cmd.websiteCode);
      if (!website) throw new NotFoundError('Website', cmd.websiteCode);
      websiteId = website.id;
    }

    const pl = await this.priceLists.create({
      code,
      name: cmd.name,
      currency: cmd.currency,
      type: cmd.type,
      priority: cmd.priority,
      customerGroupId,
      websiteId,
      startsAt: cmd.startsAt ? new Date(cmd.startsAt) : null,
      endsAt: cmd.endsAt ? new Date(cmd.endsAt) : null,
    });
    return {
      publicId: pl.publicId,
      code: pl.code,
      name: pl.name,
      currency: pl.currency,
      type: pl.type,
      priority: pl.priority,
      isActive: pl.isActive,
    };
  }
}
