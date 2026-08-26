import type { ChatCompletionContentPart } from 'openai/resources/chat/completions';
import type { OpenAiClientHandle } from './dynamic-openai-client.js';
import { DomainError } from '../../../shared/domain/errors.js';

/**
 * Per-product AI Assistant (product edit page's "AI Product Assistant" card)
 * — every function here is a thin, grounded OpenAI call: real product
 * context goes in (never invented), a draft/suggestion comes back. Nothing
 * here writes to the database — every result is a SUGGESTION the admin
 * reviews (and, for title/description/tags, edits inline) before "Save
 * Changes" persists it, same "draft, don't silently apply" posture as every
 * other AI feature in this module. Mirrors chat-with-assistant.usecase.ts's
 * error-handling pattern exactly (re-throw the real provider error as a
 * DomainError, never swallow it into an opaque 500).
 */
export interface ProductContext {
  title: string;
  description?: string;
  sku?: string;
  productType?: string;
  categoryNames?: string[];
  tags?: string[];
}

export interface ImageAnalysisDraft {
  title: string;
  description: string;
  tags: string[];
  metaTitle: string;
  metaDescription: string;
  dominantColor: string;
  productTypeGuess: string;
}

export interface PriceSuggestion {
  suggestedPrice: number;
  rationale: string;
}

export interface CategorySuggestion {
  category: string;
  rationale: string;
}

