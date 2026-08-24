'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/** One "Export" button (matching the mock's single Export action) instead
 *  of two separate always-visible "Export CSV"/"Export Excel" buttons —
 *  same two real formats, just behind one menu now. */
export function ExportMenu({ csvHref, xlsxHref }: { csvHref: string; xlsxHref: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            <Download className="size-3.5" />
            Export
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<a href={csvHref} />}>Export as CSV</DropdownMenuItem>
        <DropdownMenuItem render={<a href={xlsxHref} />}>Export as Excel</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
