// Mirrors the shared pricing convention (see store/shared/src/types/pricing.ts):
// money is always represented in integer cents. Kept local to avoid a
// cross-workspace build dependency from `web` onto `shared`.
type Cents = number;

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  priceCents: Cents;
  imageUrl: string;
  stock: number;
}

export interface ProductListParams {
  category?: string;
  q?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  unitPriceCents: Cents;
  quantity: number;
  lineTotalCents: Cents;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotalCents: Cents;
  discountCents: Cents;
  totalCents: Cents;
}

export interface AddToCartInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface UpdateCartItemInput {
  quantity: number;
}

// Matches the error body shape sent by api/src/plugins/errors.ts.
export interface ApiErrorBody {
  error: string;
  message: string;
  statusCode: number;
  details?: { path: string; code: string; message: string }[];
}
