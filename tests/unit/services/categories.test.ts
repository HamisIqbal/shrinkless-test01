import { describe, expect, it } from 'vitest';
import { Category } from '@/lib/db/models/category';
import { Product } from '@/lib/db/models/product';
import {
  CategoryNotEmptyError,
  CategorySlugTakenError,
  archiveCategory,
  assignProductsToCategory,
  backfillCategoriesFromProducts,
  listCategories,
  listVisibleCategories,
  reorderCategories,
  saveCategory,
} from '@/lib/services/categories';
import { withTestDatabase } from '@/tests/setup/db';

withTestDatabase();

const BLANK_SEO = { title: '', description: '', keywords: [] };

function input(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Men',
    slug: 'men',
    description: '',
    visible: true,
    sortOrder: 0,
    seo: BLANK_SEO,
    ...overrides,
  };
}

async function seedProduct(slug: string, category: string) {
  return Product.create({ title: slug, slug, category });
}

describe('saveCategory', () => {
  it('creates and then updates in place', async () => {
    const id = await saveCategory(input());
    await saveCategory(input({ id, name: 'Menswear' }));

    const all = await listCategories();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Menswear');
  });

  it('refuses a slug another category already holds', async () => {
    await saveCategory(input());

    await expect(saveCategory(input({ name: 'Other', slug: 'men' }))).rejects.toBeInstanceOf(
      CategorySlugTakenError,
    );
  });

  it('moves every product when the slug is renamed', async () => {
    const id = await saveCategory(input());
    await seedProduct('field-tee', 'men');
    await seedProduct('beach-tee', 'men');

    await saveCategory(input({ id, slug: 'mens' }));

    expect(await Product.countDocuments({ category: 'mens' })).toBe(2);
    expect(await Product.countDocuments({ category: 'men' })).toBe(0);
  });
});

describe('archiveCategory', () => {
  it('refuses while products still point at it, and never touches them', async () => {
    const id = await saveCategory(input());
    await seedProduct('field-tee', 'men');

    await expect(archiveCategory(id, true)).rejects.toBeInstanceOf(CategoryNotEmptyError);

    expect(await Product.countDocuments({})).toBe(1);
    expect((await listCategories())[0].archived).toBe(false);
  });

  it('archives an empty category, and restores it', async () => {
    const id = await saveCategory(input());

    await archiveCategory(id, true);
    expect(await listCategories()).toHaveLength(0);

    await archiveCategory(id, false);
    expect(await listCategories()).toHaveLength(1);
  });
});

describe('listing', () => {
  it('counts only live products', async () => {
    await saveCategory(input());
    await seedProduct('field-tee', 'men');
    await Product.create({ title: 'Gone', slug: 'gone', category: 'men', archivedAt: new Date() });

    expect((await listCategories())[0].productCount).toBe(1);
  });

  it('hides invisible categories from the storefront list only', async () => {
    await saveCategory(input({ visible: false }));

    expect(await listCategories()).toHaveLength(1);
    expect(await listVisibleCategories()).toHaveLength(0);
  });

  it('respects the manual order', async () => {
    const men = await saveCategory(input());
    const women = await saveCategory(input({ name: 'Women', slug: 'women' }));

    await reorderCategories([women, men]);

    expect((await listCategories()).map((category) => category.slug)).toEqual(['women', 'men']);
  });
});

describe('assignProductsToCategory', () => {
  it('moves the products it is given', async () => {
    await saveCategory(input());
    await saveCategory(input({ name: 'Women', slug: 'women' }));

    const first = await seedProduct('field-tee', 'men');
    const second = await seedProduct('beach-tee', 'men');

    const moved = await assignProductsToCategory([String(first._id), String(second._id)], 'women');

    expect(moved).toBe(2);
    expect(await Product.countDocuments({ category: 'women' })).toBe(2);
  });

  it('refuses a category that is not live', async () => {
    const product = await seedProduct('field-tee', 'men');

    await expect(assignProductsToCategory([String(product._id)], 'ghost')).rejects.toThrow(
      /no live category/i,
    );
  });
});

describe('backfillCategoriesFromProducts', () => {
  it('creates the missing slugs once, and is safe to run again', async () => {
    await seedProduct('field-tee', 'men');
    await seedProduct('sun-dress', 'women');

    expect(await backfillCategoriesFromProducts()).toBe(2);
    expect(await backfillCategoriesFromProducts()).toBe(0);

    const slugs = (await Category.find({}).lean()).map((doc) => doc.slug).sort();
    expect(slugs).toEqual(['men', 'women']);
  });
});
