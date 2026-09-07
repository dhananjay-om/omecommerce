'use client';

import { useActionState } from 'react';
import { updateReturnStatus, refundReturn, type ActionState } from './actions';
import { Button } from '@/components/ui/button';

const initialState: ActionState = { error: null, success: false };

/** One action per legal next step, matching UpdateReturnStatus's own
 *  state machine exactly (see its doc comment) — REFUNDED is its own
 *  separate action (RefundReturn, real money movement) rather than
 *  another option in the same status dropdown, so it's never one
 *  careless click away from a plain status change. */
export function ReturnRowActions({ publicId, status }: { publicId: string; status: string }) {
  const [approveState, approveAction, approvePending] = useActionState(updateReturnStatus.bind(null, publicId, 'APPROVED'), initialState);
  const [receiveState, receiveAction, receivePending] = useActionState(updateReturnStatus.bind(null, publicId, 'RECEIVED'), initialState);
  const [rejectState, rejectAction, rejectPending] = useActionState(updateReturnStatus.bind(null, publicId, 'REJECTED'), initialState);
  const [refundState, refundAction, refundPending] = useActionState(refundReturn.bind(null, publicId), initialState);

  const error = approveState.error || receiveState.error || rejectState.error || refundState.error;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {status === 'REQUESTED' ? (
          <form action={approveAction}>
            <Button type="submit" size="sm" variant="outline" disabled={approvePending}>
              {approvePending ? 'Approving…' : 'Approve'}
            </Button>
          </form>
        ) : null}
        {status === 'APPROVED' ? (
          <form action={receiveAction}>
            <Button type="submit" size="sm" variant="outline" disabled={receivePending}>
              {receivePending ? 'Saving…' : 'Mark Received'}
            </Button>
          </form>
        ) : null}
        {status === 'APPROVED' || status === 'RECEIVED' ? (
          <form action={refundAction}>
            <Button type="submit" size="sm" disabled={refundPending}>
              {refundPending ? 'Refunding…' : 'Refund'}
            </Button>
          </form>
        ) : null}
        {status === 'REQUESTED' || status === 'APPROVED' || status === 'RECEIVED' ? (
          <form action={rejectAction}>
            <Button type="submit" size="sm" variant="ghost" disabled={rejectPending}>
              {rejectPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </form>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
