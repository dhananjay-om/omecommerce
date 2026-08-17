import bwipjs from 'bwip-js/node';
import type { OrderView, OrderInvoiceView, OrderAddressView, OrderTaxLineView } from '../domain/repositories.js';
import { toMinorUnits, fromMinorUnits, allocateProportionally } from '../../../shared/domain/decimal.js';
import type { InvoiceBranding } from './invoice-branding.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Intl.NumberFormat-based — own copy of the same pattern already shipped in
 *  apps/admin/src/lib/format-price.ts and apps/storefront/src/lib/format-price.ts
 *  (this file is server-side Node, neither frontend app, so it needs its own
 *  copy per this project's established per-module convention). Gets the
 *  correct symbol, correct digit grouping (Indian lakh/crore for INR via
 *  'en-IN', international thousands otherwise), and the correct number of
 *  decimal places per currency, instead of the old bare
 *  `${currency} ${amount}` concatenation ("INR 2499.0000"). */
const INDIAN_GROUPING_CURRENCIES = new Set(['INR']);
function formatMoney(amount: string, currency: string): string {
  const value = Number(amount);
  const code = currency.toUpperCase();
  const locale = INDIAN_GROUPING_CURRENCIES.has(code) ? 'en-IN' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

function formatPercent(rate: string): string {
  return `${(Number(rate) * 100).toFixed(2)}%`;
}

/** A Code128 barcode encoding the invoice number, rendered as a base64 PNG —
 *  same "must be embedded, not linked" constraint as the logo (see
 *  invoice-branding.ts's header comment): Puppeteer's PdfRenderer.render()
 *  loads the HTML via page.setContent() with no base URL, so nothing outside
 *  a data: URI is reachable. bwip-js runs entirely in Node (no DOM/canvas
 *  needed), which is what makes generating it server-side straightforward. */
async function buildBarcodeDataUri(text: string): Promise<string | null> {
  try {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text,
      scale: 3,
      height: 12,
      includetext: true,
      textxalign: 'center',
      backgroundcolor: 'ffffff',
    });
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    // A barcode is decoration, not data — never let a rendering hiccup here
    // block the invoice itself from generating.
    return null;
  }
}

