/**
 * In-memory cart store.
 *
 * Rules:
 *  - Carts are keyed by an opaque `cartId`. `get` on an unknown cart id
 *    returns an empty cart ({ id, items: [] }) and does not create one.
 *  - `add` merges into an existing line when `productId` and `variantId`
 *    (strict equality, so `null` and a string never merge) already match;
 *    otherwise it creates a new line.
 *  - Quantities must always be positive integers. Invalid quantities throw
 *    a `RangeError` and never mutate the store — there is no
 *    remove-on-zero behaviour.
 *  - Operating on an unknown item id (or an item id from a different cart)
 *    throws `CartItemNotFoundError`.
 *  - Every value returned to callers (`get`, `add`, `updateQty`) is a copy,
 *    so mutating it can never affect the store.
 *  - This module has no notion of price or stock — that arrives with API-7.
 */
import { randomUUID } from 'node:crypto';

export interface CartItem {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
}

export interface AddCartItemInput {
  productId: string;
  variantId: string | null;
  quantity?: number;
}

export interface CartStoreOptions {
  generateId?: () => string;
}

export interface CartStore {
  get(cartId: string): Cart;
  add(cartId: string, input: AddCartItemInput): CartItem;
  updateQty(cartId: string, itemId: string, quantity: number): CartItem;
  remove(cartId: string, itemId: string): void;
}

export class CartItemNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'CART_ITEM_NOT_FOUND';

  constructor(cartId: string, itemId: string) {
    super(`Item "${itemId}" was not found in cart "${cartId}"`);
    this.name = 'CartItemNotFoundError';
  }
}

function assertQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError(`quantity must be a positive integer, got ${quantity}`);
  }
}

function copyItem(item: CartItem): CartItem {
  return { ...item };
}

export function createCartStore(options: CartStoreOptions = {}): CartStore {
  const generateId = options.generateId ?? randomUUID;
  const carts = new Map<string, CartItem[]>();

  function findItem(cartId: string, itemId: string): CartItem {
    const items = carts.get(cartId);
    const item = items?.find((candidate) => candidate.id === itemId);
    if (!item) {
      throw new CartItemNotFoundError(cartId, itemId);
    }
    return item;
  }

  return {
    get(cartId) {
      const items = carts.get(cartId) ?? [];
      return { id: cartId, items: items.map(copyItem) };
    },

    add(cartId, input) {
      const quantity = input.quantity ?? 1;
      assertQuantity(quantity);

      let items = carts.get(cartId);
      if (!items) {
        items = [];
        carts.set(cartId, items);
      }

      const existing = items.find(
        (item) => item.productId === input.productId && item.variantId === input.variantId,
      );

      if (existing) {
        const mergedQuantity = existing.quantity + quantity;
        assertQuantity(mergedQuantity);
        existing.quantity = mergedQuantity;
        return copyItem(existing);
      }

      const created: CartItem = {
        id: generateId(),
        productId: input.productId,
        variantId: input.variantId,
        quantity,
      };
      items.push(created);
      return copyItem(created);
    },

    updateQty(cartId, itemId, quantity) {
      assertQuantity(quantity);
      const item = findItem(cartId, itemId);
      item.quantity = quantity;
      return copyItem(item);
    },

    remove(cartId, itemId) {
      const items = carts.get(cartId);
      const index = items?.findIndex((item) => item.id === itemId) ?? -1;
      if (!items || index === -1) {
        throw new CartItemNotFoundError(cartId, itemId);
      }
      items.splice(index, 1);
    },
  };
}
