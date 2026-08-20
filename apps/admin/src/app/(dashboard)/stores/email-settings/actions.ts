'use server';

import { revalidatePath } from 'next/cache';
import { apiPut, apiPost, ApiError } from '@/lib/api-client';
import type { EmailSettings } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function updateEmailSettings(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const host = String(formData.get('host') ?? '').trim();
  const portRaw = String(formData.get('port') ?? '').trim();
  const username = String(formData.get('username') ?? '').trim();
  // Blank means "leave the currently-saved password unchanged" — see
  // UpdateEmailSettings' own doc comment. Never sent as an empty string.
  const password = String(formData.get('password') ?? '').trim();
  const fromName = String(formData.get('fromName') ?? '').trim();
  const fromEmail = String(formData.get('fromEmail') ?? '').trim();

  const port = Number(portRaw);
  if (!host || !username || !Number.isInteger(port) || port <= 0 || port > 65535) {
    return { error: 'Host, a valid port (1–65535), and a username are required.', success: false };
  }

  try {
    await apiPut<EmailSettings>('/admin/v1/email-settings', {
      host,
      port,
      username,
      password: password || undefined,
      fromName: fromName || null,
      fromEmail: fromEmail || null,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/email-settings');
  return { error: null, success: true };
}

export interface TestEmailState {
  error: string | null;
  success: boolean;
}

/** Sends through whatever EmailSender is currently active (the saved settings
 *  above, or the server's SMTP_* env vars if none are saved yet) — see
 *  SendTestEmail's own doc comment on why it always exercises the real path. */
export async function sendTestEmail(
  _prevState: TestEmailState,
  formData: FormData,
): Promise<TestEmailState> {
  const to = String(formData.get('to') ?? '').trim();
  if (!to) return { error: 'Enter an email address to send the test to.', success: false };

  try {
    await apiPost('/admin/v1/email-settings/test', { to });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  return { error: null, success: true };
}
