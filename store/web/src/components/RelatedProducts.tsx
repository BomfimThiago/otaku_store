import { useEffect, useState } from 'react';
import { listProducts } from '../api/client.js';
import type { Product } from '../api/types.js';
import { pickRelated } from '../lib/related.js';
import { ProductCard } from './ProductCard.js';

const GRID_CLASSES = 'grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5';

export function RelatedProducts({ slug, category }: { slug: string; category: string }) {
  const [related, setRelated] = useState<Product[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRelated(null);
    listProducts()
      .then((list) => {
        if (cancelled) return;
        setRelated(pickRelated({ slug, category }, list));
      })
      .catch(() => {
        if (cancelled) return;
        setRelated([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, category]);

  if (related === null || related.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="related-heading" className="mt-10 border-t border-ink-700 pt-8">
      <h2 id="related-heading" className="font-display text-xl font-bold">
        Produtos relacionados
      </h2>
      <div className={`mt-4 ${GRID_CLASSES}`}>
        {related.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
