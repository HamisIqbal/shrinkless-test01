import { describe, expect, it } from 'vitest';
import { loadServerEnv } from '@/lib/env';

describe('loadServerEnv', () => {
  it('returns the parsed values when everything is present', () => {
    const env = loadServerEnv({
      MONGODB_URI: 'mongodb://localhost:27017/shrinkless',
      AUTH_SECRET: 'a-secret',
    } as unknown as NodeJS.ProcessEnv);

    expect(env.MONGODB_URI).toBe('mongodb://localhost:27017/shrinkless');
  });

  it('throws naming every missing variable', () => {
    // Asserted separately rather than with one /s-flagged regex, which the
    // ES2017 compile target does not allow.
    expect(() => loadServerEnv({} as unknown as NodeJS.ProcessEnv)).toThrowError(/MONGODB_URI/);
    expect(() => loadServerEnv({} as unknown as NodeJS.ProcessEnv)).toThrowError(/AUTH_SECRET/);
  });

  it('rejects an empty string as missing', () => {
    expect(() =>
      loadServerEnv({ MONGODB_URI: '', AUTH_SECRET: 'x' } as unknown as NodeJS.ProcessEnv),
    ).toThrowError(/MONGODB_URI/);
  });
});
