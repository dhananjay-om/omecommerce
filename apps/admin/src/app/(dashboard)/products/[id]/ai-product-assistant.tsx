'use client';

import { useState } from 'react';
import { Sparkles, CircleCheck, CircleAlert } from 'lucide-react';
import { requestUploadUrl } from './edit/media-actions';
import {
  generateSeoTitle,
  generateMetaDescription,
  analyzeProductImage,
  analyzePerformance,
  suggestPrice,
  suggestCategory,
  suggestAttributeValues,
  applySeoCopy,
  type ProductAiContext,
  type AttributeForSuggestion,
} from './ai-product-assistant-actions';
import type { ProductImageAnalysis, ProductAttributeSuggestion } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUploadButton } from '@/components/ui/file-upload-button';
import { cn } from '@/lib/utils';

type QuickActionKey = 'seoTitle' | 'metaDescription' | 'performance' | 'price' | 'category' | 'attributes' | 'missingData';

const QUICK_ACTIONS: Array<{ key: QuickActionKey; label: string }> = [
  { key: 'seoTitle', label: 'Generate SEO Title' },
  { key: 'metaDescription', label: 'Generate Meta Description' },
  { key: 'performance', label: 'Analyze Product Performance' },
  { key: 'price', label: 'Suggest Price' },
  { key: 'category', label: 'Suggest Category' },
  { key: 'attributes', label: 'Suggest Attribute Values' },
  { key: 'missingData', label: 'Detect Missing Product Data' },
];

type QuickActionResult =
  | { kind: 'text'; label: string; value: string; applyLabel?: string; onApply?: () => void; applied?: boolean; applyPending?: boolean }
  | { kind: 'price'; suggestedPrice: number; rationale: string }
  | { kind: 'category'; category: string; rationale: string }
  | { kind: 'attributes'; suggestions: ProductAttributeSuggestion[] }
  | { kind: 'missingData'; missing: string[] };

/**
 * The product edit page's "AI Product Assistant" card — every action here
 * is a thin, grounded call into src/modules/ai's product-assistant use case
 * (see that file's own header comment for the full "draft, don't silently
 * apply" philosophy). Two different apply postures, both deliberate:
 *  - Generate from Image fills Title/Description/Tags directly into this
 *    page's own (still-unsaved) form fields — a real "draft the listing"
 *    experience, reviewable/editable before the normal Save Changes.
 *  - SEO copy (both from image analysis and the 2 SEO quick actions)
 *    persists immediately via applySeoCopy — the SEO tab is a separate
 *    route this component isn't mounted on, so there's no local field to
 *    preview into; the result panel says so explicitly.
 *  - Performance/Price/Category are purely informational suggestions —
 *    performance has no "apply" concept, and price/category changes are
 *    consequential enough (a live price, a storefront-visible category)
 *    that this deliberately doesn't auto-apply them; each links to the
 *    real tab where the admin makes that call themselves.
 */
