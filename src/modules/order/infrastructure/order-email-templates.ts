import type { OrderView, OrderAddressView } from '../domain/repositories.js';
import type { OrderEmailType } from '@prisma/client';
import { env } from '../../../config/env.js';

/**
 * Everything the template needs beyond the order itself, resolved by the
 * caller (SendOrderEmail) BEFORE calling buildOrderEmailContent — this file
 * stays a pure, synchronous function of its inputs (same reasoning
 * invoice-template.ts's buildInvoiceHtml already follows: branding/logo
 * resolution is I/O, template rendering isn't).
 */
export interface EmailBranding {
  companyName: string;
  companyAddress: string | null;
  supportEmail: string | null;
  /** "data:image/png;base64,...." from resolveInvoiceBranding — same seller
   *  logo the invoice PDF letterhead uses, reused here rather than a second
   *  upload flow just for email. Null renders a text-only header instead. */
  logoDataUri: string | null;
  /** Presigned GET URL per order line, keyed by variantId.toString() —
   *  expires in 15 minutes same as everywhere else this project presigns
   *  (see MediaUrlResolver's doc comment), which is fine: this map is only
   *  ever read once, synchronously, while building the email that's about
   *  to be sent immediately. A variantId missing from the map (no product
   *  image, or it failed to resolve) just renders a plain placeholder box —
   *  never blocks sending the email over a missing thumbnail. */
  lineImageUrls: Map<string, string>;
}

// Mirrors the reference design's exact palette — kept as named tokens so
// every section pulls from the same source instead of repeating hex codes.
const COLOR = {
  pageBg: '#eef0f4',
  cardBg: '#ffffff',
  headerFrom: '#14142b',
  headerTo: '#2c2c54',
  ink: '#14142b',
  muted: '#6b6f7b',
  faint: '#9295a1',
  border: '#e6e8ef',
  borderLight: '#eeeff3',
  accent: '#e0483e',
  metaBg: '#f7f8fb',
  infoBg: '#f2f7ff',
  green: '#2fae5a',
  greenBg: '#e9f9ee',
  red: '#e0483e',
  redBg: '#fdeceb',
  blue: '#2f6fae',
  blueBg: '#eaf2fb',
} as const;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** `${currency} 799.00` — a currency CODE prefix, not a symbol: resolving a
 *  real symbol (₹, $, ...) means another DB round-trip to the Currency table
 *  this template has no access to (and shouldn't need — it's a pure render
 *  step), so the code prefix is the same trade-off the rest of this backend
 *  already makes wherever a currency symbol isn't directly on hand. */
function money(currency: string, amount: string): string {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: 'Cash on Delivery',
};

function paymentMethodLabel(code: string | null): string {
  if (!code) return '—'; // em dash — zero-due order, nothing was ever charged
  return PAYMENT_METHOD_LABEL[code] ?? code;
}

function addressBlock(label: string, addr: OrderAddressView | undefined): string {
  if (!addr) return '';
  const lines = [
    escapeHtml(addr.name),
    addr.company ? escapeHtml(addr.company) : null,
    escapeHtml(addr.line1),
    addr.line2 ? escapeHtml(addr.line2) : null,
    `${escapeHtml(addr.city)}${addr.region ? `, ${escapeHtml(addr.region)}` : ''} ${escapeHtml(addr.postalCode)}`,
    escapeHtml(addr.country),
    addr.phone ? escapeHtml(addr.phone) : null,
  ].filter((l): l is string => l !== null);
  return `
    <td width="48%" valign="top" style="border:1px solid ${COLOR.border}; border-radius:10px; padding:20px; font-size:13px; color:#4a4d59; line-height:1.7;">
      <div style="font-size:12px; font-weight:700; color:${COLOR.ink}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">${label}</div>
      ${lines.join('<br>')}
    </td>`;
}

function addressCards(order: OrderView): string {
  const billing = order.addresses.find((a) => a.type === 'BILLING');
  const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
  if (!billing && !shipping) return '';
  return `
  <tr>
    <td style="padding:28px 40px 0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${addressBlock('Billing Address', billing)}
          <td width="4%"></td>
          ${addressBlock('Shipping Address', shipping)}
        </tr>
      </table>
    </td>
  </tr>`;
}

