import { MAX_CART_ITEM_QUANTITY } from "@/features/cart/state";

export function getQuickPurchaseLimit(
  stock: number | null,
  inStock: boolean,
  inCart: number,
): number {
  if (!inStock || (stock !== null && !Number.isFinite(stock))) return 0;
  const maximum = Math.max(
    0,
    Math.min(
      MAX_CART_ITEM_QUANTITY,
      Math.floor(stock ?? MAX_CART_ITEM_QUANTITY),
    ),
  );
  return Math.max(0, maximum - Math.max(0, Math.floor(inCart)));
}
