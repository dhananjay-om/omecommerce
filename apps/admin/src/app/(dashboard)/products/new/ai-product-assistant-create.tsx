'use client';

import { useState } from 'react';
import { Sparkles, CircleCheck, CircleAlert } from 'lucide-react';
import { requestUploadUrl } from '../[id]/edit/media-actions';
import {
  generateSeoTitle,
  generateMetaDescription,
  analyzeProductImage,
  suggestCategory,
  type ProductAiContext,
} from '../[id]/ai-product-assistant-actions';
import type { ProductImageAnalysis } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUploadButton } from '@/components/ui/file-upload-button';

type QuickActionKey = 'seoTitle' | 'metaDescription' | 'category' | 'missingData';

const QUICK_ACTIONS: Array<{ key: QuickActionKey; label: string }> = [
  { key: 'seoTitle', label: 'Generate SEO Title' },
  { key: 'metaDescription', label: 'Generate Meta Description' },
  { key: 'category', label: 'Suggest Category' },
  { key: 'missingData', label: 'Detect Missing Product Data' },
];

type QuickActionResult = { kind: 'text'; label: string; value: string } | { kind: 'category'; category: string; rationale: string } | { kind: 'missingData'; missing: string[] };

/**
 * The Create-page counterpart to ai-product-assistant.tsx (edit page) —
 * deliberately a SMALLER feature set, not the full card, because a
 * not-yet-saved product genuinely can't support everything: Analyze
 * Product Performance and Suggest Price both need real sales history a
 * brand-new product doesn't have yet (they're omitted here entirely, not
 * shown-disabled — there's nothing honest to show).
 *
 * Backend routes for content generation (generate-title/tags/description/
 * short-description/seo-title/meta-description/analyze-image) don't
 * actually resolve `:id` at all (see ai.module.ts — only analyze-
 * performance/suggest-price do), so this reuses the exact same server
 * actions as the edit page with a `'new'` placeholder in place of a real
 * publicId — safe because those routes never look it up.
 *
 * Apply behavior also differs from the edit page: this Create form's own
 * Attributes section already includes BOTH DESCRIPTION_GROUP and
 * SEO_GROUP (unlike the edit page, where SEO lives on a separate tab/
 * route) — see default-attribute-groups.ts's DEFAULT_ATTRIBUTE_GROUPS —
 * so SEO copy applies straight into this page's own (still-unsaved) form
 * fields, exactly like Title/Description/Tags, with no separate "Apply
 * SEO Copy" persist step needed (there's no product to PATCH yet anyway).
 */
