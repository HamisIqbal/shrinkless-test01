import type { ReactNode } from 'react';
import { homeFonts } from '@/components/home/fonts';
import { loadPolicy } from '@/components/pages/policy-data';
import { ContentLayer } from '@/components/site/ContentLayer';
import type { PolicyId } from '@/lib/services/site-content';
import './policy.css';

const DATE = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/** The store's email and phone, where a clause names them, as links. Only
 *  those two strings — the text is otherwise rendered exactly as written. */
function withLinks(text: string, email: string, phone: string): ReactNode {
  const targets = [
    email ? { text: email, href: `mailto:${email}` } : null,
    phone ? { text: phone, href: telHref(phone) } : null,
  ].filter((target) => target !== null);

  if (!targets.length) return text;

  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(${targets.map((target) => escape(target.text)).join('|')})`);

  return text.split(pattern).map((part, index) => {
    const target = targets.find((candidate) => candidate.text === part);

    return target ? (
      <a key={index} href={target.href}>
        {part}
      </a>
    ) : (
      part
    );
  });
}

/**
 * One policy page: a plain document, black on white, in one narrow column.
 * The title, the effective date, the lede, then each clause's heading and
 * text. No motion, no contents list, no links out to the other policies.
 *
 * The words, their {{tokens}} and the effective date are loadPolicy's; see
 * policy-data.ts.
 */
export async function PolicyPage({ id }: { id: PolicyId }) {
  const { title, lede, clauses, effective, layer, email, phone } = await loadPolicy(id);

  return (
    <div className={`pl ${homeFonts}`}>
      <article className="pl-doc">
        <header className="pl-head">
          <h1 className="pl-title">{title}</h1>
          <p className="pl-date">
            Effective <time dateTime={effective.toISOString().slice(0, 10)}>{DATE.format(effective)}</time>
          </p>
          {lede ? <p className="pl-lede">{lede}</p> : null}
        </header>

        {clauses.map((clause, index) => (
          <section key={index} className="pl-clause">
            <h2>{clause.heading}</h2>
            {clause.paragraphs.map((paragraph, n) => (
              <p key={n}>{withLinks(paragraph, email, phone)}</p>
            ))}
          </section>
        ))}
      </article>

      <ContentLayer {...layer} />
    </div>
  );
}
