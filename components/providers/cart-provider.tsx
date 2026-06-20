"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { FeaturedProduct } from "@/features/catalog/types";

const STORAGE_KEY = "artisan-cart-v1";

export type CartItem = {
  productSlug: string;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (productSlug: string, quantity?: number) => boolean;
  canAddItem: (productSlug?: string) => boolean;
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

export function CartProvider({
  children,
  products,
}: {
  children: ReactNode;
  products: FeaturedProduct[];
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setItems(readInitialCart());
      setIsHydrated(true);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [isHydrated, items]);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => {
      const product = products.find((p) => p.slug === item.productSlug);
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
        const found = products.find((item) => item.slug === productSlug);

        if (!found) {
          return false;
        }

        const safeQuantity = Math.max(1, Math.floor(quantity || 1));

        setItems((prev) => {
          const existing = prev.find(
            (item) => item.productSlug === productSlug,
          );

          if (existing) {
            return prev.map((item) =>
              item.productSlug === productSlug
                ? { ...item, quantity: item.quantity + safeQuantity }
                : item,
            );
          }

          return [...prev, { productSlug, quantity: safeQuantity }];
        });

        return true;
      },
      canAddItem: (productSlug) => {
        if (!productSlug) {
          return false;
        }

        return products.some((item) => item.slug === productSlug);
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
      clearCart: () => setItems((prev) => (prev.length > 0 ? [] : prev)),
    };
  }, [items, products]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
