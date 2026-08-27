import type { WebsiteInfo } from '../domain/repositories.js';
import { presignGetUrl } from '../../../shared/infrastructure/storage/s3-client.js';
import type { WebsiteView } from './dto.js';

/** Shared by ListWebsites, UpdateWebsiteTaxSettings, UpdateWebsiteGeneralSettings, and
 *  UpdateWebsiteWalletSettings — all four read/write the same Website row and need the
 *  identical view shape, including the live-resolved logoUrl (never cached/stored, same
 *  as every other presigned URL in this codebase). */
export async function toWebsiteView(w: WebsiteInfo): Promise<WebsiteView> {
  return {
    publicId: w.publicId,
    code: w.code,
    name: w.name,
    baseCurrency: w.baseCurrency,
    gstin: w.gstin,
    originStateCode: w.originStateCode,
    pricesIncludeTax: w.pricesIncludeTax,
    address: w.address,
    logoMediaKey: w.logoMediaKey,
    logoUrl: w.logoMediaKey ? await presignGetUrl(w.logoMediaKey) : null,
    supportEmail: w.supportEmail,
    walletEnabled: w.walletEnabled,
    walletMaxPercentOfOrder: w.walletMaxPercentOfOrder,
    walletMinOrderValue: w.walletMinOrderValue,
    walletMaxAmountPerOrder: w.walletMaxAmountPerOrder,
  };
}
