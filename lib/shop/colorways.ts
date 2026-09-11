import type { ProductDTO, VariantDTO } from '@/types/dto';

export type Colorway = {
  color: string;
  priceCents: number;
  image: { url: string; alt: string } | null;
  variants: VariantDTO[];
  inStock: boolean;
};

/**
 * Splits one product into its colourways, because the catalogue is a single
 * tee in three colours and the grid should show what the customer is actually
 * choosing between.
 *
 * Images are matched to colours positionally, in the product's own colour
 * order — the seed writes them that way. A colour with no image still gets a
 * tile rather than disappearing from the grid.
 */
export function toColorways(product: ProductDTO): Colorway[] {
  return product.colors.map((color, index) => {
    const variants = product.variants
      .filter((variant) => variant.color === color && variant.enabled)
      .sort((a, b) => sizeOrder(a.size) - sizeOrder(b.size));

    const prices = variants.map((variant) => variant.priceCents);
    const image = product.images[index] ?? product.images[0] ?? null;

    return {
      color,
      priceCents: prices.length ? Math.min(...prices) : product.minPriceCents,
      image: image ? { url: image.publicId, alt: image.alt } : null,
      variants,
      inStock: variants.some((variant) => variant.inStock),
    };
  });
}

const SIZE_ORDER = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl'];

/** Alphabetical size runs read as nonsense: L, M, S, XL, XXL. */
export function sizeOrder(size: string): number {
  const index = SIZE_ORDER.indexOf(size.toLowerCase());
  return index === -1 ? SIZE_ORDER.length : index;
}
