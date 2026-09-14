import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getProduct } from '../api/client.js';
import type { Product } from '../api/types.js';
import { useCart } from '../cart/CartContext.js';
import { useToast } from '../toast/ToastProvider.js';
import { formatPrice } from '../lib/format.js';
import { productImage } from '../lib/image.js';

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { addItem } = useCart();
  const toast = useToast();

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setProduct(null);
    setError(null);
    getProduct(slug)
      .then((p) => {
        if (!cancelled) setProduct(p);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-muted">
          Produto não encontrado.{' '}
          <Link to="/" className="text-neon-cyan">
            Voltar ao catálogo
          </Link>
        </p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="h-96 animate-pulse rounded-xl bg-ink-800" />
      </main>
    );
  }

  const add = async () => {
    setAdding(true);
    await addItem({ productId: product.id, quantity: 1 });
    setAdding(false);
    toast.show(`${product.name} adicionado ao carrinho`, { variant: 'success' });
  };

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2">
      <img
        src={productImage(product.name)}
        alt={product.name}
        className="w-full rounded-xl border border-ink-700 bg-ink-900"
      />
      <div>
        <Link to="/" className="text-sm text-muted hover:text-fg">
          ← Catálogo
        </Link>
        <p className="mt-4 text-xs uppercase tracking-wide text-neon-cyan">{product.category}</p>
        <h1 className="mt-1 font-display text-3xl font-bold">{product.name}</h1>
        <p className="mt-4 text-3xl font-bold text-neon-pink">{formatPrice(product.priceCents)}</p>
        <p className="mt-4 leading-relaxed text-muted">{product.description}</p>
        <button
          onClick={add}
          disabled={adding}
          className="mt-8 w-full rounded-lg bg-neon-pink px-5 py-3 font-semibold text-ink-950 transition hover:brightness-110 disabled:opacity-60 sm:w-auto"
        >
          {adding ? 'Adicionando…' : 'Adicionar ao carrinho'}
        </button>
      </div>
    </main>
  );
}
