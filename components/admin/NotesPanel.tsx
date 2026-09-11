'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminResult } from '@/lib/admin/action';
import type { OrderNoteDTO } from '@/types/dto';

type NoteAction = (input: { id: string; body: string }) => Promise<AdminResult<undefined>>;

/**
 * Internal notes, shared by orders and customers.
 *
 * Notes are append-only by design: an editable note is a note nobody can rely
 * on later. If something was wrong, the correction is another note.
 */
export function NotesPanel({
  id,
  notes,
  action,
  heading = 'Notes',
}: {
  id: string;
  notes: OrderNoteDTO[];
  action: NoteAction;
  heading?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    startTransition(async () => {
      const result = await action({ id, body });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setBody('');
      router.refresh();
    });
  }

  return (
    <section className="panel notes">
      <p className="alabel">{heading}</p>

      {notes.length ? (
        <ul className="notes__list">
          {notes.map((note) => (
            <li key={note.id} className="notes__item">
              <p>{note.body}</p>
              <span className="notes__meta">
                {note.actorEmail} ·{' '}
                {new Date(note.at).toLocaleString('en-US', {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="aquiet" style={{ marginBottom: 'var(--ad-s-3)' }}>
          Nothing recorded yet. Notes are staff-only and append-only — a
          correction is another note.
        </p>
      )}

      <form onSubmit={submit}>
        <label className="adfield">
          <span className="visually-hidden">New note</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            placeholder="What happened, and what you did about it"
            required
          />
        </label>

        <button
          type="submit"
          className="abtn abtn--ghost abtn--block"
          disabled={pending || !body.trim()}
        >
          {pending ? 'Saving' : 'Add note'}
        </button>
      </form>

      {error ? (
        <p role="alert" className="anotice anotice--error" style={{ marginTop: 'var(--ad-s-3)' }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
