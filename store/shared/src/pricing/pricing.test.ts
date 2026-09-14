import { describe, expect, it, test } from 'vitest';

import { calculateLinePrice, calculateOrderTotals } from './index.js';
import type { LineItemInput, OrderTotalsInput } from '../types/pricing.js';

const figureLine = (overrides: Partial<LineItemInput> = {}): LineItemInput => ({
  variantBasePriceCents: 10000,
  productKind: 'figure',
  isLimitedEdition: false,
  ...overrides,
});

describe('calculateLinePrice — (a) base + add-ons', () => {
  it('sums the base price and every add-on into the unit price', () => {
    const result = calculateLinePrice(
      figureLine({
        variantBasePriceCents: 10000,
        addOns: [
          { label: 'Gift wrap', priceCents: 1500 },
          { label: 'Charm', priceCents: 500 },
        ],
      }),
    );

    expect(result.unitBaseCents).toBe(10000);
    expect(result.unitAddOnsCents).toBe(2000);
    expect(result.unitPriceCents).toBe(12000);
    expect(result.lineTotalCents).toBe(12000);
  });

  it('returns the base price unchanged when there are no add-ons', () => {
    const result = calculateLinePrice(figureLine({ variantBasePriceCents: 10000 }));

    expect(result.unitAddOnsCents).toBe(0);
    expect(result.unitPriceCents).toBe(10000);
  });

  it('multiplies the rounded unit price by quantity', () => {
    const result = calculateLinePrice(
      figureLine({ variantBasePriceCents: 10000, quantity: 3 }),
    );

    expect(result.quantity).toBe(3);
    expect(result.unitPriceCents).toBe(10000);
    expect(result.lineTotalCents).toBe(30000);
  });
});

describe('calculateLinePrice — (b) limited edition surcharge', () => {
  // Pins the surcharge to 20% of (base + add-ons), not 20% of the base
  // alone. See the doc comment on calculateLinePrice for why this
  // intentionally reads differently than a literal "20% of the base" spec.
  it('applies a 20% surcharge on base + add-ons for a limited edition figure', () => {
    const result = calculateLinePrice(
      figureLine({
        variantBasePriceCents: 10000,
        addOns: [{ label: 'Stand', priceCents: 2000 }],
        isLimitedEdition: true,
      }),
    );

    expect(result.unitLimitedEditionSurchargeCents).toBe(2400);
    expect(result.unitPriceCents).toBe(14400);
  });

  it('does not surcharge a limited edition item that is not a figure', () => {
    const result = calculateLinePrice(
      figureLine({
        productKind: 'other',
        isLimitedEdition: true,
        addOns: [{ label: 'Stand', priceCents: 2000 }],
      }),
    );

    expect(result.unitLimitedEditionSurchargeCents).toBe(0);
    expect(result.unitPriceCents).toBe(12000);
  });

  it('does not surcharge a non-limited figure', () => {
    const result = calculateLinePrice(figureLine({ isLimitedEdition: false }));

    expect(result.unitLimitedEditionSurchargeCents).toBe(0);
    expect(result.unitPriceCents).toBe(10000);
  });
});

