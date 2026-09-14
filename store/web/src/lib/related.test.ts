import { describe, expect, it } from 'vitest';

import { pickRelated } from './related.js';
import type { Product } from '../api/types.js';

function makeProduct(overrides: Partial<Product> & Pick<Product, 'slug' | 'category'>): Product {
  return {
    id: overrides.slug,
    name: overrides.slug,
    description: '',
    priceCents: 1000,
    images: [],
    stock: 1,
    ...overrides,
  };
}

describe('pickRelated', () => {
  const current = makeProduct({ slug: 'katana-x', category: 'figures' });

  it('returns same-category products first, in catalog order', () => {
    const all: Product[] = [
      makeProduct({ slug: 'other-a', category: 'mangas' }),
      makeProduct({ slug: 'figure-a', category: 'figures' }),
      makeProduct({ slug: 'other-b', category: 'mangas' }),
      makeProduct({ slug: 'figure-b', category: 'figures' }),
    ];

    const result = pickRelated(current, all);

    expect(result.map((p) => p.slug)).toEqual(['figure-a', 'figure-b', 'other-a', 'other-b']);
  });

  it('never includes the current product, matched by slug', () => {
    const all: Product[] = [
      makeProduct({ slug: 'katana-x', category: 'figures' }),
      makeProduct({ slug: 'figure-a', category: 'figures' }),
    ];

    const result = pickRelated(current, all);

    expect(result.map((p) => p.slug)).not.toContain('katana-x');
    expect(result.map((p) => p.slug)).toEqual(['figure-a']);
  });

  it('fills with other-category products in catalog order when the category has fewer than limit others, without duplicates', () => {
    const all: Product[] = [
      makeProduct({ slug: 'figure-a', category: 'figures' }),
      makeProduct({ slug: 'manga-a', category: 'mangas' }),
      makeProduct({ slug: 'vestuario-a', category: 'vestuario' }),
      makeProduct({ slug: 'acessorio-a', category: 'acessorios' }),
      makeProduct({ slug: 'papelaria-a', category: 'papelaria' }),
    ];

    const result = pickRelated(current, all);

    expect(result.map((p) => p.slug)).toEqual(['figure-a', 'manga-a', 'vestuario-a', 'acessorio-a']);
    expect(new Set(result.map((p) => p.slug)).size).toBe(result.length);
  });

  it('returns at most limit items, shorter only when the catalog is too small', () => {
    const all: Product[] = [
      makeProduct({ slug: 'figure-a', category: 'figures' }),
      makeProduct({ slug: 'manga-a', category: 'mangas' }),
    ];

    const result = pickRelated(current, all);

    expect(result).toHaveLength(2);

    const bigAll: Product[] = Array.from({ length: 10 }, (_, i) =>
      makeProduct({ slug: `other-${i}`, category: 'mangas' }),
    );
    expect(pickRelated(current, bigAll)).toHaveLength(4);
  });

  it('returns [] for an empty catalog', () => {
    expect(pickRelated(current, [])).toEqual([]);
  });
});
