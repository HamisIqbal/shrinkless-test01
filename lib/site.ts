/**
 * Where this deployment lives, as an absolute origin.
 *
 * Needed by anything that has to put a link in an email: a relative path is
 * meaningless once it leaves the browser. `NEXT_PUBLIC_SITE_URL` wins so a
 * custom domain can be stated outright; the Vercel-provided values are the
 * fallback so preview deployments mail links to themselves rather than to
 * production.
 */
export function siteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercel =
    env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || env.VERCEL_URL?.trim() || '';
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;

  return 'http://localhost:3000';
}

/** An absolute URL for a path on this deployment. */
export function absoluteUrl(path: string, env: NodeJS.ProcessEnv = process.env): string {
  return `${siteUrl(env)}${path.startsWith('/') ? path : `/${path}`}`;
}
