import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { listProducts } from '../api/client.js';
import type { Product } from '../api/types.js';
import { CatalogSidebar } from '../components/CatalogSidebar.js';
import { HeroBanner } from '../components/HeroBanner.js';
import { ProductCard } from '../components/ProductCard.js';
import { EmptyState } from '../components/states/EmptyState.js';
import { ErrorState } from '../components/states/ErrorState.js';
import { categoryLabel, filterByPrice } from '../lib/categories.js';

const GRID_CLASSES = 'grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5';

function parsePriceParam(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function HomePage() {
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category');
  const q = searchParams.get('q') ?? '';
  const min = parsePriceParam(searchParams.get('min'));
  const max = parsePriceParam(searchParams.get('max'));
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setProducts(null);
    setError(null);
    const params: { category?: string; q?: string } = {};
    if (category) params.category = category;
    if (q.trim()) params.q = q.trim();
    listProducts(params)
      .then((list) => {
        if (!cancelled) setProducts(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar');
      });
    return () => {
      cancelled = true;
    };
  }, [category, q, nonce]);

  const visible = useMemo(() => filterByPrice(products ?? [], min, max), [products, min, max]);

  const isFiltered = Boolean(category) || Boolean(q.trim()) || min !== null || max !== null;
  const catalogTitle = category ? `Catálogo · ${categoryLabel(category)}` : 'Catálogo';

  return (
    <main className="w-full px-4 py-6 md:px-8">
      {!isFiltered && <HeroBanner />}

      <div className="flex flex-col gap-6 md:flex-row">
        <CatalogSidebar />

        <div className="min-w-0 flex-1">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold">{catalogTitle}</h1>
            {q.trim() && <p className="mt-1 text-sm text-muted">Resultados para “{q.trim()}”</p>}
          </div>

          <h2 className="mb-4 font-display text-lg font-bold">{isFiltered ? 'Resultados' : 'Destaques'}</h2>

          {error ? (
            <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} />
          ) : products === null ? (
            <div className={GRID_CLASSES}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-xl bg-ink-800" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState title="Nada por aqui" message="Nenhum produto encontrado para esta busca." />
          ) : (
            <div className={GRID_CLASSES}>
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
