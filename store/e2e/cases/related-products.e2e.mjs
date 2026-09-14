/**
 * Related products on the product page: same-category products first, then
 * other categories, always excluding the current product, up to 4 items.
 *
 * A case default-exports `async ({ base, assert })` and throws on failure.
 */

// Mirrors store/web/src/lib/related.ts's rule, without importing the TS module.
function pickRelated(current, all, limit = 4) {
  const others = all.filter((p) => p.slug !== current.slug);
  const sameCategory = others.filter((p) => p.category === current.category);
  const otherCategory = others.filter((p) => p.category !== current.category);
  return [...sameCategory, ...otherCategory].slice(0, limit);
}

export default async function ({ base, assert }) {
  const products = await (await fetch(`${base}/api/products`)).json();
  assert(
    Array.isArray(products) && products.length >= 5,
    `GET /api/products returns at least 5 products so 4 related items are possible (got ${products.length})`,
  );

  const current = products[0];
  assert(typeof current.slug === 'string' && current.slug.length > 0, 'the picked product has a slug');
  assert(typeof current.category === 'string' && current.category.length > 0, 'the picked product has a category');

  const byCategory = await (
    await fetch(`${base}/api/products?category=${encodeURIComponent(current.category)}`)
  ).json();
  assert(
    Array.isArray(byCategory) && byCategory.every((p) => p.category === current.category),
    'GET /api/products?category=<x> returns only products in that category',
  );
  assert(
    byCategory.some((p) => p.slug === current.slug),
    'the category filter includes the picked product',
  );

  const related = pickRelated(current, products);
  assert(related.length === 4, `pickRelated yields 4 items (got ${related.length})`);
  const relatedSlugs = related.map((p) => p.slug);
  assert(
    new Set(relatedSlugs).size === relatedSlugs.length,
    'the related items are unique',
  );
  assert(!relatedSlugs.includes(current.slug), 'the related items never include the current product');

  const currentPage = await fetch(`${base}/p/${current.slug}`);
  assert(currentPage.ok && /id="root"/.test(await currentPage.text()), 'GET /p/<slug> serves the SPA shell');

  const relatedSlug = relatedSlugs[0];
  const relatedPage = await fetch(`${base}/p/${relatedSlug}`);
  assert(
    relatedPage.ok && /id="root"/.test(await relatedPage.text()),
    'GET /p/<a related slug> serves the SPA shell',
  );
}
