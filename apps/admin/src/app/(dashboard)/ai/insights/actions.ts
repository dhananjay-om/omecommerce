'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, ApiError } from '@/lib/api-client';

export interface RefreshState {
  error: string | null;
  success: boolean;
}

/** Runs the exact same rule engine the nightly job runs (POST /admin/v1/
 *  ai/insights/refresh — RunNightlyAiRefresh, just for today's dateKey
 *  instead of "yesterday"), so this page doesn't have to wait until
 *  02:30 UTC to show something. */
export async function refreshInsightsNow(_prevState: RefreshState): Promise<RefreshState> {
  try {
    await apiPost('/admin/v1/ai/insights/refresh');
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/ai/insights');
  return { error: null, success: true };
}
