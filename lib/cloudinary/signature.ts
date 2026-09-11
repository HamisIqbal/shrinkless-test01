import { createHash } from 'node:crypto';
import { z } from 'zod';

/** Cloudinary signs every upload parameter except these three. */
const EXCLUDED = new Set(['file', 'api_key', 'resource_type']);

export function signatureBase(params: Record<string, string | number>): string {
  return Object.entries(params)
    .filter(([key, value]) => !EXCLUDED.has(key) && value !== '' && value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

export function signParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  return createHash('sha1').update(signatureBase(params) + apiSecret).digest('hex');
}

const cloudinarySchema = z.object({
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
});

export type CloudinaryEnv = { cloudName: string; apiKey: string; apiSecret: string };

/**
 * Separate from lib/env.ts on purpose: these three are only needed by the admin
 * uploader, and the storefront must still boot on an environment without them.
 */
export function loadCloudinaryEnv(source: NodeJS.ProcessEnv = process.env): CloudinaryEnv {
  const parsed = cloudinarySchema.safeParse(source);

  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }

  return {
    cloudName: parsed.data.CLOUDINARY_CLOUD_NAME,
    apiKey: parsed.data.CLOUDINARY_API_KEY,
    apiSecret: parsed.data.CLOUDINARY_API_SECRET,
  };
}
