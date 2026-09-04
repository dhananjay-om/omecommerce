'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/auth-store';
import { useWishlistStore } from '@/store/wishlist-store';

export function UserMenu() {
  const router = useRouter();
  const { isLoggedIn, firstName, hydrated, hydrate, logout } = useAuthStore();
  const { hydrated: wishlistHydrated, hydrate: hydrateWishlist, reset: resetWishlist } = useWishlistStore();

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  // Chained off auth's own hydration (not a separate isLoggedIn check up
  // front) — wishlist hydrate() needs to know isLoggedIn, and auth-store
  // itself resolves that asynchronously, so this only fires once that's
  // actually settled. Real per-customer state (like the cart), not local.
  useEffect(() => {
    if (hydrated && !wishlistHydrated) void hydrateWishlist();
  }, [hydrated, wishlistHydrated, hydrateWishlist]);

  if (!isLoggedIn) {
    return (
      <div className="hidden items-center gap-1 sm:flex">
        <Button variant="ghost" size="sm" render={<Link href="/login" />} nativeButton={false}>
          Login
        </Button>
        <Button variant="cta" size="sm" render={<Link href="/register" />} nativeButton={false}>
          Register
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Account menu">
            <UserIcon className="size-6" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {/* Base UI requires GroupLabel to live inside a Group — a bare Label crashed the whole menu on open. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>{firstName ? `Hi, ${firstName}` : 'My Account'}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account" />}>Account</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account/orders" />}>Orders</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account/wishlist" />}>Wishlist</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void logout().then(() => {
              resetWishlist();
              router.refresh();
            });
          }}
        >
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
