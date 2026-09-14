import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/app.js';
import { products } from '../src/data/products.js';

type App = Awaited<ReturnType<typeof createTestApp>>;

let emailCounter = 0;
function uniqueEmail(): string {
  emailCounter += 1;
  return `reviewer-${emailCounter}-${Date.now()}@example.com`;
}

function findSetCookie(headers: string | string[] | undefined, name: string): string | undefined {
  const list = Array.isArray(headers) ? headers : headers ? [headers] : [];
  return list.find((header) => header.startsWith(`${name}=`));
}

async function registerAndLogin(app: App, overrides: Partial<{ name: string; email: string }> = {}) {
  const email = overrides.email ?? uniqueEmail();
  const name = overrides.name ?? 'Ada Lovelace';
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { name, email, password: 'password1' },
  });
  const setCookie = findSetCookie(response.headers['set-cookie'], 'sid');
  const sid = response.cookies.find((c) => c.name === 'sid')?.value;
  return { email, name, sid: sid!, setCookie };
}

const slug = products[0]!.slug;

describe('GET /api/products/:slug/reviews', () => {
  let app: App;

  afterEach(async () => {
    await app.close();
  });

  it('returns 404 for an unknown slug', async () => {
    app = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/products/does-not-exist/reviews' });

    expect(response.statusCode).toBe(404);
  });

  it('returns an empty list with average 0 and count 0 when there are no reviews', async () => {
    app = await createTestApp();

    const response = await app.inject({ method: 'GET', url: `/api/products/${slug}/reviews` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reviews: [], average: 0, count: 0 });
  });
});

describe('POST /api/products/:slug/reviews', () => {
  let app: App;

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 without a cookie', async () => {
    app = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: `/api/products/${slug}/reviews`,
      payload: { rating: 5, comment: 'Ótimo!' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 401 with a tampered cookie', async () => {
    app = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: `/api/products/${slug}/reviews`,
      cookies: { sid: 's%3Atampered-value.invalidsignature' },
      payload: { rating: 5, comment: 'Ótimo!' },
    });

    expect(response.statusCode).toBe(401);
  });

  it.each([0, 6, 3.5, 'five', undefined])('returns 400 for an invalid rating %p', async (rating) => {
    app = await createTestApp();
    const { sid } = await registerAndLogin(app);

    const payload: Record<string, unknown> = { comment: 'Ótimo!' };
    if (rating !== undefined) payload.rating = rating;

    const response = await app.inject({
      method: 'POST',
      url: `/api/products/${slug}/reviews`,
      cookies: { sid },
      payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it.each(['', '   '])('returns 400 for an empty or whitespace comment %p', async (comment) => {
    app = await createTestApp();
    const { sid } = await registerAndLogin(app);

    const response = await app.inject({
      method: 'POST',
      url: `/api/products/${slug}/reviews`,
      cookies: { sid },
      payload: { rating: 5, comment },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 for an unknown slug while logged in', async () => {
    app = await createTestApp();
    const { sid } = await registerAndLogin(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/products/does-not-exist/reviews',
      cookies: { sid },
      payload: { rating: 5, comment: 'Ótimo!' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 201 with the created review for a valid submission', async () => {
    app = await createTestApp();
    const { sid, name, email } = await registerAndLogin(app);
    void email;

    const response = await app.inject({
      method: 'POST',
      url: `/api/products/${slug}/reviews`,
      cookies: { sid },
      payload: { rating: 5, comment: 'Ótimo produto!' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toEqual({
      id: expect.any(String),
      productSlug: slug,
      userId: expect.any(String),
      userName: name,
      rating: 5,
      comment: 'Ótimo produto!',
      createdAt: expect.any(String),
    });
  });

  it('returns 409 for a second review by the same user', async () => {
    app = await createTestApp();
    const { sid } = await registerAndLogin(app);

    await app.inject({
      method: 'POST',
      url: `/api/products/${slug}/reviews`,
      cookies: { sid },
      payload: { rating: 5, comment: 'Ótimo produto!' },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/products/${slug}/reviews`,
      cookies: { sid },
      payload: { rating: 3, comment: 'Mudei de ideia.' },
    });

    expect(response.statusCode).toBe(409);
  });

  it('lists reviews from two users newest first with the correct average and count, reflected in the products endpoints', async () => {
    app = await createTestApp();
    const first = await registerAndLogin(app, { name: 'Ada Lovelace' });
    const second = await registerAndLogin(app, { name: 'Grace Hopper' });

    await app.inject({
      method: 'POST',
      url: `/api/products/${slug}/reviews`,
      cookies: { sid: first.sid },
      payload: { rating: 4, comment: 'Muito bom.' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/products/${slug}/reviews`,
      cookies: { sid: second.sid },
      payload: { rating: 2, comment: 'Podia ser melhor.' },
    });

    const listResponse = await app.inject({ method: 'GET', url: `/api/products/${slug}/reviews` });
    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json();
    expect(listBody.reviews).toHaveLength(2);
    expect(listBody.reviews[0].userName).toBe('Grace Hopper');
    expect(listBody.reviews[1].userName).toBe('Ada Lovelace');
    expect(listBody.average).toBe(3);
    expect(listBody.count).toBe(2);

    const productsResponse = await app.inject({ method: 'GET', url: '/api/products' });
    const productsBody = productsResponse.json();
    const listedProduct = productsBody.find((p: { slug: string }) => p.slug === slug);
    expect(listedProduct).toMatchObject({ ratingAverage: 3, ratingCount: 2 });

    const detailResponse = await app.inject({ method: 'GET', url: `/api/products/${slug}` });
    expect(detailResponse.json()).toMatchObject({ ratingAverage: 3, ratingCount: 2 });
  });
});
