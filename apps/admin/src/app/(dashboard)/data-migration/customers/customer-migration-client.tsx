'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { MigrationChannel, MigrationConnection, MigrationRun, CustomerMigrationPlan, CustomerMigrationRunResult } from '@/lib/types';
import {
  connectSource,
  testConnection,
  analyzeCustomers,
  startMigration,
  cancelMigration,
  getRun,
  type ActionState,
  type TestConnectionState,
} from './actions';

const initialConnectState: ActionState = { error: null, success: false };
const initialTestState: TestConnectionState = { error: null, success: false, storeName: null };

export function CustomerMigrationClient({
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
  // Same "no local state mirror" reasoning as CatalogMigrationClient — a
  // successful connectSource already revalidates this route.
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
    const result = await analyzeCustomers(channel);
    setAnalyzing(false);
    if (result.error || !result.run) {
      setAnalyzeError(result.error ?? 'Something went wrong.');
      return;
    }
    setApproved(false);
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
                The same connection Catalog/Orders migration use — connecting here (or there) works everywhere.
                Paste an Admin API access token from a custom app (Shopify Admin &gt; Settings &gt; Apps and sales
                channels &gt; Develop apps).
              </>
            ) : (
              <>
                The same connection Catalog/Orders migration use. Paste an Integration Access Token (Magento Admin
                &gt; System &gt; Extensions &gt; Integrations &gt; create or open one, then Activate to get its
                token).
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <form action={connectAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dmc-store-url">Store URL</Label>
              <Input id="dmc-store-url" name="storeUrl" placeholder={channel === 'SHOPIFY' ? 'my-shop.myshopify.com' : 'my-store.example.com'} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dmc-api-token">{channel === 'SHOPIFY' ? 'Admin API Access Token' : 'Integration Access Token'}</Label>
              <Input
                id="dmc-api-token"
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
            <CardTitle className="text-base">Customer Migration</CardTitle>
            <CardDescription>Migrates customer accounts and their saved addresses — no manual setup.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {run ? <RunResultSummary run={run} /> : null}
            <Button onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? 'Checking your customers…' : run ? 'Check Migration Again' : 'Check Migration'}
            </Button>
            {analyzeError ? <p className="text-sm text-destructive">{analyzeError}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {run && run.status === 'READY' && run.plan
        ? (() => {
            // This page only ever fetches dataType=CUSTOMER runs (see
            // actions.ts's listRuns) — MigrationRun.plan is a union because
            // it's shared with the Catalog page's own MigrationPlan.
            const plan = run.plan as CustomerMigrationPlan;
            return (
              <Card>
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-base">Migration Plan</CardTitle>
                  <CardDescription>{plan.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-md border p-3">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Total customers</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{plan.totalCustomers}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">No email (sample)</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{plan.customersWithoutEmailInSample}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Duplicate emails (sample)</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{plan.duplicateEmailsInSample}</p>
                    </div>
                  </div>
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
                      I&apos;ve reviewed the numbers and warnings above and approve this plan. Nothing runs until
                      Start Migration is clicked below.
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
        : null}

      {run && run.status === 'RUNNING' ? (
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base">Migrating…</CardTitle>
            <CardDescription>
              {run.processedItems} of {run.totalItems ?? '?'} customers processed
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
              Stops after the customer currently in progress — nothing already migrated is undone, and you can
              resume later by running Check Migration again.
            </p>
            {cancelError ? <p className="text-sm text-destructive">{cancelError}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function RunResultSummary({ run }: { run: MigrationRun }) {
  const result = run.result as CustomerMigrationRunResult | null;
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
          <span className="font-medium text-foreground">{result?.customersCreated ?? run.processedItems}</span>{' '}
          customer(s) — nothing already migrated was undone. Check Migration again to pick up where it left off.
        </p>
        <SkipFailDetails result={result} />
      </div>
    );
  }
  if (!result) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Last run: <span className="font-medium text-foreground">{result.customersCreated}</span> customers,{' '}
        <span className="font-medium text-foreground">{result.addressesCreated}</span> addresses created,{' '}
        {result.skipped.length} skipped, {result.failed.length} failed.
      </p>
      <SkipFailDetails result={result} />
    </div>
  );
}

/** Same "surface the real reason, not just a count" convention as the
 *  Catalog page's own SkipFailDetails. */
function SkipFailDetails({ result }: { result: CustomerMigrationRunResult | null }) {
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
                <th className="px-2 py-1 font-medium">Email</th>
                <th className="px-2 py-1 font-medium">Status</th>
                <th className="px-2 py-1 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={`${item.kind}-${item.externalId}-${i}`} className="border-t">
                  <td className="px-2 py-1 font-mono">{item.email ?? `(external id ${item.externalId})`}</td>
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
