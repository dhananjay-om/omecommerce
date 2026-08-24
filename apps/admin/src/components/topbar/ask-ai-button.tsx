'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

/** Opens the AI Insights placeholder — honest about what it does today
 *  rather than a disabled/dead button (see the admin-UI-revamp plan's
 *  "Ask AI" decision: consistent with the rest of the placeholder
 *  strategy). Becomes a real assistant entry point once `/ai/assistant`
 *  is built. */
export function AskAiButton() {
  return (
    <Link
      href="/ai/insights"
      className="flex h-8 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
    >
      <Sparkles className="size-3.5" />
      Ask AI
    </Link>
  );
}
