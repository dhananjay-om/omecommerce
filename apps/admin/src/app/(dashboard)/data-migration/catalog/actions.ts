'use server';

import { revalidatePath } from 'next/cache';
import { apiGet, apiPut, apiPost, ApiError } from '@/lib/api-client';
import type { MigrationChannel, MigrationConnection, MigrationRun } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function getConnection(channel: MigrationChannel): Promise<MigrationConnection | null> {
  return apiGet<MigrationConnection | null>(`/admin/v1/migration/connections/${channel}`);
}

/** Bound to a channel client-side via `.bind(null, channel)` before being
 *  passed to useActionState — same pattern this app already uses for
 *  e.g. `refundOrder.bind(null, orderPublicId)`. */
export async function connectSource(channel: MigrationChannel, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const storeUrl = String(formData.get('storeUrl') ?? '').trim();
  const apiToken = String(formData.get('apiToken') ?? '').trim();

  if (!storeUrl) {
    return { error: 'Store URL is required.', success: false };
  }

  try {
    // Blank apiToken means "leave the currently-saved token unchanged" —
    // same contract as AI Settings' apiKey. Never sent as an empty string.
    await apiPut<MigrationConnection>(`/admin/v1/migration/connections/${channel}`, { storeUrl, apiToken: apiToken || undefined });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  // Not `revalidatePath('/data-migration/catalog?channel=...')` — Next
  // revalidates by path, not by search params, so the plain path covers
  // whichever channel is currently selected.
  revalidatePath('/data-migration/catalog');
  return { error: null, success: true };
}

export interface TestConnectionState {
  error: string | null;
  success: boolean;
  storeName: string | null;
}

export async function testConnection(channel: MigrationChannel, _prevState: TestConnectionState): Promise<TestConnectionState> {
  try {
    const result = await apiPost<{ storeName?: string }>(`/admin/v1/migration/connections/${channel}/test`);
    return { error: null, success: true, storeName: result.storeName ?? null };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false, storeName: null };
    throw err;
  }
}

export interface AnalyzeState {
  error: string | null;
  run: MigrationRun | null;
}

/** "Check Migration" — analyzes the real catalog and builds the AI mapping
 *  plan (a real request, not instant — bounded to a sample + one LLM call,
 *  see AnalyzeCatalog's own doc comment; no BullMQ job needed for this
 *  step). */
export async function analyzeCatalog(channel: MigrationChannel): Promise<AnalyzeState> {
  try {
    const run = await apiPost<MigrationRun>('/admin/v1/migration/runs', { channel, dataType: 'CATALOG' });
    return { error: null, run };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, run: null };
    throw err;
  }
}

export interface StartState {
  error: string | null;
  run: MigrationRun | null;
}

/** "Start Migration" — applies the already-built plan. The single click
 *  the "no manual intervention" requirement is about. */
export async function startMigration(runPublicId: string): Promise<StartState> {
  try {
    const run = await apiPost<MigrationRun>(`/admin/v1/migration/runs/${runPublicId}/start`);
    return { error: null, run };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, run: null };
    throw err;
  }
}

export interface CancelState {
  error: string | null;
  run: MigrationRun | null;
}

/** "Stop" — a cooperative request, not a hard kill (see CancelMigrationRun's
 *  own doc comment): the worker finishes whatever product it's on, then
 *  stops before starting the next one. Whatever already migrated stays
 *  migrated; re-running later picks up where this left off. */
export async function cancelMigration(runPublicId: string): Promise<CancelState> {
  try {
    const run = await apiPost<MigrationRun>(`/admin/v1/migration/runs/${runPublicId}/cancel`);
    return { error: null, run };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, run: null };
    throw err;
  }
}

/** Poll target for the progress bar while RUNNING. */
export async function getRun(runPublicId: string): Promise<MigrationRun> {
  return apiGet<MigrationRun>(`/admin/v1/migration/runs/${runPublicId}`);
}

export async function listRuns(channel: MigrationChannel): Promise<MigrationRun[]> {
  // Scoped to dataType=CATALOG — Catalog and Customer migration each have
  // their own independent Check Migration / Start / Stop history even
  // though they can share the same connection (see ListMigrationRuns'
  // own doc comment).
  return apiGet<MigrationRun[]>(`/admin/v1/migration/runs?channel=${channel}&dataType=CATALOG`);
}
