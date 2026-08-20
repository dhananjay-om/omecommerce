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
  const panelRef = useRef<HTMLDivElement>(null);

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
      if (e.key === 'Escape') setOpenKey(null);
    }
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpenKey(null);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [openKey]);

  const openGroup = NAV_GROUPS.find((g) => g.key === openKey) ?? null;

  return (
    <nav className="flex flex-col items-center gap-1">
      {NAV_GROUPS.map((group) => {
        const Icon = group.icon;
        const active = group.key === activeGroup;
        const railButtonClass = cn(
          'flex w-16 flex-col items-center gap-1 rounded-lg py-2.5 text-[10.5px] font-medium tracking-wide transition-colors',
          active || group.key === openKey
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/55 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground',
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
            onClick={() => setOpenKey((k) => (k === group.key ? null : group.key))}
          >
            <Icon className="size-5" strokeWidth={2} />
            <span className="text-center leading-tight uppercase">{group.label}</span>
          </button>
        );
      })}

      {openGroup ? (
        <>
          {/* Dims the page behind the flyout and catches outside clicks — panelRef's own
              pointerdown listener above handles the actual close, this is just the visual scrim. */}
          <div className="fixed inset-0 z-40 bg-black/20" aria-hidden="true" />
          <div
            ref={panelRef}
            className="fixed top-0 bottom-0 left-16 z-50 w-[420px] overflow-y-auto bg-sidebar text-sidebar-foreground shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h2 className="text-xl font-bold tracking-tight">{openGroup.label}</h2>
              <button
                type="button"
                onClick={() => setOpenKey(null)}
                aria-label="Close menu"
                className="rounded-md p-1 text-sidebar-foreground/50 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 px-4 pb-6 sm:grid-cols-2">
              {openGroup.items.map((item) => {
                const itemActive = item.href === activeHref;
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                      itemActive
                        ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                        : 'font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground',
                    )}
                  >
                    <ItemIcon className="size-4 shrink-0" strokeWidth={2} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </nav>
  );
}
