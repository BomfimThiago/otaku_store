import type { Product } from '../api/types.js';

/**
 * Picks up to `limit` products related to `current`: same-category products
 * first (in catalog order), then other-category products (in catalog order)
 * to fill the remainder. `current` itself is never included.
 */
export function pickRelated(
  current: Pick<Product, 'slug' | 'category'>,
  all: Product[],
  limit = 4,
): Product[] {
  const others = all.filter((p) => p.slug !== current.slug);
  const sameCategory = others.filter((p) => p.category === current.category);
  const otherCategory = others.filter((p) => p.category !== current.category);
  return [...sameCategory, ...otherCategory].slice(0, limit);
}
