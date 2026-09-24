import Link from 'next/link';
import { PhoneIcon } from '@heroicons/react/24/outline';
import { getCmsBlockOrUndefined } from '@/services/content.service';
import { getTopBar } from '@/services/navigation.service';
import { getPublicStores, getSelectedStoreViewId, getSelectedWebsiteCode } from '@/lib/store-context';
import type { TopBar } from '@/types/top-bar';
import { StoreSwitcher } from './store-switcher';

/** Shown if the settings can't be fetched — the strip's original content, so a
 *  hiccup in the API never leaves the header without it. */
const FALLBACK_TOP_BAR: TopBar = {
  isEnabled: true,
  showStoreSwitcher: true,
  phone: '+1 (800) 555-0199',
  message: 'Free shipping on orders over $50',
  links: [
    { label: 'Track Order', href: '/orders/track' },
    { label: 'Help', href: '/contact' },
  ],
  isCustomized: false,
};

const LINK_CLASS = 'transition-colors hover:text-champagne';

function TopBarLinkItem({ label, href }: { label: string; href: string }) {
  // "/page" links stay inside the app; anything else (https:, mailto:, tel:) is a plain link.
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={LINK_CLASS}>
        {label}
      </Link>
    );
  }
  const external = /^https?:/i.test(href);
  return (
    <a href={href} className={LINK_CLASS} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {label}
    </a>
  );
}

/**
 * Top bar — the thin dark strip above the header. Everything in it is managed
 * in the admin under Content > Top Bar, per website: the store switcher on/off,
 * the phone number, the promo/shipping message, and the small links on the
 * right (Track Order, Help, or anything else), or the whole strip on/off.
 *
 * Until something is saved there, a website shows the built-in defaults — with
 * one legacy exception: if a `global_announcement_bar` CMS block exists and
 * nothing has been saved in Top Bar yet, that block's HTML still replaces the
 * left side, exactly as before Top Bar existed. The real, interactive
 * login/wishlist/cart controls live in the sticky main header below.
 */
export async function AnnouncementBar() {
  const websiteCode = await getSelectedWebsiteCode();
  const [topBar, stores, selectedStoreViewId] = await Promise.all([
    getTopBar(websiteCode).catch(() => FALLBACK_TOP_BAR),
    getPublicStores().catch(() => []),
    getSelectedStoreViewId(),
  ]);
  const legacyBlock = topBar.isCustomized ? undefined : await getCmsBlockOrUndefined('global_announcement_bar');

  if (!topBar.isEnabled) return null;

  const hasLeft = !!legacyBlock || topBar.showStoreSwitcher || !!topBar.phone || !!topBar.message;
  if (!hasLeft && topBar.links.length === 0) return null;

  return (
    <div className="hidden bg-foreground text-background md:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 text-xs tracking-wide sm:px-6">
        {legacyBlock ? (
          <div className="flex items-center gap-4 [&_a]:underline" dangerouslySetInnerHTML={{ __html: legacyBlock.body }} />
        ) : (
          <div className="flex items-center gap-4">
            {topBar.showStoreSwitcher ? <StoreSwitcher stores={stores} selectedStoreViewId={selectedStoreViewId} /> : null}
            {topBar.phone ? (
              <a href={`tel:${topBar.phone.replace(/[^\d+]/g, '')}`} className={`flex items-center gap-1 ${LINK_CLASS}`}>
                <PhoneIcon className="size-3.5" />
                {topBar.phone}
              </a>
            ) : null}
            {topBar.message ? <span className="hidden text-background/60 lg:inline">{topBar.message}</span> : null}
          </div>
        )}
        <div className="flex items-center gap-4">
          {(legacyBlock ? FALLBACK_TOP_BAR.links : topBar.links).map((link) => (
            <TopBarLinkItem key={`${link.label}|${link.href}`} label={link.label} href={link.href} />
          ))}
        </div>
      </div>
    </div>
  );
}
