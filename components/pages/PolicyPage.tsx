import Link from 'next/link';
import { CatalogueHead } from '@/components/pages/CatalogueHead';
import { ContentLayer } from '@/components/site/ContentLayer';
import { homeFonts } from '@/components/home/fonts';
import {
  POLICY_CLAUSES,
  getContentLayer,
  getSiteContent,
  policyEffectiveDate,
  type PolicyId,
} from '@/lib/services/site-content';
import { getStoreSettings } from '@/lib/services/settings';
import { LEGAL_PAGES, POLICIES_EFFECTIVE } from '@/lib/legal/pages';
import { fillLine, fillParagraphs, policyTokens } from '@/lib/legal/tokens';
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
 * to ask.
 *
 * The words are read from the content registry, like every other page's, so
 * a clause can be corrected on the Content tab. A blank line in a clause's
 * text is a paragraph break — the one piece of structure a policy needs, and
 * the only one the editor's plain text can carry. {{tokens}} are filled from
 * the business details in Settings; see lib/legal/tokens.ts.
 */
export async function PolicyPage({ id }: { id: PolicyId }) {
  const [copy, layer, settings, effective] = await Promise.all([
    getSiteContent(),
    getContentLayer(`policy-${id}`),
    getStoreSettings(),
    policyEffectiveDate(id, POLICIES_EFFECTIVE),
  ]);

  const tokens = policyTokens({ ...settings.business, email: settings.storeEmail });

  const clauses = Array.from({ length: POLICY_CLAUSES[id] }, (_, index) => ({
    heading: fillLine(copy[`policy.${id}.${index + 1}.heading`] ?? '', tokens),
    paragraphs: fillParagraphs(copy[`policy.${id}.${index + 1}.body`] ?? '', tokens),
  })).filter((clause) => clause.heading && clause.paragraphs.length);

  return (
    <>
      <CatalogueHead
        eyebrow="Policies"
        title={fillLine(copy[`policy.${id}.title`], tokens)}
        lede={fillLine(copy[`policy.${id}.lede`], tokens)}
      />

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
              <a href={`mailto:${settings.storeEmail}`} className="sh-btn sh-btn--block">
                Email us
              </a>
              <p className="sh-receipt__note">{settings.storeEmail}</p>
              {settings.business.phone ? (
                <p className="sh-receipt__note">{settings.business.phone}</p>
              ) : null}
            </div>
          </aside>
        </div>

        <ContentLayer {...layer} />
      </div>
    </>
  );
}
