import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getPublishedProductBySlug,
  listProductsInCategory,
} from '@/lib/services/products';
import { VariantPicker } from '@/components/shop/VariantPicker';
import { ProductGallery } from '@/components/shop/ProductGallery';
import { ProductGrid } from '@/components/shop/ProductGrid';

// Native <details> so the accordions work without JavaScript and are keyboard
// accessible by default. Factual claims are [TBC] until confirmed — spec §11.2.
const SECTIONS = [
  {
    title: "Why it doesn't shrink",
    body:
      'The fabric is pre-shrunk and the finished garment is dyed at temperature ' +
      'before it is ever sold, so the shrinking happens in our facility rather ' +
      'than in your machine. Expected residual shrinkage: [TBC]%.',
  },
  {
    title: 'Fabric & construction',
    body:
      '[TBC]oz organic cotton, [TBC] knit, with a ribbed collar and ' +
      'shoulder-to-shoulder taping. Certification: [TBC].',
  },
  {
    title: 'Made in USA',
    body:
      'Cut and sewn in the United States. Mill and factory locations: [TBC].',
  },
  {
    title: 'Care',
    body:
      'Machine wash cold with like colours, tumble dry low. Garment dyed cotton ' +
      'keeps its character best out of high heat. Full care instructions: [TBC].',
  },
  {
    title: 'Shipping & returns',
    body:
      'Shipping options and delivery estimates: [TBC]. Returns accepted within ' +
      '[TBC] days on unworn items.',
  },
];

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
    <article className="pdp">
      <div className="wrap pdp__crumbs">
        <nav aria-label="Breadcrumb">
          <ol className="crumbs">
            <li><Link href="/shop" className="ulink">Shop</Link></li>
            <li aria-hidden="true" className="crumbs__sep">/</li>
            <li>
              <Link href={`/shop/${product.category}`} className="ulink">
                {categoryLabel}
              </Link>
            </li>
            <li aria-hidden="true" className="crumbs__sep">/</li>
            <li><span className="meta">{product.title}</span></li>
          </ol>
        </nav>
      </div>

      <div className="wrap pdp__grid">
        <ProductGallery
          images={gallery}
          title={product.title}
          wrapClassName="pdp__gallery"
          frameClassName="frame frame--45 pdp__shot"
          sizes="(min-width: 56.25rem) 58vw, 100vw"
          transform="w_1400,q_auto,f_auto"
          empty={<div className="frame frame--45 pdp__shot" aria-hidden="true" />}
        />

        <div className="pdp__info">
          <div className="pdp__sticky">
            <p className="eyebrow">{categoryLabel}</p>
            <h1 className="head pdp__title">{product.title}</h1>

            {/* The description rides inside the picker, directly under the
                price, rather than below the buttons where it was read after
                the decision had already been made. */}
            <VariantPicker
              slug={product.slug}
              title={product.title}
              sizes={product.sizes}
              colors={product.colors}
              variants={product.variants}
              description={product.description}
              initialColor={requestedColor}
              quantityRule={product.quantityRule}
            />

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
        <section className="band band--white rail pdp__related" aria-labelledby="related-heading">
          <div className="wrap">
            <div className="rail__head">
              <div>
                <p className="eyebrow">Also in {categoryLabel}</p>
                <h2 id="related-heading" className="head">You might also like</h2>
              </div>
              <Link href={`/shop/${product.category}`} className="ulink rail__more">
                Shop all
              </Link>
            </div>

            <ProductGrid products={related} columns={3} />
          </div>
        </section>
      ) : null}
    </article>
  );
}
