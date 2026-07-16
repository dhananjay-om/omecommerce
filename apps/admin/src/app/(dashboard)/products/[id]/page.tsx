import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { ProductDetail } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await apiGet<ProductDetail>(`/admin/v1/products/${id}`);
  const attributeEntries = Object.entries(product.attributes);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/products" className="text-sm text-muted-foreground hover:underline">
          ← Back to Products
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{product.name ?? product.sku}</h1>
          <Badge variant={product.status === 'ACTIVE' ? 'default' : 'secondary'}>{product.status}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">SKU</div>
            <div className="font-medium">{product.sku}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Type</div>
            <div className="font-medium">{product.type}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Visibility</div>
            <div className="font-medium">{product.visibility}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Attribute Set ID</div>
            <div className="font-medium">{product.attributeSetId}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Variants</CardTitle>
        </CardHeader>
        <CardContent>
          {product.variants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No variants.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Public ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.variants.map((v) => (
                  <TableRow key={v.publicId}>
                    <TableCell>{v.sku}</TableCell>
                    <TableCell>
                      <Badge variant={v.status === 'ACTIVE' ? 'default' : 'secondary'}>{v.status}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{v.publicId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attributes (GLOBAL scope)</CardTitle>
        </CardHeader>
        <CardContent>
          {attributeEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No GLOBAL-scope attribute values assigned.</p>
          ) : (
            <dl className="space-y-2 text-sm">
              {attributeEntries.map(([code, value], i) => (
                <div key={code}>
                  {i > 0 ? <Separator className="mb-2" /> : null}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{code}</dt>
                    <dd className="font-medium">{String(value)}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Read-only for now — editing attribute values (including per-website/store/store-view overrides) is a follow-up phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
