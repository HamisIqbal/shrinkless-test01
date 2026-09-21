/**
 * Whether a slot's address is a film rather than a photograph.
 *
 * Read off the address and not stored beside it, so a pasted link and an
 * upload are decided the same way and nothing already saved needs a second
 * field. Cloudinary files every video under `/video/upload/` whatever the
 * extension; anything else is known by its extension, which is what a browser
 * can play in a `<video>` anyway.
 *
 * Pure and free of any server import — the storefront, the admin list and the
 * crop stage all ask the same question.
 */
const VIDEO_EXTENSION = /\.(mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i;

export function isVideoUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (/^https:\/\/res\.cloudinary\.com\/[^/]*\/video\/upload\//i.test(url)) return true;

  return VIDEO_EXTENSION.test(url);
}

/** What a file picker offers for a slot: either kind of media. */
export const SLOT_MEDIA_ACCEPT = 'image/*,video/*';
