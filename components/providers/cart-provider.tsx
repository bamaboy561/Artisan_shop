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

export function CartProvider({
  children,
  products,
}: {
  children: ReactNode;
  products: FeaturedProduct[];
}) {
  const [items, setItems] = useState<CartItem[]>(readInitialCart);

  const purchasableSlugs = useMemo(
    () =>
      new Set(
        products
          .filter(
            (product) =>
              product.purchaseMode === "cart" &&
              typeof product.price === "number" &&
              product.price > 0,
          )
          .map((product) => product.slug),
      ),
    [products],
  );
  const validItems = useMemo(
    () =>
      items.filter(
        (item) => item.quantity > 0 && purchasableSlugs.has(item.productSlug),
      ),
    [items, purchasableSlugs],
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validItems));
  }, [validItems]);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = validItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = validItems.reduce((sum, item) => {
      const product = products.find((p) => p.slug === item.productSlug);
      return (
        sum +
        (typeof product?.price === "number" ? product.price * item.quantity : 0)
      );
    }, 0);

    return {
      items: validItems,
      itemCount,
      subtotal,
      addItem: (productSlug, quantity = 1) => {
        setItems((prev) => {
          const found = products.find(
            (item) => item.slug === productSlug,
          );

          if (
            !found ||
            found.purchaseMode !== "cart" ||
            typeof found.price !== "number" ||
            found.price <= 0
          ) {
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
      clearCart: () => setItems((prev) => (prev.length > 0 ? [] : prev)),
    };
  }, [products, validItems]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
