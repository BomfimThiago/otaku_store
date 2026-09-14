/**
 * Product image URL. The seeded catalog references local image paths that are
 * not shipped, so we render reliable, on-brand placeholders that always load.
 */
export function productImage(name: string): string {
  return `https://placehold.co/600x600/17142a/22e4ff?text=${encodeURIComponent(name)}`;
}
