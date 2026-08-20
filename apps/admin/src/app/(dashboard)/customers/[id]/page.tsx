import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api-client';
import type { CustomerDetail } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * The "Overview" tab — name/email/status chrome now lives in the shared
 * [id]/layout.tsx, which already 404s first for a deleted/nonexistent
 * customer; this guard is just defense in depth for the same identical
 * call (see the layout's own header comment on Next's fetch dedup).
 */
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let customer: CustomerDetail;
  try {
    customer = await apiGet<CustomerDetail>(`/admin/v1/customers/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ');

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Email</div>
            <div className="font-medium">{customer.email}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Name</div>
            <div className="font-medium">{name || '—'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Created</div>
            <div className="font-medium">{new Date(customer.createdAt).toLocaleDateString()}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Addresses</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No addresses on file.</p>
          ) : (
            <div className="space-y-4">
              {customer.addresses.map((a, i) => (
                <div key={a.publicId}>
                  {i > 0 ? <Separator className="mb-4" /> : null}
                  <div className="flex items-start justify-between text-sm">
                    <div>
                      <div className="font-medium">{a.name}</div>
                      {a.company ? <div>{a.company}</div> : null}
                      <div>{a.line1}</div>
                      {a.line2 ? <div>{a.line2}</div> : null}
                      <div>
                        {a.city}
                        {a.region ? `, ${a.region}` : ''} {a.postalCode}
                      </div>
                      <div>{a.country}</div>
                      {a.phone ? <div className="text-muted-foreground">{a.phone}</div> : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {a.isDefaultShipping ? <Badge variant="secondary">Default Shipping</Badge> : null}
                      {a.isDefaultBilling ? <Badge variant="secondary">Default Billing</Badge> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