function contextBlock(ctx: ProductContext): string {
  return [
    `Title: ${ctx.title || '(none yet)'}`,
    ctx.sku ? `SKU: ${ctx.sku}` : null,
    ctx.productType ? `Product type: ${ctx.productType}` : null,
    ctx.categoryNames?.length ? `Categories: ${ctx.categoryNames.join(', ')}` : `Categories: (none assigned)`,
    ctx.tags?.length ? `Existing tags: ${ctx.tags.join(', ')}` : null,
    `Description: ${ctx.description?.trim() || '(none yet)'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function callOpenAi(handle: OpenAiClientHandle, systemPrompt: string, userText: string, image?: ChatCompletionContentPart): Promise<string> {
  const userContent: string | ChatCompletionContentPart[] = image ? [{ type: 'text', text: userText }, image] : userText;
  let completion;
  try {
    completion = await handle.client.chat.completions.create({
      model: handle.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });
  } catch (err) {
    // Same "re-throw the real provider error, don't swallow it into an
    // opaque 500" posture as ChatWithAssistant/TestAiConnection — a bad key
    // or a non-vision model picked for an image call is a real, actionable
    // thing to tell the admin.
    const message = err instanceof Error ? err.message : 'failed to reach OpenAI';
    throw new DomainError(message, 'https://errors.ome/ai-request-failed', 502);
  }
  const content = completion.choices[0]?.message.content;
  if (!content) throw new DomainError('OpenAI returned no response', 'https://errors.ome/ai-empty-response', 502);
  return content.trim();
}

async function callOpenAiJson<T>(handle: OpenAiClientHandle, systemPrompt: string, userText: string, image?: ChatCompletionContentPart): Promise<T> {
  const userContent: string | ChatCompletionContentPart[] = image ? [{ type: 'text', text: userText }, image] : userText;
  let completion;
  try {
    completion = await handle.client.chat.completions.create({
      model: handle.model,
      messages: [
        { role: 'system', content: `${systemPrompt} Respond with ONLY a single JSON object — no markdown fences, no commentary.` },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed to reach OpenAI';
    throw new DomainError(message, 'https://errors.ome/ai-request-failed', 502);
  }
  const content = completion.choices[0]?.message.content;
  if (!content) throw new DomainError('OpenAI returned no response', 'https://errors.ome/ai-empty-response', 502);
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new DomainError('OpenAI returned a response that could not be parsed', 'https://errors.ome/ai-malformed-response', 502);
  }
}

const GROUNDING_RULE =
  'You are a product-catalog copywriting assistant for an e-commerce admin panel. Base every answer strictly on the real product ' +
  'information given to you — never invent facts, specs, or claims not present in the context.';

export async function generateTitle(handle: OpenAiClientHandle, ctx: ProductContext): Promise<string> {
  const text = await callOpenAi(
    handle,
    `${GROUNDING_RULE} Suggest ONE improved, customer-facing product title — concise, specific, no marketing fluff or emoji. Reply with the title text only, no quotes.`,
    contextBlock(ctx),
  );
  return text.replace(/^["']|["']$/g, '');
}

export async function generateTags(handle: OpenAiClientHandle, ctx: ProductContext): Promise<string[]> {
  const draft = await callOpenAiJson<{ tags: string[] }>(
    handle,
    `${GROUNDING_RULE} Suggest 4-8 short merchandising/search tags (1-3 words each, lowercase, no hashtags) as a JSON object: {"tags": ["...", ...]}.`,
    contextBlock(ctx),
  );
  return (draft.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 8);
}

export async function generateSeoTitle(handle: OpenAiClientHandle, ctx: ProductContext): Promise<string> {
  const text = await callOpenAi(
    handle,
    `${GROUNDING_RULE} Write ONE SEO meta title, ideally under 60 characters, that would work well in a search-engine results page. Reply with the title text only, no quotes.`,
    contextBlock(ctx),
  );
  return text.replace(/^["']|["']$/g, '');
}

export async function generateMetaDescription(handle: OpenAiClientHandle, ctx: ProductContext): Promise<string> {
  const text = await callOpenAi(
    handle,
    `${GROUNDING_RULE} Write ONE SEO meta description, ideally 120-155 characters, that would work well in a search-engine results snippet. Reply with the description text only, no quotes.`,
    contextBlock(ctx),
  );
  return text.replace(/^["']|["']$/g, '');
}

export async function analyzeProductImage(handle: OpenAiClientHandle, ctx: ProductContext, imageDataUrl: string): Promise<ImageAnalysisDraft> {
  return callOpenAiJson<ImageAnalysisDraft>(
    handle,
    `${GROUNDING_RULE} Look at the attached product photo and the existing product context. Detect the dominant color and the ` +
      `type of product shown, then draft a full listing. Reply as a JSON object with exactly these keys: ` +
      `"title" (concise product title), "description" (2-4 sentences, plain text), "tags" (array of 4-8 short lowercase tags), ` +
      `"metaTitle" (SEO title, under 60 chars), "metaDescription" (SEO description, 120-155 chars), ` +
      `"dominantColor" (a short color name, e.g. "Midnight Blue"), "productTypeGuess" (a short category/type guess, e.g. "Phone case").`,
    contextBlock(ctx),
    { type: 'image_url', image_url: { url: imageDataUrl } },
  );
}

export async function analyzePerformance(handle: OpenAiClientHandle, ctx: ProductContext, performanceSummary: string): Promise<string> {
  return callOpenAi(
    handle,
    `${GROUNDING_RULE} You will be given real sales numbers for this product. Write a short (3-5 sentence) plain-English summary of ` +
      `how it's performing and one concrete, actionable suggestion. Use ONLY the numbers given — never estimate or round in a way ` +
      `that changes their meaning.`,
    `${contextBlock(ctx)}\n\nReal performance data:\n${performanceSummary}`,
  );
}

export async function suggestPrice(handle: OpenAiClientHandle, ctx: ProductContext, priceContext: string): Promise<PriceSuggestion> {
  return callOpenAiJson<PriceSuggestion>(
    handle,
    `${GROUNDING_RULE} You will be given the product's current price and, where available, category-average pricing and sales-` +
      `velocity data. Suggest a price and explain why in 1-3 sentences, grounded strictly in the numbers given. Reply as a JSON ` +
      `object: {"suggestedPrice": <number, no currency symbol>, "rationale": "..."}.`,
    `${contextBlock(ctx)}\n\nReal pricing data:\n${priceContext}`,
  );
}

export async function suggestCategory(handle: OpenAiClientHandle, ctx: ProductContext, availableCategoryNames: string[]): Promise<CategorySuggestion> {
  return callOpenAiJson<CategorySuggestion>(
    handle,
    `${GROUNDING_RULE} Pick the single BEST-matching category for this product from the exact list given — never invent a category ` +
      `name not in the list. Reply as a JSON object: {"category": "<one of the listed names, verbatim>", "rationale": "..."}.`,
    `${contextBlock(ctx)}\n\nAvailable categories:\n${availableCategoryNames.join(', ')}`,
  );
}
