import type { ReactNode } from 'react';

/**
 * Every admin page opens the same way: a large heading, one quiet line of
 * orientation, and the page's own actions on the right.
 *
 * No eyebrow above the title. The heading carries its own weight, and a label
 * repeating the navigation you just clicked is noise on every single page.
 */
export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="apage__head">
      <div className="apage__titles">
        <h1 className="apage__title">{title}</h1>
        {sub ? <p className="apage__sub">{sub}</p> : null}
      </div>

      {actions ? <div className="apage__actions">{actions}</div> : null}
    </header>
  );
}
