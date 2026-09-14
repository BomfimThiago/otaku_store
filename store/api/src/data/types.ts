/**
 * Product catalog domain types. Types only — no runtime code lives in this
 * file. `api` does not depend on `@store/shared`, so `ProductKind` is a
 * local copy of the same plain string union used there.
 */

/** The subset of product kinds the catalog and pricing rules care about. */
export type ProductKind = 'figure' | 'other';

/** The fixed set of categories seeded in the MVP catalog. */
export type ProductCategory = 'Action Figures' | 'Mangás' | 'Vestuário' | 'Acessórios';

export interface ProductVariant {
  id: string;
  label: string;
  /** Non-negative integer amount of cents added on top of the base price. */
  priceDeltaCents: number;
}

export type Variant = ProductVariant;

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  kind: ProductKind;
  description: string;
  /** Non-negative integer amount of cents. */
  basePriceCents: number;
  images: string[];
  isLimitedEdition: boolean;
  variants: ProductVariant[];
}
