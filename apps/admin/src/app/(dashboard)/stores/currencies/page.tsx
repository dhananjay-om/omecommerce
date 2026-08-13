import { apiGet } from '@/lib/api-client';
import type { Currency } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NewCurrencyDialog } from './new-currency-dialog';
import { EditCurrencyDialog } from './edit-currency-dialog';
import { DeleteCurrencyDialog } from './delete-currency-dialog';
import { SetDefaultCurrencyButton } from './set-default-currency-button';

export default async function CurrenciesPage() {
  const currencies = await apiGet<Currency[]>('/admin/v1/currencies');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Currency Setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Currencies registered here can be used as a price list&apos;s currency. Only USD is registered out of
            the box. The default currency pre-fills &quot;New Price List&quot;.
          </p>
        </div>
        <NewCurrencyDialog />
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Minor Units</TableHead>
              <TableHead>Default</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currencies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No currencies registered yet.
                </TableCell>
              </TableRow>
            ) : (
              currencies.map((c) => (
                <TableRow key={c.code}>
                  <TableCell className="font-medium">{c.code}</TableCell>
                  <TableCell>{c.symbol}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.minorUnits}</TableCell>
                  <TableCell>
                    {c.isDefault ? <Badge variant="success">Default</Badge> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {!c.isDefault ? <SetDefaultCurrencyButton code={c.code} /> : null}
                      <EditCurrencyDialog currency={c} />
                      <DeleteCurrencyDialog code={c.code} name={c.name} />
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
