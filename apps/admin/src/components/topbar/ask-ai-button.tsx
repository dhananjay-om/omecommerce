'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

/** Opens the real AI Assistant chat — was a placeholder pointing at
 *  /ai/insights until that feature existed (see the admin-UI-revamp
 *  plan's original "Ask AI" decision); now that /ai/assistant is real,
 *  this is the actual assistant entry point. */
export function AskAiButton() {
  return (
    <Link
      href="/ai/assistant"
      className="flex h-8 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
    >
      <Sparkles className="size-3.5" />
      Ask AI
    </Link>
  );
}
