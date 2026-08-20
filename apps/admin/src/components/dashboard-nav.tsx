'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Boxes,
  Warehouse,
  Tag,
  ShoppingCart,
  Users,
  ListTree,
  SlidersHorizontal,
  FolderTree,
  Coins,
  Percent,
  Receipt,
  Landmark,
  Store,
  FileText,
  LayoutTemplate,
  Image,
  LayoutGrid,
  CreditCard,
  Mail,
  Award,
  Share2,
  Building2,
  Wallet,
  UsersRound,
  RefreshCw,
  ShieldCheck,
  Truck,
  Banknote,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Dashboard only — no sub-items, so its rail button is a direct link instead of a flyout toggle. */
  href?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', items: [] },
  {
    key: 'catalog',
    label: 'Catalog',
    icon: Package,
    items: [
      { href: '/products', label: 'Products', icon: Package },
      { href: '/inventory', label: 'Inventory', icon: Boxes },
      { href: '/inventory/warehouses', label: 'Warehouses', icon: Warehouse },
      { href: '/pricing', label: 'Pricing', icon: Tag },
      { href: '/customer-groups', label: 'Customer Groups', icon: UsersRound },
      { href: '/categories', label: 'Categories', icon: FolderTree },
      { href: '/attribute-sets', label: 'Attribute Sets', icon: ListTree },
      { href: '/attributes', label: 'Attributes', icon: SlidersHorizontal },
    ],
  },
  {
    key: 'commerce',
    label: 'Commerce',
    icon: ShoppingCart,
    items: [
      { href: '/orders', label: 'Orders', icon: ShoppingCart },
      { href: '/customers', label: 'Customers', icon: Users },
      { href: '/coupons', label: 'Coupons', icon: Percent },
    ],
  },
  {
    key: 'loyalty',
    label: 'Loyalty & Rewards',
    icon: Award,
    items: [
      { href: '/gift-cards', label: 'Gift Cards', icon: CreditCard },
      { href: '/loyalty', label: 'Loyalty Program', icon: Award },
      { href: '/referrals', label: 'Referrals', icon: Share2 },
    ],
  },
  {
    key: 'b2b',
    label: 'B2B',
    icon: Building2,
    items: [{ href: '/companies', label: 'Companies', icon: Building2 }],
  },
  {
    key: 'content',
    label: 'Content',
    icon: FileText,
    items: [
      { href: '/content/pages', label: 'Pages', icon: FileText },
      { href: '/content/blocks', label: 'Blocks', icon: LayoutTemplate },
      { href: '/content/banners', label: 'Banners', icon: Image },
      { href: '/content/widgets', label: 'Widgets', icon: LayoutGrid },
    ],
  },
  {
    key: 'stores',
    label: 'Stores',
    icon: Store,
    items: [
      { href: '/stores/general', label: 'General', icon: Store },
      { href: '/stores/currencies', label: 'Currency Setup', icon: Coins },
      { href: '/stores/tax-classes', label: 'Tax Classes', icon: Receipt },
      { href: '/stores/shipping-methods', label: 'Shipping Methods', icon: Truck },
      { href: '/stores/payment-methods', label: 'Payment Methods', icon: Banknote },
      { href: '/stores/email-settings', label: 'Email (SMTP)', icon: Mail },
      { href: '/stores/gst-settings', label: 'GST Settings', icon: Landmark },
      { href: '/stores/wallet-settings', label: 'Wallet Settings', icon: Wallet },
      { href: '/stores/search-index', label: 'Search Index', icon: RefreshCw },
      { href: '/stores/permissions', label: 'Admin Permissions', icon: ShieldCheck },
    ],
  },
];

/** The most specific href matching this pathname, so e.g. /inventory/warehouses highlights
 *  only "Warehouses" and not also its parent "Inventory" entry. */
function bestMatchingHref(pathname: string): string | undefined {
  return NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href))
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/** TopHeader's breadcrumb reads this instead of keeping its own separate label
 *  map — one source of truth for "which real page is this," so a route added
 *  here is never silently missing from the breadcrumb too. */
export function sectionLabelForPath(pathname: string): string {
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return 'Dashboard';
  const href = bestMatchingHref(pathname);
  const item = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.href === href);
  return item?.label ?? 'Dashboard';
}

/** Which top-level rail group owns the currently active leaf (or 'dashboard' for its own direct link). */
function activeGroupKey(pathname: string): string | undefined {
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return 'dashboard';
  const href = bestMatchingHref(pathname);
  return NAV_GROUPS.find((g) => g.items.some((i) => i.href === href))?.key;
}

/**
 * Magento-style: a slim icon rail of top-level sections, each opening a flyout
 * panel of that section's real pages on click — replaces the old always-expanded
 * single long list, which had grown to 9+ items in "Stores" alone and read as
 * one messy wall of links regardless of which section an admin actually needed.
 */
