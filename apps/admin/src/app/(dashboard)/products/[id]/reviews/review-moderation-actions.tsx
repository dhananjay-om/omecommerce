'use client';

import { useState, useTransition } from 'react';
import { moderateReview } from './moderate-review-action';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * isApproved is a plain boolean (no separate rejected state — see
 * ProductReview's schema doc comment) so "Reject" is really "send back to
 * pending," not a distinct status.
 */
export function ReviewModerationActions({
  productId,
  reviewId,
  isApproved,
}: {
  productId: string;
  reviewId: string;
  isApproved: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setApproval(next: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await moderateReview(productId, reviewId, next);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant={isApproved ? 'success' : 'secondary'}>{isApproved ? 'Approved' : 'Pending'}</Badge>
      {isApproved ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setApproval(false)}>
          Reject
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setApproval(true)}>
          Approve
        </Button>
      )}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
