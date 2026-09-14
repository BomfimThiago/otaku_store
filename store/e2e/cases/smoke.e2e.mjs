/**
 * Baseline end-to-end journey: the app boots, serves the SPA + catalog, and the
 * cart pricing works end to end. Every frontend change must keep this green and
 * add its own `cases/<feature>.e2e.mjs` for the new behavior.
 *
 * A case default-exports `async ({ base, assert })` and throws on failure.
 */
export default async function ({ base, assert }) {
  // Catalog API returns priced products.
  const products = await (await fetch(`${base}/api/products`)).json();
  assert(Array.isArray(products) && products.length >= 1, 'GET /api/products returns a non-empty array');
  const p = products[0];
  assert(typeof p.priceCents === 'number' && p.priceCents > 0, 'a product has a positive priceCents');
  assert(typeof p.slug === 'string' && p.slug.length > 0, 'a product has a slug');

  // SPA shell is served at the root and on a client route.
  const home = await fetch(`${base}/`);
  assert(home.ok && /id="root"/.test(await home.text()), 'GET / serves the SPA shell (#root)');
  const prod = await fetch(`${base}/p/${p.slug}`);
  assert(prod.ok && /id="root"/.test(await prod.text()), 'GET /p/:slug serves the SPA (client route)');

  // Cart pricing end to end: subtotal = price × qty, total adds shipping.
  const add = await fetch(`${base}/api/cart`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: p.id, quantity: 2 }),
  });
  assert(add.ok, 'POST /api/cart succeeds');
  const cart = await add.json();
  assert(
    cart.subtotalCents === p.priceCents * 2,
    `cart subtotal = price×2 (got ${cart.subtotalCents}, want ${p.priceCents * 2})`,
  );
  assert(cart.totalCents >= cart.subtotalCents, 'cart total includes shipping (>= subtotal)');
}
