import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { App } from './App.js';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App routing', () => {
  it('renders the catalog page at /', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { name: /catálogo/i })).toBeInTheDocument();
  });

  it('renders the product page at /p/:slug with the slug in the heading', () => {
    renderAt('/p/katana-x');

    expect(screen.getByRole('heading', { name: /katana-x/i })).toBeInTheDocument();
  });

  it('renders the cart page at /cart', () => {
    renderAt('/cart');

    expect(screen.getByRole('heading', { name: /carrinho/i })).toBeInTheDocument();
  });
});
