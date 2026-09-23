import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

/** Private and transactional pages stay out of search results. They are also
 *  sent `X-Robots-Tag: noindex` (next.config.ts), because robots.txt only
 *  stops crawling — a linked page can still be indexed without it. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/account',
        '/api/',
        '/auth/',
        '/cart',
        '/checkout',
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/unsubscribe',
      ],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
