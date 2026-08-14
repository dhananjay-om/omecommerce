import type { WebsiteRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { UpdateWebsiteTaxSettingsCommand, WebsiteView } from './dto.js';

/** GST Settings admin page (single-registration/single-state scope — see
 *  store.prisma's Website.gstin/.originStateCode doc comment). Defense in
 *  depth alongside the DB's website_gstin_state_code_paired CHECK: both
 *  fields must be set or cleared together, never half-configured. */
export class UpdateWebsiteTaxSettings {
  constructor(private readonly websites: WebsiteRepository) {}

  async execute(cmd: UpdateWebsiteTaxSettingsCommand): Promise<WebsiteView> {
    const existing = await this.websites.list();
    const found = existing.find((w) => w.code === cmd.code);
    if (!found) throw new NotFoundError('Website', cmd.code);

    const gstin = cmd.gstin !== undefined ? cmd.gstin : found.gstin;
    const originStateCode = cmd.originStateCode !== undefined ? cmd.originStateCode : found.originStateCode;
    if ((gstin === null) !== (originStateCode === null)) {
      throw new ValidationError('GSTIN and origin state code must be set or cleared together', [
        { path: 'gstin', message: 'must be paired with originStateCode' },
      ]);
    }

    const w = await this.websites.update(cmd.code, {
      gstin: cmd.gstin,
      originStateCode: cmd.originStateCode,
      pricesIncludeTax: cmd.pricesIncludeTax,
    });
    return {
      publicId: w.publicId,
      code: w.code,
      name: w.name,
      gstin: w.gstin,
      originStateCode: w.originStateCode,
      pricesIncludeTax: w.pricesIncludeTax,
    };
  }
}
