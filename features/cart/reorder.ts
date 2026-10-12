import type { FeaturedProduct } from "@/features/catalog/types";
import { appendCartItem, MAX_CART_ITEM_QUANTITY, type CartItem } from "./state";

export type ReorderItem = {
  productSlug: string | null;
  name: string;
  quantity: number;
};
export type PricedCartItem = CartItem & { unitPrice: number };
export type ReorderProduct = Pick<
  FeaturedProduct,
  | "slug"
  | "name"
  | "sku"
  | "image"
  | "price"
  | "stockQuantity"
  | "inStock"
  | "purchaseMode"
>;
export type ReorderData = { items: ReorderItem[]; products: ReorderProduct[] };
export type ReorderResult =
  | { data: ReorderData; error?: never }
  | { error: string; data?: never };

export function planReorder(
  items: ReorderItem[],
  products: ReorderProduct[],
  cart: CartItem[],
) {
  const grouped = new Map<string, ReorderItem>();
  items.forEach((item, index) => {
    const key = item.productSlug ?? `missing:${index}`;
    const previous = grouped.get(key);
    grouped.set(key, {
      ...item,
      quantity:
        Number.isSafeInteger(item.quantity) && item.quantity > 0
          ? item.quantity + (previous?.quantity ?? 0)
          : NaN,
    });
  });
  return [...grouped.values()].map((item) => {
    const product = products.find((entry) => entry.slug === item.productSlug);
    const alreadyInCart =
      cart.find((entry) => entry.productSlug === item.productSlug)?.quantity ??
      0;
    const validQuantity =
      Number.isSafeInteger(item.quantity) && item.quantity > 0;
    const purchasable =
      product?.purchaseMode === "cart" &&
      product.inStock &&
      typeof product.price === "number" &&
      Number.isFinite(product.price) &&
      product.price >= 0;
    const stock = product?.stockQuantity ?? MAX_CART_ITEM_QUANTITY;
    const capacity =
      product && purchasable && Number.isFinite(stock)
        ? Math.max(
            0,
            Math.min(MAX_CART_ITEM_QUANTITY, Math.floor(stock)) - alreadyInCart,
          )
        : 0;
    const quantity = validQuantity ? Math.min(item.quantity, capacity) : 0;
    return {
      ...item,
      product,
      quantity,
      requestedQuantity: item.quantity,
      alreadyInCart,
      note: !validQuantity
        ? "Количество требует уточнения у менеджера"
        : !purchasable
          ? "Недоступен для покупки"
          : quantity === 0
            ? alreadyInCart > 0
              ? "Доступный остаток уже в корзине"
              : "Нет в наличии"
            : quantity < item.quantity
              ? `Доступно к добавлению: ${quantity} из ${item.quantity} шт.`
              : null,
    };
  });
}

// Validate the whole addition before committing so failures cannot leave a partial cart.
export function appendPricedCartItems(
  cart: CartItem[],
  additions: PricedCartItem[],
  products: ReorderProduct[],
) {
  if (!additions.length) return null;
  let next = cart;
  for (const item of additions) {
    const product = products.find((entry) => entry.slug === item.productSlug);
    if (
      !product ||
      product.purchaseMode !== "cart" ||
      !product.inStock ||
      typeof product.price !== "number" ||
      !Number.isFinite(product.price) ||
      product.price < 0 ||
      (product.stockQuantity !== null &&
        !Number.isFinite(product.stockQuantity)) ||
      product.price !== item.unitPrice ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0
    )
      return null;
    const merged = appendCartItem(
      next,
      item.productSlug,
      item.quantity,
      product.stockQuantity,
    );
    if (!merged) return null;
    next = merged;
  }
  return next;
}
