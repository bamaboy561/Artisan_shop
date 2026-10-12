"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import type { FeaturedProduct } from "@/features/catalog/types";
import {
  appendPricedCartItems,
  type PricedCartItem,
} from "@/features/cart/reorder";
import {
  appendCartItem,
  MAX_CART_ITEM_QUANTITY,
  parseCart,
  type CartItem,
} from "@/features/cart/state";

export { MAX_CART_ITEM_QUANTITY } from "@/features/cart/state";
export type { CartItem } from "@/features/cart/state";
const STORAGE_KEY = "artisan-cart-v1";

type CartContextValue = {
  items: CartItem[];
  products: FeaturedProduct[];
  isLoading: boolean;
  error: string | null;
  refreshProducts: () => void;
  itemCount: number;
  beforeDiscountSubtotal: number;
  promotionDiscountTotal: number;
  subtotal: number;
  addItem: (productSlug: string, quantity?: number) => Promise<boolean>;
  addItems: (items: PricedCartItem[]) => Promise<boolean>;
  canAddItem: (productSlug?: string) => boolean;
  removeItem: (productSlug: string) => void;
  updateQuantity: (productSlug: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

async function fetchCartProducts(
  slugs: string[],
  signal?: AbortSignal,
): Promise<FeaturedProduct[]> {
  const products: FeaturedProduct[] = [];
  for (let index = 0; index < slugs.length; index += 100) {
    const response = await fetch("/api/cart/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs: slugs.slice(index, index + 100) }),
      cache: "no-store",
      signal,
    });
    if (!response.ok)
      throw new Error(
        "Не удалось обновить цены и остатки. Попробуйте ещё раз.",
      );
    const data = await response.json();
    if (!Array.isArray(data.products))
      throw new Error("Не удалось загрузить товары.");
    products.push(...data.products);
  }
  return products;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [items, setItems] = useState<CartItem[]>([]);
  const itemsRef = useRef<CartItem[]>([]);
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const inFlightAdds = useRef(new Map<string, Promise<FeaturedProduct[]>>());

  const commitItems = useCallback((next: CartItem[]) => {
    // Async additions read this ref so simultaneous buttons cannot exceed stock.
    itemsRef.current = next;
    setItems(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* Private browsing may disable storage. */
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let initial: CartItem[] = [];
      try {
        initial = parseCart(window.localStorage.getItem(STORAGE_KEY));
      } catch {
        /* Storage is optional. */
      }
      itemsRef.current = initial;
      setItems(initial);
      setIsRefreshing(initial.length > 0);
      setIsHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const slugs = itemsRef.current.map((item) => item.productSlug);
      setIsRefreshing(slugs.length > 0);
      setError(null);
      try {
        const fresh = await fetchCartProducts(slugs, controller.signal);
        if (!controller.signal.aborted) {
          setProducts((previous) => [
            ...previous.filter((product) => !slugs.includes(product.slug)),
            ...fresh,
          ]);
        }
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Не удалось загрузить корзину.",
          );
      } finally {
        if (!controller.signal.aborted) setIsRefreshing(false);
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isHydrated, pathname, revision]);

  const refreshProducts = useCallback(
    () => setRevision((value) => value + 1),
    [],
  );
  const clearCart = useCallback(() => commitItems([]), [commitItems]);

  const value = useMemo<CartContextValue>(() => {
    const totals = items.reduce(
      (sum, item) => {
        const product = products.find(
          (entry) => entry.slug === item.productSlug,
        );
        const finalPrice = product?.price ?? 0;
        const basePrice =
          product?.isPromotional && (product.oldPrice ?? 0) > finalPrice
            ? product.oldPrice!
            : finalPrice;
        return {
          beforeDiscountSubtotal:
            sum.beforeDiscountSubtotal + basePrice * item.quantity,
          subtotal: sum.subtotal + finalPrice * item.quantity,
        };
      },
      { beforeDiscountSubtotal: 0, subtotal: 0 },
    );

    return {
      items,
      products,
      error,
      refreshProducts,
      isLoading: !isHydrated || isRefreshing,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      ...totals,
      promotionDiscountTotal: Math.max(
        0,
        totals.beforeDiscountSubtotal - totals.subtotal,
      ),
      canAddItem: (slug) => {
        if (!slug || !isHydrated) return false;
        const product = products.find((entry) => entry.slug === slug);
        const quantity =
          items.find((item) => item.productSlug === slug)?.quantity ?? 0;
        return (
          quantity < MAX_CART_ITEM_QUANTITY &&
          (!product ||
            (product.purchaseMode === "cart" &&
              quantity < (product.stockQuantity ?? MAX_CART_ITEM_QUANTITY)))
        );
      },
      addItem: async (slug, quantity = 1) => {
        if (!isHydrated) return false;
        let request = inFlightAdds.current.get(slug);
        if (!request) {
          request = fetchCartProducts([slug]);
          inFlightAdds.current.set(slug, request);
        }
        let fresh: FeaturedProduct[];
        try {
          fresh = await request;
        } finally {
          inFlightAdds.current.delete(slug);
        }
        setProducts((previous) => [
          ...previous.filter((product) => product.slug !== slug),
          ...fresh,
        ]);
        const product = fresh.find((entry) => entry.slug === slug);
        if (!product || product.purchaseMode !== "cart") return false;
        const next = appendCartItem(
          itemsRef.current,
          slug,
          quantity,
          product.stockQuantity,
        );
        if (!next) return false;
        commitItems(next);
        return true;
      },
      addItems: async (additions) => {
        if (!isHydrated || !additions.length) return false;
        const slugs = [...new Set(additions.map((item) => item.productSlug))];
        const fresh = await fetchCartProducts(slugs);
        setProducts((previous) => [
          ...previous.filter((product) => !slugs.includes(product.slug)),
          ...fresh,
        ]);
        const next = appendPricedCartItems(itemsRef.current, additions, fresh);
        if (!next) return false;
        commitItems(next);
        return true;
      },
      removeItem: (slug) =>
        commitItems(
          itemsRef.current.filter((item) => item.productSlug !== slug),
        ),
      updateQuantity: (slug, quantity) => {
        if (!Number.isFinite(quantity)) return;
        const product = products.find((entry) => entry.slug === slug);
        if (!product || product.purchaseMode !== "cart") return;
        const maximum = Math.min(
          MAX_CART_ITEM_QUANTITY,
          product.stockQuantity ?? MAX_CART_ITEM_QUANTITY,
        );
        commitItems(
          itemsRef.current
            .map((item) =>
              item.productSlug === slug
                ? {
                    ...item,
                    quantity: Math.min(
                      maximum,
                      Math.max(0, Math.floor(quantity)),
                    ),
                  }
                : item,
            )
            .filter((item) => item.quantity > 0),
        );
      },
      clearCart,
    };
  }, [
    items,
    products,
    error,
    refreshProducts,
    isHydrated,
    isRefreshing,
    commitItems,
    clearCart,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
