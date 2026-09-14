import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductPage } from './ProductPage.js';
import { AuthProvider } from '../auth/AuthContext.js';
import { CartProvider } from '../cart/CartContext.js';
import { ToastProvider } from '../toast/ToastProvider.js';
import type { Cart, Product, Review, ReviewsResponse, User } from '../api/types.js';

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

const loggedInUser: User = { id: 'user-1', name: 'Ada Lovelace', email: 'ada@example.com' };

const existingReview: Review = {
  id: 'r1',
  productSlug: 'katana-x',
  userId: 'other-user',
  userName: 'Grace Hopper',
  rating: 4,
  comment: 'Muito bom produto.',
  createdAt: '2024-01-01T00:00:00.000Z',
};

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
              <Route path="/login" element={<div>Login Page</div>} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('ProductPage reviews', () => {
  let sessionUser: User | null;
  let reviewsState: ReviewsResponse;
  let postReviewStatus: 200 | 400 | 409;

  function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (url.startsWith('/api/products/katana-x/reviews') && method === 'GET') {
      return Promise.resolve(jsonResponse(reviewsState));
    }
    if (url.startsWith('/api/products/katana-x/reviews') && method === 'POST') {
      if (postReviewStatus === 409) {
        return Promise.resolve(
          jsonResponse({ error: 'Conflict', message: 'Você já avaliou este produto', statusCode: 409 }, 409),
        );
      }
      if (postReviewStatus === 400) {
        return Promise.resolve(
          jsonResponse({ error: 'Bad Request', message: 'Validação falhou', statusCode: 400 }, 400),
        );
      }
      const body = JSON.parse(init?.body as string) as { rating: number; comment: string };
      const created: Review = {
        id: 'r-new',
        productSlug: 'katana-x',
        userId: sessionUser?.id ?? 'user-1',
        userName: sessionUser?.name ?? 'Ada Lovelace',
        rating: body.rating,
        comment: body.comment,
        createdAt: new Date().toISOString(),
      };
      reviewsState = {
        reviews: [created, ...reviewsState.reviews],
        average: created.rating,
        count: reviewsState.count + 1,
      };
      return Promise.resolve(jsonResponse(created, 201));
    }
    if (url.startsWith('/api/products/katana-x')) {
      return Promise.resolve(jsonResponse(product));
    }
    if (url.startsWith('/api/cart')) {
      return Promise.resolve(jsonResponse(emptyCart));
    }
    if (url.startsWith('/api/auth/me') && method === 'GET') {
      return Promise.resolve(sessionUser ? jsonResponse(sessionUser) : unauthorizedResponse());
    }

    return Promise.reject(new Error(`Unhandled fetch in test: ${url}`));
  }

  beforeEach(() => {
    sessionUser = null;
    postReviewStatus = 200;
    reviewsState = { reviews: [existingReview], average: 4, count: 1 };
    vi.stubGlobal('fetch', vi.fn(mockFetch));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the reviews list and average', async () => {
    renderPage();

    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('Muito bom produto.')).toBeInTheDocument();
    const summary = within(screen.getByTestId('rating-summary'));
    expect(summary.getByRole('img', { name: 'Nota 4 de 5' })).toBeInTheDocument();
    expect(summary.getByText('(1)')).toBeInTheDocument();
  });

  it('shows an Entre para avaliar link to /login and no form when logged out', async () => {
    renderPage();

    await screen.findByText('Grace Hopper');

    const link = screen.getByRole('link', { name: /entre para avaliar/i });
    expect(link).toHaveAttribute('href', '/login');
    expect(screen.queryByLabelText('Comentário')).not.toBeInTheDocument();
  });

  it('shows the review form when logged in, POSTs {rating, comment} on submit, shows a success toast and refetches the list', async () => {
    sessionUser = loggedInUser;
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Grace Hopper');
    expect(screen.queryByRole('link', { name: /entre para avaliar/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '5 estrelas' }));
    await user.type(screen.getByLabelText('Comentário'), 'Chegou rápido e bem embalado.');
    await user.click(screen.getByRole('button', { name: /enviar avaliação/i }));

    await screen.findByText('Avaliação enviada!');

    const fetchMock = vi.mocked(fetch);
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    expect(JSON.parse(postCall![1]!.body as string)).toEqual({
      rating: 5,
      comment: 'Chegou rápido e bem embalado.',
    });

    await waitFor(() => {
      const summary = within(screen.getByTestId('rating-summary'));
      expect(summary.getByRole('img', { name: 'Nota 5 de 5' })).toBeInTheDocument();
      expect(summary.getByText('(2)')).toBeInTheDocument();
    });
  });

  it('shows the error message and an error toast for a 409 response', async () => {
    sessionUser = loggedInUser;
    postReviewStatus = 409;
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Grace Hopper');

    await user.click(screen.getByRole('button', { name: '3 estrelas' }));
    await user.type(screen.getByLabelText('Comentário'), 'Já avaliei antes.');
    await user.click(screen.getByRole('button', { name: /enviar avaliação/i }));

    expect(await screen.findAllByText('Você já avaliou este produto')).not.toHaveLength(0);
  });

  it('shows the error message and an error toast for a 400 response', async () => {
    sessionUser = loggedInUser;
    postReviewStatus = 400;
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Grace Hopper');

    await user.click(screen.getByRole('button', { name: '3 estrelas' }));
    await user.type(screen.getByLabelText('Comentário'), 'Comentário inválido?');
    await user.click(screen.getByRole('button', { name: /enviar avaliação/i }));

    expect(await screen.findAllByText('Validação falhou')).not.toHaveLength(0);
  });

  it('disables submit while submitting or until a rating and a comment are both entered', async () => {
    sessionUser = loggedInUser;
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Grace Hopper');

    const submit = screen.getByRole('button', { name: /enviar avaliação/i });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '4 estrelas' }));
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Comentário'), 'Muito bom.');
    expect(submit).toBeEnabled();
  });
});
