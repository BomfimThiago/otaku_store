import { useState } from 'react';
import type { Product } from '../api/types.js';
import { productImage, productImageSrc } from '../lib/image.js';

export function ProductImage({
  product,
  size = 500,
  className = '',
}: {
  product: Product;
  size?: 500 | 960;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`aspect-square overflow-hidden bg-ink-900 ${className}`}>
      <img
        src={failed ? productImage(product.name) : productImageSrc(product, size)}
        alt={product.name}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
