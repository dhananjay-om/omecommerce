'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/auth-store';

export function UserMenu() {
  const router = useRouter();
  const { isLoggedIn, firstName, hydrated, hydrate, logout } = useAuthStore();

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

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
        <DropdownMenuLabel>{firstName ? `Hi, ${firstName}` : 'My Account'}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account" />}>Account</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account/orders" />}>Orders</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account/wishlist" />}>Wishlist</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void logout().then(() => router.refresh());
          }}
        >
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
