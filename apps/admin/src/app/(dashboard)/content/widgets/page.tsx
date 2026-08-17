import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { WidgetInstance } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DeleteWidgetDialog } from './delete-widget-dialog';

const TYPE_LABELS: Record<string, string> = {
  CMS_BLOCK: 'CMS Block',
  HERO_BANNER_SLIDER: 'Hero Banner Slider',
  PROMO_BANNER_GRID: 'Promo Banner Grid',
  CATEGORY_GRID: 'Category Grid',
  BRAND_GRID: 'Brand Grid',
  WHY_CHOOSE_US_LIST: 'Why Choose Us',
  TESTIMONIAL_LIST: 'Testimonials',
};

const SECTION_LABELS: Record<string, string> = { TOP: 'Top', MIDDLE: 'Middle', FOOTER: 'Footer' };

/** Only page="home" is wired up in the admin UI today — the storefront's
 *  home page is the only page rendering widget zones so far. */
export default async function WidgetsPage() {
  const widgets = await apiGet<WidgetInstance[]>('/admin/v1/widgets?page=home');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Widgets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Placeable content for the home page — Top, Middle, and Footer sections, ordered by Position within each.
          </p>
        </div>
        <Link href="/content/widgets/new" className={cn(buttonVariants())}>
          New Widget
        </Link>
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Section</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Heading</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {widgets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No widgets yet.
                </TableCell>
              </TableRow>
            ) : (
              widgets.map((w) => (
                <TableRow key={w.publicId}>
                  <TableCell>
                    <Badge variant="outline">{SECTION_LABELS[w.section] ?? w.section}</Badge>
                  </TableCell>
                  <TableCell>{w.position}</TableCell>
                  <TableCell className="font-medium">{TYPE_LABELS[w.type] ?? w.type}</TableCell>
                  <TableCell className="text-muted-foreground">{w.title ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={w.isActive ? 'success' : 'secondary'}>{w.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/content/widgets/${w.publicId}/edit`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                        Edit
                      </Link>
                      <DeleteWidgetDialog publicId={w.publicId} label={w.title ?? TYPE_LABELS[w.type] ?? w.type} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
