import { cloudinaryUrl } from '@/lib/cloudinary/url';

/**
 * The one seam between placeholder photography and real uploads.
 *
 * Product images are Cloudinary public IDs. Editorial and seeded placeholder
 * images are absolute URLs. Rather than teach every component the difference,
 * anything that already looks like a URL is passed through untouched and
 * everything else goes to Cloudinary exactly as before — so replacing the
 * placeholders with real uploads is a data change, not a code change.
 */
export function imageUrl(publicIdOrUrl: string, transform?: string): string {
  if (/^https?:\/\//i.test(publicIdOrUrl)) return publicIdOrUrl;

  return cloudinaryUrl(publicIdOrUrl, transform);
}

export function isRemoteImage(publicIdOrUrl: string): boolean {
  return /^https?:\/\//i.test(publicIdOrUrl);
}

/**
 * The same address, asking Cloudinary for a working size.
 *
 * For display only — never for anything that gets stored, because it splices
 * rather than replaces and Cloudinary chains transforms, so a value round
 * tripped through here twice would carry both.
 *
 * A frame that is not Cloudinary's comes back untouched: the seeded Unsplash
 * photography already carries its own sizing in the query string, and this app
 * runs with Next's optimizer off precisely so those instructions are the ones
 * that count.
 */
export function sizedImageUrl(publicIdOrUrl: string, transform: string): string {
  if (!isRemoteImage(publicIdOrUrl)) return cloudinaryUrl(publicIdOrUrl, transform);

  const marker = '/image/upload/';
  const at = publicIdOrUrl.indexOf(marker);

  if (!publicIdOrUrl.includes('res.cloudinary.com') || at === -1) return publicIdOrUrl;

  return (
    publicIdOrUrl.slice(0, at + marker.length) +
    transform +
    '/' +
    publicIdOrUrl.slice(at + marker.length)
  );
}
