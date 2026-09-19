import { resolveAnnouncement } from '@/lib/shop/announcement';
import { AnnounceDismiss } from '@/components/site/AnnounceDismiss';

/**
 * The thin ticker above the masthead, on every storefront page.
 *
 * The track holds the message twice and slides exactly half its own width, so
 * the moment the first copy leaves the screen the second copy is sitting
 * precisely where the first one started. That is what makes the loop seamless
 * rather than snapping back — and it is why the duplicate is not optional.
 *
 * `role="status"` sits on the message, not on the bar: with a control inside
 * the live region, a screen reader announces the close button as part of the
 * announcement and again whenever the region changes. The duplicate copies are
 * `aria-hidden`, so the line is read once.
 */
export function AnnounceBar({ message, dismissed = false }: { message?: string; dismissed?: boolean }) {
  if (dismissed) return null;

  const text = resolveAnnouncement(message);

  // Enough repeats that the track is always wider than the viewport; a short
  // message on a wide monitor would otherwise leave a visible gap mid-loop.
  const copies = Array.from({ length: 4 }, (_, i) => i);

  return (
    <AnnounceDismiss message={text}>
      <div className="announce__viewport" role="status">
        <div className="announce__track">
          {[0, 1].map((half) => (
            <div className="announce__half" key={half} aria-hidden={half === 1 || undefined}>
              {copies.map((i) => (
                <span className="announce__item" key={i} aria-hidden={half === 1 || i > 0 || undefined}>
                  {text}
                  <span className="announce__dot" aria-hidden="true">&bull;</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </AnnounceDismiss>
  );
}