describe('calculateOrderTotals — (c) coupon', () => {
  const baseInput = (overrides: Partial<OrderTotalsInput> = {}): OrderTotalsInput => ({
    lines: [figureLine({ variantBasePriceCents: 20000 })],
    isPremium: false,
    shippingCents: 0,
    ...overrides,
  });

  it('discounts 10% of the items subtotal', () => {
    const result = calculateOrderTotals(
      baseInput({ coupon: { type: 'percent', percent: 10 } }),
    );

    expect(result.itemsSubtotalCents).toBe(20000);
    expect(result.couponDiscountCents).toBe(2000);
    expect(result.subtotalAfterCouponCents).toBe(18000);
  });

  it('discounts a fixed amount', () => {
    const result = calculateOrderTotals(
      baseInput({ coupon: { type: 'fixed', amountCents: 1500 } }),
    );

    expect(result.couponDiscountCents).toBe(1500);
    expect(result.subtotalAfterCouponCents).toBe(18500);
  });

  it('never discounts shipping, even with a 100% coupon', () => {
    const result = calculateOrderTotals(
      baseInput({
        shippingCents: 1000,
        coupon: { type: 'percent', percent: 100 },
      }),
    );

    expect(result.totalCents).toBe(1000);
  });

  it('clamps a fixed coupon larger than the subtotal to the subtotal', () => {
    const result = calculateOrderTotals(
      baseInput({ coupon: { type: 'fixed', amountCents: 999999 } }),
    );

    expect(result.couponDiscountCents).toBe(20000);
    expect(result.subtotalAfterCouponCents).toBe(0);
    expect(Object.is(result.subtotalAfterCouponCents, -0)).toBe(false);
  });

  it('applies no discount for a 0% coupon', () => {
    const result = calculateOrderTotals(
      baseInput({ coupon: { type: 'percent', percent: 0 } }),
    );

    expect(result.couponDiscountCents).toBe(0);
  });

  it('applies no discount when there is no coupon', () => {
    const result = calculateOrderTotals(baseInput());

    expect(result.couponDiscountCents).toBe(0);
  });
});

describe('calculateOrderTotals — (d) premium discount', () => {
  const baseInput = (overrides: Partial<OrderTotalsInput> = {}): OrderTotalsInput => ({
    lines: [figureLine({ variantBasePriceCents: 20000 })],
    isPremium: true,
    shippingCents: 0,
    ...overrides,
  });

  it('discounts 5% of the subtotal when there is no coupon', () => {
    const result = calculateOrderTotals(baseInput());

    expect(result.premiumDiscountCents).toBe(1000);
    expect(result.totalCents).toBe(19000);
  });

  it('applies the premium discount after the coupon discount', () => {
    const result = calculateOrderTotals(
      baseInput({ coupon: { type: 'percent', percent: 10 } }),
    );

    expect(result.subtotalAfterCouponCents).toBe(18000);
    expect(result.premiumDiscountCents).toBe(900);
    expect(result.totalCents).toBe(17100);
  });

  it('applies no premium discount once the coupon clamps the subtotal to 0', () => {
    const result = calculateOrderTotals(
      baseInput({ coupon: { type: 'fixed', amountCents: 999999 } }),
    );

    expect(result.subtotalAfterCouponCents).toBe(0);
    expect(result.premiumDiscountCents).toBe(0);
  });
});

describe('calculateOrderTotals — (e) shipping', () => {
  it('adds shipping last for a non-premium order', () => {
    const result = calculateOrderTotals({
      lines: [figureLine({ variantBasePriceCents: 20000 })],
      isPremium: false,
      shippingCents: 700,
    });

    expect(result.shippingCents).toBe(700);
    expect(result.totalCents).toBe(20700);
  });

  it('waives shipping entirely for a premium order', () => {
    const result = calculateOrderTotals({
      lines: [figureLine({ variantBasePriceCents: 20000 })],
      isPremium: true,
      shippingCents: 700,
    });

    expect(result.shippingCents).toBe(0);
  });

  it('totals to just the shipping cost for an empty non-premium order', () => {
    const result = calculateOrderTotals({ lines: [], isPremium: false, shippingCents: 700 });

    expect(result.itemsSubtotalCents).toBe(0);
    expect(result.totalCents).toBe(700);
  });

  it('totals to 0 for an empty premium order', () => {
    const result = calculateOrderTotals({ lines: [], isPremium: true, shippingCents: 700 });

    expect(result.totalCents).toBe(0);
  });
});

