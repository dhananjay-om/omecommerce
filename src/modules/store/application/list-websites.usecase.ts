import type { WebsiteRepository } from '../domain/repositories.js';
import { presignGetUrl } from '../../../shared/infrastructure/storage/s3-client.js';
import type { WebsiteView } from './dto.js';

export class ListWebsites {
  constructor(private readonly websites: WebsiteRepository) {}

  async execute(): Promise<WebsiteView[]> {
    const rows = await this.websites.list();
    return Promise.all(
      rows.map(async (w) => ({
        publicId: w.publicId,
        code: w.code,
        name: w.name,
        gstin: w.gstin,
        originStateCode: w.originStateCode,
        pricesIncludeTax: w.pricesIncludeTax,
        address: w.address,
        logoMediaKey: w.logoMediaKey,
        // Resolved live, same as every other presigned URL in this codebase
        // (never cached/stored) — a missing/deleted object just yields a
        // dead link rather than breaking this settings page.
        logoUrl: w.logoMediaKey ? await presignGetUrl(w.logoMediaKey) : null,
      })),
    );
  }
}