export function AiProductAssistantCreate({
  availableCategoryNames,
  getContext,
  applyTitle,
  applyDescription,
  applyTags,
  applyMetaTitle,
  applyMetaDescription,
}: {
  /** The real, full category list to pick from (Suggest Category is
   *  grounded against this) — NOT "categories already assigned," which is
   *  always empty for a product that doesn't exist yet. */
  availableCategoryNames: string[];
  getContext: () => ProductAiContext;
  applyTitle: (title: string) => void;
  applyDescription: (description: string) => void;
  applyTags: (tags: string[]) => void;
  applyMetaTitle: (metaTitle: string) => void;
  applyMetaDescription: (metaDescription: string) => void;
}) {
  const [pickedFile, setPickedFile] = useState<{ storageKey: string; mimeType: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [appliedFromImage, setAppliedFromImage] = useState<ProductImageAnalysis | null>(null);

  const [activeAction, setActiveAction] = useState<QuickActionKey | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<QuickActionResult | null>(null);

  // Never a real product yet — safe because these routes never resolve
  // `:id` (see this component's own header comment).
  const DRAFT_ID = 'new';

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
      const result = await analyzeProductImage(DRAFT_ID, pickedFile.storageKey, pickedFile.mimeType, getContext());
      if (result.error || !result.data) {
        setAnalyzeError(result.error ?? 'Analysis failed.');
        return;
      }
      const draft = result.data;
      applyTitle(draft.title);
      applyDescription(draft.description);
      applyTags(draft.tags);
      applyMetaTitle(draft.metaTitle);
      applyMetaDescription(draft.metaDescription);
      setAppliedFromImage(draft);
    } finally {
      setAnalyzing(false);
    }
  }

  async function runQuickAction(key: QuickActionKey) {
    setActiveAction(key);
    setActionError(null);
    setActionResult(null);

    if (key === 'missingData') {
      // Category assignment isn't checked here — CategoryPicker's live
      // selection state isn't wired into getContext() on this page, and a
      // wrong "missing" reading would be worse than not checking it at
      // all. The edit page's version of this check (a real, saved
      // product) does check it.
      const ctx = getContext();
      const missing: string[] = [];
      if (!ctx.description?.trim()) missing.push('Description');
      if (!ctx.tags || ctx.tags.length === 0) missing.push('Tags');
      setActionResult({ kind: 'missingData', missing });
      return;
    }

    setActionPending(true);
    try {
      const ctx = getContext();
      if (key === 'seoTitle') {
        const result = await generateSeoTitle(DRAFT_ID, ctx);
        if (result.error || !result.data) return setActionError(result.error ?? 'Generation failed.');
        applyMetaTitle(result.data.metaTitle);
        setActionResult({ kind: 'text', label: 'SEO title applied to the Attributes section below', value: result.data.metaTitle });
      } else if (key === 'metaDescription') {
        const result = await generateMetaDescription(DRAFT_ID, ctx);
        if (result.error || !result.data) return setActionError(result.error ?? 'Generation failed.');
        applyMetaDescription(result.data.metaDescription);
        setActionResult({ kind: 'text', label: 'Meta description applied to the Attributes section below', value: result.data.metaDescription });
      } else if (key === 'category') {
        const result = await suggestCategory(DRAFT_ID, ctx, availableCategoryNames);
        if (result.error || !result.data) return setActionError(result.error ?? 'Suggestion failed.');
        setActionResult({ kind: 'category', category: result.data.category, rationale: result.data.rationale });
      }
    } finally {
      setActionPending(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-1.5 text-[0.88rem] font-bold">
          <Sparkles className="size-3.5 text-primary" />
          AI Product Assistant
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Generate content, or upload a photo and let AI draft the listing. Performance/price suggestions aren&apos;t available until
          after the product is saved — they need real sales history.
        </p>
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
            <div className="mt-3 space-y-1.5 rounded-md border bg-muted/30 p-2.5 text-xs">
              <p className="flex items-center gap-1 font-medium text-status-good">
                <CircleCheck className="size-3.5" />
                Title, description, tags, and SEO copy drafted below — review, then Create Product.
              </p>
              <p className="text-muted-foreground">
                Detected: <span className="font-medium text-foreground">{appliedFromImage.dominantColor}</span> ·{' '}
                <span className="font-medium text-foreground">{appliedFromImage.productTypeGuess}</span>
              </p>
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

function QuickActionResultPanel({ result }: { result: QuickActionResult }) {
  if (result.kind === 'missingData') {
    return (
      <div className="rounded-md border bg-card p-2.5 text-xs">
        {result.missing.length === 0 ? (
          <p className="flex items-center gap-1 font-medium text-status-good">
            <CircleCheck className="size-3.5" />
            Nothing missing so far.
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

  if (result.kind === 'category') {
    return (
      <div className="rounded-md border bg-card p-2.5 text-xs">
        <p className="font-medium text-foreground">Suggested category: {result.category}</p>
        <p className="mt-1 text-muted-foreground">{result.rationale}</p>
        <p className="mt-1.5 text-[0.68rem] text-muted-foreground">Informational only — assign it yourself in Categories below.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card p-2.5 text-xs">
      <p className="flex items-center gap-1 font-medium text-status-good">
        <CircleCheck className="size-3.5" />
        {result.label}
      </p>
      <p className="mt-1 text-muted-foreground">{result.value}</p>
    </div>
  );
}
