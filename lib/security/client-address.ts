import { headers } from 'next/headers';

/**
 * Best-effort client address, for per-source rate limits.
 *
 * Vercel sets `x-real-ip` and overwrites `x-forwarded-for` with the address it
 * saw, so neither can be forged through the platform. Off Vercel a forwarded
 * header can be spoofed, which is why a per-source limit is only ever the
 * *second* line of defence behind one keyed on what is being attacked.
 *
 * One helper so every limit keys on the same thing: three hand-rolled copies
 * of this had already started to differ.
 */
export async function clientAddress(): Promise<string> {
  const store = await headers();

  const real = store.get('x-real-ip')?.trim();
  if (real) return real;

  return (store.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown';
}
