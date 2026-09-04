'use server';

import { revalidatePath } from 'next/cache';
import { apiGet, apiPut, apiPost, ApiError } from '@/lib/api-client';
import type { MigrationConnection, MigrationRun } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function getConnection(): Promise<MigrationConnection | null> {
  return apiGet<MigrationConnection | null>('/admin/v1/migration/connections/SHOPIFY');
}

export async function connectShopify(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const storeUrl = String(formData.get('storeUrl') ?? '').trim();
  const apiToken = String(formData.get('apiToken') ?? '').trim();

  if (!storeUrl) {
    return { error: 'Store URL is required.', success: false };
  }

  try {
    // Blank apiToken means "leave the currently-saved token unchanged" —
    // same contract as AI Settings' apiKey. Never sent as an empty string.
    await apiPut<MigrationConnection>('/admin/v1/migration/connections/SHOPIFY', { storeUrl, apiToken: apiToken || undefined });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/data-migration/catalog');
  return { error: null, success: true };
}

export interface TestConnectionState {
  error: string | null;
  success: boolean;
  storeName: string | null;
}

export async function testConnection(_prevState: TestConnectionState): Promise<TestConnectionState> {
  try {
    const result = await apiPost<{ storeName?: string }>('/admin/v1/migration/connections/SHOPIFY/test');
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
export async function analyzeCatalog(): Promise<AnalyzeState> {
  try {
    const run = await apiPost<MigrationRun>('/admin/v1/migration/runs', { channel: 'SHOPIFY', dataType: 'CATALOG' });
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

/** Poll target for the progress bar while RUNNING. */
export async function getRun(runPublicId: string): Promise<MigrationRun> {
  return apiGet<MigrationRun>(`/admin/v1/migration/runs/${runPublicId}`);
}

export async function listRuns(): Promise<MigrationRun[]> {
  return apiGet<MigrationRun[]>('/admin/v1/migration/runs?channel=SHOPIFY');
}
