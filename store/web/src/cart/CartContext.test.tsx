import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AddToCartInput, Cart } from '../api/types.js';
import { CartProvider, useCart } from './CartContext.js';

vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return {
    ...actual,
    getCart: vi.fn(),
    addToCart: vi.fn(),
    updateCartItem: vi.fn(),
    removeCartItem: vi.fn(),
  };
});

const { ApiError, addToCart, getCart, removeCartItem, updateCartItem } = await import('../api/client.js');

const baseCart: Cart = {
  id: 'cart-1',
  items: [
    {
      id: 'item-1',
      productId: 'prod-1',
      variantId: null,
      slug: 'katana-x',
      name: 'Katana X',
      unitPriceCents: 1000,
      quantity: 2,
      lineTotalCents: 2000,
    },
    {
      id: 'item-2',
      productId: 'prod-2',
      variantId: null,
      slug: 'mikubox',
      name: 'Miku Box',
      unitPriceCents: 1500,
      quantity: 3,
      lineTotalCents: 4500,
    },
  ],
  subtotalCents: 6500,
  discountCents: 0,
  totalCents: 6500,
};

describe('CartProvider / useCart', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('starts loading and then exposes the fetched cart', async () => {
    vi.mocked(getCart).mockResolvedValue(baseCart);

    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(getCart).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toEqual(baseCart.items);
    expect(result.current.subtotalCents).toBe(baseCart.subtotalCents);
    expect(result.current.discountCents).toBe(baseCart.discountCents);
    expect(result.current.totalCents).toBe(baseCart.totalCents);
    expect(result.current.itemCount).toBe(5);
    expect(result.current.error).toBeNull();
  });

  it('addItem calls addToCart with the input and reflects the returned cart', async () => {
    vi.mocked(getCart).mockResolvedValue(baseCart);
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updatedCart: Cart = {
      ...baseCart,
      items: [
        ...baseCart.items,
        {
          id: 'item-3',
          productId: 'prod-3',
          variantId: null,
          slug: 'figure-z',
          name: 'Figure Z',
          unitPriceCents: 2000,
          quantity: 1,
          lineTotalCents: 2000,
        },
      ],
      subtotalCents: 8500,
      totalCents: 8500,
    };
    vi.mocked(addToCart).mockResolvedValue(updatedCart);

    const input: AddToCartInput = { productId: 'prod-3', quantity: 1 };
    await act(async () => {
      await result.current.addItem(input);
    });

    expect(addToCart).toHaveBeenCalledWith(input);
    expect(result.current.items).toEqual(updatedCart.items);
    expect(result.current.subtotalCents).toBe(updatedCart.subtotalCents);
    expect(result.current.totalCents).toBe(updatedCart.totalCents);
  });

  it('updateItem calls updateCartItem with the quantity and reflects the returned cart', async () => {
    vi.mocked(getCart).mockResolvedValue(baseCart);
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updatedCart: Cart = {
      ...baseCart,
      items: [
        { ...baseCart.items[0]!, quantity: 4, lineTotalCents: 4000 },
        baseCart.items[1]!,
      ],
      subtotalCents: 8500,
      totalCents: 8500,
    };
    vi.mocked(updateCartItem).mockResolvedValue(updatedCart);

    await act(async () => {
      await result.current.updateItem('item-1', 4);
    });

    expect(updateCartItem).toHaveBeenCalledWith('item-1', { quantity: 4 });
    expect(result.current.items).toEqual(updatedCart.items);
  });

  it('removeItem calls removeCartItem and then refetches via getCart', async () => {
    vi.mocked(getCart).mockResolvedValueOnce(baseCart);
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.mocked(removeCartItem).mockResolvedValue(undefined);
    const refetchedCart: Cart = {
      ...baseCart,
      items: [baseCart.items[0]!],
      subtotalCents: 2000,
      totalCents: 2000,
    };
    vi.mocked(getCart).mockResolvedValueOnce(refetchedCart);

    await act(async () => {
      await result.current.removeItem('item-2');
    });

    expect(removeCartItem).toHaveBeenCalledWith('item-2');
    expect(getCart).toHaveBeenCalledTimes(2);
    expect(result.current.items).toEqual(refetchedCart.items);
  });

  it('sets an error message and empties the cart when getCart rejects with an ApiError', async () => {
    const apiError = new ApiError(500, 'Internal', 'Erro interno do servidor');
    vi.mocked(getCart).mockRejectedValue(apiError);

    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Erro interno do servidor');
    expect(result.current.items).toEqual([]);
    expect(result.current.itemCount).toBe(0);
  });

  it('sets an error and keeps the previous items when addToCart rejects, without throwing', async () => {
    vi.mocked(getCart).mockResolvedValue(baseCart);
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const apiError = new ApiError(400, 'BadRequest', 'Estoque insuficiente');
    vi.mocked(addToCart).mockRejectedValue(apiError);

    await act(async () => {
      await result.current.addItem({ productId: 'prod-1', quantity: 1 });
    });

    expect(result.current.error).toBe('Estoque insuficiente');
    expect(result.current.items).toEqual(baseCart.items);
  });

  it('throws a descriptive error when used outside a CartProvider', () => {
    expect(() => renderHook(() => useCart())).toThrow(
      'useCart must be used within a CartProvider',
    );
  });
});
