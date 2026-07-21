import type { OrderView } from '../domain/repositories.js';
import type { OrderEmailType } from '@prisma/client';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function wrap(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 14px; line-height: 1.5; max-width: 560px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 18px; }
  .muted { color: #666; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; text-align: left; font-size: 13px; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function lineItemsTable(order: OrderView): string {
  const rows = order.lines
    .map((l) => `<tr><td>${escapeHtml(l.name)}</td><td>${l.qty}</td><td>${order.currency} ${l.rowTotal}</td></tr>`)
    .join('');
  return `<table><thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** plan/15 Phase 3 — one subject+html pair per templated OrderEmailType. CUSTOM is handled entirely by the caller (admin-supplied subject/body), never reaches here. */
export function buildOrderEmailContent(type: Exclude<OrderEmailType, 'CUSTOM'>, order: OrderView): { subject: string; html: string } {
  switch (type) {
    case 'CONFIRMATION':
      return {
        subject: `Your order #${order.orderNumber} is confirmed`,
        html: wrap('Order Confirmation', `<h1>Thanks for your order, #${escapeHtml(order.orderNumber)}!</h1>${lineItemsTable(order)}<p><strong>Total: ${order.currency} ${order.grandTotal}</strong></p>`),
      };
    case 'INVOICE': {
      const invoice = order.invoices[order.invoices.length - 1];
      const body = invoice
        ? `<h1>Invoice #${escapeHtml(invoice.invoiceNumber)} for order #${escapeHtml(order.orderNumber)}</h1><p><strong>Total: ${order.currency} ${invoice.grandTotal}</strong></p>`
        : `<h1>Invoice for order #${escapeHtml(order.orderNumber)}</h1><p>No invoice has been issued for this order yet.</p>`;
      return { subject: `Invoice for order #${order.orderNumber}`, html: wrap('Invoice', body) };
    }
    case 'SHIPMENT': {
      const fulfillment = order.fulfillments[order.fulfillments.length - 1];
      const body = fulfillment
        ? `<h1>Your order #${escapeHtml(order.orderNumber)} has shipped</h1><p>Carrier: ${escapeHtml(fulfillment.carrier ?? '—')}</p><p>Tracking number: ${escapeHtml(fulfillment.trackingNumber ?? '—')}</p>`
        : `<h1>Your order #${escapeHtml(order.orderNumber)} has shipped</h1><p>Tracking details will follow shortly.</p>`;
      return { subject: `Your order #${order.orderNumber} has shipped`, html: wrap('Shipment Notification', body) };
    }
    case 'CANCELLATION':
      return {
        subject: `Your order #${order.orderNumber} has been cancelled`,
        html: wrap('Order Cancelled', `<h1>Order #${escapeHtml(order.orderNumber)} has been cancelled</h1><p>If you have questions, please contact support.</p>`),
      };
    case 'REFUND': {
      const refundPayment = [...order.payments].reverse().find((p) => p.type === 'REFUND');
      const body = refundPayment
        ? `<h1>A refund has been issued for order #${escapeHtml(order.orderNumber)}</h1><p><strong>Refunded: ${order.currency} ${refundPayment.amount}</strong></p>`
        : `<h1>A refund has been issued for order #${escapeHtml(order.orderNumber)}</h1>`;
      return { subject: `Refund issued for order #${order.orderNumber}`, html: wrap('Refund Notification', body) };
    }
  }
}
