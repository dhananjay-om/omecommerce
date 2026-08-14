import type { OrderView, OrderInvoiceView, OrderAddressView, OrderTaxLineView } from '../domain/repositories.js';
import { toMinorUnits, fromMinorUnits, allocateProportionally } from '../../../shared/domain/decimal.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function formatMoney(amount: string, currency: string): string {
  return `${currency} ${amount}`;
}

function formatPercent(rate: string): string {
  return `${(Number(rate) * 100).toFixed(2)}%`;
}

function addressBlock(address: OrderAddressView | undefined, label: string): string {
  if (!address) return `<div class="address"><strong>${label}</strong><p>—</p></div>`;
  const lines = [address.name, address.company, address.line1, address.line2, `${address.city}, ${address.region ?? ''} ${address.postalCode}`.trim(), address.country, address.phone]
    .filter((l): l is string => Boolean(l && l.trim()))
    .map(escapeHtml);
  const gstinLine = address.gstin ? `<p class="muted">GSTIN: ${escapeHtml(address.gstin)}</p>` : '';
  return `<div class="address"><strong>${label}</strong>${lines.map((l) => `<p>${l}</p>`).join('')}${gstinLine}</div>`;
}

/** Every line in one order shares the same intra/inter-state determination
 *  (one shipping address per order) — so this only needs to look at the
 *  order's OrderTaxLine rows ONCE, not per line, to know whether to render a
 *  CGST+SGST pair of columns or a single IGST column for every row. */
function gstColumnMode(taxLines: OrderTaxLineView[]): 'CGST_SGST' | 'IGST' | 'NONE' {
  if (taxLines.some((t) => t.taxType === 'CGST' || t.taxType === 'SGST')) return 'CGST_SGST';
  if (taxLines.some((t) => t.taxType === 'IGST')) return 'IGST';
  return 'NONE';
}

/**
 * A server-rendered HTML invoice, consumed two ways (plan/15 §6): rendered to
 * PDF via Puppeteer for storage/download, and — same template, same markup —
 * usable directly in a browser print dialog. Kept as plain string
 * concatenation (no template-engine dependency) since this is the only HTML
 * document this backend generates.
 *
 * GST-compliant layout (India tax module): "TAX INVOICE" title, seller/buyer
 * GSTIN, per-line HSN/SAC + rate + CGST/SGST-or-IGST split, and a tax
 * sub-total block sourced from order.taxLines — the same OrderTaxLine data
 * that was previously write-only (nothing ever read it back).
 */
export function buildInvoiceHtml(order: OrderView, invoice: OrderInvoiceView, sellerGstin: string | null): string {
  const billing = order.addresses.find((a) => a.type === 'BILLING');
  const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
  const columnMode = gstColumnMode(order.taxLines);

  const gstHeaderCells =
    columnMode === 'CGST_SGST'
      ? '<th class="num">CGST</th><th class="num">SGST</th>'
      : columnMode === 'IGST'
        ? '<th class="num">IGST</th>'
        : '';

  const rows = invoice.lines
    .map((l) => {
      const orderLine = order.lines.find((ol) => ol.id === l.orderLineId);
      let gstCells = '';
      if (columnMode === 'CGST_SGST') {
        // Exact bigint split (same allocateProportionally helper the checkout
        // calculator itself uses for CGST/SGST) — never float division, so the
        // two displayed columns always sum back to exactly l.taxAmount.
        const lineTaxMinor = toMinorUnits(l.taxAmount);
        const split = allocateProportionally(lineTaxMinor, [
          { key: 'CGST' as const, baseMinor: 1n },
          { key: 'SGST' as const, baseMinor: 1n },
        ]);
        gstCells = `<td class="num">${formatMoney(fromMinorUnits(split.get('CGST') ?? 0n), order.currency)}</td><td class="num">${formatMoney(fromMinorUnits(split.get('SGST') ?? 0n), order.currency)}</td>`;
      } else if (columnMode === 'IGST') {
        gstCells = `<td class="num">${formatMoney(l.taxAmount, order.currency)}</td>`;
      }
      return `<tr>
        <td>${escapeHtml(orderLine?.sku ?? '')}</td>
        <td>${escapeHtml(orderLine?.name ?? '')}</td>
        <td>${escapeHtml(orderLine?.hsnCode ?? '—')}</td>
        <td class="num">${l.qty}</td>
        <td class="num">${formatMoney(l.unitPrice, order.currency)}</td>
        ${gstCells}
        <td class="num">${formatMoney(l.taxAmount, order.currency)}</td>
        <td class="num">${formatMoney(l.rowTotal, order.currency)}</td>
      </tr>`;
    })
    .join('');

  // order.taxLines is the WHOLE ORDER's tax breakdown, not scoped to just this
  // invoice's lines — safe to show as-is only when this invoice covers every
  // order line (the common case; a partial invoice falls back to the flat
  // per-invoice tax total below rather than fabricating a prorated split
  // through floating-point math, which this codebase's money conventions
  // forbid — see shared/domain/decimal.ts's header comment).
  const isFullInvoice = invoice.subtotal === order.subtotal;
  const taxSummaryRows = isFullInvoice
    ? order.taxLines
        .map((t) => `<tr><td>${escapeHtml(t.taxType ?? t.taxClassCode)} @ ${formatPercent(t.rate)}</td><td class="num">${formatMoney(t.amount, order.currency)}</td></tr>`)
        .join('')
    : '';

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
      <h1>Tax Invoice ${escapeHtml(invoice.invoiceNumber)}</h1>
      <p class="muted">Order ${escapeHtml(order.orderNumber)} &middot; ${new Date(invoice.createdAt).toLocaleDateString()}</p>
      ${sellerGstin ? `<p class="muted">Seller GSTIN: ${escapeHtml(sellerGstin)}</p>` : ''}
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
    <thead><tr><th>SKU</th><th>Item</th><th>HSN/SAC</th><th class="num">Qty</th><th class="num">Unit Price</th>${gstHeaderCells}<th class="num">Tax</th><th class="num">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td class="num">${formatMoney(invoice.subtotal, order.currency)}</td></tr>
    <tr><td>Discount</td><td class="num">-${formatMoney(invoice.discountTotal, order.currency)}</td></tr>
    ${taxSummaryRows || `<tr><td>Tax</td><td class="num">${formatMoney(invoice.taxTotal, order.currency)}</td></tr>`}
    <tr class="grand"><td>Total</td><td class="num">${formatMoney(invoice.grandTotal, order.currency)}</td></tr>
  </table>
</body>
</html>`;
}
