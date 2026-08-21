import type { WebsiteRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { toWebsiteView } from './website-view.js';
import type { PublicWebsiteView } from './dto.js';

/** Storefront's read of its own branding (name + logo) — public, unauthenticated,
 *  scoped to just what a header/footer needs to render. Reuses toWebsiteView()
 *  for the live-presigned logoUrl rather than duplicating that logic. */
export class GetPublicWebsite {
  constructor(private readonly websites: WebsiteRepository) {}

  async execute(code: string): Promise<PublicWebsiteView> {
    const info = await this.websites.findByCode(code);
    if (!info) throw new NotFoundError('website', code);
    const { name, logoUrl } = await toWebsiteView(info);
    return { name, logoUrl };
  }
}
