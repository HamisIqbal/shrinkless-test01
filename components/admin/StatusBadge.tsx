/**
 * A status pill.
 *
 * Three tones, and the choice between them is operational rather than
 * decorative: **attention** is the only one that carries the acid, and it is
 * reserved for states that want a person to do something today. Everything
 * live is ink; everything closed or not yet live is quiet.
 *
 * A palette that gave every status its own colour would make the one status
 * that needs acting on impossible to spot.
 */
const ATTENTION = new Set(['pending', 'payment_failed', 'out']);
const OFF = new Set(['cancelled', 'draft', 'archived', 'inactive']);

function toneFor(status: string): 'on' | 'attention' | 'off' {
  if (ATTENTION.has(status)) return 'attention';
  if (OFF.has(status)) return 'off';
  return 'on';
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`pill pill--${toneFor(status)}`} data-status={status}>
      {label ?? status.replace(/_/g, ' ')}
    </span>
  );
}
