'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveProductAction } from '@/app/actions/admin/products';
import {
  applyRowEdits,
  buildVariantMatrix,
  pruneEditedRows,
  type MatrixRow,
} from '@/lib/admin/variant-matrix';
import { VariantMatrix } from '@/components/admin/VariantMatrix';
import { ImageUploader } from '@/components/admin/ImageUploader';
import type { ImageDTO, ProductDTO } from '@/types/dto';

const DEFAULT_PRICE_CENTS = 4200;

function toList(value: string): string[] {
  return value.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
}

type Suggestions = { categories: string[]; tags: string[]; sizes: string[]; colors: string[] };

export function ProductEditor({
  product,
  suggestions,
}: {
  product: ProductDTO | null;
  /** Values already used elsewhere in the catalogue, offered back as native
   *  autofill so a repeated category, tag, size or colour doesn't have to be
   *  retyped. Purely suggestions — picking one is the only way they apply. */
  suggestions?: Suggestions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const [title, setTitle] = useState(product?.title ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [status, setStatus] = useState<'draft' | 'published'>(product?.status ?? 'draft');
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [badge, setBadge] = useState<'none' | 'new'>(product?.badge ?? 'none');
  const [rating, setRating] = useState(String(product?.rating ?? 0));
  const [sizesText, setSizesText] = useState((product?.sizes ?? []).join(', '));
  const [colorsText, setColorsText] = useState((product?.colors ?? []).join(', '));
  const [edited, setEdited] = useState<Record<string, MatrixRow>>({});
  const [prunedFor, setPrunedFor] = useState<MatrixRow[] | null>(null);
  const [images, setImages] = useState<ImageDTO[]>(product?.images ?? []);
  const [tagsText, setTagsText] = useState((product?.tags ?? []).join(', '));
  const [baseSku, setBaseSku] = useState(product?.baseSku ?? '');
  const [seoTitle, setSeoTitle] = useState(product?.seo?.title ?? '');
  const [seoDescription, setSeoDescription] = useState(product?.seo?.description ?? '');
  const [seoKeywords, setSeoKeywords] = useState((product?.seo?.keywords ?? []).join(', '));
  const [qtyMin, setQtyMin] = useState(String(product?.quantityRule?.min ?? 1));
  const [qtyStep, setQtyStep] = useState(String(product?.quantityRule?.step ?? 1));
  const [qtyMax, setQtyMax] = useState(
    product?.quantityRule?.max === null || product?.quantityRule?.max === undefined
      ? ''
      : String(product.quantityRule.max),
  );

  const sizes = useMemo(() => toList(sizesText), [sizesText]);
  const colors = useMemo(() => toList(colorsText), [colorsText]);

  // Regenerating from the option sets on every render is what makes "add a
  // colour" append rows; per-row edits are layered back on by key.
  const generated = useMemo(
    () =>
      buildVariantMatrix({
        slug: slug || 'product',
        sizes,
        colors,
        existing: product?.variants ?? [],
        defaultPriceCents: DEFAULT_PRICE_CENTS,
      }),
    [slug, sizes, colors, product],
  );

  // A combination that leaves the option sets (colour removed) has its edit
  // dropped here, so if it comes back later (colour re-added) it regenerates
  // a clean row instead of reviving stale sku/price/stock. Pruning happens
  // during render — React's sanctioned "adjust state while rendering"
  // pattern — rather than in an effect, so this render's rows are already
  // correct instead of lagging a commit behind.
  let effectiveEdited = edited;
  if (prunedFor !== generated) {
    effectiveEdited = pruneEditedRows(edited, generated);
    setPrunedFor(generated);
    if (effectiveEdited !== edited) setEdited(effectiveEdited);
  }

  const rows = useMemo(() => applyRowEdits(generated, effectiveEdited), [generated, effectiveEdited]);

  function handleRowChange(key: string, patch: Partial<MatrixRow>) {
    setEdited((current) => {
      const target = rows.find((row) => row.key === key);
      if (!target) return current;
      return { ...current, [key]: { ...target, ...patch } };
    });
  }

  function handleApplyToAll<K extends 'priceCents' | 'stock' | 'enabled'>(
    field: K,
    value: MatrixRow[K],
  ) {
    setEdited((current) => {
      const next = { ...current };
      for (const row of rows) {
        next[row.key] = { ...row, [field]: value };
      }
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    startTransition(async () => {
      const result = await saveProductAction({
        id: product?.id,
        title, slug, description, category, status, featured, badge,
        rating: Number(rating) || 0,
        tags: toList(tagsText),
        baseSku,
        seo: {
          title: seoTitle,
          description: seoDescription,
          keywords: toList(seoKeywords),
        },
        quantityRule: {
          min: Number(qtyMin) || 1,
          step: Number(qtyStep) || 1,
          max: qtyMax.trim() === '' ? null : Number(qtyMax),
        },
        images,
        sizes, colors,
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

      router.push('/admin/products');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="editor">
      {/* Six sections, in the order a product is actually built: what it is,
          what it looks like, where it sits, how it is bought, what it costs,
          and how it is found. */}
      <section className="editor__section">
        <div className="editor__sectionhead">
          <h2 className="editor__sectiontitle">Product information</h2>
          <p className="editor__sectionnote">
            The name, the address it lives at, and the copy the product page is
            built from.
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
          </label>
        </div>

        <label className="adfield">
          Description
          <textarea
            rows={12}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <small>
            Blank lines separate blocks; a line starting with a dash is a
            bullet. The storefront reads a lead paragraph, five to seven
            bullets and a closing line.
          </small>
        </label>
      </section>

      <section className="editor__section">
        <div className="editor__sectionhead">
          <h2 className="editor__sectiontitle">Images</h2>
          <p className="editor__sectionnote">
            The first image is the one a card, a cart line and a share preview
            all use. Reorder to change it.
          </p>
        </div>

        <ImageUploader images={images} onChange={setImages} />
      </section>

      <section className="editor__section">
        <div className="editor__sectionhead">
          <h2 className="editor__sectiontitle">Collection and merchandising</h2>
          <p className="editor__sectionnote">
            Where the product sits in the shop, and how it is promoted on the
            home page.
          </p>
        </div>

        <div className="fieldrow">
          <label className="adfield">
            Collection
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              list="category-suggestions"
            />
            <small>The collection slug, as it appears in the URL.</small>
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
          </label>
        </div>

        <div className="fieldrow">
          <label className="adfield">
            Badge
            <select value={badge} onChange={(e) => setBadge(e.target.value as 'none' | 'new')}>
              <option value="none">None</option>
              <option value="new">New arrival</option>
            </select>
            <small>Drawn on the card. Sold out is worked out from stock.</small>
          </label>

          <label className="adfield">
            Rating
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            />
            <small>Out of 5. Zero draws no rating at all.</small>
          </label>
        </div>

        <label className="adfield">
          Tags
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            list="tag-suggestions"
          />
          <small>Comma separated. Searchable in the product list.</small>
        </label>

        <label className="checkline">
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
          />
          Featured in the home page band
        </label>
      </section>

      <section className="editor__section">
        <div className="editor__sectionhead">
          <h2 className="editor__sectiontitle">How it is sold</h2>
          <p className="editor__sectionnote">
            A minimum of 12 with a step of 12 sells in 12, 24 and 36. The
            product page offers only these quantities and the server refuses
            anything else.
          </p>
        </div>

        <div className="fieldrow fieldrow--three">
          <label className="adfield">
            Minimum quantity
            <input
              type="number"
              min={1}
              value={qtyMin}
              onChange={(e) => setQtyMin(e.target.value)}
            />
          </label>

          <label className="adfield">
            Sold in multiples of
            <input
              type="number"
              min={1}
              value={qtyStep}
              onChange={(e) => setQtyStep(e.target.value)}
            />
          </label>

          <label className="adfield">
            Maximum per order
            <input
              type="number"
              min={1}
              value={qtyMax}
              onChange={(e) => setQtyMax(e.target.value)}
              placeholder="No limit"
            />
          </label>
        </div>
      </section>

      <section className="editor__section">
        <div className="editor__sectionhead">
          <h2 className="editor__sectiontitle">Options, pricing and inventory</h2>
          <p className="editor__sectionnote">
            Every size crossed with every colour becomes a variant with its own
            SKU, price and stock. Changing a quantity here is recorded as a
            stock correction against your name.
          </p>
        </div>

        <div className="fieldrow">
          <label className="adfield">
            Sizes
            <input
              value={sizesText}
              onChange={(e) => setSizesText(e.target.value)}
              list="size-suggestions"
            />
            <small>Comma separated.</small>
          </label>

          <label className="adfield">
            Colours
            <input
              value={colorsText}
              onChange={(e) => setColorsText(e.target.value)}
              list="color-suggestions"
            />
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
          {pending ? 'Saving' : 'Save product'}
        </button>
      </div>

      {/* Autofill only — populates the browser's own suggestion list, never
          overwrites a field on its own. */}
      <datalist id="category-suggestions">
        {(suggestions?.categories ?? []).map((value) => <option key={value} value={value} />)}
      </datalist>
      <datalist id="tag-suggestions">
        {(suggestions?.tags ?? []).map((value) => <option key={value} value={value} />)}
      </datalist>
      <datalist id="size-suggestions">
        {(suggestions?.sizes ?? []).map((value) => <option key={value} value={value} />)}
      </datalist>
      <datalist id="color-suggestions">
        {(suggestions?.colors ?? []).map((value) => <option key={value} value={value} />)}
      </datalist>
    </form>
  );
}
