import { describe, expect, it } from 'vitest';
import { absoluteUrl, siteUrl } from '@/lib/site';

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

describe('siteUrl', () => {
  it('prefers an explicitly configured origin', () => {
    expect(siteUrl(env({ NEXT_PUBLIC_SITE_URL: 'https://shrinkless.com' }))).toBe(
      'https://shrinkless.com',
    );
  });

  it('drops a trailing slash so paths do not double up', () => {
    expect(siteUrl(env({ NEXT_PUBLIC_SITE_URL: 'https://shrinkless.com/' }))).toBe(
      'https://shrinkless.com',
    );
  });

  it('falls back to the deployment Vercel names, scheme added', () => {
    expect(siteUrl(env({ VERCEL_URL: 'shrinkless-abc123.vercel.app' }))).toBe(
      'https://shrinkless-abc123.vercel.app',
    );
  });

  it('prefers the production domain over the per-deployment one', () => {
    expect(
      siteUrl(
        env({
          VERCEL_PROJECT_PRODUCTION_URL: 'shrinkless.vercel.app',
          VERCEL_URL: 'shrinkless-abc123.vercel.app',
        }),
      ),
    ).toBe('https://shrinkless.vercel.app');
  });

  it('has a working default for local development', () => {
    expect(siteUrl(env({}))).toBe('http://localhost:3000');
  });
});

describe('absoluteUrl', () => {
  it('joins a path onto the origin exactly once', () => {
    const config = env({ NEXT_PUBLIC_SITE_URL: 'https://shrinkless.com' });

    expect(absoluteUrl('/reset-password?token=abc', config)).toBe(
      'https://shrinkless.com/reset-password?token=abc',
    );
    expect(absoluteUrl('reset-password', config)).toBe(
      'https://shrinkless.com/reset-password',
    );
  });
});
