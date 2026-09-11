'use client';

import { useEffect } from 'react';

/**
 * Catches anything thrown while rendering a page or layout — in practice, most
 * often a failed database connection, which otherwise surfaces as a blank
 * screen with the reason buried in the terminal.
 */
export default function AppError({
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
    <div className="wrap narrow errorpage">
      <p className="eyebrow">Error</p>
      <h1 className="display">
        {isDatabase ? 'Cannot reach the database' : 'Something broke'}
      </h1>

      {isDatabase ? (
        <p className="lede">
          The store loaded but the database did not answer. Check that
          MONGODB_URI is set and that the cluster is running.
        </p>
      ) : (
        <p className="lede">The page failed to render. The details are in the server log.</p>
      )}

      {process.env.NODE_ENV === 'development' ? (
        <pre className="errorpage__detail">{error.message}</pre>
      ) : null}

      <button type="button" className="btn" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
