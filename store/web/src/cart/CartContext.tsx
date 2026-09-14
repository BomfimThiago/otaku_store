import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { addToCart, ApiError, getCart, removeCartItem, updateCartItem } from '../api/client.js';
import type { AddToCartInput, Cart, CartItem } from '../api/types.js';

export interface CartContextValue {
  cart: Cart | null;
  items: CartItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  itemCount: number;
  loading: boolean;
  error: string | null;
  addItem: (input: AddToCartInput) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Erro ao carregar o carrinho';
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    getCart()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setCart(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(toErrorMessage(err));
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const result = await getCart();
      setCart(result);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  }, []);

  const addItem = useCallback(async (input: AddToCartInput) => {
    setError(null);
    try {
      const result = await addToCart(input);
      setCart(result);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  }, []);

  const updateItem = useCallback(async (itemId: string, quantity: number) => {
    setError(null);
    try {
      const result = await updateCartItem(itemId, { quantity });
      setCart(result);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    setError(null);
    try {
      await removeCartItem(itemId);
      const result = await getCart();
      setCart(result);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  }, []);

  const items = cart?.items ?? [];
  const subtotalCents = cart?.subtotalCents ?? 0;
  const discountCents = cart?.discountCents ?? 0;
  const totalCents = cart?.totalCents ?? 0;
  const itemCount = items.reduce((n, item) => n + item.quantity, 0);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      items,
      subtotalCents,
      discountCents,
      totalCents,
      itemCount,
      loading,
      error,
      addItem,
      updateItem,
      removeItem,
      refresh,
    }),
    [
      cart,
      items,
      subtotalCents,
      discountCents,
      totalCents,
      itemCount,
      loading,
      error,
      addItem,
      updateItem,
      removeItem,
      refresh,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (context === null) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
