import type { Mail } from '@/lib/email/send';
import { formatCents } from '@/lib/money';
import type { WholesaleEnquiryDTO } from '@/types/dto';

/**
 * The quote request, as it lands in the store's inbox.
 *
 * Written so it can be answered without opening the admin: every figure the
 * buyer was shown, and every way to reach them, is in the body. A trade
 * enquiry is worth a reply the same day, and a mail that only says "you have a
 * new enquiry" costs whoever reads it a login before they can start.
 *
 * The buyer typed the company, the name and the notes, so all three are
 * escaped before they reach the HTML part.
 */

const UNITS = new Intl.NumberFormat('en-US');

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function wholesaleEnquiryMail(to: string, enquiry: WholesaleEnquiryDTO): Mail {
  const subject = `Wholesale enquiry — ${enquiry.company} (${UNITS.format(enquiry.units)} units)`;

  const text = [
    `${enquiry.company} has asked for a wholesale quote.`,
    ``,
    `Contact: ${enquiry.contactName}`,
    `Email:   ${enquiry.email}`,
    ...(enquiry.phone ? [`Phone:   ${enquiry.phone}`] : []),
    `Ships to: ${enquiry.country}`,
    ``,
    `Styles`,
    ...enquiry.lines.map(
      (line) =>
        `- ${line.title} — ${UNITS.format(line.tier)} units ` +
        `@ ${formatCents(line.unitPriceCents)} = ${formatCents(line.totalCents)}`,
    ),
    ``,
    `Total: ${UNITS.format(enquiry.units)} units, ${formatCents(enquiry.totalCents)}`,
    ...(enquiry.message ? [``, `Notes: ${enquiry.message}`] : []),
    ``,
    `Those figures are the indicative ladder the site quoted. Confirm the real`,
    `terms in your reply before anything is committed.`,
  ].join('\n');

  const rows = enquiry.lines
    .map(
      (line) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px">${escapeHtml(line.title)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;font-variant-numeric:tabular-nums">${UNITS.format(line.tier)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;font-variant-numeric:tabular-nums">${formatCents(line.unitPriceCents)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;font-variant-numeric:tabular-nums">${formatCents(line.totalCents)}</td>
        </tr>`,
    )
    .join('');

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:38rem;margin:0 auto;padding:32px 24px;color:#111">
      <p style="margin:0 0 24px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#666">Shrinkless — wholesale enquiry</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6"><strong>${escapeHtml(enquiry.company)}</strong> has asked for a wholesale quote.</p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#444">
        ${escapeHtml(enquiry.contactName)}<br>
        <a href="mailto:${escapeHtml(enquiry.email)}" style="color:#111">${escapeHtml(enquiry.email)}</a><br>
        ${enquiry.phone ? `${escapeHtml(enquiry.phone)}<br>` : ''}
        Ships to ${escapeHtml(enquiry.country)}
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
        <tr>
          <th style="text-align:left;padding:0 0 8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#666">Style</th>
          <th style="text-align:right;padding:0 0 8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#666">Units</th>
          <th style="text-align:right;padding:0 0 8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#666">Per unit</th>
          <th style="text-align:right;padding:0 0 8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#666">Line</th>
        </tr>
        ${rows}
        <tr>
          <td style="padding:12px 0;font-size:14px;font-weight:600">Total</td>
          <td style="padding:12px 0;font-size:14px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums">${UNITS.format(enquiry.units)}</td>
          <td></td>
          <td style="padding:12px 0;font-size:14px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums">${formatCents(enquiry.totalCents)}</td>
        </tr>
      </table>
      ${enquiry.message ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#444"><span style="color:#666">Notes:</span> ${escapeHtml(enquiry.message)}</p>` : ''}
      <p style="margin:0;font-size:13px;line-height:1.6;color:#666">Those figures are the indicative ladder the site quoted. Confirm the real terms in your reply before anything is committed.</p>
    </div>
  `.trim();

  return { to, subject, text, html };
}
