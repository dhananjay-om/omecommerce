'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HeartIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { buildCategoryTree } from '@/lib/category-tree';
import type { Category } from '@/types/category';
import type { Website } from '@/types/website';
import { MegaMenu } from './mega-menu';
import { SearchBar } from './search-bar';
import { UserMenu } from './user-menu';
import { MiniCart } from './mini-cart';
import { MobileMenu } from './mobile-menu';

/**
 * ÉLUME restyle: a single row (hamburger, logo, centered nav, icon
 * cluster) matching the reference theme's Header.tsx exactly, replacing
 * the earlier two-row layout (a full-width search bar + icons on row one,
 * the nav as a separate row below). Search is now an icon that toggles a
 * full-width row underneath, same as the theme — not always-open. Real
 * auth (Login/Register when logged out, an account dropdown when signed
 * in) stays functional in the icon cluster — the one deliberate
 * difference from the theme, which has no real accounts to gate on.
 */
export function MainHeader({ categories, website }: { categories: Category[]; website: Website }) {
  // Nav-only visibility filter — excluding a category here also drops its
  // whole subtree, since buildCategoryTree groups children by parentId and a
  // hidden parent's children simply won't match anything in the filtered
  // list. Filtering lives only at this call site: sitemap.ts, the homepage's
  // featured categories, and the PDP breadcrumb all call listCategories()
  // directly and must keep seeing every category regardless of menu visibility.
  const menuCategories = categories.filter((c) => c.includeInMenu);
  const tree = buildCategoryTree(menuCategories);

  // A subtle shadow once the page scrolls past the top, matching the
  // reference theme's own scroll listener.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className={`border-b bg-background transition-shadow duration-300 ${scrolled ? 'shadow-sm' : ''}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <MobileMenu tree={tree} />

        <Link href="/" className="flex-1 text-center lg:flex-none lg:text-left">
          {website.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic
            <img src={website.logoUrl} alt={website.name} className="inline-block h-10 w-auto max-w-[200px] object-contain" />
          ) : (
            <span className="font-display text-2xl font-semibold tracking-[0.06em] text-jet">
              OME<span className="text-champagne">Shop</span>
            </span>
          )}
        </Link>

        <MegaMenu tree={tree} />

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search"
            onClick={() => setSearchOpen((v) => !v)}
            aria-expanded={searchOpen}
          >
            <MagnifyingGlassIcon className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Wishlist"
            render={<Link href="/account/wishlist" />}
            nativeButton={false}
            className="hidden sm:inline-flex"
          >
            <HeartIcon className="size-5" />
          </Button>
          <UserMenu />
          <MiniCart />
        </div>
      </div>

      {searchOpen ? (
        <div className="border-t border-ghost px-4 py-3 sm:px-6">
          <SearchBar className="mx-auto max-w-2xl" autoFocus onClose={() => setSearchOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
