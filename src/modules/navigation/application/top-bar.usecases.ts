import { NotFoundError } from '../../../shared/domain/errors.js';
import type { TopBarRepository, TopBarRecord, TopBarLink } from '../domain/repositories.js';

/** What a website shows until an admin saves something — identical to the
 *  strip's original hardcoded content, so nothing changes on deploy. */
export const DEFAULT_TOP_BAR: TopBarRecord = {
  isEnabled: true,
  showStoreSwitcher: true,
  phone: '+1 (800) 555-0199',
  message: 'Free shipping on orders over $50',
  links: [
    { label: 'Track Order', href: '/orders/track' },
    { label: 'Help', href: '/contact' },
  ],
};

export interface TopBarView extends TopBarRecord {
  websiteCode: string;
  /** false = showing the built-in defaults (nothing saved yet). */
  isCustomized: boolean;
}

export interface SaveTopBarCommand {
  isEnabled: boolean;
  showStoreSwitcher: boolean;
  phone?: string | null;
  message?: string | null;
  links: TopBarLink[];
}

function blankToNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export class GetTopBar {
  constructor(private readonly topBars: TopBarRepository) {}
  async execute(websiteCode: string): Promise<TopBarView> {
    const found = await this.topBars.findByWebsiteCode(websiteCode);
    if (!found) throw new NotFoundError('website', websiteCode);
    return found.record ? { websiteCode, ...found.record, isCustomized: true } : { websiteCode, ...DEFAULT_TOP_BAR, isCustomized: false };
  }
}

export class SaveTopBar {
  constructor(private readonly topBars: TopBarRepository) {}
  async execute(websiteCode: string, cmd: SaveTopBarCommand, actorId: bigint | null): Promise<TopBarView> {
    const found = await this.topBars.findByWebsiteCode(websiteCode);
    if (!found) throw new NotFoundError('website', websiteCode);
    const record: TopBarRecord = {
      isEnabled: cmd.isEnabled,
      showStoreSwitcher: cmd.showStoreSwitcher,
      phone: blankToNull(cmd.phone),
      message: blankToNull(cmd.message),
      links: cmd.links.map((l) => ({ label: l.label.trim(), href: l.href.trim() })),
    };
    await this.topBars.upsert(found.websiteId, record, actorId);
    return { websiteCode, ...record, isCustomized: true };
  }
}

export class ResetTopBar {
  constructor(private readonly topBars: TopBarRepository) {}
  async execute(websiteCode: string): Promise<TopBarView> {
    const found = await this.topBars.findByWebsiteCode(websiteCode);
    if (!found) throw new NotFoundError('website', websiteCode);
    await this.topBars.reset(found.websiteId);
    return { websiteCode, ...DEFAULT_TOP_BAR, isCustomized: false };
  }
}
