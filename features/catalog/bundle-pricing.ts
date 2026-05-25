export type BundlePricedItemLike = {
  quantity?: number | null;
  unitPrice?: number | null;
  componentProduct?: {
    price?: number | null;
  } | null;
};

export type ProductWithBundlePriceLike = {
  price?: number | null;
  bundleItems?: readonly BundlePricedItemLike[] | null;
};

function getBundleUnitPrice(item: BundlePricedItemLike) {
  if (typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice)) {
    return item.unitPrice;
  }

  if (
    typeof item.componentProduct?.price === "number" &&
    Number.isFinite(item.componentProduct.price)
  ) {
    return item.componentProduct.price;
  }

  return null;
}

export function getBundleItemsTotal(
  items: readonly BundlePricedItemLike[] | null | undefined,
) {
  if (!items?.length) {
    return null;
  }

  let total = 0;

  for (const item of items) {
    const unitPrice = getBundleUnitPrice(item);
    const quantity = Math.max(1, Math.floor(item.quantity ?? 1));

    if (unitPrice === null || unitPrice < 0 || quantity < 1) {
      return null;
    }

    total += Math.round(unitPrice) * quantity;
  }

  return total;
}

export function getEffectiveProductPrice(product: ProductWithBundlePriceLike) {
  const directPrice =
    typeof product.price === "number" && Number.isFinite(product.price)
      ? product.price
      : null;

  if (directPrice !== null && directPrice > 0) {
    return directPrice;
  }

  const bundleTotal = getBundleItemsTotal(product.bundleItems);

  if (bundleTotal !== null && bundleTotal > 0) {
    return bundleTotal;
  }

  return directPrice;
}
