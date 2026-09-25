import Link from 'next/link';
import type { ReactNode } from 'react';
import { HomeScene } from '@/components/home/HomeScene';
import { homeFonts } from '@/components/home/fonts';
import { loadPolicy } from '@/components/pages/policy-data';
import { ContentLayer } from '@/components/site/ContentLayer';
import { ArrowIcon } from '@/components/site/icons';
import { LEGAL_PAGES } from '@/lib/legal/pages';
import './privacy.css';

const pad = (value: number) => String(value).padStart(2, '0');

const DATE = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

/** A reading pace for plain prose, in words a minute. */
const PACE = 230;

/** An anchor for each clause, from its heading, so a link can point at
 *  #cookies rather than at a number that moves when a clause is added. */
function anchors(headings: string[]): string[] {
  const seen = new Set<string>();

  return headings.map((heading, index) => {
    const base =
      heading
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `clause-${index + 1}`;

    let slug = base;
    for (let n = 2; seen.has(slug); n += 1) slug = `${base}-${n}`;
    seen.add(slug);

    return slug;
  });
}

/** The store's email and phone, where a clause names them, as links. Only
 *  those two strings — the text is otherwise rendered exactly as written. */
function withLinks(text: string, email: string, phone: string): ReactNode {
  const targets = [
    email ? { text: email, href: `mailto:${email}` } : null,
    phone ? { text: phone, href: `tel:${phone.replace(/[^\d+]/g, '')}` } : null,
  ].filter((target) => target !== null);

  if (!targets.length) return text;

  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(${targets.map((target) => escape(target.text)).join('|')})`);

  return text.split(pattern).map((part, index) => {
    const target = targets.find((candidate) => candidate.text === part);

    return target ? (
      <a key={index} href={target.href} className="pv-inline">
        {part}
      </a>
    ) : (
      part
    );
  });
}

/**
 * The privacy policy.
 *
 * The same words as every policy — read, filled and dated by loadPolicy — set
 * out as a care label. A tee says what it is made of and how to treat it on a
 * label sewn into its seam; this page says the same about what a shopper tells
 * us. It opens on ink, the black tee, with the contents on a white label that
 * hangs from the seam under the masthead. Below, each clause is a ledger row:
 * its heading held in the left column while its text runs down the right.
 */
export async function PrivacyPage() {
  const { title, lede, clauses, effective, layer, email, phone } = await loadPolicy('privacy');

  const ids = anchors(clauses.map((clause) => clause.heading));

  const words = clauses
    .flatMap((clause) => [clause.heading, ...clause.paragraphs])
    .join(' ')
    .split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / PACE));

  const others = LEGAL_PAGES.filter((page) => page.id !== 'privacy');

  return (
    <div className={`pv ${homeFonts}`}>
      <HomeScene className="pv-head" aria-label={title}>
        <div className="hm-wrap pv-head__grid">
          <div className="pv-head__words">
            <p className="hm-eyebrow" data-hm-fade>Policies</p>

            <div className="hm-mask hm-mask--tall pv-head__mask">
              <h1 className="pv-head__title" data-hm-rise data-hm-delay="0.08">{title}</h1>
            </div>

            <p className="pv-head__lede" data-hm-fade data-hm-delay="0.25">{lede}</p>

            <dl className="pv-head__meta" data-hm-fade data-hm-delay="0.35">
              <div>
                <dt>Effective</dt>
                <dd>
                  <time dateTime={effective.toISOString().slice(0, 10)}>{DATE.format(effective)}</time>
                </dd>
              </div>
              <div>
                <dt>Reading time</dt>
                <dd>
                  {minutes} {minutes === 1 ? 'minute' : 'minutes'}
                </dd>
              </div>
            </dl>
          </div>

          <nav className="pv-label" aria-labelledby="pv-label-heading">
            <p className="pv-label__mark" aria-hidden="true">Shrinkless</p>
            <h2 id="pv-label-heading" className="pv-label__heading">In this policy</h2>

            <ol className="pv-label__list">
              {clauses.map((clause, index) => (
                <li key={ids[index]}>
                  <a href={`#${ids[index]}`} className="pv-label__link">
                    <span className="pv-label__no tnum" aria-hidden="true">{pad(index + 1)}</span>
                    <span className="pv-label__name">{clause.heading}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </HomeScene>

      <div className="pv-body">
        <div className="hm-wrap">
          <ol className="pv-clauses">
            {clauses.map((clause, index) => (
              <li key={ids[index]} id={ids[index]} className="pv-clause">
                <div className="pv-clause__head">
                  <p className="pv-clause__no tnum">Clause {pad(index + 1)}</p>
                  <h2 className="pv-clause__title">{clause.heading}</h2>
                </div>

                <div className="pv-clause__text">
                  {clause.paragraphs.map((paragraph, n) => (
                    <p key={n}>{withLinks(paragraph, email, phone)}</p>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          <section className="pv-ask" aria-labelledby="pv-ask-heading">
            <div className="pv-ask__lead">
              <p className="hm-eyebrow">Your information</p>
              <h2 id="pv-ask-heading" className="pv-ask__title">Ask about your data</h2>
              <p className="pv-ask__body">
                Email us to see, correct or delete the information we hold about you, or with any
                question about this policy.
              </p>

              <div className="pv-ask__actions">
                <a href={`mailto:${email}?subject=Privacy%20request`} className="hm-pill hm-pill--light">
                  <span className="hm-pill__label">Email a privacy request</span>
                  <span className="hm-pill__icon" aria-hidden="true">
                    <ArrowIcon />
                  </span>
                </a>

                <p className="pv-ask__contact">
                  <a href={`mailto:${email}`}>{email}</a>
                  {phone ? <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a> : null}
                </p>
              </div>
            </div>

            <nav className="pv-more" aria-labelledby="pv-more-heading">
              <h2 id="pv-more-heading" className="hm-eyebrow">Other policies</h2>
              <ul className="pv-more__list">
                {others.map((page) => (
                  <li key={page.id}>
                    <Link href={page.href} className="pv-more__link">
                      {page.label}
                      <ArrowIcon />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </section>
        </div>
      </div>

      <ContentLayer {...layer} />
    </div>
  );
}
