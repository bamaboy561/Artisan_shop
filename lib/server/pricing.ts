import {
  CategoryKind,
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

export type LoyaltyTierBenefits = Record<
  LoyaltyTier,
  {
    label: string;
    baseDiscountPercent: number;
    accrualPercent: number;
    plateMaterialAccrualPercent: number;
    fittingsAccrualPercent: number;
    threshold: number;
  }
>;

export type LoyaltyProgramConfig = {
  tiers: LoyaltyTierBenefits;
  maxTotalDiscountPercent: number;
  maxRedeemPercent: number;
};

export const loyaltyTierBenefits: LoyaltyTierBenefits = {
  BRONZE: {
    label: "Bronze",
    baseDiscountPercent: 0,
    accrualPercent: 2,
    plateMaterialAccrualPercent: 2,
    fittingsAccrualPercent: 3,
    threshold: 0,
  },
  SILVER: {
    label: "Silver",
    baseDiscountPercent: 0,
    accrualPercent: 3,
    plateMaterialAccrualPercent: 3,
    fittingsAccrualPercent: 4,
    threshold: 200000,
  },
  GOLD: {
    label: "Gold",
    baseDiscountPercent: 0,
    accrualPercent: 4,
    plateMaterialAccrualPercent: 4,
    fittingsAccrualPercent: 5,
    threshold: 300000,
  },
  PLATINUM: {
    label: "Platinum",
    baseDiscountPercent: 0,
    accrualPercent: 5,
    plateMaterialAccrualPercent: 5,
    fittingsAccrualPercent: 6,
    threshold: 400000,
  },
};

export const defaultLoyaltyProgramConfig: LoyaltyProgramConfig = {
  tiers: loyaltyTierBenefits,
  maxTotalDiscountPercent: 0,
  maxRedeemPercent: 50,
};

export const loyaltyTierOrder: LoyaltyTier[] = [
  LoyaltyTier.BRONZE,
  LoyaltyTier.SILVER,
  LoyaltyTier.GOLD,
  LoyaltyTier.PLATINUM,
];

function getConfig(config?: LoyaltyProgramConfig) {
  return config ?? defaultLoyaltyProgramConfig;
}

export function getLoyaltyTierLabel(
  tier: LoyaltyTier,
  config?: LoyaltyProgramConfig,
) {
  return getConfig(config).tiers[tier].label;
}

export function getLoyaltyTierBenefits(
  tier: LoyaltyTier,
  config?: LoyaltyProgramConfig,
) {
  return getConfig(config).tiers[tier];
}

export function getLoyaltyTierForLifetimePoints(
  lifetimePoints: number,
  config?: LoyaltyProgramConfig,
) {
  return getLoyaltyTierForMonthlyPurchaseTotal(lifetimePoints, config);
}

export function getLoyaltyTierForMonthlyPurchaseTotal(
  purchaseTotal: number,
  config?: LoyaltyProgramConfig,
) {
  const safePurchaseTotal = Math.max(0, Math.round(purchaseTotal));
  const tiers = getConfig(config).tiers;

  return (
    [...loyaltyTierOrder]
      .reverse()
      .find((tier) => safePurchaseTotal >= tiers[tier].threshold) ??
    LoyaltyTier.BRONZE
  );
}

export function getEffectiveDiscountPercent(
  profile: LoyaltyProfile,
  config?: LoyaltyProgramConfig,
) {
  void profile;
  void config;

  return 0;
}

export function estimateLoyaltyPoints(
  total: number,
  tier: LoyaltyTier,
  config?: LoyaltyProgramConfig,
) {
  const safeTotal = Math.max(0, Math.round(total));
  const accrualPercent = getConfig(config).tiers[tier].accrualPercent;

  return Math.floor((safeTotal * accrualPercent) / 100);
}

export function getLoyaltyAccrualPercent(
  categoryKind: CategoryKind | string | null | undefined,
  tier: LoyaltyTier,
  config?: LoyaltyProgramConfig,
) {
  const tierConfig = getConfig(config).tiers[tier];

  if (categoryKind === CategoryKind.PLATE || categoryKind === "PLATE") {
    return tierConfig.plateMaterialAccrualPercent;
  }

  if (categoryKind === CategoryKind.FITTINGS || categoryKind === "FITTINGS") {
    return tierConfig.fittingsAccrualPercent;
  }

  return 0;
}

export function estimateLoyaltyPointsForLines(
  lines: Array<{
    total: number;
    categoryKind?: CategoryKind | string | null;
  }>,
  tier: LoyaltyTier,
  config?: LoyaltyProgramConfig,
) {
  return lines.reduce((sum, line) => {
    const safeTotal = Math.max(0, Math.round(line.total));
    const accrualPercent = getLoyaltyAccrualPercent(
      line.categoryKind,
      tier,
      config,
    );

    return sum + Math.floor((safeTotal * accrualPercent) / 100);
  }, 0);
}

export function getRedeemableLoyaltyPoints(
  requestedPoints: number,
  balancePoints: number,
  eligibleTotal: number,
  config?: LoyaltyProgramConfig,
) {
  const safeRequestedPoints = Math.max(0, Math.floor(requestedPoints));
  const safeBalancePoints = Math.max(0, Math.floor(balancePoints));
  const safeEligibleTotal = Math.max(0, Math.floor(eligibleTotal));
  const maxRedeemPercent = getConfig(config).maxRedeemPercent;
  const maxByOrderTotal = Math.floor(
    (safeEligibleTotal * maxRedeemPercent) / 100,
  );

  return Math.min(safeRequestedPoints, safeBalancePoints, maxByOrderTotal);
}

export function getLoyaltyProgress(
  purchaseTotal: number,
  tier: LoyaltyTier,
  config?: LoyaltyProgramConfig,
) {
  const safePurchaseTotal = Math.max(0, purchaseTotal);
  const tiers = getConfig(config).tiers;
  const currentTierIndex = loyaltyTierOrder.indexOf(tier);
  const currentTier = tiers[tier];
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

  const nextThreshold = tiers[nextTier].threshold;
  const coveredPoints = Math.max(0, safePurchaseTotal - currentTier.threshold);
  const requiredPoints = Math.max(1, nextThreshold - currentTier.threshold);

  return {
    currentThreshold: currentTier.threshold,
    nextThreshold,
    pointsToNext: Math.max(0, nextThreshold - safePurchaseTotal),
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
