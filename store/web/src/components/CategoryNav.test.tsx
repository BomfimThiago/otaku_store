import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { CategoryNav } from './CategoryNav.js';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CategoryNav />
    </MemoryRouter>,
  );
}

describe('CategoryNav', () => {
  it('renders a link for each category plus Todos, each pointing at its category href', () => {
    renderAt('/?category=mangas');

    const expectedLinks: [name: string, href: string][] = [
      ['Todos', '/'],
      ['Figures', '/?category=figures'],
      ['Mangás', '/?category=mangas'],
      ['Vestuário', '/?category=vestuario'],
      ['Acessórios', '/?category=acessorios'],
      ['Papelaria', '/?category=papelaria'],
      ['Pelúcias', '/?category=pelucias'],
    ];

    for (const [name, href] of expectedLinks) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
    }
  });

  it('marks only the active category as aria-current="page"', () => {
    renderAt('/?category=mangas');

    expect(screen.getByRole('link', { name: 'Mangás' })).toHaveAttribute('aria-current', 'page');

    const others = ['Todos', 'Figures', 'Vestuário', 'Acessórios', 'Papelaria', 'Pelúcias'];
    for (const name of others) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current');
    }
  });
});
