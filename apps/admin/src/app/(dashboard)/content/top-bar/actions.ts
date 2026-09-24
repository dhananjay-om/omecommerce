'use server';

import { revalidatePath } from 'next/cache';
import { apiPut, apiDelete, ApiError } from '@/lib/api-client';
import type { TopBarLink, TopBarSettings } from '@/lib/types';

export interface TopBarPayload {
  isEnabled: boolean;
  showStoreSwitcher: boolean;
  phone: string | null;
  message: string | null;
  links: TopBarLink[];
}

export interface ActionResult {
  error: string | null;
  settings?: TopBarSettings;
}

function message(err: ApiError): string {
  const details = err.errors?.map((e) => e.message).join('; ');
  return details ? `${err.message} — ${details}` : err.message;
}

export async function saveTopBar(websiteCode: string, payload: TopBarPayload): Promise<ActionResult> {
  try {
    const settings = await apiPut<TopBarSettings>(`/admin/v1/navigation/top-bar/${websiteCode}`, payload);
    revalidatePath('/content/top-bar');
    return { error: null, settings };
  } catch (err) {
    if (err instanceof ApiError) return { error: message(err) };
    throw err;
  }
}

export async function resetTopBar(websiteCode: string): Promise<ActionResult> {
  try {
    const settings = await apiDelete<TopBarSettings>(`/admin/v1/navigation/top-bar/${websiteCode}`);
    revalidatePath('/content/top-bar');
    return { error: null, settings };
  } catch (err) {
    if (err instanceof ApiError) return { error: message(err) };
    throw err;
  }
}
