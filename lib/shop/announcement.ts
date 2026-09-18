/* --------------------------------------------------------------------------
   The announcement bar's one decision: is this message already dismissed?

   Pure on purpose. The layout reads the cookie with `cookies()` and the close
   button writes it with `document.cookie`; both sides agree here about what
   the value means, and a test can ask the question without either.
   -------------------------------------------------------------------------- */

export const ANNOUNCE_COOKIE = 'sl_announce';

/** Six months. Long enough that dismissing means dismissed, short enough that
 *  a browser kept for years does not carry it forever. */
export const ANNOUNCE_MAX_AGE = 60 * 60 * 24 * 180;

const PLACEHOLDER =
  'Future announcements will appear here — restocks, new releases and Shrinkless news.';

/** What the bar actually renders: the store's message, or the stand-in. */
export function resolveAnnouncement(message?: string): string {
  return message?.trim() || PLACEHOLDER;
}

/**
 * A short, stable fingerprint of the message.
 *
 * FNV-1a, which is a few lines and needs no dependency. This is not a security
 * boundary — nothing is being authenticated — it is only a way of asking "is
 * this the same announcement I dismissed?" in a value small enough for a
 * cookie and safe enough to need no escaping.
 */
export function announcementTag(message: string): string {
  const text = resolveAnnouncement(message);
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

/**
 * Whether the bar stays down.
 *
 * Only when the stored tag is this exact message's. A bare boolean here would
 * be a content bug with no symptom: the admin publishes a restock, and every
 * shopper who ever closed the old bar never learns about it.
 */
export function isDismissed(message: string | undefined, cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  return cookieValue === announcementTag(resolveAnnouncement(message));
}
