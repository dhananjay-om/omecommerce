'use server';

import { revalidatePath } from 'next/cache';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';
import type { AutomationRule, AutomationRuleRun } from '@/lib/types';

export interface RuleConditionInput {
  field: string;
  comparator: string;
  value: string;
}

export interface RuleActionInput {
  type: string;
  config: Record<string, string>;
}

export interface CreateRulePayload {
  name: string;
  description?: string;
  triggerType: string;
  conditions: RuleConditionInput[];
  actions: RuleActionInput[];
  isActive?: boolean;
}

export interface UpdateRulePayload {
  name?: string;
  description?: string | null;
  conditions?: RuleConditionInput[];
  actions?: RuleActionInput[];
  isActive?: boolean;
}

/** Both Rules and Workflows pages revalidate each other — they list the
 *  exact same underlying rows (see the plan's own "one engine, two
 *  framings" decision), so a change made from either page must be
 *  reflected on both. */
function revalidateBoth(): void {
  revalidatePath('/automation/rules');
  revalidatePath('/automation/workflows');
}

export async function createAutomationRule(payload: CreateRulePayload): Promise<{ error: string | null }> {
  try {
    await apiPost<AutomationRule>('/admin/v1/automation/rules', payload);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
  revalidateBoth();
  return { error: null };
}

export async function updateAutomationRule(publicId: string, payload: UpdateRulePayload): Promise<{ error: string | null }> {
  try {
    await apiPatch<AutomationRule>(`/admin/v1/automation/rules/${publicId}`, payload);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
  revalidateBoth();
  return { error: null };
}

export async function setAutomationRuleActive(publicId: string, isActive: boolean): Promise<{ error: string | null }> {
  return updateAutomationRule(publicId, { isActive });
}

export async function deleteAutomationRule(publicId: string): Promise<{ error: string | null }> {
  try {
    await apiDelete(`/admin/v1/automation/rules/${publicId}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
  revalidateBoth();
  return { error: null };
}

export async function fetchAutomationRuleRuns(publicId: string): Promise<AutomationRuleRun[]> {
  return apiGet<AutomationRuleRun[]>(`/admin/v1/automation/rules/${publicId}/runs?limit=10`);
}
