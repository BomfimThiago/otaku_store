export const CATEGORIES = [
  'figures',
  'mangas',
  'vestuario',
  'acessorios',
  'papelaria',
  'pelucias',
] as const;

export type CategorySlug = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  figures: 'Figures',
  mangas: 'Mangás',
  vestuario: 'Vestuário',
  acessorios: 'Acessórios',
  papelaria: 'Papelaria',
  pelucias: 'Pelúcias',
};

function isCategorySlug(slug: string): slug is CategorySlug {
  return (CATEGORIES as readonly string[]).includes(slug);
}

export function categoryLabel(slug: string): string {
  return isCategorySlug(slug) ? CATEGORY_LABELS[slug] : slug;
}

export interface PriceRange {
  id: string;
  label: string;
  min?: number;
  max?: number;
}

// Bounds are inclusive and expressed in integer cents.
export const PRICE_RANGES: readonly PriceRange[] = [
  { id: 'ate-50', label: 'Até R$ 50', max: 5000 },
  { id: '50-150', label: 'R$ 50 – R$ 150', min: 5000, max: 15000 },
  { id: '150-300', label: 'R$ 150 – R$ 300', min: 15000, max: 30000 },
  { id: '300-mais', label: 'Acima de R$ 300', min: 30000 },
];

export function filterByPrice<T extends { priceCents: number }>(
  products: readonly T[],
  min: number | null,
  max: number | null,
): T[] {
  return products.filter((p) => {
    if (min !== null && p.priceCents < min) return false;
    if (max !== null && p.priceCents > max) return false;
    return true;
  });
}
