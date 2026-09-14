import type { Product } from '../api/types.js';

/**
 * Product image placeholder URL, used when a product has no real image (or
 * as a fallback if the real one fails to load). Colours match the light
 * theme's ink-800 background and muted text tokens.
 */
export function productImage(name: string): string {
  return `https://placehold.co/600x600/eeeef3/6b6580?text=${encodeURIComponent(name)}`;
}

const WIKIMEDIA_THUMB_WIDTH = /\/(\d+)px-/;

/**
 * Resolves the image to render for a product: the first real image if any,
 * otherwise the light-theme placeholder. For Wikimedia Commons thumbnail URLs, a
 * `size` of 960 swaps the thumbnail width segment (e.g. `/500px-` ->
 * `/960px-`) to request a larger rendition; only standard Wikimedia widths
 * are used, so no other URL shapes are rewritten.
 */
export function productImageSrc(product: Product, size: 500 | 960 = 500): string {
  const [image] = product.images;
  if (!image) {
    return productImage(product.name);
  }

  if (size === 960 && image.startsWith('https://upload.wikimedia.org/') && WIKIMEDIA_THUMB_WIDTH.test(image)) {
    return image.replace(WIKIMEDIA_THUMB_WIDTH, '/960px-');
  }

  return image;
}
