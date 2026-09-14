import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addToCart,
  ApiError,
  getCart,
  getProduct,
  listProducts,
  removeCartItem,
  updateCartItem,
} from './client.js';

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists products with no params', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await listProducts();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/products');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.credentials).toBe('include');
  });

  it('lists products with query params, omitting undefined keys', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await listProducts({ category: 'figures', q: 'miku' });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/products?category=figures&q=miku');
  });

  it('gets a product by slug, encoding it', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: '1' }));

    await getProduct('a b');

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/products/a%20b');
  });

  it('gets the cart', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'cart-1', items: [] }));

    await getCart();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/cart');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.credentials).toBe('include');
  });

  it('adds an item to the cart', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'cart-1', items: [] }));

    const input = { productId: 'p1', variantId: 'v1', quantity: 2 };
    await addToCart(input);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/cart');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(init?.body).toBe(JSON.stringify(input));
  });

  it('updates a cart item', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'cart-1', items: [] }));

    await updateCartItem('i1', { quantity: 3 });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/cart/i1');
    expect(init?.method).toBe('PATCH');
    expect(init?.credentials).toBe('include');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(init?.body).toBe(JSON.stringify({ quantity: 3 }));
  });

  it('removes a cart item', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'cart-1', items: [] }));

    await removeCartItem('i1');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/cart/i1');
    expect(init?.method).toBe('DELETE');
    expect(init?.credentials).toBe('include');
  });

  it('rejects with an ApiError built from the response body on 404', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ error: 'NotFound', message: 'x', statusCode: 404 }, { status: 404 })),
    );

    await expect(getProduct('missing')).rejects.toBeInstanceOf(ApiError);
    await expect(getProduct('missing')).rejects.toMatchObject({
      status: 404,
      code: 'NotFound',
      message: 'x',
    });
  });

  it('rejects with an ApiError even when the error body is not JSON', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('oops', { status: 500 }));

    await expect(getProduct('missing')).rejects.toBeInstanceOf(ApiError);
    await expect(getProduct('missing')).rejects.toMatchObject({ status: 500 });
  });

  it('returns parsed JSON on a 2xx response', async () => {
    const fetchMock = vi.mocked(fetch);
    const product = { id: '1', slug: 'katana-x' };
    fetchMock.mockResolvedValueOnce(jsonResponse(product));

    await expect(getProduct('katana-x')).resolves.toEqual(product);
  });

  it('resolves without parsing a body on 204', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(removeCartItem('i1')).resolves.toBeUndefined();
  });
});
