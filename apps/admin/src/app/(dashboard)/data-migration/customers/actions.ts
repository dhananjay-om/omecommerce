'use server';

import { revalidatePath } from 'next/cache';
import { apiGet, apiPut, apiPost, ApiError } from '@/lib/api-client';
import type { MigrationChannel, MigrationConnection, MigrationRun } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

// Connect/Test hit the exact same per-channel connection Catalog/Orders
// migration use — connecting on any of the 3 pages makes all 3 see it
// immediately. Duplicated here rather than shared, matching each
// migration page's own self-contained-page shape (each owns its whole
// flow end to end).
export async function getConnection(channel: MigrationChannel): Promise<MigrationConnection | null> {
  return apiGet<MigrationConnection | null>(`/admin/v1/migration/connections/${channel}`);
}

export async function connectSource(channel: MigrationChannel, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const storeUrl = String(formData.get('storeUrl') ?? '').trim();
  const apiToken = String(formData.get('apiToken') ?? '').trim();

  if (!storeUrl) {
    return { error: 'Store URL is required.', success: false };
  }

  try {
    await apiPut<MigrationConnection>(`/admin/v1/migration/connections/${channel}`, { storeUrl, apiToken: apiToken || undefined });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/data-migration/customers');
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

/** "Check Migration" — no AI call, unlike Catalog's (see AnalyzeCustomers'
 *  own doc comment on why a customer record has no real mapping ambiguity
 *  to resolve). Still a real request against the source store, not
 *  instant. */
export async function analyzeCustomers(channel: MigrationChannel): Promise<AnalyzeState> {
  try {
    const run = await apiPost<MigrationRun>('/admin/v1/migration/runs', { channel, dataType: 'CUSTOMER' });
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

/** "Stop" — same cooperative-stop contract as Catalog's own Stop button
 *  (see CancelMigrationRun's doc comment): finishes whatever customer it's
 *  currently on, then stops before starting the next one. */
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
  return apiGet<MigrationRun[]>(`/admin/v1/migration/runs?channel=${channel}&dataType=CUSTOMER`);
}
