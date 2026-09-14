import { describe, expect, it } from 'vitest';

import { categoryLabel, filterByPrice } from './categories.js';

describe('categoryLabel', () => {
  it('returns the Portuguese label for a known category slug', () => {
    expect(categoryLabel('figures')).toBe('Figures');
    expect(categoryLabel('mangas')).toBe('Mangás');
    expect(categoryLabel('vestuario')).toBe('Vestuário');
    expect(categoryLabel('acessorios')).toBe('Acessórios');
    expect(categoryLabel('papelaria')).toBe('Papelaria');
    expect(categoryLabel('pelucias')).toBe('Pelúcias');
  });

  it('falls back to the raw slug for an unknown category', () => {
    expect(categoryLabel('unknown-category')).toBe('unknown-category');
  });
});

describe('filterByPrice', () => {
  const products = [
    { id: '1', priceCents: 2000 },
    { id: '2', priceCents: 8000 },
    { id: '3', priceCents: 20000 },
    { id: '4', priceCents: 50000 },
  ];

  it('returns all products when min and max are null', () => {
    expect(filterByPrice(products, null, null)).toEqual(products);
  });

  it('excludes products below min', () => {
    const result = filterByPrice(products, 10000, null);
    expect(result.map((p) => p.id)).toEqual(['3', '4']);
  });

  it('excludes products above max', () => {
    const result = filterByPrice(products, null, 10000);
    expect(result.map((p) => p.id)).toEqual(['1', '2']);
  });

  it('applies both bounds together', () => {
    const result = filterByPrice(products, 5000, 25000);
    expect(result.map((p) => p.id)).toEqual(['2', '3']);
  });

  it('includes products exactly on the boundary', () => {
    const result = filterByPrice(products, 8000, 20000);
    expect(result.map((p) => p.id)).toEqual(['2', '3']);
  });
});
