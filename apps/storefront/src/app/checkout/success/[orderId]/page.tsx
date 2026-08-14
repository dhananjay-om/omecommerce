import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { getOrder } from '@/services/order.service';
import { ApiError } from '@/lib/api-client';
import { formatPrice } from '@/lib/format-price';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Order Confirmed' };

interface Props {
  params: Promise<{ orderId: string }>;
}

export default async function CheckoutSuccessPage({ params }: Props) {
  const { orderId } = await params;

  let order;
  try {
    order = await getOrder(orderId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <CheckCircleIcon className="mx-auto size-16 text-success" />
      <h1 className="mt-4 text-2xl font-bold">Thank you for your order!</h1>
      <p className="mt-1 text-muted-foreground">
        Order #{order.orderNumber} has been placed. A confirmation has been sent to {order.email}.
      </p>

      <div className="mt-8 rounded-lg border p-6 text-left">
        <div className="flex flex-col gap-1">
          {order.lines.map((line) => (
            <div key={line.sku} className="flex justify-between text-sm">
              <span>
                {line.name} &times; {line.qty}
              </span>
              <span>{formatPrice(line.rowTotal, order.currency)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-1 border-t pt-4 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatPrice(order.subtotal, order.currency)}</span>
          </div>
          {Number(order.discountTotal) > 0 ? (
            <div className="flex justify-between text-success">
              <span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span>
              <span>-{formatPrice(order.discountTotal, order.currency)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-muted-foreground">
            <span>Shipping</span>
            <span>{formatPrice(order.shippingTotal, order.currency)}</span>
          </div>
          {order.taxLines.length > 0 ? (
            order.taxLines.map((t, i) => (
              <div key={`${t.taxClassCode}-${t.taxType}-${i}`} className="flex justify-between text-muted-foreground">
                <span>{t.taxType ?? 'Tax'} ({(Number(t.rate) * 100).toFixed(2)}%)</span>
                <span>{formatPrice(t.amount, order.currency)}</span>
              </div>
            ))
          ) : (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span>{formatPrice(order.taxTotal, order.currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{formatPrice(order.grandTotal, order.currency)}</span>
          </div>
        </div>
      </div>

      <Button variant="cta" size="lg" className="mt-8" render={<Link href="/products" />} nativeButton={false}>
        Continue Shopping
      </Button>
    </div>
  );
}
