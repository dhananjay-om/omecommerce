import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { apiGet } from '@/lib/api-client';
import type { ProductDetail } from '@/lib/types';
import { SITE_URL } from '@/lib/config';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { statusBadgeVariant } from '@/lib/status-badge';
import { cn } from '@/lib/utils';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await apiGet<ProductDetail>(`/admin/v1/products/${id}`);
  const attributeEntries = Object.entries(product.attributes);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/products" className="text-sm text-muted-foreground hover:underline">
          ← Back to Products
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{product.name ?? product.sku}</h1>
            <Badge variant={statusBadgeVariant(product.status)}>{product.status}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<a href={`${SITE_URL}/${product.slug}.html`} target="_blank" rel="noreferrer" />}
            >
              View Product
              <ExternalLink className="size-3.5" />
            </Button>
            <Link href={`/products/${product.publicId}/edit`} className={cn(buttonVariants())}>
              Edit
            </Link>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
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
          <div>
            <div className="text-muted-foreground">Weight</div>
            <div className="font-medium">{product.weight ? `${product.weight} kg` : '—'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Images</CardTitle>
        </CardHeader>
        <CardContent>
          {product.media.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No images yet.{' '}
              <Link href={`/products/${product.publicId}/edit`} className="underline hover:text-foreground">
                Add some
              </Link>
              .
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
              {product.media.map((m) => (
                // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic
                <img key={m.productMediaId} src={m.url} alt={m.altText ?? ''} className="aspect-square w-full rounded-md border object-cover" />
              ))}
            </div>
          )}
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
                  <TableHead>Axis Values</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Public ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.variants.map((v) => (
                  <TableRow key={v.publicId}>
                    <TableCell>{v.sku}</TableCell>
                    <TableCell>
                      {v.axisValues.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {v.axisValues.map((a) => (
                            <Badge key={a.attributeCode} variant="outline">
                              {a.attributeLabel}: {a.optionLabel}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(v.status)}>{v.status}</Badge>
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
            <Link href={`/products/${product.publicId}/edit`} className="underline hover:text-foreground">
              Edit these values
            </Link>{' '}
            — per-website/store/store-view overrides aren&apos;t supported here yet, GLOBAL scope only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
