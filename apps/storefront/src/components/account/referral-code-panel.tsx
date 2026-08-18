'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** Copy/share pattern matches pdp/product-actions.tsx's identical share button. */
export function ReferralCodePanel({ code }: { code: string }) {
  function handleShare() {
    const url = `${window.location.origin}/register?ref=${code}`;
    if (navigator.share) {
      navigator.share({ url, title: 'Join me and get a reward' }).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(url).then(() => toast.success('Referral link copied to clipboard'));
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
      <div>
        <div className="text-sm text-muted-foreground">Your referral code</div>
        <div className="font-mono text-lg font-semibold">{code}</div>
      </div>
      <Button type="button" variant="outline" onClick={handleShare} className="ml-auto">
        Share your link
      </Button>
    </div>
  );
}