describe('calculateLinePrice / calculateOrderTotals — (f) integer cents and rounding', () => {
  test.each([
    { cents: 1003, expectedSurcharge: 201 },
  ])('rounds a 20% limited edition surcharge on $cents half-up to $expectedSurcharge', ({ cents, expectedSurcharge }) => {
    const result = calculateLinePrice(
      figureLine({ variantBasePriceCents: cents, isLimitedEdition: true }),
    );

    expect(result.unitLimitedEditionSurchargeCents).toBe(expectedSurcharge);
  });

  test.each([
    { subtotal: 1010, expectedDiscount: 51 },
  ])('rounds a 5% premium discount on $subtotal half-up to $expectedDiscount', ({ subtotal, expectedDiscount }) => {
    const result = calculateOrderTotals({
      lines: [figureLine({ variantBasePriceCents: subtotal })],
      isPremium: true,
      shippingCents: 0,
    });

    expect(result.premiumDiscountCents).toBe(expectedDiscount);
  });

  test.each([
    { subtotal: 1005, expectedDiscount: 101 },
  ])('rounds a 10% coupon discount on $subtotal half-up to $expectedDiscount', ({ subtotal, expectedDiscount }) => {
    const result = calculateOrderTotals({
      lines: [figureLine({ variantBasePriceCents: subtotal })],
      isPremium: false,
      shippingCents: 0,
      coupon: { type: 'percent', percent: 10 },
    });

    expect(result.couponDiscountCents).toBe(expectedDiscount);
  });

  it('produces only integer fields on line prices and order totals', () => {
    const order = calculateOrderTotals({
      lines: [
        figureLine({
          variantBasePriceCents: 1003,
          addOns: [{ label: 'Charm', priceCents: 7 }],
          isLimitedEdition: true,
          quantity: 3,
        }),
      ],
      isPremium: true,
      shippingCents: 700,
      coupon: { type: 'percent', percent: 10 },
    });

    const line = order.lines[0]!;
    expect(Number.isInteger(line.unitBaseCents)).toBe(true);
    expect(Number.isInteger(line.unitAddOnsCents)).toBe(true);
    expect(Number.isInteger(line.unitLimitedEditionSurchargeCents)).toBe(true);
    expect(Number.isInteger(line.unitPriceCents)).toBe(true);
    expect(Number.isInteger(line.lineTotalCents)).toBe(true);
    expect(Number.isInteger(order.itemsSubtotalCents)).toBe(true);
    expect(Number.isInteger(order.couponDiscountCents)).toBe(true);
    expect(Number.isInteger(order.subtotalAfterCouponCents)).toBe(true);
    expect(Number.isInteger(order.premiumDiscountCents)).toBe(true);
    expect(Number.isInteger(order.shippingCents)).toBe(true);
    expect(Number.isInteger(order.totalCents)).toBe(true);
  });

  it('rejects a non-integer cents value', () => {
    expect(() => calculateLinePrice(figureLine({ variantBasePriceCents: 100.5 }))).toThrow(RangeError);
  });

  it('rejects a negative cents value', () => {
    expect(() => calculateLinePrice(figureLine({ variantBasePriceCents: -100 }))).toThrow(RangeError);
  });

  it('rejects a coupon percent below 0', () => {
    expect(() =>
      calculateOrderTotals({
        lines: [figureLine()],
        isPremium: false,
        shippingCents: 0,
        coupon: { type: 'percent', percent: -1 },
      }),
    ).toThrow(RangeError);
  });

  it('rejects a coupon percent above 100', () => {
    expect(() =>
      calculateOrderTotals({
        lines: [figureLine()],
        isPremium: false,
        shippingCents: 0,
        coupon: { type: 'percent', percent: 101 },
      }),
    ).toThrow(RangeError);
  });

  it('rejects a quantity that is not a positive integer', () => {
    expect(() => calculateLinePrice(figureLine({ quantity: 0 }))).toThrow(RangeError);
    expect(() => calculateLinePrice(figureLine({ quantity: 1.5 }))).toThrow(RangeError);
  });
});
