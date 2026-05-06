import {
  DiscountType,
  LoyaltyTier,
  PromotionStatus,
  type Promotion,
} from "@/generated/prisma";

type PromotionSnapshot = Pick<
  Promotion,
  | "id"
  | "name"
  | "status"
  | "discountType"
  | "discountValue"
  | "startsAt"
  | "endsAt"
>;

type LoyaltyProfile = {
  loyaltyTier: LoyaltyTier;
  personalDiscountPercent?: number | null;
  loyaltyPointsBalance?: number | null;
  loyaltyPointsLifetime?: number | null;
};

export const loyaltyTierBenefits: Record<
  LoyaltyTier,
  {
    label: string;
    baseDiscountPercent: number;
    accrualPercent: number;
    threshold: number;
  }
> = {
  BRONZE: {
    label: "Бронза",
    baseDiscountPercent: 0,
    accrualPercent: 2,
    threshold: 0,
  },
  SILVER: {
    label: "Серебро",
    baseDiscountPercent: 3,
    accrualPercent: 3,
    threshold: 1500,
  },
  GOLD: {
    label: "Золото",
    baseDiscountPercent: 5,
    accrualPercent: 4,
    threshold: 5000,
  },
  PLATINUM: {
    label: "Платина",
    baseDiscountPercent: 7,
    accrualPercent: 5,
    threshold: 12000,
  },
};

export const loyaltyTierOrder: LoyaltyTier[] = [
  LoyaltyTier.BRONZE,
  LoyaltyTier.SILVER,
  LoyaltyTier.GOLD,
  LoyaltyTier.PLATINUM,
];

export function getLoyaltyTierLabel(tier: LoyaltyTier) {
  return loyaltyTierBenefits[tier].label;
}

export function getLoyaltyTierBenefits(tier: LoyaltyTier) {
  return loyaltyTierBenefits[tier];
}

export function getLoyaltyTierForLifetimePoints(lifetimePoints: number) {
  const safeLifetimePoints = Math.max(0, lifetimePoints);

  return (
    [...loyaltyTierOrder]
      .reverse()
      .find(
        (tier) => safeLifetimePoints >= loyaltyTierBenefits[tier].threshold,
      ) ?? LoyaltyTier.BRONZE
  );
}

export function getEffectiveDiscountPercent(profile: LoyaltyProfile) {
  const tierDiscount =
    loyaltyTierBenefits[profile.loyaltyTier].baseDiscountPercent;
  const personalDiscount = Math.max(0, profile.personalDiscountPercent ?? 0);

  return Math.min(25, tierDiscount + personalDiscount);
}

export function estimateLoyaltyPoints(total: number, tier: LoyaltyTier) {
  const safeTotal = Math.max(0, Math.round(total));
  const accrualPercent = loyaltyTierBenefits[tier].accrualPercent;

  return Math.floor((safeTotal * accrualPercent) / 100);
}

export function getRedeemableLoyaltyPoints(
  requestedPoints: number,
  balancePoints: number,
  eligibleTotal: number,
) {
  const safeRequestedPoints = Math.max(0, Math.floor(requestedPoints));
  const safeBalancePoints = Math.max(0, Math.floor(balancePoints));
  const safeEligibleTotal = Math.max(0, Math.floor(eligibleTotal));

  return Math.min(safeRequestedPoints, safeBalancePoints, safeEligibleTotal);
}

export function getLoyaltyProgress(lifetimePoints: number, tier: LoyaltyTier) {
  const safeLifetimePoints = Math.max(0, lifetimePoints);
  const currentTierIndex = loyaltyTierOrder.indexOf(tier);
  const currentTier = loyaltyTierBenefits[tier];
  const nextTier = loyaltyTierOrder[currentTierIndex + 1];

  if (!nextTier) {
    return {
      currentThreshold: currentTier.threshold,
      nextThreshold: null,
      pointsToNext: 0,
      progressPercent: 100,
      nextTier: null,
    };
  }

  const nextThreshold = loyaltyTierBenefits[nextTier].threshold;
  const coveredPoints = Math.max(0, safeLifetimePoints - currentTier.threshold);
  const requiredPoints = Math.max(1, nextThreshold - currentTier.threshold);

  return {
    currentThreshold: currentTier.threshold,
    nextThreshold,
    pointsToNext: Math.max(0, nextThreshold - safeLifetimePoints),
    progressPercent: Math.min(
      100,
      Math.round((coveredPoints / requiredPoints) * 100),
    ),
    nextTier,
  };
}

export function isPromotionActive(
  promotion: PromotionSnapshot,
  now = new Date(),
) {
  if (promotion.status !== PromotionStatus.ACTIVE) {
    return false;
  }

  if (promotion.startsAt && promotion.startsAt > now) {
    return false;
  }

  if (promotion.endsAt && promotion.endsAt < now) {
    return false;
  }

  return true;
}

export function applyPromotion(
  basePrice: number,
  promotion: PromotionSnapshot,
) {
  const safeBasePrice = Math.max(0, Math.round(basePrice));

  let nextPrice = safeBasePrice;

  if (promotion.discountType === DiscountType.PERCENT) {
    nextPrice =
      safeBasePrice -
      Math.round((safeBasePrice * promotion.discountValue) / 100);
  }

  if (promotion.discountType === DiscountType.FIXED_AMOUNT) {
    nextPrice = safeBasePrice - promotion.discountValue;
  }

  if (promotion.discountType === DiscountType.FIXED_PRICE) {
    nextPrice = promotion.discountValue;
  }

  const finalPrice = Math.max(0, nextPrice);

  return {
    finalPrice,
    discountAmount: safeBasePrice - finalPrice,
  };
}

export function getBestPromotion(
  basePrice: number,
  promotions: PromotionSnapshot[],
  now = new Date(),
) {
  const activePromotions = promotions.filter((promotion) =>
    isPromotionActive(promotion, now),
  );

  if (activePromotions.length === 0) {
    return null;
  }

  return activePromotions.reduce<{
    promotion: PromotionSnapshot;
    finalPrice: number;
    discountAmount: number;
  } | null>((best, promotion) => {
    const result = applyPromotion(basePrice, promotion);

    if (!best || result.discountAmount > best.discountAmount) {
      return {
        promotion,
        finalPrice: result.finalPrice,
        discountAmount: result.discountAmount,
      };
    }

    return best;
  }, null);
}
