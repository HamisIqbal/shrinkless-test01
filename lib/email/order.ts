import type { Mail } from '@/lib/email/send';
import { formatCents } from '@/lib/money';
import { absoluteUrl } from '@/lib/site';
import { DISPATCH_BUSINESS_DAYS, RETURN_WINDOW_DAYS } from '@/lib/legal/pages';
import type { OrderDTO } from '@/types/dto';

/**
 * The two mails an order sends: confirmation when Stripe says it is paid, and
 * a note when it ships.
 *
 * Transactional, so CAN-SPAM's unsubscribe rule does not apply to them — which
 * is also why nothing promotional may ever be added to these templates. Every
 * value that came from a shopper is escaped before it touches the HTML.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function itemLine(item: OrderDTO['items'][number]): string {
  const options = [item.size, item.color].filter(Boolean).join(' / ');
  return `${item.quantity} × ${item.title}${options ? ` (${options})` : ''} — ${formatCents(
    item.unitPriceCents * item.quantity,
  )}`;
}

function addressLines(order: OrderDTO): string[] {
  const a = order.shippingAddress;
  return [
    a.name,
    a.line1,
    a.line2,
    `${a.city}, ${a.state} ${a.postalCode}`,
  ].filter(Boolean);
}

function frame(label: string, paragraphs: string[]): string {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">${p}</p>`)
    .join('');

  return `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:34rem;margin:0 auto;padding:32px 24px;color:#111">
      <p style="margin:0 0 24px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#666">${escapeHtml(label)}</p>
      ${body}
    </div>
  `.trim();
}

export function orderConfirmationMail(order: OrderDTO): Mail {
  const subject = `Your Shrinkless order ${order.orderNumber}`;
  const items = order.items.map(itemLine);
  const policies = absoluteUrl('/refund-policy');

  const totals = [
    `Subtotal: ${formatCents(order.subtotalCents)}`,
    `Shipping: ${order.shippingCents ? formatCents(order.shippingCents) : 'Free'}`,
    ...(order.taxCents ? [`Tax: ${formatCents(order.taxCents)}`] : []),
    `Total: ${formatCents(order.totalCents)}`,
  ];

  const text = [
    `Thank you — we have your order ${order.orderNumber} and your payment.`,
    ``,
    ...items,
    ``,
    ...totals,
    ``,
    `Shipping to:`,
    ...addressLines(order),
    ``,
    `Orders leave us within ${DISPATCH_BUSINESS_DAYS} business days. We will email you when it ships.`,
    `Returns are accepted within ${RETURN_WINDOW_DAYS} days of delivery: ${policies}`,
    ``,
    `Questions? Reply to this email or write to us — quote ${order.orderNumber}.`,
  ].join('\n');

  const html = frame(`Shrinkless — order ${order.orderNumber}`, [
    `Thank you — we have your order and your payment.`,
    items.map(escapeHtml).join('<br>'),
    totals.map(escapeHtml).join('<br>'),
    `<strong>Shipping to</strong><br>${addressLines(order).map(escapeHtml).join('<br>')}`,
    `Orders leave us within ${DISPATCH_BUSINESS_DAYS} business days. We will email you when it ships.`,
    `Returns are accepted within ${RETURN_WINDOW_DAYS} days of delivery — <a href="${policies}" style="color:#111">see the refund policy</a>.`,
  ]);

  return { to: order.email, subject, text, html };
}

export function orderShippedMail(order: OrderDTO): Mail {
  const subject = `Your Shrinkless order ${order.orderNumber} has shipped`;
  const tracking = order.trackingNumber.trim();

  const text = [
    `Your order ${order.orderNumber} is on its way.`,
    ...(tracking ? [``, `Tracking number: ${tracking}`] : []),
    ``,
    `Shipping to:`,
    ...addressLines(order),
    ``,
    `Questions? Reply to this email and quote ${order.orderNumber}.`,
  ].join('\n');

  const html = frame(`Shrinkless — order ${order.orderNumber}`, [
    `Your order is on its way.`,
    ...(tracking ? [`Tracking number: <strong>${escapeHtml(tracking)}</strong>`] : []),
    `<strong>Shipping to</strong><br>${addressLines(order).map(escapeHtml).join('<br>')}`,
  ]);

  return { to: order.email, subject, text, html };
}
