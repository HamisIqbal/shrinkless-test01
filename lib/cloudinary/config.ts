export const UPLOAD_FOLDER = 'shrinkless/products';

/** Brand and editorial photography. A second folder rather than one shared
 *  one, so a product shot and a hero frame are never a search away from each
 *  other in the Cloudinary console. */
export const SITE_UPLOAD_FOLDER = 'shrinkless/site';

/**
 * Where a signed upload is sent.
 *
 * `auto` lets Cloudinary decide from the file, which is how a slot on the
 * Media tab takes a film as readily as a photograph: a video lands under
 * `/video/upload/` and its address says so. Product photography stays on
 * `image`, where a file that is not a picture ought to be refused.
 */
export function uploadEndpoint(cloudName: string, resource: 'image' | 'auto' = 'image'): string {
  return `https://api.cloudinary.com/v1_1/${cloudName}/${resource}/upload`;
}
