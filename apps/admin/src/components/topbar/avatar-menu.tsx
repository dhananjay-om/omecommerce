'use client';

import { LogOut, Settings } from 'lucide-react';
import { logout } from '@/app/actions/auth';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/**
 * Replaces the old hardcoded "A" div + separate sign-out form with a real
 * menu (mock's avatar → Settings maps to `settings`'s real href below).
 * There's no `GET /admin/v1/auth/me` endpoint yet to show a real admin
 * name/email here — the "A" initial and "Admin" label are the same
 * placeholder identity the app has always shown, just inside a proper menu
 * now instead of a bare div.
 */
export function AvatarMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground outline-none">
        A
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Admin</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<a href="/stores/general" />}>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
