/**
 * The Cloudinary account images are delivered from.
 *
 * The public name is inlined into the browser bundle at build time, so a
 * deployment built without it has an empty string baked in — which is how
 * `https://res.cloudinary.com//image/upload/…` addresses were being made. The
 * server can also read the private copy the upload signature already depends
 * on, so anything rendered there comes out right whichever of the two is set.
 * In the browser the private one is simply undefined.
 */
export function cloudinaryCloudName(): string {
  return (
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_CLOUD_NAME ||
    ''
  );
}

export function cloudinaryUrl(
  publicId: string,
  transform?: string,
  cloudName = cloudinaryCloudName(),
): string {
  const segments = ['https://res.cloudinary.com', cloudName, 'image', 'upload'];
  if (transform) segments.push(transform);
  segments.push(publicId);

  return segments.join('/');
}

const MISSING_CLOUD = 'https://res.cloudinary.com//';

/**
 * Puts the account name back into an address that was built without one.
 *
 * Such addresses were saved before the uploader was fixed, and they can only
 * be mended where the name is known — so a value with nothing to repair, or no
 * name to repair it with, comes back exactly as it went in.
 */
export function repairCloudinaryUrl(url: string, cloudName = cloudinaryCloudName()): string {
  if (!cloudName || !url.startsWith(MISSING_CLOUD)) return url;

  return `https://res.cloudinary.com/${cloudName}/${url.slice(MISSING_CLOUD.length)}`;
}
