import type { WebsiteRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { toWebsiteView } from './website-view.js';
import type { UpdateWebsiteGeneralSettingsCommand, WebsiteView } from './dto.js';

/** General Settings admin page — store branding shown on the invoice
 *  letterhead and elsewhere (address, logo, contact email), deliberately
 *  separate from GST Settings/UpdateWebsiteTaxSettings even though both
 *  write the same Website row — see WebsiteRepository's doc comment. */
export class UpdateWebsiteGeneralSettings {
  constructor(private readonly websites: WebsiteRepository) {}

  async execute(cmd: UpdateWebsiteGeneralSettingsCommand): Promise<WebsiteView> {
    const existing = await this.websites.list();
    if (!existing.some((w) => w.code === cmd.code)) throw new NotFoundError('Website', cmd.code);

    const w = await this.websites.update(cmd.code, {
      address: cmd.address,
      logoMediaKey: cmd.logoMediaKey,
      supportEmail: cmd.supportEmail,
    });
    return toWebsiteView(w);
  }
}
