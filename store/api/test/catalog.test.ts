import { describe, expect, it } from 'vitest';
import { products, findProductBySlug, findProductById } from '../src/data/catalog.js';
import type { Product } from '../src/data/types.js';

const IMAGE_PREFIX = 'https://placehold.co/600x600/1F1710/E2843F?text=';
const ALLOWED_CATEGORIES = ['Action Figures', 'Mangás', 'Vestuário', 'Acessórios'];

describe('product catalog seed', () => {
  it('contains exactly 8 products', () => {
    expect(products).toHaveLength(8);
  });

  it('has unique slugs', () => {
    const slugs = products.map((product) => product.slug);
    expect(new Set(slugs).size).toBe(products.length);
  });

  it('has unique ids', () => {
    const ids = products.map((product) => product.id);
    expect(new Set(ids).size).toBe(products.length);
  });

  it('spans at least 3 distinct, allowed categories', () => {
    const categories = new Set(products.map((product) => product.category));
    expect(categories.size).toBeGreaterThanOrEqual(3);
    for (const category of categories) {
      expect(ALLOWED_CATEGORIES).toContain(category);
    }
  });

  it('has at least one limited-edition figure', () => {
    expect(products.some((product) => product.isLimitedEdition && product.kind === 'figure')).toBe(true);
  });

  it('has at least one product with multiple variants', () => {
    expect(products.some((product) => product.variants.length > 1)).toBe(true);
  });

  it('only allows limited editions on figures', () => {
    for (const product of products) {
      if (product.isLimitedEdition) {
        expect(product.kind).toBe('figure');
      }
    }
  });

  it.each(products)('product $slug has valid fields', (product: Product) => {
    expect(product.id).toEqual(expect.any(String));
    expect(product.id.length).toBeGreaterThan(0);
    expect(product.slug).toEqual(expect.any(String));
    expect(product.slug.length).toBeGreaterThan(0);
    expect(product.name).toEqual(expect.any(String));
    expect(product.name.length).toBeGreaterThan(0);
    expect(product.category).toEqual(expect.any(String));
    expect(product.category.length).toBeGreaterThan(0);
    expect(product.description).toEqual(expect.any(String));
    expect(product.description.length).toBeGreaterThan(0);

    expect(['figure', 'other']).toContain(product.kind);

    expect(Number.isInteger(product.basePriceCents)).toBe(true);
    expect(product.basePriceCents).toBeGreaterThanOrEqual(0);

    expect(product.images.length).toBeGreaterThanOrEqual(1);
    for (const url of product.images) {
      expect(url.startsWith(IMAGE_PREFIX)).toBe(true);
      const suffix = url.slice(IMAGE_PREFIX.length);
      expect(suffix.length).toBeGreaterThan(0);
      expect(suffix.includes(' ')).toBe(false);
    }

    expect(typeof product.isLimitedEdition).toBe('boolean');

    expect(Array.isArray(product.variants)).toBe(true);
    const variantIds = product.variants.map((variant) => variant.id);
    expect(new Set(variantIds).size).toBe(variantIds.length);

    for (const variant of product.variants) {
      expect(variant.id).toEqual(expect.any(String));
      expect(variant.id.length).toBeGreaterThan(0);
      expect(variant.label).toEqual(expect.any(String));
      expect(variant.label.length).toBeGreaterThan(0);
      expect(Number.isInteger(variant.priceDeltaCents)).toBe(true);
      expect(variant.priceDeltaCents).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('findProductBySlug', () => {
  it('returns the product matching the given slug', () => {
    const first = products[0];
    if (!first) {
      throw new Error('expected at least one seeded product');
    }

    expect(findProductBySlug(first.slug)).toBe(first);
  });

  it('returns undefined for an unknown slug', () => {
    expect(findProductBySlug('does-not-exist')).toBeUndefined();
  });
});

describe('findProductById', () => {
  it('returns the product matching the given id', () => {
    const first = products[0];
    if (!first) {
      throw new Error('expected at least one seeded product');
    }

    expect(findProductById(first.id)).toBe(first);
  });

  it('returns undefined for an unknown id', () => {
    expect(findProductById('does-not-exist')).toBeUndefined();
  });
});
