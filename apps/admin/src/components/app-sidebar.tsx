'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, CircleHelp } from 'lucide-react';
import { NAV, bestMatchingNavItem } from '@/lib/nav-data';
import { cn } from '@/lib/utils';

/**
 * Always-visible 248px grouped-list sidebar (admin UI revamp — replaces
 * the old icon-rail + flyout `DashboardNav`, which stays in place,
 * unimported, for one iteration cycle as cheap revert insurance for a
 * daily-use-affecting change — see the plan). Reads `NAV` from
 * `lib/nav-data.ts` — the single source of truth also used by the
 * breadcrumb, the command palette, and every `ComingSoon` page.
 *
 * Active-item look (wash background + a left accent bar + solid white
 * text) and the footer (Help & Documentation + a store info card) match
 * the "Meridian Commerce OS" mock's `.sb-item.active`/`#sidebar-foot`
 * exactly, per explicit user color/content-parity feedback.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const activeItem = bestMatchingNavItem(pathname);

  return (
    <aside className="flex h-screen w-62 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <Link href="/dashboard" className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
          <ShoppingBag className="size-4.5 text-primary-foreground" strokeWidth={2.25} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight text-sidebar-foreground">OMEcommerce</div>
          <div className="text-[10px] font-medium tracking-wider text-sidebar-foreground/50 uppercase">Admin</div>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => (
          <div key={group.key} className="mb-4">
            <div
              className={cn(
                'flex items-center gap-1.5 px-2.5 pt-3 pb-1.5 text-[11px] font-semibold tracking-wider uppercase',
                group.accent === 'ai' ? 'text-primary' : 'text-sidebar-foreground/45',
              )}
            >
              {group.accent === 'ai' ? <group.icon className="size-3" /> : null}
              {group.label}
              {group.accent === 'ai' ? (
                <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-normal text-primary normal-case">
                  Powered by AI
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = item.key === activeItem?.key;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-r-lg border-l-2 py-1.5 pr-2.5 pl-2 text-sm transition-colors',
                      active
                        ? 'border-l-sidebar-primary bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                        : 'border-l-transparent text-sidebar-foreground/75 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground',
                    )}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={2} />
                    <span className="truncate">{item.label}</span>
                    {item.status === 'comingSoon' ? (
                      <span className="ml-auto rounded-full bg-sidebar-foreground/10 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-sidebar-foreground/50 uppercase">
                        Soon
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-2.5">
        <Link
          href="/system/notifications"
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
        >
          <CircleHelp className="size-4" strokeWidth={2} />
          Help &amp; Documentation
        </Link>
        <div className="mt-1 flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-[#1c2029] text-[10px] font-bold text-white">
            OM
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-white">OMEcommerce</div>
            <div className="text-[11px] text-sidebar-foreground/50">Store Admin</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
