'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { MigrationChannel, MigrationConnection, MigrationRun, MigrationPlan, MigrationRunResult } from '@/lib/types';
import {
  connectSource,
  testConnection,
  analyzeCatalog,
  startMigration,
  cancelMigration,
  getRun,
  type ActionState,
  type TestConnectionState,
} from './actions';

const initialConnectState: ActionState = { error: null, success: false };
const initialTestState: TestConnectionState = { error: null, success: false, storeName: null };

export function CatalogMigrationClient({
  channel,
  initialConnection,
  initialRun,
}: {
  channel: MigrationChannel;
  initialConnection: MigrationConnection | null;
  initialRun: MigrationRun | null;
}) {
  const router = useRouter();
  const channelLabel = channel === 'SHOPIFY' ? 'Shopify' : 'Magento';
  // No local mirror of the connection needed — connectSource's own server
  // action already calls revalidatePath, so router.refresh() re-fetches
  // this page's Server Component (getConnection) with fresh data and
  // re-renders this component with the real saved connection as a new
  // `initialConnection` prop directly.
  const connection = initialConnection;
  const [connectState, connectAction, connecting] = useActionState(connectSource.bind(null, channel), initialConnectState);
  const [testState, testAction, testing] = useActionState(testConnection.bind(null, channel), initialTestState);

  useEffect(() => {
    if (connectState.success) router.refresh();
  }, [connectState.success, router]);

  const [run, setRun] = useState(initialRun);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
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
    const result = await analyzeCatalog(channel);
    setAnalyzing(false);
    if (result.error || !result.run) {
      setAnalyzeError(result.error ?? 'Something went wrong.');
      return;
    }
    setApproved(false); // a fresh plan needs its own fresh review, not the last one's approval
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

  async function handleCancel() {
    if (!run) return;
    setCancelling(true);
    setCancelError(null);
    const result = await cancelMigration(run.publicId);
    setCancelling(false);
    if (result.error || !result.run) {
      setCancelError(result.error ?? 'Something went wrong.');
      return;
    }
    // Cancelling is cooperative — the run often still reads RUNNING for a
    // moment (the worker stops between products, not instantly) until the
    // next poll picks up CANCELLED. cancelRequested is already set either
    // way, so the worker will stop on its own even if this tab is closed.
    setRun(result.run);
  }

  if (!connection) {
    return (
      <Card className="max-w-xl">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">Connect {channelLabel}</CardTitle>
          <CardDescription>
            {channel === 'SHOPIFY' ? (
              <>
                Paste an Admin API access token from a custom app (Shopify Admin &gt; Settings &gt; Apps and sales
                channels &gt; Develop apps). No OAuth install needed.
              </>
            ) : (
              <>
                Paste an Integration Access Token (Magento Admin &gt; System &gt; Extensions &gt; Integrations &gt;
                create or open one, then Activate to get its token). No admin login is stored.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <form action={connectAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dm-store-url">Store URL</Label>
              <Input id="dm-store-url" name="storeUrl" placeholder={channel === 'SHOPIFY' ? 'my-shop.myshopify.com' : 'my-store.example.com'} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dm-api-token">{channel === 'SHOPIFY' ? 'Admin API Access Token' : 'Integration Access Token'}</Label>
              <Input
                id="dm-api-token"
                name="apiToken"
                type="password"
                autoComplete="off"
                required
                placeholder={channel === 'SHOPIFY' ? 'shpat_...' : undefined}
              />
            </div>
            {connectState.error ? <p className="text-sm text-destructive">{connectState.error}</p> : null}
            <Button type="submit" disabled={connecting}>
              {connecting ? 'Connecting…' : 'Connect'}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">{channelLabel}</CardTitle>
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

      {!run || run.status === 'COMPLETED' || run.status === 'FAILED' || run.status === 'CANCELLED' ? (
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
        (() => {
          // This page only ever fetches dataType=CATALOG runs (see
          // actions.ts's listRuns) — MigrationRun.plan is typed as a union
          // because the SAME type is shared with the Customers migration
          // page, which gets a CustomerMigrationPlan instead; narrow here
          // rather than threading a dataType generic through this whole
          // component for one field.
          const plan = run.plan as MigrationPlan;
          return (
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base">Migration Plan</CardTitle>
            <CardDescription>{plan.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <p className="text-sm">
              <span className="font-medium text-foreground">{plan.totalProducts}</span> products found.
            </p>
            <PlanCounts plan={plan} />
            <PlanSection title="Categories" entries={plan.categoryPlan.map((c) => ({ label: c.name, matched: c.action === 'MATCH_EXISTING' ? c.matchedCategoryName : undefined }))} />
            <AttributePlanSection entries={plan.attributePlan} />
            <PlanSection title="Attribute sets" entries={plan.attributeSetPlan.map((s) => ({ label: s.sourceProductType, matched: s.action === 'MATCH_EXISTING' ? s.matchedAttributeSetCode : undefined }))} />
            {plan.warnings.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Warnings</p>
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  {plan.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
              />
              <span>
                I&apos;ve reviewed the categories, attributes, and attribute sets above and approve this plan.
                Nothing runs until Start Migration is clicked below.
              </span>
            </label>
            <Button onClick={handleStart} disabled={starting || !approved}>
              {starting ? 'Starting…' : 'Approve & Start Migration'}
            </Button>
            {startError ? <p className="text-sm text-destructive">{startError}</p> : null}
          </CardContent>
        </Card>
          );
        })()
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
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Stopping…' : 'Stop'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Stops after the product currently in progress — nothing already migrated is undone, and you can
              resume later by running Check Migration again.
            </p>
            {cancelError ? <p className="text-sm text-destructive">{cancelError}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/** A clear "how many of each will actually be created vs. reused" count —
 *  the plan's detail sections below already show this per-item, but an
 *  admin managing a catalog with many product types/options needs the
 *  numbers up front, not a count they have to tally themselves. */
function PlanCounts({
  plan,
}: {
  plan: {
    categoryPlan: Array<{ action: 'CREATE' | 'MATCH_EXISTING' }>;
    attributePlan: Array<{ action: 'CREATE' | 'MATCH_EXISTING' }>;
    attributeSetPlan: Array<{ action: 'CREATE' | 'MATCH_EXISTING' }>;
  };
}) {
  const tiles = [
    { label: 'Categories', entries: plan.categoryPlan },
    { label: 'Attributes', entries: plan.attributePlan },
    { label: 'Attribute sets', entries: plan.attributeSetPlan },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tiles.map((t) => {
        const created = t.entries.filter((e) => e.action === 'CREATE').length;
        const matched = t.entries.filter((e) => e.action === 'MATCH_EXISTING').length;
        return (
          <div key={t.label} className="rounded-md border p-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t.label}</p>
            <p className="mt-1 text-sm">
              <span className="font-medium text-foreground">{created}</span> new,{' '}
              <span className="font-medium text-foreground">{matched}</span> matched to existing
            </p>
          </div>
        );
      })}
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

/** Unlike the other plan sections (a bare name badge), this one shows the
 *  REAL attribute that will be created or matched, plus a few real example
 *  values seen on the source store — so the admin can actually judge
 *  whether "Color" mapping to a new attribute with values Red/Blue/Green
 *  is correct before clicking Start, not just see that "something" will
 *  happen to it. */
function AttributePlanSection({
  entries,
}: {
  entries: Array<{ sourceOptionName: string; action: 'CREATE' | 'MATCH_EXISTING'; matchedAttributeCode?: string; newAttributeCode?: string; sampleValues?: string[] }>;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Variant attributes</p>
      <div className="space-y-2 rounded-md border p-3">
        {entries.map((e) => (
          <div key={e.sourceOptionName} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-medium text-foreground">{e.sourceOptionName}</span>
            <Badge variant={e.action === 'MATCH_EXISTING' ? 'secondary' : 'outline'}>
              {e.action === 'MATCH_EXISTING' ? `→ ${e.matchedAttributeCode}` : `new attribute "${e.newAttributeCode}"`}
            </Badge>
            {e.sampleValues && e.sampleValues.length > 0 ? (
              <span className="text-xs text-muted-foreground">values seen: {e.sampleValues.join(', ')}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function RunResultSummary({ run }: { run: MigrationRun }) {
  // Same narrowing reasoning as the Migration Plan card above — this page
  // only ever deals with CATALOG runs.
  const result = run.result as MigrationRunResult | null;
  if (run.status === 'FAILED') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">
          Last run failed{result?.fatalError ? `: ${result.fatalError}` : '.'}
        </p>
        <SkipFailDetails result={result} />
      </div>
    );
  }
  if (run.status === 'CANCELLED') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Last run was stopped after{' '}
          <span className="font-medium text-foreground">{result?.productsCreated ?? run.processedItems}</span>{' '}
          product(s) — nothing already migrated was undone. Check Migration again to pick up where it left off.
        </p>
        <SkipFailDetails result={result} />
      </div>
    );
  }
  if (!result) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Last run: <span className="font-medium text-foreground">{result.productsCreated}</span> products,{' '}
        <span className="font-medium text-foreground">{result.variantsCreated}</span> variants,{' '}
        <span className="font-medium text-foreground">{result.categoriesCreated}</span> categories created,{' '}
        {result.skipped.length} skipped, {result.failed.length} failed.
      </p>
      <SkipFailDetails result={result} />
    </div>
  );
}

/** Every skip/failure the worker records already names a real reason (e.g.
 *  "a product with this SKU already exists locally", "no SKU on the source
 *  product") — this just surfaces that list instead of leaving the admin
 *  with only a bare count to wonder about. Collapsed by default since a
 *  large catalog can produce a long list. */
function SkipFailDetails({ result }: { result: MigrationRunResult | null }) {
  const [open, setOpen] = useState(false);
  if (!result) return null;
  const items = [
    ...result.skipped.map((s) => ({ ...s, kind: 'Skipped' as const })),
    ...result.failed.map((f) => ({ ...f, kind: 'Failed' as const })),
  ];
  if (items.length === 0) return null;
  return (
    <div>
      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide' : 'View'} the {items.length} skipped/failed item{items.length === 1 ? '' : 's'} and why
      </Button>
      {open ? (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-2 py-1 font-medium">SKU</th>
                <th className="px-2 py-1 font-medium">Status</th>
                <th className="px-2 py-1 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={`${item.kind}-${item.externalId}-${i}`} className="border-t">
                  <td className="px-2 py-1 font-mono">{item.sku ?? `(external id ${item.externalId})`}</td>
                  <td className="px-2 py-1">
                    <Badge variant={item.kind === 'Failed' ? 'destructive' : 'outline'}>{item.kind}</Badge>
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
