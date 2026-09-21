'use client';

import { useEffect, useState } from 'react';

type Props = {
  /** How many things differ from what the storefront is serving. */
  count: number;
  pending: boolean;
  /** A refusal from the last save, shown in the bar until the next edit. */
  error: string;
  /** Bumped by the caller on every successful save, to show the confirmation. */
  savedAt: number;
  onSave: () => void;
  onCancel: () => void;
};

/** How long the confirmation stays up after a save before the bar leaves. */
const CONFIRM_MS = 2600;

/**
 * The question every editor in the panel asks once something has changed:
 * keep it, or put it back.
 *
 * It replaces the per-row "Changed" and "Not published" marks. Those said
 * something was different but left the answer in a bar at the top of a page
 * that had usually been scrolled off; this one rides the bottom of the screen
 * for as long as there is something to decide, and leaves once there is not.
 *
 * Fixed rather than sticky so it is in the same place on every page and at
 * every scroll position, which is what makes it a habit rather than a search.
 */
export function UnsavedBar({ count, pending, error, savedAt, onSave, onCancel }: Props) {
  /* The save whose confirmation has already been shown and taken down. A save
     is confirmed until the timer below catches up with it. */
  const [dismissed, setDismissed] = useState(0);

  useEffect(() => {
    if (!savedAt) return;

    const timer = window.setTimeout(() => setDismissed(savedAt), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  const open = count > 0 || pending || Boolean(error);
  const confirmed = !open && savedAt > 0 && savedAt !== dismissed;

  if (!open && !confirmed) return null;

  return (
    <div
      className={`savebar${error ? ' savebar--error' : ''}${confirmed ? ' savebar--done' : ''}`}
      role="region"
      aria-label="Unsaved changes"
      aria-live="polite"
    >
      <p className="savebar__text">
        {confirmed
          ? 'Saved. The storefront is serving this now.'
          : error ||
            (pending
              ? 'Saving…'
              : `You have ${count} unsaved change${count === 1 ? '' : 's'}. Save them?`)}
      </p>

      {confirmed ? null : (
        <div className="savebar__acts">
          <button
            type="button"
            className="abtn abtn--sm savebar__cancel"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>

          <button
            type="button"
            className="abtn abtn--sm savebar__save"
            onClick={onSave}
            disabled={pending || count === 0}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