function orderMetaBox(order: OrderView): string {
  return `
  <tr>
    <td style="padding:28px 40px 0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR.metaBg}; border-radius:10px;">
        <tr>
          <td width="33%" align="center" style="padding:18px 10px;">
            <div style="font-size:11px; color:${COLOR.faint}; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:4px;">Order Number</div>
            <div style="font-size:14px; color:${COLOR.ink}; font-weight:600;">#${escapeHtml(order.orderNumber)}</div>
          </td>
          <td width="33%" align="center" style="padding:18px 10px; border-left:1px solid ${COLOR.border}; border-right:1px solid ${COLOR.border};">
            <div style="font-size:11px; color:${COLOR.faint}; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:4px;">Order Date</div>
            <div style="font-size:14px; color:${COLOR.ink}; font-weight:600;">${formatDate(order.placedAt)}</div>
          </td>
          <td width="33%" align="center" style="padding:18px 10px;">
            <div style="font-size:11px; color:${COLOR.faint}; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:4px;">Payment</div>
            <div style="font-size:14px; color:${COLOR.ink}; font-weight:600;">${escapeHtml(paymentMethodLabel(order.paymentMethodCode))}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function itemsTable(order: OrderView, branding: EmailBranding): string {
  const rows = order.lines
    .map((l) => {
      const imageUrl = branding.lineImageUrls.get(l.variantId.toString());
      const image = imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" width="48" style="display:block; border-radius:6px; border:1px solid ${COLOR.borderLight};">`
        : `<div style="width:48px; height:48px; background-color:${COLOR.metaBg}; border-radius:6px; border:1px solid ${COLOR.borderLight};"></div>`;
      // Struck-through MRP next to the unit price whenever it's a genuine
      // compare-at value above what was actually charged — same `mrp >
      // price` gate every other MRP display in this project uses.
      const priceCell =
        l.mrp && Number(l.mrp) > Number(l.unitPrice)
          ? `${money(order.currency, l.unitPrice)}<br><span style="text-decoration:line-through; color:${COLOR.faint}; font-size:11px;">${money(order.currency, l.mrp)}</span>`
          : money(order.currency, l.unitPrice);
      return `
        <tr style="border-bottom:1px solid ${COLOR.borderLight};">
          <td style="padding:16px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;">${image}</td>
                <td style="font-size:13px; color:${COLOR.ink}; font-weight:600;">
                  ${escapeHtml(l.name)}<br>
                  <span style="color:${COLOR.faint}; font-size:11px; font-weight:400;">SKU: ${escapeHtml(l.sku)}</span>
                </td>
              </tr>
            </table>
          </td>
          <td style="padding:16px 0; font-size:13px; color:#4a4d59;" align="center">${l.qty}</td>
          <td style="padding:16px 0; font-size:13px; color:#4a4d59;" align="right">${priceCell}</td>
          <td style="padding:16px 0; font-size:13px; color:${COLOR.ink}; font-weight:600;" align="right">${money(order.currency, l.rowTotal)}</td>
        </tr>`;
    })
    .join('');

  return `
  <tr>
    <td style="padding:32px 40px 0 40px;">
      <div style="font-size:12px; font-weight:700; color:${COLOR.ink}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:14px;">Order Items</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:0 0 10px 0; font-size:11px; color:${COLOR.faint}; text-transform:uppercase; letter-spacing:0.4px; border-bottom:2px solid ${COLOR.ink};">Item</td>
          <td style="padding:0 0 10px 0; font-size:11px; color:${COLOR.faint}; text-transform:uppercase; letter-spacing:0.4px; border-bottom:2px solid ${COLOR.ink};" align="center">Qty</td>
          <td style="padding:0 0 10px 0; font-size:11px; color:${COLOR.faint}; text-transform:uppercase; letter-spacing:0.4px; border-bottom:2px solid ${COLOR.ink};" align="right">Price</td>
          <td style="padding:0 0 10px 0; font-size:11px; color:${COLOR.faint}; text-transform:uppercase; letter-spacing:0.4px; border-bottom:2px solid ${COLOR.ink};" align="right">Total</td>
        </tr>
        ${rows}
      </table>
    </td>
  </tr>`;
}

function summaryRow(label: string, value: string, opts?: { bold?: boolean; color?: string }): string {
  const size = opts?.bold ? '16px' : '13px';
  const weight = opts?.bold ? '700' : '400';
  const color = opts?.color ?? (opts?.bold ? COLOR.ink : COLOR.ink);
  const labelColor = opts?.bold ? COLOR.ink : COLOR.muted;
  return `
        <tr>
          <td style="font-size:${size}; color:${labelColor}; font-weight:${weight}; padding:${opts?.bold ? '4px' : '5px'} 0;">${label}</td>
          <td align="right" style="font-size:${size}; color:${color}; font-weight:${weight}; padding:${opts?.bold ? '4px' : '5px'} 0;">${value}</td>
        </tr>`;
}

