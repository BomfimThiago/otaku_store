import { Link } from 'react-router';
import type { Product } from '../api/types.js';
import { formatPrice } from '../lib/format.js';
import { productImage } from '../lib/image.js';

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      to={`/p/${product.slug}`}
      className="group rounded-xl border border-ink-700 bg-ink-900 p-3 transition hover:border-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
    >
      <img
        src={productImage(product.name)}
        alt={product.name}
        loading="lazy"
        className="aspect-square w-full rounded-lg bg-ink-800 object-cover"
      />
      <p className="mt-3 text-[0.65rem] uppercase tracking-wide text-muted">{product.category}</p>
      <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-fg group-hover:text-neon-cyan">
        {product.name}
      </h3>
      <p className="mt-2 font-bold text-neon-pink">{formatPrice(product.priceCents)}</p>
    </Link>
  );
}
