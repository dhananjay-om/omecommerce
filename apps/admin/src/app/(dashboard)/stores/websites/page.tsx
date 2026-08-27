import { apiGet } from '@/lib/api-client';
import type { Website, Currency } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { NewStoreDialog } from './new-store-dialog';

export default async function WebsitesPage() {
  const [websites, currencies] = await Promise.all([
    apiGet<Website[]>('/admin/v1/websites'),
    apiGet<Currency[]>('/admin/v1/currencies'),
  ]);

  return (
    <div>
      <PageBreadcrumb items={[{ label: 'Stores', href: '/stores/websites' }, { label: 'Websites' }]} />

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-[1.32rem] font-extrabold tracking-tight">Websites</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each website is a separate store — its own currency, GST registration, and storefront
            experience. General/GST/Wallet settings below apply per-website once created here.
          </p>
        </div>
        <NewStoreDialog currencies={currencies} />
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Currency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {websites.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No websites yet.
                </TableCell>
              </TableRow>
            ) : (
              websites.map((w) => (
                <TableRow key={w.publicId}>
                  <TableCell className="font-medium">{w.code}</TableCell>
                  <TableCell>{w.name}</TableCell>
                  <TableCell>{w.baseCurrency}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
