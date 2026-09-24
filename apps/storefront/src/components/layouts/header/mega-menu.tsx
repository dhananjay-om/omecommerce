'use client';

import { useState, type MouseEvent } from 'react';
import Link from 'next/link';
import type { CategoryNode } from '@/lib/category-tree';
import type { MegaMenuItem, MegaMenuPromoImagePosition } from '@/types/mega-menu';

const linkClass = 'rounded-full px-3 py-1.5 text-sm font-medium text-charcoal transition-colors hover:bg-sand hover:text-jet';

// Reveal classes are dropped entirely while a panel is `closed` (just
// clicked a link inside it) — CSS :hover/:focus-within alone can't know a
// click already "used" the menu, so without this the panel stayed open over
// the page the click navigated to (cursor still hovering, clicked link still
// focused).
const REVEAL_CLASS = 'group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100';

const staticLinks = [
  { href: '/products', label: 'Products' },
  { href: '/brands', label: 'Brands' },
  { href: '/offers', label: 'Offers' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

// Where the promo image sits relative to the fixed horizontal row of
// columns — 'right'/'left' put it beside that row (outer flex-row(-reverse)),
// 'top'/'bottom' put it above/below the full-width row (outer flex-col(-reverse)).
// The columns row itself is ALWAYS a horizontal row internally — position
// only moves the image, it never re-stacks the columns themselves.
const PROMO_DIRECTION_CLASS: Record<MegaMenuPromoImagePosition, string> = {
  right: 'flex-row',
  left: 'flex-row-reverse',
  top: 'flex-col-reverse',
  bottom: 'flex-col',
};

/** Admin-configurable dropdown panel for one mega-menu item — panel
 *  width, spacing between columns, and the promo image's own
 *  width/height/position are all optional per-item settings (Content >
 *  Mega Menu > Dropdown Layout / Promo Panel); every one left unset here
 *  reproduces the exact look this panel had before those controls
 *  existed. */
function MegaMenuPanel({ item, closed }: { item: MegaMenuItem; closed: boolean }) {
  const isRow = item.promoImagePosition === 'left' || item.promoImagePosition === 'right';
  const promoWidth = item.promoImageWidth ? `${item.promoImageWidth}px` : isRow ? '160px' : '100%';
  const promoHeight = item.promoImageHeight ? `${item.promoImageHeight}px` : isRow ? '100%' : '200px';

  return (
    // group-focus-within (not just group-hover): visibility:hidden removes an
    // element from the tab order entirely, so a keyboard user tabbing to the
    // parent link needs :focus-within on the group to reveal the panel.
    <div
      className={`invisible absolute top-full left-1/2 z-40 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-start gap-6 rounded-2xl border border-ghost bg-white p-6 opacity-0 shadow-xl transition-opacity ${closed ? '' : REVEAL_CLASS} ${PROMO_DIRECTION_CLASS[item.promoImagePosition]}`}
      style={{ minWidth: item.panelWidth ? `${item.panelWidth}px` : '28rem' }}
    >
      {item.columns.length > 0 ? (
        <div className="flex flex-1" style={{ gap: item.columnGap != null ? `${item.columnGap}px` : '24px' }}>
          {item.columns.map((col, i) => (
            <div key={i} className="min-w-32">
              <div className="mb-2 text-xs font-semibold tracking-wide text-slate uppercase">{col.heading}</div>
              <div className="flex flex-col gap-1">
                {col.links.map((link) => (
                  <Link key={link.href} href={link.href} className="rounded-lg px-2 py-1.5 text-sm text-charcoal transition-colors hover:bg-sand hover:text-champagne">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {item.promoImageUrl ? (
        <Link href={item.promoHref || item.href} className="group/promo relative block shrink-0 overflow-hidden rounded-xl" style={{ width: promoWidth, height: promoHeight }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL, per-request/dynamic */}
          <img src={item.promoImageUrl} alt={item.promoCaption ?? ''} className="h-full w-full object-cover transition-transform group-hover/promo:scale-105" />
          {item.promoCaption ? (
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-2 text-xs font-medium text-white">{item.promoCaption}</span>
          ) : null}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Desktop nav with a hover-triggered dropdown per top-level item. Opening
 * is pure CSS (`group`/`group-hover`); the only JS state is which item was
 * just clicked, so its panel can close after navigating (see REVEAL_CLASS).
 * The dropdown is anchored to the <nav> (centered, clamped to the viewport)
 * rather than to its own item — anchored to the item, a wide panel on a
 * right-hand link stuck out past the window edge even while invisible and
 * gave the whole page a sideways scrollbar.
 *
 * `items` (admin-managed, Content > Mega Menu — see navigation.service.ts)
 * takes over completely once at least one exists: real multi-column
 * dropdowns with an optional promo image, in place of the auto-generated
 * one-level category tree this always rendered before that feature
 * existed. When `items` is empty (the untouched, never-configured case —
 * every site before this feature shipped), this falls back to that exact
 * original `tree`-based rendering, unchanged, so nothing regresses for a
 * site that hasn't set up the new admin page yet.
 */
export function MegaMenu({ tree, items }: { tree: CategoryNode[]; items: MegaMenuItem[] }) {
  const [closedId, setClosedId] = useState<string | null>(null);

  // Click anywhere inside a group (top link or a panel link): close it, and
  // drop focus from the clicked anchor so :focus-within doesn't re-open it
  // the moment the cursor leaves.
  const onGroupClick = (id: string) => (e: MouseEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest('a')) return;
    (e.target as HTMLElement).closest('a')?.blur();
    setClosedId(id);
  };
  const onGroupLeave = (id: string) => () => setClosedId((cur) => (cur === id ? null : cur));

  if (items.length > 0) {
    return (
      <nav className="relative hidden flex-1 items-center justify-center gap-1 lg:flex">
        <Link href="/" className={linkClass}>
          Home
        </Link>
        {items.map((item) => (
          <div key={item.publicId} className="group" onClick={onGroupClick(item.publicId)} onMouseLeave={onGroupLeave(item.publicId)}>
            <Link href={item.href} className={`flex items-center gap-1 ${linkClass}`}>
              {item.label}
            </Link>
            {item.columns.length > 0 || item.promoImageUrl ? <MegaMenuPanel item={item} closed={closedId === item.publicId} /> : null}
          </div>
        ))}
      </nav>
    );
  }

  // ÉLUME restyle: pill nav links (hover fills sand) + a rounded-2xl,
  // shadow-xl dropdown card matching the reference theme's Header.tsx.
  return (
    <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
      <Link href="/" className={linkClass}>
        Home
      </Link>
      {tree.map((node) => (
        <div key={node.category.publicId} className="group relative" onClick={onGroupClick(node.category.publicId)} onMouseLeave={onGroupLeave(node.category.publicId)}>
          <Link href={`/collections/${node.category.slug}`} className={`flex items-center gap-1 ${linkClass}`}>
            {node.category.nameDefault ?? node.category.slug}
          </Link>
          {node.children.length > 0 ? (
            <div className={`invisible absolute top-full left-0 z-40 min-w-56 rounded-2xl border border-ghost bg-white p-3 opacity-0 shadow-xl transition-opacity ${closedId === node.category.publicId ? '' : REVEAL_CLASS}`}>
              {node.children.map((child) => (
                <Link
                  key={child.category.publicId}
                  href={`/collections/${child.category.slug}`}
                  className="block rounded-lg px-3 py-2 text-sm text-charcoal transition-colors hover:bg-sand hover:text-champagne"
                >
                  {child.category.nameDefault ?? child.category.slug}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ))}
      {staticLinks.map((link) => (
        <Link key={link.href} href={link.href} className={linkClass}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
