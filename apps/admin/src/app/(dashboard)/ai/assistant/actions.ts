'use server';

import { apiPost, ApiError } from '@/lib/api-client';
import type { ChatMessage, ChatResult } from '@/lib/types';

export interface SendChatMessageResult {
  data: ChatResult | null;
  error: string | null;
}

/** Called directly from the chat client component (not via a <form>/
 *  useActionState — the conversation is accumulated client-side in
 *  useState, called on every send, not tied to a form submission
 *  lifecycle). No server-side persistence: `messages` is the whole running
 *  transcript, resent every call — see ChatWithAssistant's own doc
 *  comment on why. */
export async function sendChatMessage(messages: ChatMessage[]): Promise<SendChatMessageResult> {
  try {
    const data = await apiPost<ChatResult>('/admin/v1/ai/assistant/chat', { messages });
    return { data, error: null };
  } catch (err) {
    if (err instanceof ApiError) return { data: null, error: err.message };
    throw err;
  }
}
