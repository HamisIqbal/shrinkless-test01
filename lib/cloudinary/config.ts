export const UPLOAD_FOLDER = 'shrinkless/products';

/** Brand and editorial photography. A second folder rather than one shared
 *  one, so a product shot and a hero frame are never a search away from each
 *  other in the Cloudinary console. */
export const SITE_UPLOAD_FOLDER = 'shrinkless/site';

export function uploadEndpoint(cloudName: string): string {
  return `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
}