function summaryBox(order: OrderView): string {
  const rows = [
    summaryRow('Subtotal', money(order.currency, order.subtotal)),
    Number(order.discountTotal) > 0
      ? summaryRow('Discount', `-${money(order.currency, order.discountTotal)}`, { color: COLOR.accent })
      : '',
    summaryRow('Shipping', money(order.currency, order.shippingTotal)),
    summaryRow('Tax', money(order.currency, order.taxTotal)),
  ].join('');
  return `
  <tr>
    <td style="padding:20px 40px 0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${rows}
        <tr><td colspan="2" style="border-top:1px solid ${COLOR.border}; padding-top:12px;"></td></tr>
        ${summaryRow('Total', money(order.currency, order.grandTotal), { bold: true })}
      </table>
    </td>
  </tr>`;
}

function shippingInfoBox(order: OrderView): string {
  const fulfillment = order.fulfillments[order.fulfillments.length - 1];
  if (!fulfillment) return '';
  const trackButton = fulfillment.carrierTrackingUrl
    ? `<a href="${escapeHtml(fulfillment.carrierTrackingUrl)}" style="display:inline-block; background-color:${COLOR.ink}; color:#ffffff; text-decoration:none; padding:11px 22px; border-radius:6px; font-size:13px; font-weight:600;">Track Your Order</a>`
    : '';
  return `
  <tr>
    <td style="padding:28px 40px 0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR.infoBg}; border-radius:10px;">
        <tr>
          <td style="padding:22px; font-size:13px; color:#4a4d59; line-height:1.9;">
            <div style="font-size:12px; font-weight:700; color:${COLOR.ink}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">Shipping Information</div>
            ${order.shippingMethodCode ? `<strong style="color:${COLOR.ink};">Method:</strong> ${escapeHtml(order.shippingMethodCode)}<br>` : ''}
            ${fulfillment.estimatedDeliveryAt ? `<strong style="color:${COLOR.ink};">Estimated Delivery:</strong> ${formatDate(fulfillment.estimatedDeliveryAt)}<br>` : ''}
            ${fulfillment.carrier ? `<strong style="color:${COLOR.ink};">Carrier:</strong> ${escapeHtml(fulfillment.carrier)}<br>` : ''}
            ${fulfillment.trackingNumber ? `<strong style="color:${COLOR.ink};">Tracking Number:</strong> ${escapeHtml(fulfillment.trackingNumber)}<br>` : ''}
            ${trackButton ? `<br>${trackButton}` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function banner(icon: string, iconColor: string, iconBg: string, heading: string, message: string): string {
  return `
  <tr>
    <td align="center" style="padding:32px 40px 4px 40px;">
      <div style="width:56px; height:56px; background-color:${iconBg}; border-radius:50%; line-height:56px; text-align:center; margin:0 auto 18px auto;">
        <span style="color:${iconColor}; font-size:26px;">${icon}</span>
      </div>
      <h1 style="font-size:23px; color:${COLOR.ink}; margin:0 0 8px 0; font-weight:700;">${escapeHtml(heading)}</h1>
      <p style="font-size:14px; color:${COLOR.muted}; line-height:1.6; margin:0; max-width:420px;">${escapeHtml(message)}</p>
    </td>
  </tr>`;
}

function ctaButton(url: string, label: string): string {
  return `
  <tr>
    <td align="center" style="padding:32px 40px 36px 40px;">
      <a href="${escapeHtml(url)}" style="display:inline-block; background-color:${COLOR.accent}; color:#ffffff; text-decoration:none; padding:13px 34px; border-radius:6px; font-size:14px; font-weight:700;">${escapeHtml(label)}</a>
    </td>
  </tr>`;
}

/** The order-details link every CTA points at — omitted (both the button
 *  and the section around it) when SITE_URL isn't configured, rather than
 *  ever emitting a broken relative link. */
function orderDetailsUrl(order: OrderView): string | null {
  if (!env.SITE_URL) return null;
  return `${env.SITE_URL}/account/orders/${order.publicId}`;
}

function customerGreetingName(order: OrderView): string {
  const billing = order.addresses.find((a) => a.type === 'BILLING');
  const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
  return billing?.name ?? shipping?.name ?? 'there';
}

function wrap(title: string, bodyHtml: string, branding: EmailBranding): string {
  const headerContent = branding.logoDataUri
    ? `<img src="${branding.logoDataUri}" alt="${escapeHtml(branding.companyName)}" height="40" style="display:block; max-height:40px;">`
    : `<span style="color:#ffffff; font-size:20px; font-weight:700; letter-spacing:0.3px;">${escapeHtml(branding.companyName)}</span>`;

  const footerContact = branding.supportEmail
    ? `Need help? Contact us at <a href="mailto:${escapeHtml(branding.supportEmail)}" style="color:${COLOR.ink}; text-decoration:none; font-weight:600;">${escapeHtml(branding.supportEmail)}</a><br><br>`
    : '';
  // Each piece escaped individually BEFORE joining — the separator itself is
  // real markup (a non-breaking-space-padded pipe), so the joined string must
  // never be run through escapeHtml() again afterward (that would turn
  // "&nbsp;" back into the literal text "&amp;nbsp;").
  const footerAddress = [branding.companyName, branding.companyAddress]
    .filter((v): v is string => Boolean(v))
    .map(escapeHtml)
    .join(' &nbsp;|&nbsp; ');

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title></head>
<body style="margin:0; padding:0; background-color:${COLOR.pageBg}; font-family:'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR.pageBg}; padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:${COLOR.cardBg}; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(20,20,43,0.08);">
  <tr>
    <td align="center" style="background:linear-gradient(135deg,${COLOR.headerFrom},${COLOR.headerTo}); padding:36px 20px;">
      ${headerContent}
    </td>
  </tr>
  ${bodyHtml}
  <tr>
    <td style="background-color:${COLOR.metaBg}; padding:28px 40px; text-align:center; font-size:12px; color:${COLOR.faint}; border-top:1px solid ${COLOR.border};">
      ${footerContact}${footerAddress}
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** plan/15 Phase 3, redesigned per the merchant-supplied reference layout — one subject+html pair per templated OrderEmailType. CUSTOM is handled entirely by the caller (admin-supplied subject/body), never reaches here. */
export function buildOrderEmailContent(
  type: Exclude<OrderEmailType, 'CUSTOM'>,
  order: OrderView,
  branding: EmailBranding,
): { subject: string; html: string } {
  const name = customerGreetingName(order);
  const detailsUrl = orderDetailsUrl(order);

  switch (type) {
    case 'CONFIRMATION': {
      const body = `
        ${banner('&#10003;', COLOR.green, COLOR.greenBg, `Thanks for your order, ${name}!`, "We've received your order and it's being prepared. A summary is below for your records.")}
        ${orderMetaBox(order)}
        ${addressCards(order)}
        ${itemsTable(order, branding)}
        ${summaryBox(order)}
        ${detailsUrl ? ctaButton(detailsUrl, 'View Order Details') : ''}`;
      return { subject: `Your order #${order.orderNumber} is confirmed`, html: wrap('Order Confirmation', body, branding) };
    }
    case 'INVOICE': {
      const invoice = order.invoices[order.invoices.length - 1];
      const body = invoice
        ? `
        ${banner('&#128196;', COLOR.blue, COLOR.blueBg, `Invoice #${invoice.invoiceNumber}`, `For order #${order.orderNumber}.`)}
        ${orderMetaBox(order)}
        ${itemsTable(order, branding)}
        ${summaryBox(order)}
        ${detailsUrl ? ctaButton(detailsUrl, 'View Order Details') : ''}`
        : banner('&#128196;', COLOR.blue, COLOR.blueBg, `Invoice for order #${order.orderNumber}`, 'No invoice has been issued for this order yet.');
      return { subject: `Invoice for order #${order.orderNumber}`, html: wrap('Invoice', body, branding) };
    }
    case 'SHIPMENT': {
      const body = `
        ${banner('&#10003;', COLOR.blue, COLOR.blueBg, `Your order #${order.orderNumber} has shipped!`, "It's on its way — tracking details are below.")}
        ${shippingInfoBox(order)}
        ${itemsTable(order, branding)}
        ${detailsUrl ? ctaButton(detailsUrl, 'View Order Details') : ''}`;
      return { subject: `Your order #${order.orderNumber} has shipped`, html: wrap('Shipment Notification', body, branding) };
    }
    case 'CANCELLATION': {
      const body = `
        ${banner('&#10005;', COLOR.red, COLOR.redBg, `Order #${order.orderNumber} has been cancelled`, 'If this was a mistake or you have questions, please contact support.')}
        ${orderMetaBox(order)}
        ${itemsTable(order, branding)}
        ${detailsUrl ? ctaButton(detailsUrl, 'View Order Details') : ''}`;
      return { subject: `Your order #${order.orderNumber} has been cancelled`, html: wrap('Order Cancelled', body, branding) };
    }
    case 'REFUND': {
      const refundPayment = [...order.payments].reverse().find((p) => p.type === 'REFUND');
      const body = `
        ${banner('&#8635;', COLOR.blue, COLOR.blueBg, `A refund has been issued`, `For order #${order.orderNumber}.`)}
        ${orderMetaBox(order)}
        <tr>
          <td style="padding:20px 40px 0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${summaryRow('Refunded', refundPayment ? money(order.currency, refundPayment.amount) : money(order.currency, order.grandTotal), { bold: true })}
            </table>
          </td>
        </tr>
        ${detailsUrl ? ctaButton(detailsUrl, 'View Order Details') : ''}`;
      return { subject: `Refund issued for order #${order.orderNumber}`, html: wrap('Refund Notification', body, branding) };
    }
  }
}
