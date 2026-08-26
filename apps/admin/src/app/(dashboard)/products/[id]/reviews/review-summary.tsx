'use client';

import { useState } from 'react';
import { Sparkles, CircleAlert } from 'lucide-react';
import { summarizeReviews, type ProductAiContext } from '../ai-product-assistant-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/** Real customer review text -> a grounded LLM summary (never a fabricated
 *  sentiment score) — see product-assistant-openai.ts's summarizeReviews
 *  doc comment. On-demand, not auto-run on page load, same "the admin
 *  decides when to spend an API call" posture as every other AI action in
 *  this system. */
export function ReviewSummary({ productPublicId, context, hasReviews }: { productPublicId: string; context: ProductAiContext; hasReviews: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function handleSummarize() {
    setPending(true);
    setError(null);
    try {
      const result = await summarizeReviews(productPublicId, context);
      if (result.error || !result.data) {
        setError(result.error ?? 'Summarization failed.');
        return;
      }
      setSummary(result.data.summary);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-2 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-bold">
            <Sparkles className="size-3.5 text-primary" />
            AI Summary
          </div>
          <Button type="button" size="sm" disabled={pending || !hasReviews} onClick={handleSummarize} title={hasReviews ? undefined : 'No reviews yet to summarize'}>
            <Sparkles className="size-3" />
            {pending ? 'Summarizing…' : summary ? 'Regenerate' : 'Summarize with AI'}
          </Button>
        </div>
        {error ? (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <CircleAlert className="size-3.5 shrink-0" />
            {error}
          </p>
        ) : null}
        {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : !hasReviews ? <p className="text-sm text-muted-foreground">No reviews yet — nothing to summarize.</p> : null}
      </CardContent>
    </Card>
  );
}
