/**
 * Pricing domain types. Types only — no runtime code lives in this file.
 */

/** A non-negative integer amount of cents. */
export type Cents = number;

/**
 * The subset of product kinds that pricing rules care about. Deliberately a
 * plain string union (not derived from Prisma) so this package stays free of
 * a database dependency.
 */
export type ProductKind = 'figure' | 'other';

export type AddOn = {
  label: string;
  priceCents: Cents;
};

export type LineItemInput = {
  variantBasePriceCents: Cents;
  addOns?: readonly AddOn[];
  productKind: ProductKind;
  isLimitedEdition: boolean;
  quantity?: number;
};

export type LinePrice = {
  unitBaseCents: Cents;
  unitAddOnsCents: Cents;
  unitLimitedEditionSurchargeCents: Cents;
  unitPriceCents: Cents;
  quantity: number;
  lineTotalCents: Cents;
};

export type Coupon =
  | { type: 'percent'; percent: number }
  | { type: 'fixed'; amountCents: Cents };

export type OrderTotalsInput = {
  lines: readonly LineItemInput[];
  coupon?: Coupon;
  isPremium: boolean;
  shippingCents: Cents;
};

export type OrderTotals = {
  lines: LinePrice[];
  itemsSubtotalCents: Cents;
  couponDiscountCents: Cents;
  subtotalAfterCouponCents: Cents;
  premiumDiscountCents: Cents;
  shippingCents: Cents;
  totalCents: Cents;
};
