import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    // In-memory MongoDB starts in beforeAll; under parallel load this can exceed
    // the 10s default, causing "Hook timed out" failures.
    hookTimeout: 60_000,
    server: {
      // `next` ships without an "exports" map, so Node's ESM resolver can't
      // resolve extensionless subpaths like "next/server" (which next-auth
      // imports). Inlining lets Vite bundle these deps instead of handing
      // resolution to the native Node loader.
      deps: {
        inline: ['next-auth', 'next'],
      },
    },
  },
});
