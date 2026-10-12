import type { Promotion } from "@/generated/prisma";
import { getBestPromotion } from "@/lib/server/pricing";

export const PROMOTION_PRICE_SELECT = {
  id: true,
  name: true,
  status: true,
  discountType: true,
  discountValue: true,
  startsAt: true,
  endsAt: true,
} as const;

type PromotionPriceSnapshot = Pick<
  Promotion,
  | "id"
  | "name"
  | "status"
  | "discountType"
  | "discountValue"
  | "startsAt"
  | "endsAt"
>;

export type PromotionPricingRelation = {
  promotion: PromotionPriceSnapshot;
};

export type ProductPromotionPrice = {
  basePrice: number | null;
  finalPrice: number | null;
  unitDiscountAmount: number;
  promotion: PromotionPriceSnapshot | null;
};

function normalizePrice(price: number | null | undefined) {
  if (typeof price !== "number" || !Number.isFinite(price)) {
    return null;
  }

  return Math.max(0, Math.round(price));
}

export function getProductPromotionPrice(
  basePrice: number | null | undefined,
  productPromotions?: readonly PromotionPricingRelation[] | null,
  categoryPromotions?: readonly PromotionPricingRelation[] | null,
): ProductPromotionPrice {
  const safeBasePrice = normalizePrice(basePrice);

  if (safeBasePrice === null) {
    return {
      basePrice: null,
      finalPrice: null,
      unitDiscountAmount: 0,
      promotion: null,
    };
  }

  const promotions = [
    ...(productPromotions ?? []).map((item) => item.promotion),
    ...(categoryPromotions ?? []).map((item) => item.promotion),
  ];
  const bestPromotion = getBestPromotion(safeBasePrice, promotions);

  if (!bestPromotion || bestPromotion.discountAmount <= 0) {
    return {
      basePrice: safeBasePrice,
      finalPrice: safeBasePrice,
      unitDiscountAmount: 0,
      promotion: null,
    };
  }

  return {
    basePrice: safeBasePrice,
    finalPrice: bestPromotion.finalPrice,
    unitDiscountAmount: bestPromotion.discountAmount,
    promotion: bestPromotion.promotion,
  };
}

export function getPromotionCompareAtPrice(
  compareAtPrice: number | null | undefined,
  promotionPrice: ProductPromotionPrice,
) {
  const safeCompareAtPrice = normalizePrice(compareAtPrice);

  if (promotionPrice.unitDiscountAmount > 0 && promotionPrice.basePrice) {
    return Math.max(safeCompareAtPrice ?? 0, promotionPrice.basePrice);
  }

  return safeCompareAtPrice;
}
