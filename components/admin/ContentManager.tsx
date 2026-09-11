'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { resetContentFieldAction, saveContentPageAction } from '@/app/actions/admin/content';
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
          {field.overridden ? <span className="cfield__state">Changed</span> : null}
          {edited ? <span className="cfield__state cfield__state--on">Unsaved</span> : null}
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

function Editor({ pages, onRestored }: { pages: ContentPageView[]; onRestored: () => void }) {
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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const page = pages.find((candidate) => candidate.id === pageId) ?? pages[0];
  const here = page ? pageFields(page) : [];
  const dirty = here.filter((field) => drafts[field.key] !== saved[field.key]);

  /** Everything changed on this page, in one write. */
  function save() {
    setError('');
    setMessage('');

    const entries = dirty.map((field) => ({ key: field.key, value: drafts[field.key] }));

    startTransition(async () => {
      const result = await saveContentPageAction({ entries });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage('Saved. The storefront is serving this now.');
      onRestored();
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
              onClick={() => {
                setPageId(candidate.id);
                setMessage('');
              }}
              aria-pressed={candidate.id === page?.id}
            >
              {candidate.label}
            </button>
          ))}
        </div>

        <div className="cedit__acts">
          <button
            type="button"
            className="abtn abtn--sm"
            onClick={save}
            disabled={pending || !dirty.length}
          >
            {pending ? 'Saving…' : `Save${dirty.length ? ` (${dirty.length})` : ''}`}
          </button>

          <button
            type="button"
            className="abtn abtn--quiet abtn--sm"
            onClick={() => {
              setError('');
              setMessage('');
              setDrafts(saved);
            }}
            disabled={pending || !dirty.length}
          >
            Cancel
          </button>
        </div>

        {error ? <p className="anotice anotice--error cedit__note">{error}</p> : null}
        {!error && message ? <p className="anotice cedit__note">{message}</p> : null}
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
                  setMessage('');
                  setDrafts((current) => ({ ...current, [field.key]: value }));
                }}
                onRestored={onRestored}
              />
            ))}
          </div>
        </section>
      ))}
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
 * A save or a restore both change what the server would send, so both refresh
 * and remount: the drafts start again from what came back.
 */
export function ContentManager({ pages }: { pages: ContentPageView[] }) {
  const router = useRouter();
  const [version, setVersion] = useState(0);

  return (
    <Editor
      key={version}
      pages={pages}
      onRestored={() => {
        router.refresh();
        setVersion((current) => current + 1);
      }}
    />
  );
}
