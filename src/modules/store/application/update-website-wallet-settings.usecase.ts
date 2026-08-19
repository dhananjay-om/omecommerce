import type { WebsiteRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { toWebsiteView } from './website-view.js';
import type { UpdateWebsiteWalletSettingsCommand, WebsiteView } from './dto.js';

/** Wallet Settings admin page (plan/17) — admin-configurable rules for the wallet checkout
 *  tender only; store branding/GST live on their own separate pages/usecases, same split
 *  WebsiteRepository's own doc comment explains. Defense in depth alongside three DB CHECKs
 *  (website_wallet_max_percent_of_order_range/min_order_value_nonneg/max_amount_per_order_positive)
 *  — without this pre-check, an out-of-range value here would hit the raw Postgres CHECK and
 *  surface as an unhandled 500 instead of a clean validation error, same reasoning
 *  UpdateWebsiteTaxSettings documents for its own two GST CHECKs. */
export class UpdateWebsiteWalletSettings {
  constructor(private readonly websites: WebsiteRepository) {}

  async execute(cmd: UpdateWebsiteWalletSettingsCommand): Promise<WebsiteView> {
    const existing = await this.websites.list();
    const found = existing.find((w) => w.code === cmd.code);
    if (!found) throw new NotFoundError('Website', cmd.code);

    if (cmd.walletMaxPercentOfOrder !== undefined && cmd.walletMaxPercentOfOrder !== null) {
      const pct = Number(cmd.walletMaxPercentOfOrder);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        throw new ValidationError(
          'walletMaxPercentOfOrder must be a percentage between 0 (exclusive) and 100',
          [{ path: 'walletMaxPercentOfOrder', message: 'must be > 0 and <= 100' }],
        );
      }
    }
    if (cmd.walletMinOrderValue !== undefined && cmd.walletMinOrderValue !== null) {
      const min = Number(cmd.walletMinOrderValue);
      if (!Number.isFinite(min) || min < 0) {
        throw new ValidationError('walletMinOrderValue must not be negative', [
          { path: 'walletMinOrderValue', message: 'must be >= 0' },
        ]);
      }
    }
    if (cmd.walletMaxAmountPerOrder !== undefined && cmd.walletMaxAmountPerOrder !== null) {
      const max = Number(cmd.walletMaxAmountPerOrder);
      if (!Number.isFinite(max) || max <= 0) {
        throw new ValidationError('walletMaxAmountPerOrder must be a positive amount', [
          { path: 'walletMaxAmountPerOrder', message: 'must be > 0' },
        ]);
      }
    }

    const w = await this.websites.update(cmd.code, {
      walletEnabled: cmd.walletEnabled,
      walletMaxPercentOfOrder: cmd.walletMaxPercentOfOrder,
      walletMinOrderValue: cmd.walletMinOrderValue,
      walletMaxAmountPerOrder: cmd.walletMaxAmountPerOrder,
    });
    return toWebsiteView(w);
  }
}
