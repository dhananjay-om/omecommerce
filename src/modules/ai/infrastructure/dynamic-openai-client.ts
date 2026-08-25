import OpenAI from 'openai';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { env } from '../../../config/env.js';

export interface OpenAiClientHandle {
  client: OpenAI;
  model: string;
}

/** Resolves an OpenAI client fresh on every call (not cached at boot) — same
 *  precedence and "re-check the DB every time" posture as order/
 *  infrastructure/dynamic-email-sender.ts's DynamicEmailSender: the
 *  admin-configurable AiSettings row (Stores > AI Settings) wins when it
 *  exists, is active, and has a key; OPENAI_API_KEY falls back to it when
 *  the row is absent/inactive/keyless; returns null when neither is
 *  configured, so callers degrade to "AI feature unavailable" instead of
 *  crashing. Only `getOpenAiClient` and TestAiConnection actually construct
 *  an OpenAI client today — no feature calls this yet (AI Assistant will be
 *  the first), this is deliberately just the plumbing shipped ahead of it. */
export async function getOpenAiClient(db: Db): Promise<OpenAiClientHandle | null> {
  const settings = await db.aiSettings.findFirst();
  if (settings && settings.isActive && settings.apiKey && settings.provider === 'openai') {
    return { client: new OpenAI({ apiKey: settings.apiKey }), model: settings.model };
  }
  if (env.OPENAI_API_KEY) {
    return { client: new OpenAI({ apiKey: env.OPENAI_API_KEY }), model: settings?.model ?? 'gpt-4o-mini' };
  }
  return null;
}
