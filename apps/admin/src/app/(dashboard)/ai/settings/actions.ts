'use server';

import { revalidatePath } from 'next/cache';
import { apiPut, apiPost, ApiError } from '@/lib/api-client';
import type { AiSettings } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function updateAiSettings(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const apiKey = String(formData.get('apiKey') ?? '').trim();
  const model = String(formData.get('model') ?? '').trim();
  const isActive = formData.get('isActive') === 'on';

  if (!model) {
    return { error: 'Model is required.', success: false };
  }

  try {
    // Blank apiKey means "leave the currently-saved key unchanged" — see
    // UpdateAiSettings' own doc comment. Never sent as an empty string.
    await apiPut<AiSettings>('/admin/v1/ai/settings', { apiKey: apiKey || undefined, model, isActive });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/ai/settings');
  return { error: null, success: true };
}

export interface TestConnectionState {
  error: string | null;
  success: boolean;
  model: string | null;
}

/** Tests through whatever OpenAI client is currently active — the saved
 *  settings above, or the server's OPENAI_API_KEY env var if none are
 *  saved yet — see TestAiConnection's own doc comment on why it always
 *  exercises the real path, same reasoning as email-settings' Send Test
 *  Email action. */
export async function testAiConnection(_prevState: TestConnectionState): Promise<TestConnectionState> {
  try {
    const result = await apiPost<{ model: string }>('/admin/v1/ai/settings/test');
    return { error: null, success: true, model: result.model };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false, model: null };
    throw err;
  }
}
