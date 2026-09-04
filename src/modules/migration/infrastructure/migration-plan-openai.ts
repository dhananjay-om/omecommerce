import { DomainError } from '../../../shared/domain/errors.js';
import type { OpenAiClientHandle } from '../../ai/infrastructure/dynamic-openai-client.js';
import type { MigrationPlan } from '../application/dto.js';

/** Same JSON-mode invocation this codebase already established in
 *  src/modules/ai/infrastructure/product-assistant-openai.ts's own
 *  `callOpenAiJson` — a small, deliberate copy rather than importing across
 *  module boundaries for a 15-line helper (same "own trivial copy"
 *  precedent as RequestReviewImageUpload's relationship to
 *  RequestMediaUpload). */
async function callOpenAiJson<T>(handle: OpenAiClientHandle, systemPrompt: string, userText: string): Promise<T> {
  let completion;
  try {
    completion = await handle.client.chat.completions.create({
      model: handle.model,
      messages: [
        { role: 'system', content: `${systemPrompt} Respond with ONLY a single JSON object — no markdown fences, no commentary.` },
        { role: 'user', content: userText },
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

export interface MigrationPlanInputs {
  channel: string;
  totalProducts: number;
  /** Distinct source option names (e.g. Shopify variant options: "Color",
   *  "Size") seen across the sample, each with a few real example values —
   *  enough for the model to judge whether it's the same concept as an
   *  existing local attribute. */
  sourceOptionNames: Array<{ name: string; sampleValues: string[] }>;
  sourceProductTypes: string[];
  sourceCategoryNames: string[];
  existingAttributes: Array<{ code: string; label: string }>;
  existingAttributeSets: Array<{ code: string; name: string }>;
  existingCategoryNames: string[];
  productsWithoutSku: number;
}

const SYSTEM_PROMPT =
  'You are a catalog-migration planning assistant for an e-commerce admin panel. Your job is to decide how to map a ' +
  'foreign store\'s catalog structure onto this store\'s EXISTING attribute/attribute-set/category schema, so the ' +
  'migration can run with no further manual mapping. For every mapping decision, you MUST prefer matching an EXISTING ' +
  'local attribute/attribute-set/category when it genuinely represents the same real-world concept (e.g. "Colour" and ' +
  '"Color" and "colour_option" are the same concept) — only propose creating something new when nothing existing ' +
  'reasonably matches. Never invent a match to an existing name that is not in the list given to you.';

/** Runs ONCE per migration (during Analyze), not per product — the plan it
 *  produces is then applied deterministically by plain code across every
 *  product in the actual run (see catalog-migration.worker.ts's own doc
 *  comment for why: consistency, speed, and cost at real catalog scale). */
export async function generateMigrationPlan(handle: OpenAiClientHandle, inputs: MigrationPlanInputs): Promise<MigrationPlan> {
  const userText = JSON.stringify(inputs, null, 2);
  const schemaNote =
    'Reply as a JSON object exactly matching this shape: {"summary": "2-4 sentence plain-English description of what will ' +
    'happen, written for a store admin, not a developer", "categoryPlan": [{"externalId or name": ..., "name": "...", ' +
    '"action": "CREATE"|"MATCH_EXISTING", "matchedCategoryName"?: "..."}], "attributePlan": [{"sourceOptionName": "...", ' +
    '"action": "CREATE"|"MATCH_EXISTING", "matchedAttributeCode"?: "...", "newAttributeCode"?: "snake_case_code"}], ' +
    '"attributeSetPlan": [{"sourceProductType": "...", "action": "CREATE"|"MATCH_EXISTING", "matchedAttributeSetCode"?: ' +
    '"...", "newAttributeSetCode"?: "snake_case_code"}], "warnings": ["plain-English strings, e.g. about products missing ' +
    'a SKU"]}. One entry per distinct sourceOptionName/sourceProductType/category given — do not skip any.';

  const draft = await callOpenAiJson<RawMigrationPlan>(handle, SYSTEM_PROMPT, `${userText}\n\n${schemaNote}`);
  return normalizePlan(draft, inputs);
}

interface RawMigrationPlan {
  summary?: string;
  categoryPlan?: Array<{ name?: string; externalId?: string; action?: string; matchedCategoryName?: string }>;
  attributePlan?: Array<{ sourceOptionName?: string; action?: string; matchedAttributeCode?: string; newAttributeCode?: string }>;
  attributeSetPlan?: Array<{ sourceProductType?: string; action?: string; matchedAttributeSetCode?: string; newAttributeSetCode?: string }>;
  warnings?: string[];
}

/** Defends against a model reply that doesn't perfectly match the schema —
 *  drops malformed entries and falls back to a real, honest default (CREATE
 *  with a slugified name) rather than crashing the whole Analyze step over
 *  one bad field. Also re-validates every "MATCH_EXISTING" claim against
 *  the real lists given (same "never trust an unconstrained model claim"
 *  discipline as suggestAttributeValues's own option-list validation) —
 *  a hallucinated match name is downgraded to CREATE, not silently kept. */
function normalizePlan(draft: RawMigrationPlan, inputs: MigrationPlanInputs): MigrationPlan {
  const attrByCode = new Set(inputs.existingAttributes.map((a) => a.code));
  const setByCode = new Set(inputs.existingAttributeSets.map((s) => s.code));
  const categoryByName = new Set(inputs.existingCategoryNames);

  const slugify = (v: string) =>
    v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'migrated';

  const categoryPlan: MigrationPlan['categoryPlan'] = inputs.sourceCategoryNames.map((name) => {
    const found = (draft.categoryPlan ?? []).find((c) => c.name === name);
    const matchedName = found?.action === 'MATCH_EXISTING' ? found.matchedCategoryName : undefined;
    if (matchedName && categoryByName.has(matchedName)) {
      return { name, action: 'MATCH_EXISTING', matchedCategoryName: matchedName };
    }
    return { name, action: 'CREATE' };
  });

  const attributePlan: MigrationPlan['attributePlan'] = inputs.sourceOptionNames.map(({ name }) => {
    const found = (draft.attributePlan ?? []).find((a) => a.sourceOptionName === name);
    const matchedCode = found?.action === 'MATCH_EXISTING' ? found.matchedAttributeCode : undefined;
    if (matchedCode && attrByCode.has(matchedCode)) {
      return { sourceOptionName: name, action: 'MATCH_EXISTING', matchedAttributeCode: matchedCode };
    }
    return { sourceOptionName: name, action: 'CREATE', newAttributeCode: found?.newAttributeCode || slugify(name) };
  });

  const attributeSetPlan: MigrationPlan['attributeSetPlan'] = inputs.sourceProductTypes.map((type) => {
    const found = (draft.attributeSetPlan ?? []).find((s) => s.sourceProductType === type);
    const matchedCode = found?.action === 'MATCH_EXISTING' ? found.matchedAttributeSetCode : undefined;
    if (matchedCode && setByCode.has(matchedCode)) {
      return { sourceProductType: type, action: 'MATCH_EXISTING', matchedAttributeSetCode: matchedCode };
    }
    return { sourceProductType: type, action: 'CREATE', newAttributeSetCode: found?.newAttributeSetCode || slugify(type) };
  });

  const warnings = Array.isArray(draft.warnings) ? draft.warnings.filter((w): w is string => typeof w === 'string') : [];
  if (inputs.productsWithoutSku > 0) {
    warnings.push(`${inputs.productsWithoutSku} product(s) in the sample have no SKU and will be skipped.`);
  }

  return {
    summary: typeof draft.summary === 'string' && draft.summary.trim() ? draft.summary.trim() : `Migrate ${inputs.totalProducts} products from ${inputs.channel}.`,
    totalProducts: inputs.totalProducts,
    categoryPlan,
    attributePlan,
    attributeSetPlan,
    warnings,
  };
}
