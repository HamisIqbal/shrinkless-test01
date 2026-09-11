'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveWholesaleProductAction } from '@/app/actions/admin/wholesale';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { VariantMatrix } from '@/components/admin/VariantMatrix';
import {
  applyRowEdits,
  buildVariantMatrix,
  pruneEditedRows,
  type MatrixRow,
} from '@/lib/admin/variant-matrix';
import { WHOLESALE_RATIOS } from '@/lib/media/crop';
import { formatCents } from '@/lib/money';
import { WHOLESALE_COLORS, WHOLESALE_SIZES, WHOLESALE_TAG } from '@/lib/wholesale/catalogue';
import { tierLadder } from '@/lib/wholesale/pricing';
import type { ImageDTO, ProductDTO } from '@/types/dto';

/** What a new style opens at, matching the seeded line. */
const DEFAULT_BASIS_CENTS = 8900;

const UNITS = new Intl.NumberFormat('en-US');

function toList(value: string): string[] {
  return value.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
}

/** Cents to the dollars-and-cents an admin actually types. */
function toAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function toCents(amount: string): number {
  const value = Number.parseFloat(amount);
  return Number.isFinite(value) ? Math.max(0, Math.round(value * 100)) : 0;
}

/**
 * The wholesale style editor.
 *
 * Built from the same parts as `ProductEditor` — the same field classes, the
 * same uploader, the same variant matrix, the same save shape — because a
 * wholesale style IS a product, and an admin should not have to learn a second
 * panel to edit one.
 *
 * Three things differ, and each is a fact about the line sheet rather than a
 * preference:
 *
 *   1. There is no merchandising block. A wholesale style cannot be featured
 *      on the home page or badged as a new arrival — the tag that keeps it off
 *      the shop grid keeps it off those bands too, so the controls would be
 *      inert and an inert control is a lie.
 *
 *   2. Price is entered once, as the trade basis, and the ladder beneath it is
 *      shown rather than typed. `lib/wholesale/pricing.ts` derives every tier
 *      from the cheapest enabled variant, so a per-tier field here would be a
 *      figure the storefront ignores.
 *
 *   3. The crop stages are held against the sheet's own 2:3 frame instead of
 *      the product gallery's 4:5.
 */
