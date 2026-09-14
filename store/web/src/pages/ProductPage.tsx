import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getProduct } from '../api/client.js';
import type { Product } from '../api/types.js';
import { ProductImage } from '../components/ProductImage.js';
import { ReviewsSection } from '../components/ReviewsSection.js';
import { useCart } from '../cart/CartContext.js';
import { useToast } from '../toast/ToastProvider.js';
import { formatPrice } from '../lib/format.js';
import { categoryLabel } from '../lib/categories.js';

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
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
        if (!cancelled) {
          setProduct(p);
          setQuantity(1);
        }
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
      <main className="w-full px-4 py-16 text-center md:px-8">
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
      <main className="w-full px-4 py-6 md:px-8">
        <div className="h-4 w-24 animate-pulse rounded bg-ink-800" />
        <div className="mt-6 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7 xl:col-span-5">
            <div className="aspect-square animate-pulse rounded-xl bg-ink-800" />
          </div>
          <div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-7">
            <div className="h-4 w-24 animate-pulse rounded bg-ink-800" />
            <div className="h-8 w-2/3 animate-pulse rounded bg-ink-800" />
            <div className="h-24 animate-pulse rounded bg-ink-800" />
            <div className="h-48 animate-pulse rounded-xl bg-ink-800" />
          </div>
        </div>
      </main>
    );
  }

  const inStock = product.stock > 0;
  const maxQuantity = Math.min(product.stock, 10);

  const handleAdd = async () => {
    setAdding(true);
    try {
      await addItem({ productId: product.id, quantity });
      toast.show(`${quantity}x ${product.name} adicionado ao carrinho`, { variant: 'success' });
    } finally {
      setAdding(false);
    }
  };

  return (
    <main className="w-full px-4 py-6 md:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link to="/" className="hover:text-fg">
              Início
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to={`/?category=${product.category}`} className="hover:text-fg">
              {categoryLabel(product.category)}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <span aria-current="page" className="text-fg">
              {product.name}
            </span>
          </li>
        </ol>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 xl:col-span-5">
          <div className="rounded-xl border border-ink-700 bg-ink-900 p-4">
            <ProductImage product={product} size={960} />
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:col-span-5 xl:col-span-7 xl:grid xl:grid-cols-7">
          <div className="xl:col-span-4">
            <p className="text-xs uppercase tracking-wide text-neon-cyan">{product.category}</p>
            <h1 className="mt-1 font-display text-3xl font-bold">{product.name}</h1>
            <p className="mt-4 leading-relaxed text-muted">{product.description}</p>
          </div>

          <aside
            aria-label="Comprar"
            className="h-fit rounded-xl border border-ink-700 bg-ink-900 p-5 shadow-neon-cyan xl:col-span-3 lg:sticky lg:top-24"
          >
            <p className="text-3xl font-bold text-neon-pink">{formatPrice(product.priceCents)}</p>
            <p className={`mt-2 text-sm ${inStock ? 'text-neon-lime' : 'text-muted'}`}>
              {inStock ? 'Em estoque' : 'Esgotado'}
            </p>

            <div className="mt-4">
              <label htmlFor="quantity" className="block text-xs text-muted">
                Quantidade
              </label>
              <select
                id="quantity"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                disabled={!inStock}
                className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg focus:border-neon-cyan focus:outline-none disabled:opacity-60"
              >
                {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAdd}
              disabled={adding || !inStock}
              className="mt-5 w-full rounded-lg bg-neon-pink px-5 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {adding ? 'Adicionando…' : 'Adicionar ao carrinho'}
            </button>
          </aside>
        </div>
      </div>

      <ReviewsSection slug={product.slug} />
    </main>
  );
}
