import type { OrderView, FulfillmentView, OrderAddressView } from '../domain/repositories.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function addressBlock(address: OrderAddressView | undefined): string {
  if (!address) return '<p>—</p>';
  return [address.name, address.company, address.line1, address.line2, `${address.city}, ${address.region ?? ''} ${address.postalCode}`.trim(), address.country]
    .filter((l): l is string => Boolean(l && l.trim()))
    .map((l) => `<p>${escapeHtml(l)}</p>`)
    .join('');
}

/** A packing slip lists what to pack for one Fulfillment — no prices (plan/15 Phase 2), unlike the invoice template it otherwise mirrors in structure. */
export function buildPackingSlipHtml(order: OrderView, fulfillment: FulfillmentView): string {
  const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
  const rows = fulfillment.lines
    .map((l) => {
      const orderLine = order.lines.find((ol) => ol.id === l.orderLineId);
      return `<tr><td>${escapeHtml(orderLine?.sku ?? '')}</td><td>${escapeHtml(orderLine?.name ?? '')}</td><td class="num">${l.qty}</td></tr>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Packing Slip — Order ${escapeHtml(order.orderNumber)}</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 13px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #666; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .address p { margin: 0; line-height: 1.4; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { padding: 8px; border-bottom: 1px solid #e5e5e5; text-align: left; }
  th { background: #f5f5f5; font-size: 11px; text-transform: uppercase; color: #666; }
  .num { text-align: right; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Packing Slip</h1>
      <p class="muted">Order ${escapeHtml(order.orderNumber)} &middot; Shipment ${escapeHtml(fulfillment.publicId)}</p>
    </div>
    <div class="address"><strong>Ship To</strong>${addressBlock(shipping)}</div>
  </div>
  <table>
    <thead><tr><th>SKU</th><th>Item</th><th class="num">Qty</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}
