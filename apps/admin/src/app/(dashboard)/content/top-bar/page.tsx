import { apiGet } from '@/lib/api-client';
import type { Website, TopBarSettings } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { TopBarForm } from './top-bar-form';

/** Content > Top Bar — the thin dark strip above the storefront header
 *  (store switcher, phone, promo message, Track Order / Help links). One card
 *  per website, so each store can show its own number and message. */
export default async function TopBarPage() {
  const websites = await apiGet<Website[]>('/admin/v1/websites');
  const settings = await Promise.all(websites.map((w) => apiGet<TopBarSettings>(`/admin/v1/navigation/top-bar/${w.code}`)));

  return (
    <div>
      <PageBreadcrumb items={[{ label: 'Content', href: '/content/top-bar' }, { label: 'Top Bar' }]} />
      <div className="mt-2">
        <h1 className="text-[1.32rem] font-extrabold tracking-tight">Top Bar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The thin dark strip at the very top of your storefront. Change the phone number, the promo message and the
          links on the right (Track Order, Help, or anything else), or hide any part of it. Changes show on the store
          right after you save.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {websites.map((w, i) => (
          <Card key={w.code}>
            <CardHeader>
              <CardTitle>
                {w.name} <span className="text-sm font-normal text-muted-foreground">({w.code})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TopBarForm websiteCode={w.code} initial={settings[i]!} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
