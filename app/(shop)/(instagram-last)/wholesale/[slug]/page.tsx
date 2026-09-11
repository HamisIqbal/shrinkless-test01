import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getWholesaleProductBySlug,
  listWholesaleProducts,
} from '@/lib/services/wholesale';
import { WHOLESALE_TIERS } from '@/lib/wholesale/pricing';
import { ProductGallery } from '@/components/shop/ProductGallery';
import { WholesaleBuyPanel } from '@/components/shop/WholesaleBuyPanel';
import { WholesaleGrid } from '@/components/shop/WholesaleGrid';

const UNITS = new Intl.NumberFormat('en-US');

// The retail page's accordion, answering the questions a trade buyer asks
// instead of the ones a shopper does. Factual claims are [TBC] until confirmed.
const SECTIONS = [
  {
    title: 'Minimums & tiers',
    body:
      'Every style is made to order against the ladder above. The smallest run ' +
      'is the opening tier; the per-unit price falls at each rung. Split size ' +
      'and colour ratios across a run at no extra cost.',
  },
  {
    title: 'Lead time & production',
    body:
      'Cut and sewn in the United States once the order is confirmed. Typical ' +
      'lead time from approved sample: [TBC] weeks. Mill and factory ' +
      'locations: [TBC].',
  },
  {
    title: "Why it doesn't shrink",
    body:
      'The fabric is pre-shrunk and the finished garment is dyed at temperature ' +
      'before it ever ships, so the shrinking happens in our facility rather ' +
      'than in your customer’s machine. Expected residual shrinkage: [TBC]%.',
  },
  {
    title: 'Fabric & construction',
    body:
      '[TBC]oz organic cotton, [TBC] knit, with a ribbed collar and ' +
      'shoulder-to-shoulder taping. Certification: [TBC].',
  },
  {
    title: 'Terms & payment',
    body:
      'Deposit on confirmation with the balance before despatch. Freight, duties ' +
      'and payment terms are quoted per order: [TBC].',
  },
];

export async function generateMetadata(props: PageProps<'/wholesale/[slug]'>) {
  const { slug } = await props.params;
  const style = await getWholesaleProductBySlug(slug);

  if (!style) return { title: 'Wholesale' };

  return {
    title: `${style.title} — Wholesale`,
    description: `Trade terms for ${style.title}: made to order from ${UNITS.format(
      WHOLESALE_TIERS[0],
    )} units. Request a quote.`,
  };
}

/**
 * One style on the line sheet.
 *
 * The same page as a retail product detail page — same breadcrumb, same
 * gallery beside a sticky column, same order of price, story, spec, choice and
 * action, same accordion, same rail of related styles underneath — drawn on
 * the sheet's ink ground rather than the shop's paper. The structure is the
 * retail one because a buyer who knows the storefront should not have to learn
 * a second page; the colour is the sheet's because they have not left it.
 */
export default async function WholesaleStylePage(
  props: PageProps<'/wholesale/[slug]'>,
) {
  const { slug } = await props.params;
  const style = await getWholesaleProductBySlug(slug);

  if (!style) notFound();

  const siblings = await listWholesaleProducts();
  const related = siblings.filter((item) => item.id !== style.id).slice(0, 3);

  return (
    <article className="band band--ink pdp pdp--trade tradestyle tradestyle-page">
      <div className="wrap pdp__crumbs">
        <nav aria-label="Breadcrumb" className="tradestyle__crumbs">
          <ol className="crumbs">
            <li><Link href="/wholesale" className="ulink">Wholesale</Link></li>
            <li aria-hidden="true" className="crumbs__sep">/</li>
            <li><span className="meta">{style.title}</span></li>
          </ol>
        </nav>
      </div>

      <div className="wrap pdp__grid">
        <ProductGallery
          images={style.images}
          title={style.title}
          wrapClassName="pdp__gallery"
          frameClassName="frame frame--45 pdp__shot"
          sizes="(min-width: 56.25rem) 58vw, 100vw"
          transform="w_1400,q_auto,f_auto"
          empty={<div className="frame frame--45 pdp__shot" aria-hidden="true" />}
        />

        <div className="pdp__info">
          <div className="pdp__sticky">
            <p className="eyebrow">{`${style.category} · Wholesale`}</p>
            <h1 className="head pdp__title">{style.title}</h1>

            <WholesaleBuyPanel style={style} />

            <ul className="accordion pdp__accordion">
              {SECTIONS.map((section) => (
                <li key={section.title}>
                  <details className="accordion__item">
                    <summary className="accordion__summary">
                      <span>{section.title}</span>
                      <span className="accordion__mark" aria-hidden="true" />
                    </summary>
                    <p className="accordion__body">{section.body}</p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {related.length ? (
        <section className="rail pdp__related" aria-labelledby="related-heading">
          <div className="wrap">
            <div className="rail__head">
              <div>
                <p className="eyebrow">Also on the line sheet</p>
                <h2 id="related-heading" className="head">More trade styles</h2>
              </div>
              <Link href="/wholesale" className="ulink rail__more">
                See the sheet
              </Link>
            </div>

            <WholesaleGrid styles={related} />
          </div>
        </section>
      ) : null}
    </article>
  );
}
