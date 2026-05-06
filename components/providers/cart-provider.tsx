"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { catalogProducts } from "@/features/catalog/data";

const STORAGE_KEY = "artisan-cart-v1";

export type CartItem = {
  productSlug: string;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (productSlug: string, quantity?: number) => void;
  removeItem: (productSlug: string) => void;
  updateQuantity: (productSlug: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readInitialCart(): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item.quantity > 0)
      : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readInitialCart);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => {
      const product = catalogProducts.find((p) => p.slug === item.productSlug);
      return (
        sum +
        (typeof product?.price === "number" ? product.price * item.quantity : 0)
      );
    }, 0);

    return {
      items,
      itemCount,
      subtotal,
      addItem: (productSlug, quantity = 1) => {
        setItems((prev) => {
          const product = catalogProducts.find(
            (item) => item.slug === productSlug,
          );

          if (!product || typeof product.price !== "number") {
            return prev;
          }

          const existing = prev.find(
            (item) => item.productSlug === productSlug,
          );

          if (existing) {
            return prev.map((item) =>
              item.productSlug === productSlug
                ? { ...item, quantity: item.quantity + quantity }
                : item,
            );
          }

          return [...prev, { productSlug, quantity }];
        });
      },
      removeItem: (productSlug) => {
        setItems((prev) =>
          prev.filter((item) => item.productSlug !== productSlug),
        );
      },
      updateQuantity: (productSlug, quantity) => {
        setItems((prev) =>
          prev
            .map((item) =>
              item.productSlug === productSlug
                ? { ...item, quantity: Math.max(0, quantity) }
                : item,
            )
            .filter((item) => item.quantity > 0),
        );
      },
      clearCart: () => setItems([]),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
