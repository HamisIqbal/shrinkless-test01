'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { duplicateProductAction } from '@/app/actions/admin/products';

type Props = {
  id: string;
};

/**
 * Edit and duplicate, from the line sheet.
 *
 * A wholesale style is a product with the wholesale tag, so duplicating one
 * goes through the same `duplicateProductAction` the retail list uses — the
 * tag travels with the rest of the copied fields, and the copy lands back on
 * the wholesale editor rather than the retail one.
 */
export function WholesaleRowActions({ id }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function duplicate() {
    setError('');
    startTransition(async () => {
      const result = await duplicateProductAction({ id });

      if (!result.ok) setError(result.error);
      else router.push(`/admin/wholesale/${result.data.id}`);
    });
  }

  return (
    <span className="rowactions">
      <Link href={`/admin/wholesale/${id}`} className="abtn abtn--quiet abtn--sm">
        Edit
      </Link>

      <button
        type="button"
        className="abtn abtn--quiet abtn--sm"
        onClick={duplicate}
        disabled={pending}
      >
        Duplicate
      </button>

      {error ? <span role="alert" className="rowactions__error">{error}</span> : null}
    </span>
  );
}
