'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the code is still visible to select/copy by hand.
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={copy} className="shrink-0 font-mono">
      {copied ? 'Copied!' : code}
    </Button>
  );
}