export function AiProductAssistant({
  productPublicId,
  categoryNames,
  metaTitle,
  metaDescription,
  attributesForSuggestion,
  getContext,
  applyTitle,
  applyDescription,
  applyTags,
}: {
  productPublicId: string;
  categoryNames: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  /** The current attribute set's own real attributes (Description/SEO
   *  excluded — those have their own dedicated generate buttons) with
   *  their real option lists, for Suggest Attribute Values' grounding. */
  attributesForSuggestion: AttributeForSuggestion[];
  getContext: () => ProductAiContext;
  applyTitle: (title: string) => void;
  applyDescription: (description: string) => void;
  applyTags: (tags: string[]) => void;
}) {
  const [pickedFile, setPickedFile] = useState<{ storageKey: string; mimeType: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [appliedFromImage, setAppliedFromImage] = useState<ImageDraftApplyState | null>(null);

  const [activeAction, setActiveAction] = useState<QuickActionKey | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<QuickActionResult | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    setAnalyzeError(null);
    setAppliedFromImage(null);
    setUploading(true);
    try {
      const presign = await requestUploadUrl(file.name, file.type);
      if (presign.error || !presign.uploadUrl || !presign.storageKey) {
        setUploadError(presign.error ?? 'Could not start upload.');
        return;
      }
      const putRes = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!putRes.ok) {
        setUploadError('Upload to storage failed.');
        return;
      }
      setPickedFile({ storageKey: presign.storageKey, mimeType: file.type, name: file.name });
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyzeAndGenerate() {
    if (!pickedFile) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await analyzeProductImage(productPublicId, pickedFile.storageKey, pickedFile.mimeType, getContext());
      if (result.error || !result.data) {
        setAnalyzeError(result.error ?? 'Analysis failed.');
        return;
      }
      applyDraft(result.data);
    } finally {
      setAnalyzing(false);
    }
  }

  function applyDraft(draft: ProductImageAnalysis) {
    applyTitle(draft.title);
    applyDescription(draft.description);
    applyTags(draft.tags);
    setAppliedFromImage({ draft, seoApplied: false, seoPending: false, seoError: null });
  }

  async function handleApplySeoFromImage() {
    if (!appliedFromImage) return;
    setAppliedFromImage({ ...appliedFromImage, seoPending: true, seoError: null });
    const result = await applySeoCopy(productPublicId, {
      metaTitle: appliedFromImage.draft.metaTitle,
      metaDescription: appliedFromImage.draft.metaDescription,
    });
    setAppliedFromImage({ ...appliedFromImage, seoPending: false, seoApplied: !result.error, seoError: result.error });
  }

  async function runQuickAction(key: QuickActionKey) {
    setActiveAction(key);
    setActionError(null);
    setActionResult(null);

    if (key === 'missingData') {
      const ctx = getContext();
      const missing: string[] = [];
      if (!ctx.description?.trim()) missing.push('Description');
      if (!ctx.tags || ctx.tags.length === 0) missing.push('Tags');
      if (!categoryNames.length) missing.push('Category assignment');
      if (!metaTitle?.trim()) missing.push('SEO meta title');
      if (!metaDescription?.trim()) missing.push('SEO meta description');
      setActionResult({ kind: 'missingData', missing });
      return;
    }

    setActionPending(true);
    try {
      const ctx = getContext();
      if (key === 'seoTitle') {
        const result = await generateSeoTitle(productPublicId, ctx);
        if (result.error || !result.data) return setActionError(result.error ?? 'Generation failed.');
        setActionResult({ kind: 'text', label: 'Suggested SEO title', value: result.data.metaTitle, applyLabel: 'Apply to SEO tab', onApply: () => applySeo({ metaTitle: result.data!.metaTitle }) });
      } else if (key === 'metaDescription') {
        const result = await generateMetaDescription(productPublicId, ctx);
        if (result.error || !result.data) return setActionError(result.error ?? 'Generation failed.');
        setActionResult({
          kind: 'text',
          label: 'Suggested meta description',
          value: result.data.metaDescription,
          applyLabel: 'Apply to SEO tab',
          onApply: () => applySeo({ metaDescription: result.data!.metaDescription }),
        });
      } else if (key === 'performance') {
        const result = await analyzePerformance(productPublicId, ctx);
        if (result.error || !result.data) return setActionError(result.error ?? 'Analysis failed.');
        setActionResult({ kind: 'text', label: 'Performance summary', value: result.data.narrative });
      } else if (key === 'price') {
        const result = await suggestPrice(productPublicId, ctx);
        if (result.error || !result.data) return setActionError(result.error ?? 'Suggestion failed.');
        setActionResult({ kind: 'price', suggestedPrice: result.data.suggestedPrice, rationale: result.data.rationale });
      } else if (key === 'category') {
        const result = await suggestCategory(productPublicId, ctx, categoryNames);
        if (result.error || !result.data) return setActionError(result.error ?? 'Suggestion failed.');
        setActionResult({ kind: 'category', category: result.data.category, rationale: result.data.rationale });
      } else if (key === 'attributes') {
        if (attributesForSuggestion.length === 0) {
          setActionResult({ kind: 'attributes', suggestions: [] });
          return;
        }
        const result = await suggestAttributeValues(productPublicId, ctx, attributesForSuggestion);
        if (result.error || !result.data) return setActionError(result.error ?? 'Suggestion failed.');
        setActionResult({ kind: 'attributes', suggestions: result.data.suggestions });
      }
    } finally {
      setActionPending(false);
    }
  }

  async function applySeo(values: { metaTitle?: string; metaDescription?: string }) {
    setActionResult((prev) => (prev && prev.kind === 'text' ? { ...prev, applyPending: true } : prev));
    const result = await applySeoCopy(productPublicId, values);
    setActionResult((prev) => (prev && prev.kind === 'text' ? { ...prev, applyPending: false, applied: !result.error } : prev));
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-1.5 text-[0.88rem] font-bold">
          <Sparkles className="size-3.5 text-primary" />
          AI Product Assistant
        </CardTitle>
        <p className="text-xs text-muted-foreground">Generate content, or upload a photo and let AI draft the listing.</p>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs font-semibold">Generate from Image</p>
          <p className="mt-1 text-xs text-muted-foreground">Upload a product photo — AI detects the dominant color and product type, then drafts title, description, tags and SEO copy.</p>
          {uploadError ? <p className="mt-1.5 text-xs text-destructive">{uploadError}</p> : null}
          {analyzeError ? <p className="mt-1.5 text-xs text-destructive">{analyzeError}</p> : null}
          {pickedFile ? <p className="mt-1.5 truncate text-xs text-muted-foreground">Selected: {pickedFile.name}</p> : null}
          <div className="mt-2 flex gap-2">
            <FileUploadButton accept="image/*" onChange={handleFileChange} disabled={uploading} label={uploading ? 'Uploading…' : 'Upload Photo'} className="flex-1 justify-center" />
            <Button type="button" size="sm" className="flex-1" disabled={!pickedFile || analyzing} onClick={handleAnalyzeAndGenerate}>
              <Sparkles className="size-3" />
              {analyzing ? 'Analyzing…' : 'Analyze & Generate'}
            </Button>
          </div>
          {appliedFromImage ? (
            <div className="mt-3 space-y-2 rounded-md border bg-muted/30 p-2.5 text-xs">
              <p className="flex items-center gap-1 font-medium text-status-good">
                <CircleCheck className="size-3.5" />
                Title, description, and tags drafted above — review, then Save Changes.
              </p>
              <p className="text-muted-foreground">
                Detected: <span className="font-medium text-foreground">{appliedFromImage.draft.dominantColor}</span> ·{' '}
                <span className="font-medium text-foreground">{appliedFromImage.draft.productTypeGuess}</span>
              </p>
              <div className="rounded border bg-card p-2">
                <p className="font-medium text-foreground">SEO copy (separate SEO tab, not previewed here)</p>
                <p className="mt-1 text-muted-foreground">{appliedFromImage.draft.metaTitle}</p>
                <p className="mt-0.5 text-muted-foreground">{appliedFromImage.draft.metaDescription}</p>
                {appliedFromImage.seoApplied ? (
                  <p className="mt-1.5 flex items-center gap-1 font-medium text-status-good">
                    <CircleCheck className="size-3.5" />
                    Saved to the SEO tab.
                  </p>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="mt-1.5" disabled={appliedFromImage.seoPending} onClick={handleApplySeoFromImage}>
                    {appliedFromImage.seoPending ? 'Saving…' : 'Apply SEO Copy'}
                  </Button>
                )}
                {appliedFromImage.seoError ? <p className="mt-1 text-destructive">{appliedFromImage.seoError}</p> : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="text-[0.72rem] font-bold tracking-wide text-muted-foreground uppercase">Quick Actions</div>
        {QUICK_ACTIONS.map((a) => (
          <Button
            key={a.key}
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start"
            disabled={actionPending && activeAction === a.key}
            onClick={() => runQuickAction(a.key)}
          >
            <Sparkles className="size-3" />
            {actionPending && activeAction === a.key ? 'Working…' : a.label}
          </Button>
        ))}

        {actionError ? (
          <p className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            <CircleAlert className="size-3.5 shrink-0" />
            {actionError}
          </p>
        ) : null}

        {actionResult ? <QuickActionResultPanel result={actionResult} /> : null}
      </CardContent>
    </Card>
  );
}

interface ImageDraftApplyState {
  draft: ProductImageAnalysis;
  seoApplied: boolean;
  seoPending: boolean;
  seoError: string | null;
}

function QuickActionResultPanel({ result }: { result: QuickActionResult }) {
  if (result.kind === 'missingData') {
    return (
      <div className="rounded-md border bg-card p-2.5 text-xs">
        {result.missing.length === 0 ? (
          <p className="flex items-center gap-1 font-medium text-status-good">
            <CircleCheck className="size-3.5" />
            Nothing missing — description, tags, category, and SEO copy are all filled in.
          </p>
        ) : (
          <>
            <p className="font-medium text-foreground">Missing:</p>
            <ul className="mt-1 space-y-0.5">
              {result.missing.map((m) => (
                <li key={m} className="flex items-center gap-1 text-muted-foreground">
                  <CircleAlert className="size-3 shrink-0 text-status-warning" />
                  {m}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }

  if (result.kind === 'price') {
    return (
      <div className="rounded-md border bg-card p-2.5 text-xs">
        <p className="font-medium text-foreground">Suggested price: {result.suggestedPrice.toFixed(2)}</p>
        <p className="mt-1 text-muted-foreground">{result.rationale}</p>
        <p className="mt-1.5 text-[0.68rem] text-muted-foreground">Informational only — update the price yourself on the Pricing tab.</p>
      </div>
    );
  }

  if (result.kind === 'category') {
    return (
      <div className="rounded-md border bg-card p-2.5 text-xs">
        <p className="font-medium text-foreground">Suggested category: {result.category}</p>
        <p className="mt-1 text-muted-foreground">{result.rationale}</p>
        <p className="mt-1.5 text-[0.68rem] text-muted-foreground">Informational only — assign it yourself in Categories below.</p>
      </div>
    );
  }

  if (result.kind === 'attributes') {
    return (
      <div className="rounded-md border bg-card p-2.5 text-xs">
        {result.suggestions.length === 0 ? (
          <p className="text-muted-foreground">No suggestable attributes on this product&apos;s attribute set (beyond Description/SEO, which have their own Generate buttons).</p>
        ) : (
          <>
            <p className="font-medium text-foreground">Suggested values:</p>
            <ul className="mt-1 space-y-1">
              {result.suggestions.map((s) => (
                <li key={s.code}>
                  <span className="font-medium text-foreground">{s.label}:</span> <span className="text-muted-foreground">{s.suggestedValue}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[0.68rem] text-muted-foreground">Informational only — set these yourself in the Attributes section below.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card p-2.5 text-xs">
      <p className="font-medium text-foreground">{result.label}</p>
      <p className={cn('mt-1 text-muted-foreground', result.applied && 'text-status-good')}>{result.value}</p>
      {result.onApply ? (
        result.applied ? (
          <p className="mt-1.5 flex items-center gap-1 font-medium text-status-good">
            <CircleCheck className="size-3.5" />
            Saved to the SEO tab.
          </p>
        ) : (
          <Button type="button" variant="outline" size="sm" className="mt-1.5" disabled={result.applyPending} onClick={result.onApply}>
            {result.applyPending ? 'Saving…' : result.applyLabel}
          </Button>
        )
      ) : null}
    </div>
  );
}
