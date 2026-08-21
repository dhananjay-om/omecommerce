'use client';

import Link from 'next/link';
import { HeartIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { buildCategoryTree } from '@/lib/category-tree';
import type { Category } from '@/types/category';
import type { Website } from '@/types/website';
import { MegaMenu } from './mega-menu';
import { SearchBar } from './search-bar';
import { UserMenu } from './user-menu';
import { MiniCart } from './mini-cart';
import { MobileMenu } from './mobile-menu';

export function MainHeader({ categories, website }: { categories: Category[]; website: Website }) {
  // Nav-only visibility filter — excluding a category here also drops its
  // whole subtree, since buildCategoryTree groups children by parentId and a
  // hidden parent's children simply won't match anything in the filtered
  // list. Filtering lives only at this call site: sitemap.ts, the homepage's
  // featured categories, and the PDP breadcrumb all call listCategories()
  // directly and must keep seeing every category regardless of menu visibility.
  const menuCategories = categories.filter((c) => c.includeInMenu);
  const tree = buildCategoryTree(menuCategories);

  return (
    <div className="border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <MobileMenu tree={tree} />
        <Link href="/" className="shrink-0 text-xl font-bold text-primary">
          {website.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic
            <img src={website.logoUrl} alt={website.name} className="h-8 w-auto object-contain" />
          ) : (
            <>
              OME<span className="text-cta">Shop</span>
            </>
          )}
        </Link>
        <SearchBar className="hidden flex-1 md:block" />
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Wishlist"
            render={<Link href="/account/wishlist" />}
            nativeButton={false}
            className="hidden sm:inline-flex"
          >
            <HeartIcon className="size-6" />
          </Button>
          <UserMenu />
          <MiniCart />
        </div>
      </div>
      <div className="border-t md:hidden">
        <div className="px-4 py-2">
          <SearchBar />
        </div>
      </div>
      <div className="mx-auto hidden max-w-7xl px-4 lg:block">
        <MegaMenu tree={tree} />
      </div>
    </div>
  );
}
