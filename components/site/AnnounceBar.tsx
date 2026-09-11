const PLACEHOLDER =
  'Future announcements will appear here — restocks, new releases and Shrinkless news.';

/**
 * The thin ticker above the masthead.
 *
 * The track holds the message twice and slides exactly half its own width, so
 * the moment the first copy leaves the screen the second copy is sitting
 * precisely where the first one started. That is what makes the loop seamless
 * rather than snapping back — and it is why the duplicate is not optional.
 *
 * Marked `aria-hidden` on the duplicate so the line is announced once, not
 * twice, and the whole strip is inert to a screen reader beyond its single
 * readable copy.
 */
export function AnnounceBar({ message }: { message?: string }) {
  const text = message?.trim() || PLACEHOLDER;

  // Enough repeats that the track is always wider than the viewport; a short
  // message on a wide monitor would otherwise leave a visible gap mid-loop.
  const copies = Array.from({ length: 4 }, (_, i) => i);

  return (
    <div className="announce" role="status">
      <div className="announce__track">
        {[0, 1].map((half) => (
          <div className="announce__half" key={half} aria-hidden={half === 1 || undefined}>
            {copies.map((i) => (
              <span className="announce__item" key={i}>
                {text}
                <span className="announce__dot" aria-hidden="true">&bull;</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
