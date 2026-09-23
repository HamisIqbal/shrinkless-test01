import { describe, expect, it } from 'vitest';
import {
  unsubscribeHeaders,
  unsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribeToken,
} from '@/lib/email/unsubscribe';

const env = {
  AUTH_SECRET: 'test-secret',
  NEXT_PUBLIC_SITE_URL: 'https://shop.example',
} as unknown as NodeJS.ProcessEnv;

describe('unsubscribe links', () => {
  it('verify for the address they were made for, whatever its case', () => {
    const token = unsubscribeToken('Buyer@Example.com', env);
    expect(verifyUnsubscribeToken('buyer@example.com', token, env)).toBe(true);
  });

  it('refuse another address or a tampered token', () => {
    const token = unsubscribeToken('buyer@example.com', env);
    expect(verifyUnsubscribeToken('other@example.com', token, env)).toBe(false);
    expect(verifyUnsubscribeToken('buyer@example.com', `${token}x`, env)).toBe(false);
    expect(verifyUnsubscribeToken('buyer@example.com', '', env)).toBe(false);
  });

  it('point at this site, with one-click headers for mail clients', () => {
    expect(unsubscribeUrl('buyer@example.com', env)).toMatch(
      /^https:\/\/shop\.example\/unsubscribe\?e=/,
    );
    expect(unsubscribeHeaders('buyer@example.com', env)['List-Unsubscribe-Post']).toBe(
      'List-Unsubscribe=One-Click',
    );
  });
});
