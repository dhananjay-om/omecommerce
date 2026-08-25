'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, ApiError } from '@/lib/api-client';

export interface RefreshState {
  error: string | null;
  success: boolean;
}

/** Mirrors ai/insights/actions.ts's refreshInsightsNow exactly — runs the
 *  same metric computation the nightly job runs (POST /admin/v1/ai/
 *  forecasts/refresh, RunNightlyForecastRefresh, for today's dateKey
 *  instead of "yesterday"), so this page doesn't have to wait until
 *  02:30 UTC to show something. */
export async function refreshForecastsNow(_prevState: RefreshState): Promise<RefreshState> {
  try {
    await apiPost('/admin/v1/ai/forecasts/refresh');
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/ai/forecasting');
  return { error: null, success: true };
}
