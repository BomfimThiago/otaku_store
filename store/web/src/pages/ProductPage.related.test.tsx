import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProductPage } from './ProductPage.js';
import { AuthProvider } from '../auth/AuthContext.js';
import { CartProvider } from '../cart/CartContext.js';
import { ToastProvider } from '../toast/ToastProvider.js';
import type { Cart, Product, ReviewsResponse, User } from '../api/types.js';

const product: Product = {
  id: 'prod-1',
  slug: 'katana-x',
  name: 'Katana-X',
  description: 'Uma réplica de katana de colecionador.',
  category: 'figures',
  priceCents: 19900,
  images: [],
  stock: 5,
};

const emptyCart: Cart = { id: 'c1', items: [], subtotalCents: 0, discountCents: 0, totalCents: 0 };
const emptyReviews: ReviewsResponse = { reviews: [], average: 0, count: 0 };
const sessionUser: User | null = null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function unauthorizedResponse(): Response {
  return jsonResponse({ error: 'Unauthorized', message: 'Not authenticated', statusCode: 401 }, 401);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/p/katana-x']}>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/p/:slug" element={<ProductPage />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

function makeMockFetch(catalog: Product[] | 'reject') {
  return function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (url.startsWith('/api/products/katana-x/reviews')) {
      return Promise.resolve(jsonResponse(emptyReviews));
    }
    if (url.startsWith('/api/products/katana-x')) {
      return Promise.resolve(jsonResponse(product));
    }
    if (url.startsWith('/api/products')) {
      if (catalog === 'reject') {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve(jsonResponse(catalog));
    }
    if (url.startsWith('/api/cart')) {
      return Promise.resolve(jsonResponse(emptyCart));
    }
    if (url.startsWith('/api/auth/me') && method === 'GET') {
      return Promise.resolve(sessionUser ? jsonResponse(sessionUser) : unauthorizedResponse());
    }

    return Promise.reject(new Error(`Unhandled fetch in test: ${url}`));
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProductPage related products', () => {
  it('shows 4 related products, same-category first, without the current product', async () => {
    const catalog: Product[] = [
      product,
      { ...product, id: 'p2', slug: 'p2', name: 'Figure Two' },
      { ...product, id: 'p3', slug: 'p3', name: 'Manga Three', category: 'mangas' },
      { ...product, id: 'p4', slug: 'p4', name: 'Figure Four' },
      { ...product, id: 'p5', slug: 'p5', name: 'Vestuario Five', category: 'vestuario' },
      { ...product, id: 'p6', slug: 'p6', name: 'Acessorio Six', category: 'acessorios' },
    ];
    vi.stubGlobal('fetch', vi.fn(makeMockFetch(catalog)));

    renderPage();

    const region = within(
      await screen.findByRole('region', { name: 'Produtos relacionados' }),
    );

    const articles = await region.findAllByRole('article');
    expect(articles).toHaveLength(4);
    expect(articles.map((a) => a.textContent)).toEqual([
      expect.stringContaining('Figure Two'),
      expect.stringContaining('Figure Four'),
      expect.stringContaining('Manga Three'),
      expect.stringContaining('Vestuario Five'),
    ]);
    expect(region.queryByText('Katana-X')).not.toBeInTheDocument();
  });

  it('fills the remaining slots from other categories when the category has only one other product', async () => {
    const catalog: Product[] = [
      product,
      { ...product, id: 'p2', slug: 'p2', name: 'Figure Two' },
      { ...product, id: 'p3', slug: 'p3', name: 'Manga Three', category: 'mangas' },
      { ...product, id: 'p4', slug: 'p4', name: 'Vestuario Four', category: 'vestuario' },
      { ...product, id: 'p5', slug: 'p5', name: 'Acessorio Five', category: 'acessorios' },
    ];
    vi.stubGlobal('fetch', vi.fn(makeMockFetch(catalog)));

    renderPage();

    const region = within(
      await screen.findByRole('region', { name: 'Produtos relacionados' }),
    );

    const articles = await region.findAllByRole('article');
    expect(articles).toHaveLength(4);
    expect(articles.map((a) => a.textContent)).toEqual([
      expect.stringContaining('Figure Two'),
      expect.stringContaining('Manga Three'),
      expect.stringContaining('Vestuario Four'),
      expect.stringContaining('Acessorio Five'),
    ]);
  });

  it('renders no related section when /api/products rejects, and the rest of the page still works', async () => {
    vi.stubGlobal('fetch', vi.fn(makeMockFetch('reject')));

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Katana-X' })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole('region', { name: 'Produtos relacionados' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeInTheDocument();
  });

  it('renders no related section when /api/products returns only the current product', async () => {
    vi.stubGlobal('fetch', vi.fn(makeMockFetch([product])));

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Katana-X' })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole('region', { name: 'Produtos relacionados' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeInTheDocument();
  });
});
