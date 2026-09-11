import type { ReactNode } from 'react';

/**
 * An empty state that teaches the region rather than apologising for it.
 *
 * `title` says what is missing in the shop's own language; `body` says what
 * this region is for and what puts something in it.
 */
export function EmptyState({
  title,
  body,
  action,
  center = false,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`empty${center ? ' empty--center' : ''}`}>
      <p className="empty__title">{title}</p>
      {body ? <p className="empty__body">{body}</p> : null}
      {action}
    </div>
  );
}
