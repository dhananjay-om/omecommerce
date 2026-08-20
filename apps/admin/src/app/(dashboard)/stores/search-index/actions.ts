'use server';

import { apiPost, ApiError } from '@/lib/api-client';

export interface ReindexActionState {
  error: string | null;
  result: { indexed: number; removed: number; ranAt: string } | null;
}

export async function reindexSearch(_prevState: ReindexActionState): Promise<ReindexActionState> {
  try {
    const data = await apiPost<{ indexed: number; removed: number }>('/admin/v1/search/reindex');
    return { error: null, result: { ...data, ranAt: new Date().toISOString() } };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, result: null };
    throw err;
  }
}
