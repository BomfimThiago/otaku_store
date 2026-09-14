import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App.js';
import { AuthProvider } from './auth/AuthContext.js';
import { CartProvider } from './cart/CartContext.js';
import { ToastProvider } from './toast/ToastProvider.js';
import type { Cart, Product, User } from './api/types.js';

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

const registeredUser: User = { id: 'user-1', name: 'Ada Lovelace', email: 'ada@example.com' };
const REGISTERED_PASSWORD = 'password1';

// The current session, as far as the mocked API is concerned. Reset before
// each test so login/logout in one test can't leak into another.
let sessionUser: User | null = null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function unauthorizedResponse(): Response {
  return jsonResponse({ error: 'Unauthorized', message: 'Not authenticated', statusCode: 401 }, 401);
}

function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();
  const method = init?.method ?? 'GET';

  if (url.includes('/reviews')) {
    return Promise.resolve(jsonResponse({ reviews: [], average: 0, count: 0 }));
  }
  if (url.startsWith('/api/products/katana-x')) {
    return Promise.resolve(jsonResponse(katanaProduct));
  }
  if (url.startsWith('/api/products')) {
    return Promise.resolve(jsonResponse([]));
  }
  if (url.startsWith('/api/cart')) {
    return Promise.resolve(jsonResponse(emptyCart));
  }

  if (url.startsWith('/api/auth/me') && method === 'GET') {
    return Promise.resolve(sessionUser ? jsonResponse(sessionUser) : unauthorizedResponse());
  }
  if (url.startsWith('/api/auth/login') && method === 'POST') {
    const body = JSON.parse(init?.body as string) as { email: string; password: string };
    if (body.email === registeredUser.email && body.password === REGISTERED_PASSWORD) {
      sessionUser = registeredUser;
      return Promise.resolve(jsonResponse(registeredUser));
    }
    return Promise.resolve(
      jsonResponse({ error: 'Unauthorized', message: 'Credenciais inválidas', statusCode: 401 }, 401),
    );
  }
  if (url.startsWith('/api/auth/logout') && method === 'POST') {
    sessionUser = null;
    return Promise.resolve(new Response(null, { status: 204 }));
  }

  return Promise.reject(new Error(`Unhandled fetch in test: ${url}`));
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('App routing', () => {
  beforeEach(() => {
    sessionUser = null;
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

  it('shows the Entrar link in the header when logged out', async () => {
    renderAt('/');

    await screen.findByRole('heading', { name: /catálogo/i });

    expect(await screen.findByRole('link', { name: /entrar/i })).toBeInTheDocument();
  });

  it('shows the user name and Sair in the header when logged in, and Sair logs out', async () => {
    sessionUser = registeredUser;
    renderAt('/');

    await screen.findByRole('heading', { name: /catálogo/i });

    expect(await screen.findByText(registeredUser.name)).toBeInTheDocument();
    const signOutButton = screen.getByRole('button', { name: /sair/i });

    fireEvent.click(signOutButton);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /entrar/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(registeredUser.name)).not.toBeInTheDocument();
  });

  describe('/login', () => {
    it('renders the login form', async () => {
      renderAt('/login');

      expect(await screen.findByRole('heading', { name: /entrar/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    });

    it('shows validation errors on an empty submit without calling fetch', async () => {
      const user = userEvent.setup();
      renderAt('/login');

      await screen.findByRole('heading', { name: /entrar/i });
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockClear();

      await user.click(screen.getByRole('button', { name: /entrar/i }));

      expect(await screen.findByText(/informe seu e-mail/i)).toBeInTheDocument();
      expect(screen.getByText(/informe sua senha/i)).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shows a validation error for an invalid email without calling fetch', async () => {
      const user = userEvent.setup();
      renderAt('/login');

      await screen.findByRole('heading', { name: /entrar/i });
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockClear();

      await user.type(screen.getByLabelText(/e-mail/i), 'not-an-email');
      await user.type(screen.getByLabelText(/senha/i), 'password1');
      await user.click(screen.getByRole('button', { name: /entrar/i }));

      expect(await screen.findByText(/informe um e-mail válido/i)).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('logs in successfully and shows the user name in the header', async () => {
      const user = userEvent.setup();
      renderAt('/login');

      await screen.findByRole('heading', { name: /entrar/i });

      await user.type(screen.getByLabelText(/e-mail/i), registeredUser.email);
      await user.type(screen.getByLabelText(/senha/i), REGISTERED_PASSWORD);
      await user.click(screen.getByRole('button', { name: /entrar/i }));

      expect(await screen.findByText(registeredUser.name)).toBeInTheDocument();
    });
  });

  describe('/register', () => {
    it('renders the register form', async () => {
      renderAt('/register');

      expect(await screen.findByRole('heading', { name: /criar conta/i })).toBeInTheDocument();
    });

    it('shows a validation error for a short password without calling fetch', async () => {
      const user = userEvent.setup();
      renderAt('/register');

      await screen.findByRole('heading', { name: /criar conta/i });
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockClear();

      await user.type(screen.getByLabelText(/nome/i), 'Ada Lovelace');
      await user.type(screen.getByLabelText(/e-mail/i), 'ada@example.com');
      await user.type(screen.getByLabelText(/^senha/i), 'ab1');
      await user.type(screen.getByLabelText(/confirmar senha/i), 'ab1');
      await user.click(screen.getByRole('button', { name: /criar conta/i }));

      expect(await screen.findByText(/ao menos 8 caracteres/i)).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
