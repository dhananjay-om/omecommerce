import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { DomainError } from '../../../shared/domain/errors.js';
import { getOpenAiClient } from '../infrastructure/dynamic-openai-client.js';

/** Proves the currently-saved key actually authenticates — same intent as
 *  order/application/send-test-email.usecase.ts's SendTestEmail (reuse the
 *  exact live path a real feature would use, re-throw the real provider
 *  error instead of swallowing it into a silent failure). Uses
 *  `models.list()` deliberately — it authenticates the key without
 *  spending any completion tokens, the cheapest real proof-of-life call the
 *  API offers. */
export class TestAiConnection {
  constructor(private readonly db: Db) {}

  async execute(): Promise<{ model: string }> {
    const handle = await getOpenAiClient(this.db);
    if (!handle) {
      throw new DomainError('No AI provider is configured — save an API key first', 'https://errors.ome/ai-not-configured', 404);
    }
    try {
      await handle.client.models.list();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'failed to connect to OpenAI';
      throw new DomainError(message, 'https://errors.ome/ai-test-failed', 502);
    }
    return { model: handle.model };
  }
}
