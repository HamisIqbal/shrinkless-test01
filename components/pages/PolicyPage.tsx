import Link from 'next/link';
import { CatalogueHead } from '@/components/pages/CatalogueHead';
import { ContentLayer } from '@/components/site/ContentLayer';
import { homeFonts } from '@/components/home/fonts';
import {
  POLICY_CLAUSES,
  POLICY_PAGES,
  getContentLayer,
  getSiteContent,
  type PolicyId,
} from '@/lib/services/site-content';
import { getStoreSettings } from '@/lib/services/settings';
import '@/components/shop/shop.css';

/** The four, in the order the side panel and the footer list them. */
const ORDER: { id: PolicyId; label: string }[] = [
  { id: 'terms', label: 'Terms & Conditions' },
  { id: 'refunds', label: 'Refund Policy' },
  { id: 'shipping', label: 'Shipping & Returns' },
  { id: 'privacy', label: 'Privacy Policy' },
];

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * One policy page: the chalk band every page opens on, then the clauses as a
 * numbered ledger beside a panel that links the other three and says where to
 * ask.
 *
 * The words are read from the content registry, like every other page's, so
 * a clause can be corrected on the Content tab. A blank line in a clause's
 * text is a paragraph break — the one piece of structure a policy needs, and
 * the only one the editor's plain text can carry.
 */
export async function PolicyPage({ id }: { id: PolicyId }) {
  const [copy, layer, settings] = await Promise.all([
    getSiteContent(),
    getContentLayer(`policy-${id}`),
    getStoreSettings(),
  ]);

  const clauses = Array.from({ length: POLICY_CLAUSES[id] }, (_, index) => ({
    heading: copy[`policy.${id}.${index + 1}.heading`],
    paragraphs: (copy[`policy.${id}.${index + 1}.body`] ?? '')
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
  }));

  return (
    <>
      <CatalogueHead
        eyebrow="Policies"
        title={copy[`policy.${id}.title`]}
        lede={copy[`policy.${id}.lede`]}
      />

      <div className={`sh-policy ${homeFonts}`}>
        <div className="sh-wrap sh-policy__layout">
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

          <aside className="sh-receipt sh-policy__aside" aria-label="Policies and contact">
            <nav aria-labelledby="policy-nav-heading">
              <h2 id="policy-nav-heading" className="sh-label">Policies</h2>
              <ul className="sh-policy__nav">
                {ORDER.map((policy) => (
                  <li key={policy.id}>
                    <Link
                      href={POLICY_PAGES[policy.id]}
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
            </div>
          </aside>
        </div>

        <ContentLayer {...layer} />
      </div>
    </>
  );
}
