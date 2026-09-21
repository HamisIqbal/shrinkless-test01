'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { resetContentFieldAction, saveContentPageAction } from '@/app/actions/admin/content';
import { UnsavedBar } from '@/components/admin/UnsavedBar';
import type { ContentFieldView, ContentKind, ContentPageView } from '@/lib/services/site-content';

/** Which kinds are written in a box rather than on a line. A heading that
 *  wraps is still a heading; a paragraph typed into a single-line input is a
 *  paragraph nobody can read while writing it. */
function isLong(kind: ContentKind): boolean {
  return kind === 'body' || kind === 'answer' || kind === 'lede';
}

function pageFields(page: ContentPageView): ContentFieldView[] {
  return page.sections.flatMap((section) => section.fields);
}

/* --------------------------------------------------------------------------
   One line of writing
   -------------------------------------------------------------------------- */

function Field({
  field,
  value,
  edited,
  onChange,
  onRestored,
}: {
  field: ContentFieldView;
  value: string;
  edited: boolean;
  onChange: (value: string) => void;
  onRestored: () => void;
}) {
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  /** Forgets the override, so the field falls back to the wording the site
   *  shipped with. The server is the only place that knows what that is, so
   *  the panel reloads rather than guessing. */
  function restore() {
    setError('');

    startTransition(async () => {
      const result = await resetContentFieldAction({ key: field.key });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onRestored();
    });
  }

  return (
    <div className={`cfield${edited ? ' cfield--edited' : ''}`}>
      <label className="adfield">
        <span className="cfield__label">
          {field.label}
        </span>

        {isLong(field.kind) ? (
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            maxLength={field.maxLength}
            rows={field.kind === 'body' || field.kind === 'answer' ? 6 : 3}
            required
          />
        ) : (
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            maxLength={field.maxLength}
            required
          />
        )}

        <small className="cfield__meta">
          {value.trim().length} / {field.maxLength}
          {field.overridden ? (
            <button
              type="button"
              className="cfield__restore"
              onClick={restore}
              disabled={pending}
            >
              {pending ? 'Restoring…' : 'Restore original'}
            </button>
          ) : null}
        </small>
      </label>

      {error ? <p className="anotice anotice--error">{error}</p> : null}
    </div>
  );
}

/* --------------------------------------------------------------------------
   The tab
   -------------------------------------------------------------------------- */

function Editor({
  pages,
  savedAt,
  onSaved,
  onRestored,
}: {
  pages: ContentPageView[];
  /** When the last save landed, so the bar can confirm it across a remount. */
  savedAt: number;
  onSaved: () => void;
  onRestored: () => void;
}) {
  /* What the storefront is serving right now — the last save, or the shipped
     wording if there has never been one. Everything typed lives in `drafts`
     until Save, and Cancel is simply this record copied back. */
  const saved = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        pages.flatMap((page) => pageFields(page).map((field) => [field.key, field.value])),
      ),
    [pages],
  );

  const [drafts, setDrafts] = useState<Record<string, string>>(saved);
  const [pageId, setPageId] = useState(pages[0]?.id ?? '');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const page = pages.find((candidate) => candidate.id === pageId) ?? pages[0];

  /* Every page, not just the one on screen: the bar asks about everything
     that differs, so a line changed on Home and another on the FAQ are one
     decision rather than two that could be half made. */
  const dirty = pages
    .flatMap(pageFields)
    .filter((field) => drafts[field.key] !== saved[field.key]);

  /** Everything changed on any page, in one write. */
  function save() {
    setError('');

    const entries = dirty.map((field) => ({ key: field.key, value: drafts[field.key] }));

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveContentPageAction>>;

      try {
        result = await saveContentPageAction({ entries });
      } catch {
        setError('Could not reach the server to save. Check the connection and try again.');
        return;
      }

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onSaved();
    });
  }

  return (
    <div className="cedit">
      <header className="cedit__bar">
        <div className="cedit__pages" role="group" aria-label="Page">
          {pages.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className={`cedit__page${candidate.id === page?.id ? ' cedit__page--on' : ''}`}
              onClick={() => setPageId(candidate.id)}
              aria-pressed={candidate.id === page?.id}
            >
              {candidate.label}
            </button>
          ))}
        </div>

      </header>

      {page?.sections.map((section) => (
        <section key={section.id} className="panel csection">
          <header className="csection__head">
            <h3 className="csection__title">{section.label}</h3>
            <p className="csection__note">{section.note}</p>
          </header>

          <div className="csection__fields">
            {section.fields.map((field) => (
              <Field
                key={field.key}
                field={field}
                value={drafts[field.key] ?? ''}
                edited={drafts[field.key] !== saved[field.key]}
                onChange={(value) => {
                  setError('');
                  setDrafts((current) => ({ ...current, [field.key]: value }));
                }}
                onRestored={onRestored}
              />
            ))}
          </div>
        </section>
      ))}

      <UnsavedBar
        count={dirty.length}
        pending={pending}
        error={error}
        savedAt={savedAt}
        onSave={save}
        onCancel={() => {
          setError('');
          setDrafts(saved);
        }}
      />
    </div>
  );
}

/**
 * The storefront's writing, section by section.
 *
 * Words and nothing else. How a line is set — its size, its colour, where it
 * sits — is not this tab's business, and the settings anything already carries
 * are left exactly as they are when the wording changes: a save here writes
 * the sentence and touches nothing around it.
 *
 * A save or a restore both change what the server would send, so the drafts
 * start again from what came back. The editor is keyed on that data rather
 * than on a counter bumped when the action returned: the counter remounted it
 * before the refreshed data arrived, so the drafts were rebuilt from the old
 * wording and the bar asked to save a change that was already live.
 */
export function ContentManager({ pages }: { pages: ContentPageView[] }) {
  const router = useRouter();
  const [savedAt, setSavedAt] = useState(0);
  const fingerprint = useMemo(() => JSON.stringify(pages), [pages]);

  return (
    <Editor
      key={fingerprint}
      pages={pages}
      savedAt={savedAt}
      onSaved={() => {
        setSavedAt(Date.now());
        router.refresh();
      }}
      onRestored={() => router.refresh()}
    />
  );
}
