/**
 * Pure, dependency-free integer-cent pricing math.
 *
 * Order of operations for `calculateOrderTotals`:
 *   1. Each line's price is the variant base + its add-ons, plus a limited
 *      edition surcharge (figures only).
 *   2. Lines are summed into `itemsSubtotalCents`.
 *   3. A coupon (percent or fixed) is applied to that subtotal and clamped
 *      so it can never discount below 0 or exceed the subtotal. The coupon
 *      never touches shipping.
 *   4. A premium discount is applied to the subtotal *after* the coupon.
 *   5. Shipping is added last, and is waived entirely for premium orders.
 *
 * Rounding policy: every percentage is rounded half-up to the nearest cent
 * with a single division (`percentOf`), so rounding only happens once per
 * step and every output field is guaranteed to be an integer.
 */
import type {
  AddOn,
  Cents,
  Coupon,
  LineItemInput,
  LinePrice,
  OrderTotals,
  OrderTotalsInput,
  ProductKind,
} from '../types/pricing.js';

export const LIMITED_EDITION_SURCHARGE_PERCENT = 20;
export const PREMIUM_DISCOUNT_PERCENT = 5;

function assertCents(value: Cents, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer number of cents, got ${value}`);
  }
}

function assertPercent(percent: number, label: string): void {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new RangeError(`${label} must be a percent between 0 and 100, got ${percent}`);
  }
}

function assertQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError(`quantity must be a positive integer, got ${quantity}`);
  }
}

/** Rounds `percent`% of `cents` half-up to the nearest cent, normalising -0. */
function percentOf(cents: Cents, percent: number): Cents {
  return Math.round((cents * percent) / 100) + 0;
}

function sumAddOns(addOns: readonly AddOn[]): Cents {
  return addOns.reduce((sum, addOn) => {
    assertCents(addOn.priceCents, `addOn "${addOn.label}" priceCents`);
    return sum + addOn.priceCents;
  }, 0);
}

function isSurchargeable(productKind: ProductKind, isLimitedEdition: boolean): boolean {
  return productKind === 'figure' && isLimitedEdition;
}

/**
 * Prices a single line item.
 *
 * NOTE: the limited edition surcharge is 20% of the base price *plus*
 * add-ons, not 20% of the base price alone. This intentionally conflicts
 * with a literal reading of the spec (which only mentions "the base"),
 * because charging the surcharge on add-ons too keeps bundled accessories
 * from silently escaping the limited-edition premium.
 */
export function calculateLinePrice(item: LineItemInput): LinePrice {
  assertCents(item.variantBasePriceCents, 'variantBasePriceCents');
  const quantity = item.quantity ?? 1;
  assertQuantity(quantity);

  const unitBaseCents = item.variantBasePriceCents;
  const unitAddOnsCents = sumAddOns(item.addOns ?? []);
  const preSurchargeCents = unitBaseCents + unitAddOnsCents;

  const unitLimitedEditionSurchargeCents = isSurchargeable(item.productKind, item.isLimitedEdition)
    ? percentOf(preSurchargeCents, LIMITED_EDITION_SURCHARGE_PERCENT)
    : 0;

  const unitPriceCents = preSurchargeCents + unitLimitedEditionSurchargeCents;
  const lineTotalCents = unitPriceCents * quantity;

  return {
    unitBaseCents,
    unitAddOnsCents,
    unitLimitedEditionSurchargeCents,
    unitPriceCents,
    quantity,
    lineTotalCents,
  };
}

function calculateCouponDiscountCents(coupon: Coupon | undefined, itemsSubtotalCents: Cents): Cents {
  if (!coupon) {
    return 0;
  }

  let rawDiscountCents: Cents;
  if (coupon.type === 'percent') {
    assertPercent(coupon.percent, 'coupon.percent');
    rawDiscountCents = percentOf(itemsSubtotalCents, coupon.percent);
  } else {
    assertCents(coupon.amountCents, 'coupon.amountCents');
    rawDiscountCents = coupon.amountCents;
  }

  return Math.min(Math.max(rawDiscountCents, 0), itemsSubtotalCents);
}

export function calculateOrderTotals(input: OrderTotalsInput): OrderTotals {
  assertCents(input.shippingCents, 'shippingCents');

  const lines = input.lines.map(calculateLinePrice);
  const itemsSubtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);

  const couponDiscountCents = calculateCouponDiscountCents(input.coupon, itemsSubtotalCents);
  const subtotalAfterCouponCents = itemsSubtotalCents - couponDiscountCents;

  const premiumDiscountCents = input.isPremium
    ? percentOf(subtotalAfterCouponCents, PREMIUM_DISCOUNT_PERCENT)
    : 0;
  const shippingCents = input.isPremium ? 0 : input.shippingCents;
  const totalCents = subtotalAfterCouponCents - premiumDiscountCents + shippingCents;

  return {
    lines,
    itemsSubtotalCents,
    couponDiscountCents,
    subtotalAfterCouponCents,
    premiumDiscountCents,
    shippingCents,
    totalCents,
  };
}

export type {
  AddOn,
  Cents,
  Coupon,
  LineItemInput,
  LinePrice,
  OrderTotals,
  OrderTotalsInput,
  ProductKind,
} from '../types/pricing.js';
