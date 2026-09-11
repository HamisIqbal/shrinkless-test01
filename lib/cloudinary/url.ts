export function cloudinaryUrl(
  publicId: string,
  transform?: string,
  cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
): string {
  const segments = ['https://res.cloudinary.com', cloudName, 'image', 'upload'];
  if (transform) segments.push(transform);
  segments.push(publicId);

  return segments.join('/');
}
