import { useState } from 'react';
import { Link } from 'react-router';
import type { Product } from '../api/types.js';
import { useCart } from '../cart/CartContext.js';
import { formatPrice } from '../lib/format.js';
import { useToast } from '../toast/ToastProvider.js';
import { ProductImage } from './ProductImage.js';
import { Stars } from './Stars.js';

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const inStock = product.stock > 0;

  const handleAdd = async () => {
    setAdding(true);
    try {
      await addItem({ productId: product.id, quantity: 1 });
      toast.show(`${product.name} adicionado ao carrinho`, { variant: 'success' });
    } finally {
      setAdding(false);
    }
  };

  return (
    <article className="group flex flex-col rounded-xl border border-ink-700 bg-ink-900 transition hover:-translate-y-1 hover:border-neon-pink/60 hover:shadow-neon focus-within:border-neon-cyan">
      <Link
        to={`/p/${product.slug}`}
        className="flex flex-col rounded-t-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
      >
        <ProductImage product={product} size={500} className="rounded-t-xl" />
        <div className="px-3 pt-3">
          <p className="text-[0.65rem] uppercase tracking-wide text-muted">{product.category}</p>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-fg group-hover:text-neon-cyan">
            {product.name}
          </h3>
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-3 pb-3">
        <p className="mt-2 text-lg font-bold text-neon-pink">{formatPrice(product.priceCents)}</p>
        {typeof product.ratingCount === 'number' && (
          <Stars value={product.ratingAverage ?? 0} count={product.ratingCount} size="sm" />
        )}
        <p className={`mt-1 text-xs ${inStock ? 'text-neon-lime' : 'text-muted'}`}>
          {inStock ? 'Em estoque' : 'Esgotado'}
        </p>
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !inStock}
          className="mt-auto w-full rounded-lg bg-neon-pink px-3 py-2 text-sm font-semibold text-ink-950 transition hover:brightness-110 disabled:opacity-60"
        >
          {adding ? 'Adicionando…' : 'Adicionar ao carrinho'}
        </button>
      </div>
    </article>
  );
}
