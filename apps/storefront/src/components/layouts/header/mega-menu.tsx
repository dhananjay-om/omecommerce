import Link from 'next/link';
import type { CategoryNode } from '@/lib/category-tree';
import type { MegaMenuItem } from '@/types/mega-menu';

const linkClass = 'rounded-full px-3 py-1.5 text-sm font-medium text-charcoal transition-colors hover:bg-sand hover:text-jet';

const staticLinks = [
  { href: '/products', label: 'Products' },
  { href: '/brands', label: 'Brands' },
  { href: '/offers', label: 'Offers' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

/**
 * Desktop nav with a hover-triggered dropdown per top-level item. Pure
 * CSS (`group`/`group-hover`), no JS state — the primitives copied from
 * admin don't include a NavigationMenu component, and this doesn't need
 * one.
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
  if (items.length > 0) {
    return (
      <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
        <Link href="/" className={linkClass}>
          Home
        </Link>
        {items.map((item) => (
          <div key={item.publicId} className="group relative">
            <Link href={item.href} className={`flex items-center gap-1 ${linkClass}`}>
              {item.label}
            </Link>
            {item.columns.length > 0 || item.promoImageUrl ? (
              // group-focus-within (not just group-hover): visibility:hidden removes an
              // element from the tab order entirely, so a keyboard user tabbing to the
              // parent link needs :focus-within on the group to reveal the panel.
              <div className="invisible absolute top-full left-0 z-40 flex min-w-[28rem] gap-6 rounded-2xl border border-ghost bg-white p-6 opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
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
                {item.promoImageUrl ? (
                  <Link href={item.promoHref || item.href} className="group/promo relative block w-40 shrink-0 overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL, per-request/dynamic */}
                    <img src={item.promoImageUrl} alt={item.promoCaption ?? ''} className="h-full w-full object-cover transition-transform group-hover/promo:scale-105" />
                    {item.promoCaption ? (
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-2 text-xs font-medium text-white">{item.promoCaption}</span>
                    ) : null}
                  </Link>
                ) : null}
              </div>
            ) : null}
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
        <div key={node.category.publicId} className="group relative">
          <Link href={`/collections/${node.category.slug}`} className={`flex items-center gap-1 ${linkClass}`}>
            {node.category.nameDefault ?? node.category.slug}
          </Link>
          {node.children.length > 0 ? (
            <div className="invisible absolute top-full left-0 z-40 min-w-56 rounded-2xl border border-ghost bg-white p-3 opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
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
