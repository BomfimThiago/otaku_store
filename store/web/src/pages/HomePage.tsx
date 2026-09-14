import { useEffect, useState } from 'react';
import { listProducts } from '../api/client.js';
import type { Product } from '../api/types.js';
import { ProductCard } from '../components/ProductCard.js';
import { EmptyState } from '../components/states/EmptyState.js';
import { ErrorState } from '../components/states/ErrorState.js';

const CATEGORIES = ['figures', 'mangas', 'vestuario', 'acessorios', 'papelaria', 'pelucias'];

export function HomePage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [q, setQ] = useState('');
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold">Catálogo</h1>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar produtos…"
          aria-label="Buscar produtos"
          className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-neon-cyan focus:outline-none"
        />
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
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-ink-800" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState title="Nada por aqui" message="Nenhum produto encontrado para esta busca." />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
