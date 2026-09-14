import { useEffect, useState } from 'react';
import { listProducts } from '../api/client.js';
import type { Product } from '../api/types.js';
import { pickRelated } from '../lib/related.js';
import { ProductCard } from './ProductCard.js';

export function RelatedProducts({ product }: { product: Product }) {
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setRelated([]);
    setLoading(true);
    listProducts()
      .then((list) => {
        if (cancelled) return;
        setRelated(pickRelated(product, list, 4));
      })
      .catch(() => {
        if (cancelled) return;
        setRelated([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product.id, product.category]);

  if (loading) {
    return (
      <section aria-labelledby="related-heading" className="mt-10 border-t border-ink-700 pt-8">
        <h2 id="related-heading" className="font-display text-xl font-bold">
          Produtos relacionados
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-ink-800" />
          ))}
        </div>
      </section>
    );
  }

  if (related.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="related-heading" className="mt-10 border-t border-ink-700 pt-8">
      <h2 id="related-heading" className="font-display text-xl font-bold">
        Produtos relacionados
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {related.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
