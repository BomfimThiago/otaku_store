import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductPage } from './ProductPage.js';
import { AuthProvider } from '../auth/AuthContext.js';
import { CartProvider } from '../cart/CartContext.js';
import { ToastProvider } from '../toast/ToastProvider.js';
import type { Cart, Product, ReviewsResponse } from '../api/types.js';

const catalog: Product[] = [
  {
    id: 'p-katana',
    slug: 'katana-x',
    name: 'Katana-X',
    description: 'Uma réplica de katana de colecionador.',
    category: 'figures',
    priceCents: 19900,
    images: [],
    stock: 5,
  },
  {
    id: 'p-figure-b',
    slug: 'figure-b',
    name: 'Figure B',
    description: 'Outra figure.',
    category: 'figures',
    priceCents: 12900,
    images: [],
    stock: 3,
  },
  {
    id: 'p-figure-c',
    slug: 'figure-c',
    name: 'Figure C',
    description: 'Mais uma figure.',
    category: 'figures',
    priceCents: 13900,
    images: [],
    stock: 3,
  },
  {
    id: 'p-manga-a',
    slug: 'manga-a',
    name: 'Manga A',
    description: 'Um mangá.',
    category: 'mangas',
    priceCents: 3900,
    images: [],
    stock: 10,
  },
  {
    id: 'p-vestuario-a',
    slug: 'vestuario-a',
    name: 'Vestuario A',
    description: 'Uma camiseta.',
    category: 'vestuario',
    priceCents: 7900,
    images: [],
    stock: 10,
  },
  {
    id: 'p-acessorio-a',
    slug: 'acessorio-a',
    name: 'Acessorio A',
    description: 'Um acessório.',
    category: 'acessorios',
    priceCents: 4900,
    images: [],
    stock: 10,
  },
  {
    id: 'p-papelaria-a',
    slug: 'papelaria-a',
    name: 'Papelaria A',
    description: 'Um caderno.',
    category: 'papelaria',
    priceCents: 2900,
    images: [],
    stock: 10,
  },
];

const emptyCart: Cart = { id: 'c1', items: [], subtotalCents: 0, discountCents: 0, totalCents: 0 };
const emptyReviews: ReviewsResponse = { reviews: [], average: 0, count: 0 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function unauthorizedResponse(): Response {
  return jsonResponse({ error: 'Unauthorized', message: 'Not authenticated', statusCode: 401 }, 401);
}

function renderPage(initialSlug = 'katana-x') {
  return render(
    <MemoryRouter initialEntries={[`/p/${initialSlug}`]}>
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

describe('ProductPage related products', () => {
  let listShouldFail: boolean;

  function mockFetch(input: RequestInfo | URL): Promise<Response> {
    const url = typeof input === 'string' ? input : input.toString();

    const reviewsMatch = /^\/api\/products\/([^/]+)\/reviews/.exec(url);
    if (reviewsMatch) {
      return Promise.resolve(jsonResponse(emptyReviews));
    }

    const detailMatch = /^\/api\/products\/([^/?]+)$/.exec(url);
    if (detailMatch) {
      const product = catalog.find((p) => p.slug === detailMatch[1]);
      if (product) return Promise.resolve(jsonResponse(product));
      return Promise.resolve(
        jsonResponse({ error: 'Not Found', message: 'Produto não encontrado', statusCode: 404 }, 404),
      );
    }

    if (url.startsWith('/api/products')) {
      if (listShouldFail) {
        return Promise.resolve(
          jsonResponse({ error: 'Internal Server Error', message: 'Falhou', statusCode: 500 }, 500),
        );
      }
      return Promise.resolve(jsonResponse(catalog));
    }

    if (url.startsWith('/api/cart')) {
      return Promise.resolve(jsonResponse(emptyCart));
    }
    if (url.startsWith('/api/auth/me')) {
      return Promise.resolve(unauthorizedResponse());
    }

    return Promise.reject(new Error(`Unhandled fetch in test: ${url}`));
  }

  beforeEach(() => {
    listShouldFail = false;
    vi.stubGlobal('fetch', vi.fn(mockFetch));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows exactly 4 related products, same-category first, excluding the current product', async () => {
    renderPage();

    const region = await screen.findByRole('region', { name: 'Produtos relacionados' });
    const articles = within(region).getAllByRole('article');
    expect(articles).toHaveLength(4);
    expect(articles.map((a) => within(a).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Figure B',
      'Figure C',
      'Manga A',
      'Vestuario A',
    ]);

    expect(within(region).queryByText('Katana-X')).not.toBeInTheDocument();
  });

  it('renders the related section after the reviews section', async () => {
    renderPage();

    const reviews = await screen.findByRole('region', { name: 'Avaliações' });
    const related = await screen.findByRole('region', { name: 'Produtos relacionados' });

    expect(reviews.compareDocumentPosition(related) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the product but no related section when the products list fetch fails', async () => {
    listShouldFail = true;
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Katana-X' });

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Produtos relacionados' })).not.toBeInTheDocument();
    });
  });

  it('navigates to a related product and refetches the section without the new current product', async () => {
    const user = userEvent.setup();
    renderPage();

    const region = await screen.findByRole('region', { name: 'Produtos relacionados' });
    await user.click(within(region).getByText('Figure B'));

    await screen.findByRole('heading', { level: 1, name: 'Figure B' });

    const newRegion = await screen.findByRole('region', { name: 'Produtos relacionados' });
    const articles = within(newRegion).getAllByRole('article');
    expect(articles).toHaveLength(4);
    expect(articles.map((a) => within(a).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Katana-X',
      'Figure C',
      'Manga A',
      'Vestuario A',
    ]);
    expect(within(newRegion).queryByText('Figure B')).not.toBeInTheDocument();
  });
});
