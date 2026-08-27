import type { WebsiteRepository } from '../domain/repositories.js';
import type { PublicStoreView } from './dto.js';

/** Backs the storefront's public store switcher — every active store view,
 *  public/unauthenticated (same posture as GetPublicWebsite). */
export class ListPublicStores {
  constructor(private readonly websites: WebsiteRepository) {}

  async execute(): Promise<PublicStoreView[]> {
    const rows = await this.websites.listPublicStores();
    return rows.map((r) => ({
      websiteCode: r.websiteCode,
      websiteName: r.websiteName,
      storeViewId: r.storeViewId.toString(),
      storeViewCode: r.storeViewCode,
      currency: r.currency,
      isDefault: r.isDefault,
    }));
  }
}
