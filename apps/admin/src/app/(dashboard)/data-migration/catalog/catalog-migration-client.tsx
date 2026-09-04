'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { MigrationConnection, MigrationRun } from '@/lib/types';
import {
  connectShopify,
  testConnection,
  analyzeCatalog,
  startMigration,
  getRun,
  type ActionState,
  type TestConnectionState,
} from './actions';

const initialConnectState: ActionState = { error: null, success: false };
const initialTestState: TestConnectionState = { error: null, success: false, storeName: null };

export function CatalogMigrationClient({
  initialConnection,
  initialRun,
}: {
  initialConnection: MigrationConnection | null;
  initialRun: MigrationRun | null;
}) {
  const router = useRouter();
  // No local mirror of the connection needed — connectShopify's own server
  // action already calls revalidatePath, so router.refresh() re-fetches
  // this page's Server Component (getConnection) with fresh data and
  // re-renders this component with the real saved connection as a new
  // `initialConnection` prop directly.
  const connection = initialConnection;
  const [connectState, connectAction, connecting] = useActionState(connectShopify, initialConnectState);
  const [testState, testAction, testing] = useActionState(testConnection, initialTestState);

  useEffect(() => {
    if (connectState.success) router.refresh();
  }, [connectState.success, router]);

  const [run, setRun] = useState(initialRun);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  function poll(runPublicId: string) {
    pollTimer.current = setTimeout(async () => {
      const latest = await getRun(runPublicId);
      setRun(latest);
      if (latest.status === 'RUNNING') poll(runPublicId);
    }, 2000);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalyzeError(null);
    const result = await analyzeCatalog();
    setAnalyzing(false);
    if (result.error || !result.run) {
      setAnalyzeError(result.error ?? 'Something went wrong.');
      return;
    }
    setRun(result.run);
  }

  async function handleStart() {
    if (!run) return;
    setStarting(true);
    setStartError(null);
    const result = await startMigration(run.publicId);
    setStarting(false);
    if (result.error || !result.run) {
      setStartError(result.error ?? 'Something went wrong.');
      return;
    }
    setRun(result.run);
    poll(run.publicId);
  }

  if (!connection) {
    return (
      <Card className="max-w-xl">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">Connect Shopify</CardTitle>
          <CardDescription>
            Paste an Admin API access token from a custom app (Shopify Admin &gt; Settings &gt; Apps and sales
            channels &gt; Develop apps). No OAuth install needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <form action={connectAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dm-store-url">Store URL</Label>
              <Input id="dm-store-url" name="storeUrl" placeholder="my-shop.myshopify.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dm-api-token">Admin API Access Token</Label>
              <Input id="dm-api-token" name="apiToken" type="password" autoComplete="off" required placeholder="shpat_..." />
            </div>
            {connectState.error ? <p className="text-sm text-destructive">{connectState.error}</p> : null}
            <Button type="submit" disabled={connecting}>
              {connecting ? 'Connecting…' : 'Connect'}
            </Button>
          </form>

          <div className="rounded-lg border border-dashed p-4 opacity-60">
            <p className="text-sm font-medium">Magento</p>
            <p className="text-sm text-muted-foreground">Coming soon — the same engine, once Shopify is verified.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">Shopify</CardTitle>
          <CardDescription>{connection.storeUrl}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <form action={testAction}>
            <Button type="submit" variant="outline" size="sm" disabled={testing}>
              {testing ? 'Testing…' : 'Test Connection'}
            </Button>
          </form>
          {testState.error ? <p className="text-sm text-destructive">{testState.error}</p> : null}
          {testState.success ? (
            <p className="text-sm text-success">Connected{testState.storeName ? ` — ${testState.storeName}` : ''}.</p>
          ) : null}
        </CardContent>
      </Card>

      {!run || run.status === 'COMPLETED' || run.status === 'FAILED' ? (
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base">Catalog Migration</CardTitle>
            <CardDescription>Analyzes your real catalog and builds a mapping plan — no manual setup.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {run ? <RunResultSummary run={run} /> : null}
            <Button onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? 'Checking your catalog…' : run ? 'Check Migration Again' : 'Check Migration'}
            </Button>
            {analyzeError ? <p className="text-sm text-destructive">{analyzeError}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {run && run.status === 'READY' && run.plan ? (
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base">Migration Plan</CardTitle>
            <CardDescription>{run.plan.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <p className="text-sm">
              <span className="font-medium text-foreground">{run.plan.totalProducts}</span> products found.
            </p>
            <PlanSection title="Categories" entries={run.plan.categoryPlan.map((c) => ({ label: c.name, matched: c.action === 'MATCH_EXISTING' ? c.matchedCategoryName : undefined }))} />
            <PlanSection title="Variant attributes" entries={run.plan.attributePlan.map((a) => ({ label: a.sourceOptionName, matched: a.action === 'MATCH_EXISTING' ? a.matchedAttributeCode : undefined }))} />
            <PlanSection title="Attribute sets" entries={run.plan.attributeSetPlan.map((s) => ({ label: s.sourceProductType, matched: s.action === 'MATCH_EXISTING' ? s.matchedAttributeSetCode : undefined }))} />
            {run.plan.warnings.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Warnings</p>
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  {run.plan.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Button onClick={handleStart} disabled={starting}>
              {starting ? 'Starting…' : 'Start Migration'}
            </Button>
            {startError ? <p className="text-sm text-destructive">{startError}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {run && run.status === 'RUNNING' ? (
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base">Migrating…</CardTitle>
            <CardDescription>
              {run.processedItems} of {run.totalItems ?? '?'} products processed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${run.totalItems ? Math.round((run.processedItems / run.totalItems) * 100) : 0}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {run.skippedItems} skipped, {run.failedItems} failed so far.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function PlanSection({ title, entries }: { title: string; entries: Array<{ label: string; matched?: string }> }) {
  if (entries.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {entries.map((e) => (
          <Badge key={e.label} variant={e.matched ? 'secondary' : 'outline'}>
            {e.label} {e.matched ? `→ ${e.matched}` : '(new)'}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function RunResultSummary({ run }: { run: MigrationRun }) {
  if (run.status === 'FAILED') {
    return (
      <p className="text-sm text-destructive">
        Last run failed{run.result?.fatalError ? `: ${run.result.fatalError}` : '.'}
      </p>
    );
  }
  if (!run.result) return null;
  return (
    <p className="text-sm text-muted-foreground">
      Last run: <span className="font-medium text-foreground">{run.result.productsCreated}</span> products,{' '}
      <span className="font-medium text-foreground">{run.result.variantsCreated}</span> variants,{' '}
      <span className="font-medium text-foreground">{run.result.categoriesCreated}</span> categories created,{' '}
      {run.result.skipped.length} skipped, {run.result.failed.length} failed.
    </p>
  );
}