export function WholesaleEditor({ product }: { product: ProductDTO | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const [title, setTitle] = useState(product?.title ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [category, setCategory] = useState(product?.category ?? 'men');
  const [status, setStatus] = useState<'draft' | 'published'>(product?.status ?? 'draft');
  const [images, setImages] = useState<ImageDTO[]>(product?.images ?? []);
  const [sizesText, setSizesText] = useState((product?.sizes ?? WHOLESALE_SIZES).join(', '));
  const [colorsText, setColorsText] = useState((product?.colors ?? WHOLESALE_COLORS).join(', '));
  const [baseSku, setBaseSku] = useState(product?.baseSku ?? '');
  const [seoTitle, setSeoTitle] = useState(product?.seo?.title ?? '');
  const [seoDescription, setSeoDescription] = useState(product?.seo?.description ?? '');
  const [seoKeywords, setSeoKeywords] = useState((product?.seo?.keywords ?? []).join(', '));

  // The basis an existing style is already priced at: the cheapest enabled
  // variant, which is exactly what the line sheet reads.
  const savedBasis = useMemo(() => {
    const sellable = (product?.variants ?? []).filter((variant) => variant.enabled);
    return sellable.length
      ? Math.min(...sellable.map((variant) => variant.priceCents))
      : DEFAULT_BASIS_CENTS;
  }, [product]);

  const [basisText, setBasisText] = useState(toAmount(savedBasis));

  const [edited, setEdited] = useState<Record<string, MatrixRow>>({});
  const [prunedFor, setPrunedFor] = useState<MatrixRow[] | null>(null);

  const sizes = useMemo(() => toList(sizesText), [sizesText]);
  const colors = useMemo(() => toList(colorsText), [colorsText]);

  const basisCents = toCents(basisText);

  const generated = useMemo(
    () =>
      buildVariantMatrix({
        slug: slug || 'wholesale-style',
        sizes,
        colors,
        existing: product?.variants ?? [],
        // A brand new style's variants open at the basis above, so a style
        // priced before its sizes were chosen still comes out right.
        defaultPriceCents: basisCents || DEFAULT_BASIS_CENTS,
      }),
    [slug, sizes, colors, product, basisCents],
  );

  // Same render-time prune as the product editor: a combination that leaves
  // the option sets drops its edit, so re-adding a colour regenerates a clean
  // row instead of reviving a stale SKU and price.
  let effectiveEdited = edited;
  if (prunedFor !== generated) {
    effectiveEdited = pruneEditedRows(edited, generated);
    setPrunedFor(generated);
    if (effectiveEdited !== edited) setEdited(effectiveEdited);
  }

  const rows = useMemo(
    () => applyRowEdits(generated, effectiveEdited),
    [generated, effectiveEdited],
  );

  /**
   * The figure the storefront will actually strike the ladder from.
   *
   * Read back off the rows rather than off the basis field, so the preview
   * tells the truth when a single variant has been given a different price by
   * hand in the matrix below.
   */
  const effectiveBasis = useMemo(() => {
    const sellable = rows.filter((row) => row.enabled);
    return sellable.length ? Math.min(...sellable.map((row) => row.priceCents)) : 0;
  }, [rows]);

  const ladder = useMemo(() => tierLadder(effectiveBasis), [effectiveBasis]);

  function handleRowChange(key: string, patch: Partial<MatrixRow>) {
    setEdited((current) => {
      const target = rows.find((row) => row.key === key);
      if (!target) return current;
      return { ...current, [key]: { ...target, ...patch } };
    });
  }

  /** Puts the typed basis on every row at once. Twenty variants at one price
   *  is the normal case for a made-to-order style, and setting them one at a
   *  time in the matrix is work an editor should not ask for. */
  function applyBasisToRows() {
    setEdited((current) => {
      const next = { ...current };
      for (const row of rows) next[row.key] = { ...row, priceCents: basisCents };
      return next;
    });
  }

  function handleApplyToAll<K extends 'priceCents' | 'stock' | 'enabled'>(
    field: K,
    value: MatrixRow[K],
  ) {
    setEdited((current) => {
      const next = { ...current };
      for (const row of rows) next[row.key] = { ...row, [field]: value };
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    startTransition(async () => {
      const result = await saveWholesaleProductAction({
        id: product?.id,
        title,
        slug,
        description,
        category,
        status,
        // Not offered above, and not silently changed either: an existing
        // style keeps whatever it was saved with.
        featured: product?.featured ?? false,
        badge: product?.badge ?? 'none',
        rating: product?.rating ?? 0,
        // The action reapplies the wholesale tag regardless; sending the
        // style's existing tags keeps any others an admin has added.
        tags: product?.tags?.length ? product.tags : [WHOLESALE_TAG],
        baseSku,
        seo: {
          title: seoTitle,
          description: seoDescription,
          keywords: toList(seoKeywords),
        },
        // Wholesale is quoted by the tier and never added to a cart, so the
        // retail quantity rule is carried through rather than exposed.
        quantityRule: product?.quantityRule ?? { min: 1, step: 1, max: null },
        images,
        sizes,
        colors,
        variants: rows.map((row) => ({
          variantId: row.variantId,
          size: row.size,
          color: row.color,
          sku: row.sku,
          priceCents: row.priceCents,
          stock: row.stock,
          enabled: row.enabled,
          lowStockThreshold: null,
          imagePublicId: '',
        })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push('/admin/wholesale');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="editor">
      <section className="editor__section">
        <div className="editor__sectionhead">
          <h2 className="editor__sectiontitle">Style information</h2>
          <p className="editor__sectionnote">
            The name on the line sheet, the address it lives at, and the copy
            the row&rsquo;s lead paragraph is taken from.
          </p>
        </div>

        <div className="fieldrow">
          <label className="adfield">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>

          <label className="adfield">
            Slug
            <input value={slug} onChange={(e) => setSlug(e.target.value)} required />
            <small>Lowercase letters, numbers and dashes.</small>
          </label>
        </div>

        <label className="adfield">
          Description
          <textarea
            rows={10}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <small>
            The line sheet prints the first paragraph beside the frame. Blank
            lines separate blocks; a line starting with a dash is a bullet.
          </small>
        </label>

        <div className="fieldrow">
          <label className="adfield">
            Gender
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="men">Men</option>
              <option value="women">Women</option>
            </select>
            <small>Printed on the row as the style&rsquo;s spec line.</small>
          </label>

          <label className="adfield">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <small>Only published styles appear on the wholesale page.</small>
          </label>
        </div>
      </section>

      <section className="editor__section">
        <div className="editor__sectionhead">
          <h2 className="editor__sectiontitle">Line sheet frame</h2>
          <p className="editor__sectionnote">
            The first image is the one the sheet draws. Both stages below are
            the frame&rsquo;s real 2:3 shape — drag the photograph to choose
            what it keeps, and give the phone a placement of its own where the
            desktop one does not survive the smaller thumbnail. Nothing is cut
            from the file: only the position and the zoom are saved.
          </p>
        </div>

        <ImageUploader images={images} onChange={setImages} ratios={WHOLESALE_RATIOS} />
      </section>

      <section className="editor__section">
        <div className="editor__sectionhead">
          <h2 className="editor__sectiontitle">Trade pricing</h2>
          <p className="editor__sectionnote">
            One basis price per style. The tiers below are derived from it and
            are what a buyer is quoted — they are not entered by hand, so the
            sheet, the enquiry and the confirmation email can never disagree.
          </p>
        </div>

        <div className="fieldrow">
          <label className="adfield">
            Retail basis price
            <input
              type="number"
              min={0}
              step="0.01"
              value={basisText}
              onChange={(e) => setBasisText(e.target.value)}
            />
            <small>In dollars. The ladder falls away from this figure.</small>
          </label>

          <div className="adfield">
            <span>Apply to variants</span>
            <button
              type="button"
              className="abtn abtn--quiet"
              onClick={applyBasisToRows}
              disabled={!rows.length}
            >
              Price all {rows.length} at {formatCents(basisCents)}
            </button>
            <small>
              Every variant carries the price; the sheet reads the cheapest one.
            </small>
          </div>
        </div>

        <div className="matrix">
          <table>
            <thead>
              <tr>
                <th scope="col">Order size</th>
                <th scope="col">Off retail</th>
                <th scope="col">Per unit</th>
                <th scope="col">Order total</th>
              </tr>
            </thead>
            <tbody>
              {ladder.map((tier) => (
                <tr key={tier.tier}>
                  <td>{UNITS.format(tier.tier)} units</td>
                  <td>{tier.discountPercent}%</td>
                  <td>{formatCents(tier.unitPriceCents)}</td>
                  <td>{formatCents(tier.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="aquiet">
          Struck from {formatCents(effectiveBasis)} — the cheapest variant that
          is for sale.
          {effectiveBasis !== basisCents
            ? ' A variant below has been priced by hand, so this differs from the basis above.'
            : ''}
        </p>
      </section>

      <section className="editor__section">
        <div className="editor__sectionhead">
          <h2 className="editor__sectiontitle">Sizes, colours and variants</h2>
          <p className="editor__sectionnote">
            Every size crossed with every colour becomes a variant. Wholesale is
            made to order, so stock stays at zero and nothing on the line sheet
            consults it.
          </p>
        </div>

        <div className="fieldrow">
          <label className="adfield">
            Sizes
            <input value={sizesText} onChange={(e) => setSizesText(e.target.value)} />
            <small>Comma separated. The run the sheet quotes.</small>
          </label>

          <label className="adfield">
            Colours
            <input value={colorsText} onChange={(e) => setColorsText(e.target.value)} />
            <small>Comma separated.</small>
          </label>
        </div>

        <label className="adfield">
          Base SKU
          <input value={baseSku} onChange={(e) => setBaseSku(e.target.value.toUpperCase())} />
          <small>The family code. Each variant carries its own SKU below.</small>
        </label>

        <VariantMatrix rows={rows} onRowChange={handleRowChange} onApplyToAll={handleApplyToAll} />
      </section>

      <section className="editor__section">
        <div className="editor__sectionhead">
          <h2 className="editor__sectiontitle">Search engines</h2>
          <p className="editor__sectionnote">
            What a search result and a shared link say. Left blank, the title
            and description above are used.
          </p>
        </div>

        <label className="adfield">
          SEO title
          <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={70} />
          <small>Up to 70 characters.</small>
        </label>

        <label className="adfield">
          SEO description
          <textarea
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            maxLength={160}
            rows={3}
          />
          <small>Up to 160 characters.</small>
        </label>

        <label className="adfield">
          Keywords
          <input value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} />
          <small>Comma separated.</small>
        </label>
      </section>

      <div className="editor__save">
        {error ? <p role="alert" className="editor__savemsg">{error}</p> : null}

        <button type="submit" className="abtn" disabled={pending}>
          {pending ? 'Saving' : 'Save style'}
        </button>
      </div>
    </form>
  );
}
