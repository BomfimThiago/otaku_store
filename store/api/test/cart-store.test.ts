import { beforeEach, describe, expect, it } from 'vitest';

import { createCartStore, CartItemNotFoundError } from '../src/data/cart.js';
import type { CartStore } from '../src/data/cart.js';

function createIdGenerator(): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `item-${counter}`;
  };
}

describe('createCartStore', () => {
  let store: CartStore;

  beforeEach(() => {
    store = createCartStore({ generateId: createIdGenerator() });
  });

  describe('get', () => {
    it('returns an empty cart for an unknown cart id', () => {
      const cart = store.get('cart-1');

      expect(cart).toEqual({ id: 'cart-1', items: [] });
    });

    it('returns a copy whose items array can be mutated without affecting the store', () => {
      store.add('cart-1', { productId: 'p1', variantId: null });

      const cart = store.get('cart-1');
      cart.items.push({ id: 'item-x', productId: 'intruder', variantId: null, quantity: 1 });

      expect(store.get('cart-1').items).toHaveLength(1);
    });

    it('returns a copy whose item objects can be mutated without affecting the store', () => {
      store.add('cart-1', { productId: 'p1', variantId: null });

      const cart = store.get('cart-1');
      cart.items[0]!.quantity = 999;

      expect(store.get('cart-1').items[0]!.quantity).toBe(1);
    });
  });

  describe('add', () => {
    it('returns the created cart item and reflects it in get', () => {
      const created = store.add('cart-1', { productId: 'p1', variantId: 'v1', quantity: 2 });

      expect(created).toEqual({ id: 'item-1', productId: 'p1', variantId: 'v1', quantity: 2 });
      expect(store.get('cart-1')).toEqual({ id: 'cart-1', items: [created] });
    });

    it('defaults quantity to 1 when omitted', () => {
      const created = store.add('cart-1', { productId: 'p1', variantId: null });

      expect(created.quantity).toBe(1);
    });

    it('merges into the existing line when productId and variantId already match', () => {
      const first = store.add('cart-1', { productId: 'p1', variantId: 'v1', quantity: 2 });
      const second = store.add('cart-1', { productId: 'p1', variantId: 'v1', quantity: 3 });

      expect(second.id).toBe(first.id);
      expect(second.quantity).toBe(5);
      expect(store.get('cart-1').items).toHaveLength(1);
    });

    it('creates a separate line for the same productId with a different variantId', () => {
      store.add('cart-1', { productId: 'p1', variantId: null, quantity: 1 });
      store.add('cart-1', { productId: 'p1', variantId: 'v1', quantity: 1 });

      const cart = store.get('cart-1');
      expect(cart.items).toHaveLength(2);
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'throws RangeError for quantity %p and leaves the cart unchanged',
      (quantity) => {
        store.add('cart-1', { productId: 'p1', variantId: null, quantity: 1 });

        expect(() => store.add('cart-1', { productId: 'p2', variantId: null, quantity })).toThrow(RangeError);
        expect(store.get('cart-1').items).toHaveLength(1);
      },
    );

    it('generates distinct non-empty string ids when no generator is injected', () => {
      const defaultStore = createCartStore();

      const first = defaultStore.add('cart-1', { productId: 'p1', variantId: null });
      const second = defaultStore.add('cart-1', { productId: 'p2', variantId: null });

      expect(first.id).toEqual(expect.any(String));
      expect(second.id).toEqual(expect.any(String));
      expect(first.id).not.toBe('');
      expect(second.id).not.toBe('');
      expect(first.id).not.toBe(second.id);
    });
  });

  describe('updateQty', () => {
    it('sets the quantity of an existing item and returns the updated item', () => {
      const created = store.add('cart-1', { productId: 'p1', variantId: null, quantity: 2 });

      const updated = store.updateQty('cart-1', created.id, 5);

      expect(updated).toEqual({ ...created, quantity: 5 });
      expect(store.get('cart-1').items[0]!.quantity).toBe(5);
    });

    it.each([0, -1, 1.5])(
      'throws RangeError for quantity %p and leaves the item unchanged',
      (quantity) => {
        const created = store.add('cart-1', { productId: 'p1', variantId: null, quantity: 2 });

        expect(() => store.updateQty('cart-1', created.id, quantity)).toThrow(RangeError);
        expect(store.get('cart-1').items[0]!.quantity).toBe(2);
      },
    );

    it('throws CartItemNotFoundError with statusCode 404 and code CART_ITEM_NOT_FOUND for an unknown item id', () => {
      store.add('cart-1', { productId: 'p1', variantId: null });

      expect.assertions(3);
      try {
        store.updateQty('cart-1', 'missing-item', 1);
      } catch (error) {
        expect(error).toBeInstanceOf(CartItemNotFoundError);
        expect((error as CartItemNotFoundError).statusCode).toBe(404);
        expect((error as CartItemNotFoundError).code).toBe('CART_ITEM_NOT_FOUND');
      }
    });

    it('throws CartItemNotFoundError for an unknown cart id', () => {
      expect(() => store.updateQty('unknown-cart', 'item-1', 1)).toThrow(CartItemNotFoundError);
    });
  });

  describe('remove', () => {
    it('deletes the item so get no longer contains it, keeping other items', () => {
      const first = store.add('cart-1', { productId: 'p1', variantId: null });
      const second = store.add('cart-1', { productId: 'p2', variantId: null });

      store.remove('cart-1', first.id);

      expect(store.get('cart-1').items).toEqual([second]);
    });

    it('throws CartItemNotFoundError when removing the same id twice', () => {
      const created = store.add('cart-1', { productId: 'p1', variantId: null });

      store.remove('cart-1', created.id);

      expect(() => store.remove('cart-1', created.id)).toThrow(CartItemNotFoundError);
    });

    it('throws CartItemNotFoundError for an unknown item id', () => {
      store.add('cart-1', { productId: 'p1', variantId: null });

      expect(() => store.remove('cart-1', 'missing-item')).toThrow(CartItemNotFoundError);
    });

    it('throws CartItemNotFoundError for an unknown cart id', () => {
      expect(() => store.remove('unknown-cart', 'item-1')).toThrow(CartItemNotFoundError);
    });
  });

  describe('isolation', () => {
    it('keeps items added to one cart out of another', () => {
      store.add('cart-a', { productId: 'p1', variantId: null });

      expect(store.get('cart-b')).toEqual({ id: 'cart-b', items: [] });
    });

    it('throws CartItemNotFoundError when updateQty targets an item id from a different cart', () => {
      const created = store.add('cart-a', { productId: 'p1', variantId: null });

      expect(() => store.updateQty('cart-b', created.id, 2)).toThrow(CartItemNotFoundError);
    });

    it('throws CartItemNotFoundError when remove targets an item id from a different cart', () => {
      const created = store.add('cart-a', { productId: 'p1', variantId: null });

      expect(() => store.remove('cart-b', created.id)).toThrow(CartItemNotFoundError);
    });

    it('does not share state between two stores from createCartStore()', () => {
      const otherStore = createCartStore({ generateId: createIdGenerator() });

      store.add('cart-1', { productId: 'p1', variantId: null });

      expect(otherStore.get('cart-1')).toEqual({ id: 'cart-1', items: [] });
    });
  });
});
