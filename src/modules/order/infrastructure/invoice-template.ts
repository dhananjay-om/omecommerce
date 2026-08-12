import type { OrderView, OrderInvoiceView, OrderAddressView } from '../domain/repositories.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function formatMoney(amount: string, currency: string): string {
  return `${currency} ${amount}`;
}

function addressBlock(address: OrderAddressView | undefined, label: string): string {
  if (!address) return `<div class="address"><strong>${label}</strong><p>—</p></div>`;
  const lines = [address.name, address.company, address.line1, address.line2, `${address.city}, ${address.region ?? ''} ${address.postalCode}`.trim(), address.country, address.phone]
    .filter((l): l is string => Boolean(l && l.trim()))
    .map(escapeHtml);
  return `<div class="address"><strong>${label}</strong>${lines.map((l) => `<p>${l}</p>`).join('')}</div>`;
}

/**
 * A server-rendered HTML invoice, consumed two ways (plan/15 §6): rendered to
 * PDF via Puppeteer for storage/download, and — same template, same markup —
 * usable directly in a browser print dialog. Kept as plain string
 * concatenation (no template-engine dependency) since this is the only HTML
 * document this backend generates.
 */
export function buildInvoiceHtml(order: OrderView, invoice: OrderInvoiceView): string {
  const billing = order.addresses.find((a) => a.type === 'BILLING');
  const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
  const rows = invoice.lines
    .map((l) => {
      const orderLine = order.lines.find((ol) => ol.id === l.orderLineId);
      return `<tr>
        <td>${escapeHtml(orderLine?.sku ?? '')}</td>
        <td>${escapeHtml(orderLine?.name ?? '')}</td>
        <td class="num">${l.qty}</td>
        <td class="num">${formatMoney(l.unitPrice, order.currency)}</td>
        <td class="num">${formatMoney(l.taxAmount, order.currency)}</td>
        <td class="num">${formatMoney(l.rowTotal, order.currency)}</td>
      </tr>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 13px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #666; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .addresses { display: flex; gap: 32px; margin-bottom: 24px; }
  .address p { margin: 0; line-height: 1.4; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { padding: 8px; border-bottom: 1px solid #e5e5e5; text-align: left; }
  th { background: #f5f5f5; font-size: 11px; text-transform: uppercase; color: #666; }
  .num { text-align: right; }
  .totals { width: 280px; margin-left: auto; }
  .totals td { border: none; padding: 4px 8px; }
  .totals .grand { font-weight: bold; font-size: 15px; border-top: 2px solid #1a1a1a; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Invoice ${escapeHtml(invoice.invoiceNumber)}</h1>
      <p class="muted">Order ${escapeHtml(order.orderNumber)} &middot; ${new Date(invoice.createdAt).toLocaleDateString()}</p>
    </div>
    <div class="muted">
      <p>${escapeHtml(order.email)}</p>
    </div>
  </div>
  <div class="addresses">
    ${addressBlock(billing, 'Bill To')}
    ${addressBlock(shipping, 'Ship To')}
  </div>
  <table>
    <thead><tr><th>SKU</th><th>Item</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Tax</th><th class="num">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td class="num">${formatMoney(invoice.subtotal, order.currency)}</td></tr>
    <tr><td>Discount</td><td class="num">-${formatMoney(invoice.discountTotal, order.currency)}</td></tr>
    <tr><td>Tax</td><td class="num">${formatMoney(invoice.taxTotal, order.currency)}</td></tr>
    <tr class="grand"><td>Total</td><td class="num">${formatMoney(invoice.grandTotal, order.currency)}</td></tr>
  </table>
</body>
</html>`;
}
