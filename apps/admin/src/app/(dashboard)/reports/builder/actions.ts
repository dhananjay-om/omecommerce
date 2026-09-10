'use server';

import { revalidatePath } from 'next/cache';
import { apiGet, apiPost, apiDelete, buildQuery, ApiError } from '@/lib/api-client';
import type { ReportResult, SavedReportView } from '@/lib/types';

export interface RunReportResult {
  error: string | null;
  result: ReportResult | null;
}

/** Calls the backend's fully generic report-run route — every metric shares
 *  this one endpoint, so nothing here is metric-specific (see the client's
 *  own comment on why the table is rendered generically from
 *  result.columns/result.rows rather than per-metric columns). */
export async function runReport(metricCode: string, dateFrom: string, dateTo: string, limit: number): Promise<RunReportResult> {
  try {
    const result = await apiGet<ReportResult>('/admin/v1/analytics/reports/run' + buildQuery({ metricCode, dateFrom, dateTo, limit }));
    return { error: null, result };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, result: null };
    throw err;
  }
}

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createSavedReport(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get('name') ?? '').trim();
  const metricCode = String(formData.get('metricCode') ?? '').trim();
  const rangePreset = String(formData.get('rangePreset') ?? '').trim();
  const customFromDateKeyRaw = String(formData.get('customFromDateKey') ?? '').trim();
  const customToDateKeyRaw = String(formData.get('customToDateKey') ?? '').trim();

  if (!name) return { error: 'Name is required.', success: false };
  if (!metricCode) return { error: 'Metric is required.', success: false };
  if (!rangePreset) return { error: 'Date range is required.', success: false };
  if (rangePreset === 'custom' && (!customFromDateKeyRaw || !customToDateKeyRaw)) {
    return { error: 'Custom date range requires both dates.', success: false };
  }

  try {
    await apiPost<SavedReportView>('/admin/v1/analytics/saved-reports', {
      name,
      metricCode,
      rangePreset,
      ...(rangePreset === 'custom'
        ? { customFromDateKey: Number(customFromDateKeyRaw), customToDateKey: Number(customToDateKeyRaw) }
        : {}),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/reports/builder');
  return { error: null, success: true };
}

export async function deleteSavedReport(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  if (!publicId) return { error: 'Missing saved report id.', success: false };

  try {
    await apiDelete(`/admin/v1/analytics/saved-reports/${publicId}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/reports/builder');
  return { error: null, success: true };
}
