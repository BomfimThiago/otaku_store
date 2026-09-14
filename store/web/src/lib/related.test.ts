import { describe, expect, it } from 'vitest';

import { pickRelated } from './related.js';

interface TestProduct {
  id: string;
  category: string;
}

const current: TestProduct = { id: 'p1', category: 'figures' };

describe('pickRelated', () => {
  it('never includes the current product', () => {
    const all: TestProduct[] = [
      current,
      { id: 'p2', category: 'figures' },
      { id: 'p3', category: 'mangas' },
    ];

    const result = pickRelated(current, all);

    expect(result.some((p) => p.id === current.id)).toBe(false);
  });

  it('puts same-category products first, in catalog order', () => {
    const all: TestProduct[] = [
      { id: 'p2', category: 'mangas' },
      { id: 'p3', category: 'figures' },
      current,
      { id: 'p4', category: 'figures' },
      { id: 'p5', category: 'vestuario' },
    ];

    const result = pickRelated(current, all);

    expect(result.map((p) => p.id)).toEqual(['p3', 'p4', 'p2', 'p5']);
  });

  it('fills from other categories in catalog order with no duplicates when the category has fewer than limit', () => {
    const all: TestProduct[] = [
      current,
      { id: 'p2', category: 'figures' },
      { id: 'p3', category: 'mangas' },
      { id: 'p4', category: 'vestuario' },
      { id: 'p5', category: 'acessorios' },
    ];

    const result = pickRelated(current, all);

    expect(result.map((p) => p.id)).toEqual(['p2', 'p3', 'p4', 'p5']);
    expect(new Set(result.map((p) => p.id)).size).toBe(result.length);
  });

  it('returns at most `limit` items', () => {
    const all: TestProduct[] = [
      current,
      { id: 'p2', category: 'figures' },
      { id: 'p3', category: 'mangas' },
      { id: 'p4', category: 'vestuario' },
      { id: 'p5', category: 'acessorios' },
      { id: 'p6', category: 'papelaria' },
    ];

    const result = pickRelated(current, all, 4);

    expect(result).toHaveLength(4);
  });

  it('returns [] when the catalog is empty', () => {
    expect(pickRelated(current, [])).toEqual([]);
  });

  it('returns [] when the catalog holds only the current product', () => {
    expect(pickRelated(current, [current])).toEqual([]);
  });
});