function addressBlock(address: OrderAddressView | undefined, label: string): string {
  if (!address) return `<div class="address"><h3>${label}</h3><p>—</p></div>`;
  const lines = [address.name, address.company, address.line1, address.line2, `${address.city}, ${address.region ?? ''} ${address.postalCode}`.trim(), address.country, address.phone]
    .filter((l): l is string => Boolean(l && l.trim()))
    .map(escapeHtml);
  const gstinLine = address.gstin ? `<p class="muted">GSTIN: ${escapeHtml(address.gstin)}</p>` : '';
  return `<div class="address"><h3>${label}</h3>${lines.map((l) => `<p>${l}</p>`).join('')}${gstinLine}</div>`;
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
 * that was previously write-only (nothing ever read it back). Branding
 * (logo/address) and the barcode both need an async resolve step (S3 fetch,
 * bwip-js respectively), so this function is async — a signature change from
 * its original synchronous form.
 */
export async function buildInvoiceHtml(order: OrderView, invoice: OrderInvoiceView, branding: InvoiceBranding): Promise<string> {
  const billing = order.addresses.find((a) => a.type === 'BILLING');
  const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
  const columnMode = gstColumnMode(order.taxLines);
  const barcodeDataUri = await buildBarcodeDataUri(`INV-${invoice.invoiceNumber}`);

  const gstHeaderCells =
    columnMode === 'CGST_SGST'
      ? '<th class="num">CGST</th><th class="num">SGST</th>'
      : columnMode === 'IGST'
        ? '<th class="num">IGST</th>'
        : '';

  const rows = invoice.lines
    .map((l, i) => {
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
      return `<tr class="${i % 2 === 1 ? 'alt' : ''}">
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
  :root { --accent: #1d4ed8; --ink: #16181d; --muted: #6b7280; --line: #e5e7eb; --panel: #f8fafc; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: var(--ink); font-size: 13px; margin: 0; }
  .sheet { padding: 8px 4px; }
  .muted { color: var(--muted); }
  .accent-bar { height: 6px; background: linear-gradient(90deg, var(--accent), #60a5fa); border-radius: 3px; margin-bottom: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 24px; }
  .seller { display: flex; gap: 14px; align-items: flex-start; }
  .seller img.logo { max-width: 72px; max-height: 72px; object-fit: contain; border-radius: 6px; }
  .seller-name { font-size: 17px; font-weight: 700; margin: 0 0 2px; }
  .seller-address p { margin: 0; line-height: 1.45; color: var(--muted); font-size: 12px; }
  .doc-meta { text-align: right; }
  .doc-title { font-size: 24px; font-weight: 800; letter-spacing: 0.5px; color: var(--accent); margin: 0 0 6px; }
  .doc-meta p { margin: 0; line-height: 1.5; }
  .doc-meta .barcode { margin-top: 10px; }
  .doc-meta .barcode img { height: 40px; }
  .addresses { display: flex; gap: 24px; margin-bottom: 24px; }
  .address { flex: 1; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; }
  .address h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); }
  .address p { margin: 0; line-height: 1.45; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { padding: 9px 8px; border-bottom: 1px solid var(--line); text-align: left; }
  th { background: var(--ink); color: #fff; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.4px; }
  th:first-child { border-top-left-radius: 6px; }
  th:last-child { border-top-right-radius: 6px; }
  tr.alt td { background: var(--panel); }
  .num { text-align: right; }
  .totals-wrap { display: flex; justify-content: flex-end; }
  .totals { width: 300px; }
  .totals td { border: none; padding: 5px 8px; }
  .totals .grand { font-weight: 800; font-size: 16px; background: var(--ink); color: #fff; border-radius: 6px; }
  .totals .grand td { padding: 10px 8px; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid var(--line); text-align: center; color: var(--muted); font-size: 11.5px; }
</style>
</head>
<body>
<div class="sheet">
  <div class="accent-bar"></div>
  <div class="header">
    <div class="seller">
      ${branding.logoDataUri ? `<img class="logo" src="${branding.logoDataUri}" alt="${escapeHtml(branding.sellerName)} logo">` : ''}
      <div>
        <p class="seller-name">${escapeHtml(branding.sellerName)}</p>
        <div class="seller-address">
          ${branding.sellerAddress ? branding.sellerAddress.split('\n').filter((l) => l.trim()).map((l) => `<p>${escapeHtml(l)}</p>`).join('') : ''}
          ${branding.sellerGstin ? `<p>GSTIN: ${escapeHtml(branding.sellerGstin)}</p>` : ''}
        </div>
      </div>
    </div>
    <div class="doc-meta">
      <p class="doc-title">TAX INVOICE</p>
      <p><strong>${escapeHtml(invoice.invoiceNumber)}</strong></p>
      <p class="muted">Order ${escapeHtml(order.orderNumber)} &middot; ${new Date(invoice.createdAt).toLocaleDateString()}</p>
      <p class="muted">${escapeHtml(order.email)}</p>
      ${barcodeDataUri ? `<div class="barcode"><img src="${barcodeDataUri}" alt="Invoice barcode INV-${escapeHtml(invoice.invoiceNumber)}"></div>` : ''}
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
  <div class="totals-wrap">
    <table class="totals">
      <tr><td>Subtotal</td><td class="num">${formatMoney(invoice.subtotal, order.currency)}</td></tr>
      <tr><td>Discount</td><td class="num">-${formatMoney(invoice.discountTotal, order.currency)}</td></tr>
      ${taxSummaryRows || `<tr><td>Tax</td><td class="num">${formatMoney(invoice.taxTotal, order.currency)}</td></tr>`}
      <tr class="grand"><td>Total</td><td class="num">${formatMoney(invoice.grandTotal, order.currency)}</td></tr>
    </table>
  </div>
  <div class="footer">Thank you for your business.</div>
</div>
</body>
</html>`;
}
