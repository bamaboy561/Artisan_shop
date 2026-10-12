export const MAX_CART_ITEM_QUANTITY = 999;

export type CartItem = { productSlug: string; quantity: number };

export function parseCart(raw: string | null): CartItem[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    const quantities = new Map<string, number>();
    for (const item of value) {
      if (
        !item ||
        typeof item.productSlug !== "string" ||
        !item.productSlug.trim() ||
        typeof item.quantity !== "number" ||
        !Number.isFinite(item.quantity) ||
        item.quantity < 1
      )
        continue;
      quantities.set(
        item.productSlug,
        Math.min(
          MAX_CART_ITEM_QUANTITY,
          (quantities.get(item.productSlug) ?? 0) + Math.floor(item.quantity),
        ),
      );
    }
    return Array.from(quantities, ([productSlug, quantity]) => ({
      productSlug,
      quantity,
    }));
  } catch {
    return [];
  }
}

export function appendCartItem(
  items: CartItem[],
  productSlug: string,
  quantity: number,
  stock: number | null,
): CartItem[] | null {
  if (!Number.isFinite(quantity) || quantity < 1) return null;
  const increment = Math.floor(quantity);
  const current =
    items.find((item) => item.productSlug === productSlug)?.quantity ?? 0;
  if (
    current + increment >
    Math.min(MAX_CART_ITEM_QUANTITY, stock ?? MAX_CART_ITEM_QUANTITY)
  )
    return null;
  return current
    ? items.map((item) =>
        item.productSlug === productSlug
          ? { ...item, quantity: current + increment }
          : item,
      )
    : [...items, { productSlug, quantity: increment }];
}
