'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  archiveCategoryAction,
  backfillCategoriesAction,
  reorderCategoriesAction,
  saveCategoryAction,
} from '@/app/actions/admin/categories';
import { EmptyState } from '@/components/admin/EmptyState';
import type { CategoryDTO } from '@/types/dto';

const BLANK = {
  id: undefined as string | undefined,
  name: '',
  slug: '',
  description: '',
  visible: true,
  sortOrder: 0,
  seoTitle: '',
  seoDescription: '',
};

type Draft = typeof BLANK;

function draftFrom(category: CategoryDTO): Draft {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    visible: category.visible,
    sortOrder: category.sortOrder,
    seoTitle: category.seo.title,
    seoDescription: category.seo.description,
  };
}

/**
 * The whole collection surface on one screen: the list on the left, the editor
 * pinned beside it.
 *
 * There are rarely more than a handful of collections, so a detail page per
 * collection would be more navigation than content — and editing one while
 * looking at the others is exactly what ordering them requires.
 */
export function CategoryManager({
  categories,
  orphanSlugs,
}: {
  categories: CategoryDTO[];
  orphanSlugs: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function run(work: () => Promise<{ ok: boolean; error?: string }>, done?: string) {
    setError('');
    setMessage('');

    startTransition(async () => {
      const result = await work();

      if (!result.ok) {
        setError(result.error ?? 'That did not work.');
        return;
      }

      if (done) setMessage(done);
      router.refresh();
    });
  }

  function save(event: React.FormEvent) {
    event.preventDefault();

    run(
      () =>
        saveCategoryAction({
          ...(draft.id ? { id: draft.id } : {}),
          name: draft.name,
          slug: draft.slug,
          description: draft.description,
          visible: draft.visible,
          sortOrder: Number(draft.sortOrder) || 0,
          seo: { title: draft.seoTitle, description: draft.seoDescription, keywords: [] },
        }),
      draft.id ? 'Collection updated.' : 'Collection created.',
    );

    if (!draft.id) setDraft(BLANK);
  }

  function move(index: number, by: number) {
    const next = [...categories];
    const target = index + by;
    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target], next[index]];

    run(() => reorderCategoriesAction({ orderedIds: next.map((category) => category.id) }));
  }

  return (
    <div className="manager">
      <div>
        {orphanSlugs.length ? (
          <div className="anotice anotice--alert" style={{ marginBottom: 'var(--ad-s-4)' }}>
            <p>
              {orphanSlugs.length === 1
                ? 'One slug is used by products but has no collection record'
                : orphanSlugs.length + ' slugs are used by products but have no collection record'}
              : {orphanSlugs.join(', ')}.
            </p>
            <button
              type="button"
              className="abtn abtn--sm"
              disabled={pending}
              onClick={() => run(() => backfillCategoriesAction({}), 'Imported.')}
            >
              Import
            </button>
          </div>
        ) : null}

        {categories.length ? (
          <div className="tablewrap">
            <table className="atable">
              <thead>
                <tr>
                  <th scope="col">Collection</th>
                  <th scope="col">Visibility</th>
                  <th scope="col" className="atable__num">Products</th>
                  <th scope="col" className="atable__actions">Order</th>
                  <th scope="col" className="atable__actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category, index) => (
                  <tr key={category.id}>
                    <td>
                      <span className="prow__title">{category.name}</span>
                      <span className="prow__meta">{category.slug}</span>
                    </td>
                    <td>
                      <span
                        className={
                          'pill pill--' +
                          (category.archived || !category.visible ? 'off' : 'on')
                        }
                      >
                        {category.archived
                          ? 'Archived'
                          : category.visible
                            ? 'Visible'
                            : 'Hidden'}
                      </span>
                    </td>
                    <td className="atable__num">{category.productCount}</td>
                    <td className="atable__actions">
                      <span className="rowactions">
                        <button
                          type="button"
                          className="abtn abtn--quiet abtn--sm"
                          onClick={() => move(index, -1)}
                          disabled={pending || index === 0}
                          aria-label={'Move ' + category.name + ' up'}
                        >
                          &uarr;
                        </button>
                        <button
                          type="button"
                          className="abtn abtn--quiet abtn--sm"
                          onClick={() => move(index, 1)}
                          disabled={pending || index === categories.length - 1}
                          aria-label={'Move ' + category.name + ' down'}
                        >
                          &darr;
                        </button>
                      </span>
                    </td>
                    <td className="atable__actions">
                      <span className="rowactions">
                        <button
                          type="button"
                          className="abtn abtn--ghost abtn--sm"
                          onClick={() => setDraft(draftFrom(category))}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="abtn abtn--quiet abtn--sm"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () =>
                                archiveCategoryAction({
                                  id: category.id,
                                  archived: !category.archived,
                                }),
                              category.archived ? 'Restored.' : 'Archived.',
                            )
                          }
                        >
                          {category.archived ? 'Restore' : 'Archive'}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No collections yet"
            body="A collection is what a product belongs to and a page a shopper can land on. Create one here, then assign products to it from the product editor."
          />
        )}
      </div>

      <form onSubmit={save} className="manager__form">
        <h2 className="manager__formtitle">
          {draft.id ? 'Edit ' + draft.slug : 'New collection'}
        </h2>

        <label className="adfield">
          Name
          <input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            required
          />
        </label>

        <label className="adfield">
          Slug
          <input
            value={draft.slug}
            onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
            required
          />
          <small>
            Products point at a collection by slug. Renaming one moves every
            product with it.
          </small>
        </label>

        <label className="adfield">
          Description
          <textarea
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            rows={2}
          />
        </label>

        <label className="adfield">
          SEO title
          <input
            value={draft.seoTitle}
            onChange={(event) => setDraft({ ...draft, seoTitle: event.target.value })}
          />
        </label>

        <label className="adfield">
          SEO description
          <textarea
            value={draft.seoDescription}
            onChange={(event) => setDraft({ ...draft, seoDescription: event.target.value })}
            rows={2}
          />
        </label>

        <label className="checkline">
          <input
            type="checkbox"
            checked={draft.visible}
            onChange={(event) => setDraft({ ...draft, visible: event.target.checked })}
          />
          Visible in storefront navigation
        </label>

        <div className="manager__actions">
          <button type="submit" className="abtn" disabled={pending}>
            {draft.id ? 'Save collection' : 'Create collection'}
          </button>

          {draft.id ? (
            <button
              type="button"
              className="abtn abtn--ghost"
              onClick={() => setDraft(BLANK)}
              disabled={pending}
            >
              Cancel
            </button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="anotice anotice--error" style={{ marginTop: 'var(--ad-s-3)' }}>
            {error}
          </p>
        ) : null}
        {!error && message ? (
          <p className="anotice" style={{ marginTop: 'var(--ad-s-3)' }}>{message}</p>
        ) : null}
      </form>
    </div>
  );
}
