import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/app.js';
import { products } from '../src/data/products.js';
import { SEED_REVIEWS } from '../src/data/reviews.js';

describe('GET /api/products', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;

  afterEach(async () => {
    await app.close();
  });

  it('returns all products', async () => {
    app = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/products' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(8);
    expect(products).toHaveLength(8);
  });

  it('filters by category', async () => {
    app = await createTestApp();

    const category = products[0]!.category;
    const expected = products.filter((p) => p.category === category);

    const response = await app.inject({ method: 'GET', url: `/api/products?category=${category}` });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body).toHaveLength(expected.length);
    for (const item of body) {
      expect(item.category).toBe(category);
    }
  });

  it('filters by q case-insensitively, matching name', async () => {
    app = await createTestApp();

    const target = products[0]!;
    const fragment = target.name.slice(0, 4);
    const mixedCase = fragment
      .split('')
      .map((char, index) => (index % 2 === 0 ? char.toUpperCase() : char.toLowerCase()))
      .join('');

    const response = await app.inject({
      method: 'GET',
      url: `/api/products?q=${encodeURIComponent(mixedCase)}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const expected = products.filter(
      (p) =>
        p.name.toLowerCase().includes(fragment.toLowerCase()) ||
        p.description.toLowerCase().includes(fragment.toLowerCase()),
    );
    expect(body).toHaveLength(expected.length);
    for (const item of body) {
      expect(
        item.name.toLowerCase().includes(fragment.toLowerCase()) ||
          item.description.toLowerCase().includes(fragment.toLowerCase()),
      ).toBe(true);
    }
  });

  it('filters by q matching description text only', async () => {
    app = await createTestApp();

    // Find a word that appears in some description but not in any product name.
    const nameWords = new Set(
      products.flatMap((p) => p.name.toLowerCase().split(/\W+/).filter(Boolean)),
    );
    let descriptionOnlyWord: string | undefined;
    for (const product of products) {
      const words = product.description.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      const candidate = words.find((w) => !nameWords.has(w));
      if (candidate) {
        descriptionOnlyWord = candidate;
        break;
      }
    }
    expect(descriptionOnlyWord).toBeDefined();

    const response = await app.inject({
      method: 'GET',
      url: `/api/products?q=${encodeURIComponent(descriptionOnlyWord!)}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const expected = products.filter((p) => p.description.toLowerCase().includes(descriptionOnlyWord!));
    expect(body).toHaveLength(expected.length);
    expect(body.length).toBeGreaterThan(0);
    for (const item of body) {
      expect(item.name.toLowerCase().includes(descriptionOnlyWord!)).toBe(false);
    }
  });

  it('combines category and q filters', async () => {
    app = await createTestApp();

    const category = products[0]!.category;
    const sameCategory = products.filter((p) => p.category === category);
    expect(sameCategory.length).toBeGreaterThan(1);

    const target = sameCategory[0]!;
    const fragment = target.name.slice(0, 4);

    const categoryOnlyResponse = await app.inject({
      method: 'GET',
      url: `/api/products?category=${category}`,
    });
    const qOnlyResponse = await app.inject({
      method: 'GET',
      url: `/api/products?q=${encodeURIComponent(fragment)}`,
    });
    const combinedResponse = await app.inject({
      method: 'GET',
      url: `/api/products?category=${category}&q=${encodeURIComponent(fragment)}`,
    });

    expect(combinedResponse.statusCode).toBe(200);
    const combinedBody = combinedResponse.json();
    const categoryOnlyBody = categoryOnlyResponse.json();
    const qOnlyBody = qOnlyResponse.json();

    expect(combinedBody.length).toBeLessThan(categoryOnlyBody.length);
    expect(combinedBody.length).toBeLessThanOrEqual(qOnlyBody.length);
    for (const item of combinedBody) {
      expect(item.category).toBe(category);
      expect(
        item.name.toLowerCase().includes(fragment.toLowerCase()) ||
          item.description.toLowerCase().includes(fragment.toLowerCase()),
      ).toBe(true);
    }
  });

  it('returns an empty array for a q with no matches', async () => {
    app = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/products?q=zzz-no-match' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('returns an empty array for an unknown category', async () => {
    app = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/products?category=nonexistent' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });
});

describe('GET /api/products/:slug', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;

  afterEach(async () => {
    await app.close();
  });

  it('returns the matching product', async () => {
    app = await createTestApp();

    const target = products[0]!;
    const seedForTarget = SEED_REVIEWS.filter((review) => review.productSlug === target.slug);
    const seedSum = seedForTarget.reduce((total, review) => total + review.rating, 0);
    const ratingAverage = seedForTarget.length === 0 ? 0 : Math.round((seedSum / seedForTarget.length) * 10) / 10;

    const response = await app.inject({ method: 'GET', url: `/api/products/${target.slug}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ...target, ratingAverage, ratingCount: seedForTarget.length });
  });

  it('returns a 404 JSON body for an unknown slug', async () => {
    app = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/products/does-not-exist' });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body).toMatchObject({ error: 'Not Found', statusCode: 404 });
    expect(typeof body.message).toBe('string');
  });
});
