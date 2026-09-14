import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App.js';
import { CartProvider } from './cart/CartContext.js';
import { ToastProvider } from './toast/ToastProvider.js';
import type { Cart, Product } from './api/types.js';

const emptyCart: Cart = {
  id: 'c1',
  items: [],
  subtotalCents: 0,
  discountCents: 0,
  totalCents: 0,
};

const katanaProduct: Product = {
  id: 'prod-1',
  slug: 'katana-x',
  name: 'Katana-X',
  description: 'Uma réplica de katana de colecionador.',
  category: 'figures',
  priceCents: 19900,
  images: [],
  stock: 5,
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();

  if (url.startsWith('/api/products/katana-x')) {
    return Promise.resolve(jsonResponse(katanaProduct));
  }
  if (url.startsWith('/api/products')) {
    return Promise.resolve(jsonResponse([]));
  }
  if (url.startsWith('/api/cart')) {
    return Promise.resolve(jsonResponse(emptyCart));
  }

  return Promise.reject(new Error(`Unhandled fetch in test: ${url}`));
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('App routing', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(mockFetch));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the catalog page at /', async () => {
    renderAt('/');

    expect(await screen.findByRole('heading', { name: /catálogo/i })).toBeInTheDocument();
  });

  it('renders the product page at /p/:slug with the slug in the heading', async () => {
    renderAt('/p/katana-x');

    expect(await screen.findByRole('heading', { name: /katana-x/i })).toBeInTheDocument();
  });

  it('renders the cart page at /cart', async () => {
    renderAt('/cart');

    expect(await screen.findByRole('heading', { name: /carrinho/i })).toBeInTheDocument();
  });

  it('renders the footer and the category navigation on every route', async () => {
    renderAt('/');

    await screen.findByRole('heading', { name: /catálogo/i });

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /categorias/i })).toBeInTheDocument();
  });
});
