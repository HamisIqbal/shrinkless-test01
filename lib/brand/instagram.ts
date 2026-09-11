/**
 * The Instagram strip: above New arrivals on the homepage, above the footer
 * on every other page.
 *
 * The account is real: instagram.com/shrinkless — "Organic Tees That Don't
 * Shrink". The posts are read live from Meta's Graph API, cached for an hour.
 *
 * There is no way to read a profile's grid without credentials. Instagram
 * stopped serving media to unauthenticated requests, and the public oEmbed
 * endpoint has needed an app token since 2020 — so scraping the profile page
 * returns the bio and nothing else. A token is the only route.
 *
 * SETUP (see docs/instagram.md for the click-by-click):
 *
 *   1. The account has to be Professional (Creator or Business). Instagram →
 *      Settings → Account type.
 *   2. Create an app at developers.facebook.com, add the "Instagram" product,
 *      and connect the account.
 *   3. Generate a long-lived user access token with the
 *      `instagram_business_basic` scope.
 *   4. Put it in the environment as INSTAGRAM_ACCESS_TOKEN, locally in
 *      .env.local and on Vercel for Production and Preview.
 *
 * Long-lived tokens last 60 days and are refreshable. `refreshInstagramToken`
 * below does the refresh; nothing calls it on a schedule yet, so until
 * something does, this needs a new token every couple of months. Without a
 * token — or with an expired one — `fetchInstagramPosts` returns an empty list
 * and the strip renders as a plain invitation to follow rather than as
 * somebody else's photographs pretending to be posts.
 */

export const INSTAGRAM_HANDLE = 'shrinkless';
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

/** Meta's version pin. Unversioned calls get silently migrated. */
const GRAPH = 'https://graph.instagram.com/v23.0';

/** One hour. The grid is not a stock ticker. */
const REVALIDATE = 3600;

export type InstagramPost = {
  id: string;
  /** The post itself, on instagram.com. */
  permalink: string;
  /** Always a still: a video post yields its thumbnail. */
  imageUrl: string;
  /** First line of the caption, for alt text. Never empty. */
  alt: string;
};

type GraphMedia = {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
};

/** A caption is a paragraph and a pile of hashtags; alt text is one line. */
function toAlt(caption: string | undefined): string {
  const first = (caption ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('#'));

  if (!first) return `A post from @${INSTAGRAM_HANDLE} on Instagram.`;

  const trimmed = first.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
  return trimmed.length > 140 ? `${trimmed.slice(0, 139)}\u2026` : trimmed;
}

/**
 * The account's most recent posts, newest first.
 *
 * Never throws. A missing token, a revoked token, a Meta outage — all of them
 * come back as an empty list, because a footer strip is not worth a 500 on
 * every page of the store.
 */
export async function fetchInstagramPosts(limit = 12): Promise<InstagramPost[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return [];

  const url =
    `${GRAPH}/me/media` +
    `?fields=id,media_type,media_url,thumbnail_url,permalink,caption` +
    `&limit=${limit}` +
    `&access_token=${encodeURIComponent(token)}`;

  try {
    const response = await fetch(url, { next: { revalidate: REVALIDATE } });
    if (!response.ok) return [];

    const body = (await response.json()) as { data?: GraphMedia[] };

    return (body.data ?? [])
      .map((media) => {
        // A video's `media_url` is an mp4. The thumbnail is the still.
        const image = media.media_type === 'VIDEO' ? media.thumbnail_url : media.media_url;
        if (!image) return null;

        return {
          id: media.id,
          permalink: media.permalink,
          imageUrl: image,
          alt: toAlt(media.caption),
        } satisfies InstagramPost;
      })
      .filter((post): post is InstagramPost => post !== null);
  } catch {
    return [];
  }
}

/**
 * Exchanges a long-lived token for a fresh one, good for another 60 days.
 *
 * Meta requires the token being refreshed to be at least 24 hours old and not
 * yet expired. Nothing calls this on a schedule; wire it to a cron route when
 * the store is past launch.
 */
export async function refreshInstagramToken(token: string): Promise<string | null> {
  const url =
    `${GRAPH}/refresh_access_token` +
    `?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;

    const body = (await response.json()) as { access_token?: string };
    return body.access_token ?? null;
  } catch {
    return null;
  }
}
