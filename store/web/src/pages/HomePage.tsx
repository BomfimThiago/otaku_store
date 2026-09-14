import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { listProducts } from '../api/client.js';
import type { Product } from '../api/types.js';
import { ProductCard } from '../components/ProductCard.js';
import { EmptyState } from '../components/states/EmptyState.js';
import { ErrorState } from '../components/states/ErrorState.js';

const CATEGORIES = ['figures', 'mangas', 'vestuario', 'acessorios', 'papelaria', 'pelucias'];

const GRID_CLASSES = 'grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7';

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category');
  const q = searchParams.get('q') ?? '';
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

  const setCategory = (next: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (next) {
      params.set('category', next);
    } else {
      params.delete('category');
    }
    setSearchParams(params);
  };

  return (
    <main className="w-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Catálogo</h1>
        {q.trim() && <p className="mt-1 text-sm text-muted">Resultados para “{q.trim()}”</p>}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Chip active={category === null} onClick={() => setCategory(null)}>
          Todos
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}
          </Chip>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} />
      ) : products === null ? (
        <div className={GRID_CLASSES}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-ink-800" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState title="Nada por aqui" message="Nenhum produto encontrado para esta busca." />
      ) : (
        <div className={GRID_CLASSES}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
        active ? 'bg-neon-cyan text-ink-950' : 'bg-ink-800 text-muted hover:text-fg'
      }`}
    >
      {children}
    </button>
  );
}
