import Link from 'next/link';
import { CatalogueHead } from '@/components/pages/CatalogueHead';
import { loadPolicy } from '@/components/pages/policy-data';
import { ContentLayer } from '@/components/site/ContentLayer';
import { homeFonts } from '@/components/home/fonts';
import type { PolicyId } from '@/lib/services/site-content';
import { LEGAL_PAGES } from '@/lib/legal/pages';
import '@/components/shop/shop.css';

const pad = (value: number) => String(value).padStart(2, '0');

const DATE = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * One policy page: the chalk band every page opens on, then the clauses as a
 * numbered ledger beside a panel that links the other policies and says where
 * to ask. The words and their filling are loadPolicy's; see policy-data.ts.
 */
export async function PolicyPage({ id }: { id: PolicyId }) {
  const { title, lede, clauses, effective, layer, email, phone } = await loadPolicy(id);

  return (
    <>
      <CatalogueHead eyebrow="Policies" title={title} lede={lede} />

      <div className={`sh-policy ${homeFonts}`}>
        <div className="sh-wrap sh-policy__layout">
          <div className="sh-policy__main">
            <p className="sh-label">
              Effective <time dateTime={effective.toISOString().slice(0, 10)}>{DATE.format(effective)}</time>
            </p>

            <ol className="sh-policy__clauses">
              {clauses.map((clause, index) => (
                <li key={index} className="sh-policy__clause">
                  <p className="sh-label tnum">{pad(index + 1)}</p>
                  <h2 className="sh-sub">{clause.heading}</h2>
                  <div className="sh-policy__text">
                    {clause.paragraphs.map((paragraph, n) => (
                      <p key={n} className="sh-body">{paragraph}</p>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <aside className="sh-receipt sh-policy__aside" aria-label="Policies and contact">
            <nav aria-labelledby="policy-nav-heading">
              <h2 id="policy-nav-heading" className="sh-label">Policies</h2>
              <ul className="sh-policy__nav">
                {LEGAL_PAGES.map((policy) => (
                  <li key={policy.id}>
                    <Link
                      href={policy.href}
                      className="sh-link"
                      aria-current={policy.id === id ? 'page' : undefined}
                    >
                      {policy.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="sh-policy__ask">
              <p className="sh-label">Questions</p>
              <a href={`mailto:${email}`} className="sh-btn sh-btn--block">
                Email us
              </a>
              <p className="sh-receipt__note">{email}</p>
              {phone ? <p className="sh-receipt__note">{phone}</p> : null}
            </div>
          </aside>
        </div>

        <ContentLayer {...layer} />
      </div>
    </>
  );
}
