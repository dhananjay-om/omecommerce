import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReindexButton } from './reindex-button';

export default function SearchIndexPage() {
  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Search Index</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The storefront&apos;s product search, category pages, and home page carousels are all
          served from a separate search index, not read live from the catalog — most edits (price,
          stock, status) reindex that one product automatically within moments, but a full reindex
          is worth running if something still looks stale: a missing image or price right after
          uploading it, a product that doesn&apos;t show up yet, or after a bulk change made outside
          the normal edit flow.
        </p>
      </div>

      <Card className="mt-6 max-w-2xl">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">Full reindex</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Rebuilds every active product&apos;s search document from the current database, and
            removes any leftover entry for a product that no longer exists. Safe to run any time —
            existing search results keep working while it runs, and it&apos;s a no-op if nothing has
            changed.
          </p>
          <ReindexButton />
        </CardContent>
      </Card>
    </div>
  );
}