export function DashboardNav() {
  const pathname = usePathname();
  const activeHref = bestMatchingHref(pathname);
  const activeGroup = activeGroupKey(pathname);
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Kept populated through the close animation — clearing openKey alone (leaving this
  // as-is) lets the panel slide/fade out still showing its last content, instead of
  // the flyout going visually blank a beat before it finishes disappearing.
  const [renderedGroup, setRenderedGroup] = useState<NavGroup | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function openFlyout(group: NavGroup) {
    setRenderedGroup(group);
    setOpenKey(group.key);
  }
  function closeFlyout() {
    setOpenKey(null);
  }

  // Close on navigation — this layout persists across route changes (Link clicks
  // don't unmount it), so the flyout needs an explicit reset. Adjusted during
  // render (React's documented pattern for "state derived from a changed prop"),
  // not in an effect, which would cause an extra cascading render for the same result.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpenKey(null);
  }

  useEffect(() => {
    if (!openKey) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeFlyout();
    }
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) closeFlyout();
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [openKey]);

  const isOpen = openKey !== null;

  return (
    <nav className="flex flex-col items-center gap-1">
      {NAV_GROUPS.map((group) => {
        const Icon = group.icon;
        // Only one rail item highlighted at a time: while a flyout is open, it alone
        // is highlighted (which page you're actually on takes a back seat) — otherwise
        // the current page's group is. Without isOpen gating this, clicking a
        // different section's rail button while still on e.g. /dashboard highlighted
        // both Dashboard (current page) and the newly-opened group simultaneously.
        const highlighted = isOpen ? group.key === openKey : group.key === activeGroup;
        const railButtonClass = cn(
          'flex w-20 flex-col items-center gap-1.5 rounded-lg py-3 text-[11px] font-medium tracking-wide',
          'transition-all duration-150 ease-out active:scale-90',
          highlighted
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/55 hover:scale-105 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground',
        );

        if (group.href) {
          return (
            <Link key={group.key} href={group.href} className={railButtonClass}>
              <Icon className="size-5" strokeWidth={2} />
              <span className="uppercase">{group.label}</span>
            </Link>
          );
        }

        return (
          <button
            key={group.key}
            type="button"
            className={railButtonClass}
            aria-expanded={group.key === openKey}
            onClick={() => (openKey === group.key ? closeFlyout() : openFlyout(group))}
          >
            <Icon className="size-5" strokeWidth={2} />
            <span className="text-center leading-tight uppercase">{group.label}</span>
          </button>
        );
      })}

      {/* Backdrop + panel stay mounted permanently (rather than only while open) so
          closing can play a real slide/fade transition instead of an instant unmount —
          pointer-events are switched off while closed so the invisible panel never
          blocks clicks on the page underneath. */}
      <div
        className={cn(
          // left-20 (not inset-0) — starts after the rail, so the dim/blur never
          // covers the rail itself; it should stay fully visible and clickable
          // while a flyout is open, e.g. to switch straight to another section.
          'fixed inset-y-0 left-20 right-0 z-40 bg-black/25 backdrop-blur-[1px] transition-opacity duration-200 ease-out',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={cn(
          'fixed top-0 left-20 z-50 max-h-[calc(100vh-2rem)] w-[640px] max-w-[calc(100vw-5rem)] overflow-y-auto',
          'rounded-b-2xl bg-sidebar text-sidebar-foreground shadow-2xl ring-1 ring-white/5',
          'transition-all duration-200 ease-out',
          isOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-6 opacity-0',
        )}
      >
        {renderedGroup ? (
          <>
            <div className="flex items-center justify-between px-8 pt-7 pb-5">
              <h2 className="text-2xl font-bold tracking-tight">{renderedGroup.label}</h2>
              <button
                type="button"
                onClick={closeFlyout}
                aria-label="Close menu"
                className="rounded-md p-1.5 text-sidebar-foreground/50 transition-all duration-150 hover:scale-110 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground active:scale-95"
              >
                <X className="size-5" />
              </button>
            </div>
            <div
              className={cn(
                'grid grid-cols-1 gap-x-8 gap-y-1 px-6 pb-8',
                renderedGroup.items.length > 4 ? 'sm:grid-cols-2' : '',
              )}
            >
              {renderedGroup.items.map((item, i) => {
                const itemActive = item.href === activeHref;
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={isOpen ? { transitionDelay: `${Math.min(i, 8) * 20}ms` } : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm transition-all duration-200 ease-out',
                      isOpen ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
                      itemActive
                        ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                        : 'font-medium text-sidebar-foreground/70 hover:translate-x-0.5 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground',
                    )}
                  >
                    <ItemIcon className="size-4 shrink-0" strokeWidth={2} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </nav>
  );
}
