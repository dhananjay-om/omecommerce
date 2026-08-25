import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { AnalyticsQueryRepository } from '../../analytics/domain/queries.js';
import { getOpenAiClient } from '../infrastructure/dynamic-openai-client.js';
import { ASSISTANT_TOOLS, TOOL_REPORT_LINKS, dispatchAssistantTool } from '../infrastructure/assistant-tools.js';
import { DomainError } from '../../../shared/domain/errors.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolLink {
  tool: string;
  label: string;
  href: string;
}

export interface ChatWithAssistantResult {
  message: string;
  toolsUsed: ToolLink[];
}

// A runaway-loop backstop, not a real limit — no normal question needs more
// than 1-2 tool-calling rounds; this just guarantees the request eventually
// terminates instead of looping forever against a model that keeps asking
// for more tools.
const MAX_ROUNDS = 5;

/** Natural-language question -> data-backed answer, via OpenAI function-
 *  calling against the real AnalyticsQueryRepository (assistant-tools.ts) —
 *  no conversation persistence (the client resends the whole transcript
 *  each turn, see ai.module.ts's route). Stateless server-side by design. */
export class ChatWithAssistant {
  constructor(
    private readonly db: Db,
    private readonly analytics: AnalyticsQueryRepository,
  ) {}

  async execute(input: { messages: ChatMessage[] }): Promise<ChatWithAssistantResult> {
    const handle = await getOpenAiClient(this.db);
    if (!handle) {
      throw new DomainError('AI Assistant needs an OpenAI key — configure one in AI Settings.', 'https://errors.ome/ai-not-configured', 404);
    }

    // The model has no built-in clock — without this, "this week"/"last
    // month" can't resolve to real dateFrom/dateTo before it calls a tool.
    const today = new Date().toISOString().slice(0, 10);
    const systemMessage: ChatCompletionMessageParam = {
      role: 'system',
      content:
        `You are the AI Assistant inside an e-commerce admin panel (OMEcommerce). Answer questions about the ` +
        `store's real orders, products, customers, and inventory ONLY using the provided tools — never invent ` +
        `numbers. Today's date is ${today} (UTC); resolve relative periods like "this week" or "last month" into ` +
        `real dateFrom/dateTo values yourself before calling a tool. Keep answers concise and concrete — lead ` +
        `with the number, then a brief explanation. If a question is outside what the tools can answer, say so ` +
        `plainly rather than guessing.`,
    };

    const working: ChatCompletionMessageParam[] = [systemMessage, ...input.messages];
    const toolsUsed = new Set<string>();

    for (let round = 0; round < MAX_ROUNDS; round++) {
      let completion;
      try {
        completion = await handle.client.chat.completions.create({
          model: handle.model,
          messages: working,
          tools: ASSISTANT_TOOLS,
          tool_choice: 'auto',
        });
      } catch (err) {
        // Same "re-throw the real provider error, don't swallow it into an
        // opaque 500" posture as TestAiConnection — a bad/expired key here
        // is a real, actionable thing to tell the admin, not an internal
        // server error.
        const message = err instanceof Error ? err.message : 'failed to reach OpenAI';
        throw new DomainError(message, 'https://errors.ome/ai-request-failed', 502);
      }
      const choice = completion.choices[0];
      if (!choice) {
        throw new DomainError('OpenAI returned no response', 'https://errors.ome/ai-empty-response', 502);
      }
      const responseMessage = choice.message;

      if (choice.finish_reason !== 'tool_calls' || !responseMessage.tool_calls?.length) {
        return {
          message: responseMessage.content ?? "I couldn't come up with an answer to that.",
          toolsUsed: [...toolsUsed].map((name) => ({ tool: name, ...(TOOL_REPORT_LINKS[name] ?? { label: name, href: '/ai/insights' }) })),
        };
      }

      working.push(responseMessage);
      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        toolsUsed.add(toolCall.function.name);
        let resultContent: string;
        try {
          const args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
          const result = await dispatchAssistantTool(toolCall.function.name, args, this.analytics);
          resultContent = JSON.stringify(result);
        } catch (err) {
          // A bad tool call (malformed args, unknown tool) becomes a tool
          // result the model can see and recover from — e.g. try different
          // arguments — rather than crashing the whole conversation.
          resultContent = JSON.stringify({ error: err instanceof Error ? err.message : 'tool call failed' });
        }
        working.push({ role: 'tool', tool_call_id: toolCall.id, content: resultContent });
      }
    }

    throw new DomainError('AI Assistant took too many steps to answer that — try a simpler or more specific question.', 'https://errors.ome/ai-too-many-steps', 502);
  }
}
