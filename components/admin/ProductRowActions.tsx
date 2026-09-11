'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  archiveProductAction,
  duplicateProductAction,
  setProductStatusAction,
} from '@/app/actions/admin/products';

type Props = {
  id: string;
  status: 'draft' | 'published';
  archived: boolean;
  title: string;
};

/**
 * Edit, publish, unpublish and archive, from the list.
 *
 * Edit is a plain link to the same place the product's name goes. It is here
 * because a name that happens to be a link is a thing you have to already know
 * — the row should say where editing is, not rely on a hover.
 *
 * The rest are server actions that re-check the permission — the buttons are a
 * convenience, not the authorization. Archiving asks first, because it is the
 * closest thing to a delete this store offers.
 */
export function ProductRowActions({ id, status, archived, title }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function toggleStatus() {
    setError('');
    startTransition(async () => {
      const result = await setProductStatusAction({
        id,
        status: status === 'published' ? 'draft' : 'published',
      });

      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function duplicate() {
    setError('');
    startTransition(async () => {
      const result = await duplicateProductAction({ id });

      if (!result.ok) setError(result.error);
      else router.push(`/admin/products/${result.data.id}`);
    });
  }

  function toggleArchive() {
    if (!archived && !window.confirm(`Archive “${title}”? It leaves the storefront.`)) return;

    setError('');
    startTransition(async () => {
      const result = await archiveProductAction({ id, archived: !archived });

      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <span className="rowactions">
      <Link href={`/admin/products/${id}`} className="abtn abtn--ghost abtn--sm">
        Edit
      </Link>

      <button
        type="button"
        className="abtn abtn--ghost abtn--sm"
        onClick={duplicate}
        disabled={pending}
      >
        Duplicate
      </button>

      {!archived ? (
        <button
          type="button"
          className="abtn abtn--ghost abtn--sm"
          onClick={toggleStatus}
          disabled={pending}
        >
          {status === 'published' ? 'Unpublish' : 'Publish'}
        </button>
      ) : null}

      <button
        type="button"
        className="abtn abtn--quiet abtn--sm"
        onClick={toggleArchive}
        disabled={pending}
      >
        {archived ? 'Restore' : 'Archive'}
      </button>

      {error ? <span role="alert" className="rowactions__error">{error}</span> : null}
    </span>
  );
}
