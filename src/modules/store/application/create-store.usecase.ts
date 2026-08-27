import type { WebsiteRepository } from '../domain/repositories.js';
import { ConflictError } from '../../../shared/domain/errors.js';
import { toWebsiteView } from './website-view.js';
import type { CreateStoreCommand, WebsiteView } from './dto.js';

const DEFAULT_STORE_CODE = 'main';
const DEFAULT_STORE_VIEW_CODE = 'default';

/**
 * The admin's "Create Store" action — one combined write producing a
 * Website + Store + StoreView together (see WebsiteRepository.createStore's
 * doc comment for why this isn't 3 separate screens: the admin thinks in
 * terms of "a store," and the existing us_retail setup is exactly 1-of-each
 * already). storeCode/storeViewCode default to 'main'/'default' (mirroring
 * prisma/seed.ts's own 'main'/'en' precedent) and are never a form field —
 * only website code, name, and currency are real admin input.
 *
 * Currency is set here and ONLY here — there is deliberately no
 * UpdateWebsiteCurrency use case. A cart's currency is snapshotted once at
 * creation and never re-derived (confirmed by this session's own earlier
 * real production bug), so a casual "edit currency" button on an existing
 * store would silently reintroduce that exact bug.
 */
export class CreateStore {
  constructor(private readonly websites: WebsiteRepository) {}

  async execute(cmd: CreateStoreCommand): Promise<WebsiteView> {
    const websiteCode = cmd.websiteCode.trim();
    const currency = cmd.currency.trim().toUpperCase();

    if (await this.websites.findByCode(websiteCode)) {
      throw new ConflictError(`website code already exists: ${websiteCode}`);
    }

    // Exactly one Language row exists in every deployment so far (see
    // prisma/seed.ts) — silently default to it rather than exposing a
    // picker for a choice that isn't real yet. If a second language is
    // ever registered, this becomes a real required input instead.
    const languageIds = await this.websites.listLanguageIds();
    const languageId = languageIds[0];
    if (languageId === undefined) {
      throw new ConflictError('no language is registered yet — a store view needs one');
    }

    const website = await this.websites.createStore({
      websiteCode,
      websiteName: cmd.websiteName.trim(),
      currency,
      storeCode: cmd.storeCode?.trim() || DEFAULT_STORE_CODE,
      storeViewCode: cmd.storeViewCode?.trim() || DEFAULT_STORE_VIEW_CODE,
      languageId,
    });
    return toWebsiteView(website);
  }
}
