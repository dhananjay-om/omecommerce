import type { WebsiteRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { presignGetUrl } from '../../../shared/infrastructure/storage/s3-client.js';
import type { UpdateWebsiteTaxSettingsCommand, WebsiteView } from './dto.js';

/** GST Settings admin page (single-registration/single-state scope — see
 *  store.prisma's Website.gstin/.originStateCode doc comment). Defense in
 *  depth alongside two DB CHECKs: website_gstin_state_code_paired (both
 *  fields must be set or cleared together, never half-configured) and
 *  website_gstin_state_match (the GSTIN's first 2 digits must equal
 *  originStateCode — a GSTIN is state-specific by construction). Without
 *  this pre-check, a mismatch here would hit the raw Postgres CHECK and
 *  surface as an unhandled 500 instead of a clean validation error. */
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
    if (gstin !== null && originStateCode !== null && gstin.slice(0, 2) !== originStateCode) {
      throw new ValidationError("origin state code must match the GSTIN's first 2 digits", [
        { path: 'originStateCode', message: `expected "${gstin.slice(0, 2)}" to match GSTIN ${gstin}` },
      ]);
    }

    const w = await this.websites.update(cmd.code, {
      gstin: cmd.gstin,
      originStateCode: cmd.originStateCode,
      pricesIncludeTax: cmd.pricesIncludeTax,
      address: cmd.address,
      logoMediaKey: cmd.logoMediaKey,
    });
    return {
      publicId: w.publicId,
      code: w.code,
      name: w.name,
      gstin: w.gstin,
      originStateCode: w.originStateCode,
      pricesIncludeTax: w.pricesIncludeTax,
      address: w.address,
      logoMediaKey: w.logoMediaKey,
      logoUrl: w.logoMediaKey ? await presignGetUrl(w.logoMediaKey) : null,
    };
  }
}
