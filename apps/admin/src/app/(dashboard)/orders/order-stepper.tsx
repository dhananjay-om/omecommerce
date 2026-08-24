import { Check } from 'lucide-react';
import type { OrderDetail } from '@/lib/types';
import { cn } from '@/lib/utils';

const STEPS = ['Order placed', 'Payment confirmed', 'Processing', 'Packed', 'Shipped', 'Delivered'];

/** Maps this app's real order/financial/fulfillment status fields (there is
 *  no single "progress stage" field in the data model — the mock's demo
 *  data invents one) to the furthest-completed step index. Best-effort,
 *  same spirit as the mock's own `stepIdx` lookup table, just derived from
 *  three real enums instead of one fake one. */
function currentStepIndex(order: OrderDetail): number {
  let idx = 0; // Order placed — always true once the order exists
  if (['PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.financialStatus)) idx = 1;
  if (order.status !== 'PENDING') idx = Math.max(idx, 2);
  if (order.fulfillmentStatus !== 'UNFULFILLED' || order.fulfillments.some((f) => ['PACKED', 'SHIPPED', 'DELIVERED'].includes(f.status))) idx = Math.max(idx, 3);
  if (order.fulfillments.some((f) => f.status === 'SHIPPED' || f.status === 'DELIVERED' || f.shippedAt)) idx = Math.max(idx, 4);
  if (order.fulfillments.some((f) => f.status === 'DELIVERED')) idx = Math.max(idx, 5);
  return idx;
}

/** Matches the mock's `.stepper` exactly: a horizontal row of dot+label
 *  steps connected by a line, done steps filled + checked, the current
 *  step ringed. Hidden for cancelled orders (same as the mock — a
 *  fulfillment-progress stepper doesn't mean anything for an order that
 *  isn't going to fulfill). */
export function OrderStepper({ order }: { order: OrderDetail }) {
  if (order.status === 'CANCELLED') return null;
  const currentIdx = currentStepIndex(order);

  return (
    <div className="flex w-full items-center">
      {STEPS.map((label, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        return (
          <div key={label} className="relative flex flex-1 flex-col items-center gap-1.5">
            {i > 0 ? (
              <div className={cn('absolute top-2.5 right-1/2 left-[-50%] h-0.5', done || current ? 'bg-primary' : 'bg-border')} />
            ) : null}
            <div
              className={cn(
                'z-10 flex size-5 items-center justify-center rounded-full border-2',
                done ? 'border-primary bg-primary' : current ? 'border-primary bg-background ring-3 ring-primary/15' : 'border-border bg-muted',
              )}
            >
              {done ? <Check className="size-2.5 text-primary-foreground" strokeWidth={3} /> : null}
            </div>
            <div className={cn('text-center text-[11px] font-semibold', done || current ? 'text-foreground' : 'text-muted-foreground')}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}
