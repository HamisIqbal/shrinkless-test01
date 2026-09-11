'use client';

import { useEffect } from 'react';

/**
 * `app/error.tsx` cannot catch a throw from `app/(shop)/layout.tsx` — a layout's
 * errors bubble past the boundary beside it, to the root. Since every shop page
 * loads store settings in that layout, a database outage skipped the boundary
 * entirely and Next served a bare 500. This is the backstop, so it must render
 * its own <html> and <body>, and must not depend on any app stylesheet.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDatabase =
    error.name === 'MongooseServerSelectionError' ||
    /mongo|ECONNREFUSED|EAI_AGAIN|server selection/i.test(error.message);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
          background: '#e9e2d3',
          color: '#1c1815',
          font: '400 1rem/1.6 Georgia, serif',
        }}
      >
        <main style={{ maxWidth: '34rem' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Error
          </p>
          <h1 style={{ margin: '0.75rem 0 0', fontSize: '2.25rem', lineHeight: 1.1, fontWeight: 500 }}>
            {isDatabase ? 'Cannot reach the database' : 'Something broke'}
          </h1>
          <p style={{ marginTop: '1.25rem' }}>
            {isDatabase
              ? 'The store is running but the database did not answer. Check that MONGODB_URI is set and that the cluster accepts connections from this host.'
              : 'The page failed to render. The details are in the server log.'}
          </p>
          {error.digest ? (
            <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#5c5348' }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '2rem',
              padding: '0.75rem 1.5rem',
              border: 0,
              background: '#1c1815',
              color: '#e9e2d3',
              font: 'inherit',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
