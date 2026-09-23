import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getPublishedProductBySlug,
  listProductsInCategory,
} from '@/lib/services/products';
import { VariantPicker } from '@/components/shop/VariantPicker';
import { ProductGallery } from '@/components/shop/ProductGallery';
import { ProductCard } from '@/components/shop/ProductCard';
import { DISPATCH_BUSINESS_DAYS, RETURN_WINDOW_DAYS } from '@/lib/legal/pages';
import { homeFonts } from '@/components/home/fonts';
import '@/components/shop/shop.css';

/**
 * What this tee is, as a table.
 *
 * These four were `<details>` accordions, folded away under the buy button
 * beside two others — and they are not prose. They are four attributes with
 * four values, which is a table, and a table can be read at a glance instead
 * of opened one row at a time.
 *
 * Fibre content and origin come from the product itself, because the FTC
 * Textile Rules require both on any clothing sold online and they differ by
 * style. A row whose value has not been entered is left out — a guessed
 * fabric or a guessed country is a claim the business then has to stand
 * behind. Never put a placeholder here: the page renders what it is given.
 */
function specFor(product: { fiberContent: string; origin: string }) {
  return [
    { key: 'Fabric', value: product.fiberContent },
    { key: 'Finish', value: 'Garment dyed' },
    { key: 'Construction', value: 'Ribbed collar, shoulder-to-shoulder taping' },
    { key: 'Origin', value: product.origin },
  ].filter((row) => row.value);
}

/**
 * The two that really are prose, and stay folded.
 *
 * Native `<details>`, so they work without JavaScript and are keyboard
 * accessible by default.
 */
const SECTIONS = [
  {
    title: 'How it holds its size',
    body:
      'The fabric is pre-shrunk and the finished garment is dyed at temperature ' +
      'before it is ever sold, so most of the shrinking happens in our facility ' +
      'rather than in your machine. Washed and dried as the care label directs, ' +
      'it keeps its fit.',
  },
  {
    title: 'Care, shipping and returns',
    body:
      'Machine wash cold with like colours, tumble dry low, and follow the care ' +
      'label. Garment dyed cotton keeps its character best out of high heat. ' +
      `We ship within the US and orders leave us within ${DISPATCH_BUSINESS_DAYS} ` +
      'business days; the cost and delivery estimate are shown at checkout. ' +
      `Unworn, unwashed items can be returned within ${RETURN_WINDOW_DAYS} days of delivery.`,
  },
];

/**
 * The product page.
 *
 * Gallery on the left, a column that stays with you on the right. Inside that
 * column the order is the order a decision gets made in: what it is, what it
 * costs, what it is made of in one line, then the choices, then the facts.
 *
 * The gallery is a stack rather than a single frame with thumbnails under it —
 * the first photograph runs the full width of its column and the rest pair off
 * beneath. Scrolling is how people look at clothes, and a stack means the buy
 * column stays put beside every one of them.
 */
export default async function ProductPage(props: PageProps<'/product/[slug]'>) {
  const [{ slug }, search] = await Promise.all([props.params, props.searchParams]);
  const product = await getPublishedProductBySlug(slug);

  if (!product) notFound();

  const requestedColor = typeof search?.color === 'string' ? search.color : undefined;

  const siblings = await listProductsInCategory(product.category);
  const related = siblings.filter((item) => item.id !== product.id).slice(0, 3);

  // Lead with the colourway the visitor clicked, if they clicked one.
  const gallery = [...product.images].sort((a, b) => {
    if (!requestedColor) return 0;
    const aMatch = a.alt.toLowerCase().includes(requestedColor.toLowerCase()) ? -1 : 0;
    const bMatch = b.alt.toLowerCase().includes(requestedColor.toLowerCase()) ? -1 : 0;
    return aMatch - bMatch;
  });

  const categoryLabel = product.category === 'men' ? "Men's" : "Women's";

  return (
    <article className={`sh-pdp ${homeFonts}`}>
      <div className="sh-wrap sh-pdp__crumbs">
        <nav aria-label="Breadcrumb">
          <ol className="sh-pdp__trail">
            <li><Link href="/shop">Shop</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href={`/shop/${product.category}`}>{categoryLabel}</Link></li>
            <li aria-hidden="true">/</li>
            <li className="sh-pdp__here">{product.title}</li>
          </ol>
        </nav>
      </div>

      <div className="sh-wrap sh-pdp__grid">
        <ProductGallery
          images={gallery}
          title={product.title}
          wrapClassName="sh-pdp__gallery"
          frameClassName="sh-pdp__shot"
          sizes="(min-width: 62rem) 45vw, 100vw"
          transform="w_1400,q_auto,f_auto"
          empty={<div className="sh-pdp__shot" aria-hidden="true" />}
        />

        <div className="sh-pdp__info">
          <header className="sh-pdp__titles">
            <p className="sh-label">{categoryLabel}</p>
            {/* No star rating. The stored figure is typed in by an admin, not
                earned from reviews, and showing it as a rating is a fake
                review under the FTC's 2024 rule (16 CFR Part 465). Bring it
                back only on top of real, collected customer reviews. */}
            <h1 className="sh-pdp__title">{product.title}</h1>
          </header>

          {/* The description rides inside the picker, directly under the
              price, rather than below the buttons where it was read after the
              decision had already been made. */}
          <VariantPicker
            slug={product.slug}
            title={product.title}
            sizes={product.sizes}
            colors={product.colors}
            variants={product.variants}
            description={product.description}
            initialColor={requestedColor}
            quantityRule={product.quantityRule}
            fiberContent={product.fiberContent}
            origin={product.origin}
          />

          <section aria-labelledby="spec-heading">
            <h2 id="spec-heading" className="sh-label">Specification</h2>
            <dl className="sh-spec">
              {specFor(product).map((row) => (
                <div key={row.key} style={{ display: 'contents' }}>
                  <dt className="sh-spec__key">{row.key}</dt>
                  <dd className="sh-spec__value">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="sh-fold">
            {SECTIONS.map((section) => (
              <details key={section.title} className="sh-fold__item">
                <summary className="sh-fold__summary">
                  <span>{section.title}</span>
                  <span className="sh-fold__mark" aria-hidden="true" />
                </summary>
                <p className="sh-fold__body">{section.body}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {related.length ? (
        <section className="sh-pdp__related" aria-labelledby="related-heading">
          <div className="sh-wrap">
            <div className="sh-pdp__relatedhead">
              <div>
                <p className="sh-label">Also in {categoryLabel}</p>
                <h2 id="related-heading" className="sh-sub">You might also like</h2>
              </div>
              <Link href={`/shop/${product.category}`} className="sh-link">
                Shop all {categoryLabel}
              </Link>
            </div>

            <ul className="sh-pdp__relatedgrid">
              {related.map((item, index) => (
                <li key={item.id}>
                  <ProductCard product={item} index={index} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </article>
  );
}
