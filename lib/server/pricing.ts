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
  plateMaterialLoyaltyTier?: LoyaltyTier | null;
  fittingsLoyaltyTier?: LoyaltyTier | null;
  personalDiscountPercent?: number | null;
  loyaltyPointsBalance?: number | null;
  loyaltyPointsLifetime?: number | null;
};

export type LoyaltyThresholdKind = "overall" | "plateMaterial" | "fittings";

export type LoyaltyTierSource =
  | LoyaltyTier
  | {
      loyaltyTier?: LoyaltyTier | null;
      plateMaterialLoyaltyTier?: LoyaltyTier | null;
      fittingsLoyaltyTier?: LoyaltyTier | null;
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
    plateMaterialThreshold: number;
    fittingsThreshold: number;
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
    plateMaterialThreshold: 0,
    fittingsThreshold: 0,
  },
  SILVER: {
    label: "Silver",
    baseDiscountPercent: 0,
    accrualPercent: 3,
    plateMaterialAccrualPercent: 3,
    fittingsAccrualPercent: 5,
    threshold: 450000,
    plateMaterialThreshold: 500000,
    fittingsThreshold: 450000,
  },
  GOLD: {
    label: "Gold",
    baseDiscountPercent: 0,
    accrualPercent: 4,
    plateMaterialAccrualPercent: 4,
    fittingsAccrualPercent: 6,
    threshold: 650000,
    plateMaterialThreshold: 800000,
    fittingsThreshold: 650000,
  },
  PLATINUM: {
    label: "Platinum",
    baseDiscountPercent: 0,
    accrualPercent: 6,
    plateMaterialAccrualPercent: 6,
    fittingsAccrualPercent: 7,
    threshold: 900000,
    plateMaterialThreshold: 1800000,
    fittingsThreshold: 900000,
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

export function getLoyaltyTierRank(tier: LoyaltyTier) {
  return loyaltyTierOrder.indexOf(tier);
}

export function getHighestLoyaltyTier(tiers: LoyaltyTier[]) {
  return tiers.reduce(
    (highest, tier) =>
      getLoyaltyTierRank(tier) > getLoyaltyTierRank(highest) ? tier : highest,
    LoyaltyTier.BRONZE,
  );
}

function getTierThreshold(
  tier: LoyaltyTier,
  config?: LoyaltyProgramConfig,
  thresholdKind: LoyaltyThresholdKind = "overall",
) {
  const benefits = getLoyaltyTierBenefits(tier, config);

  if (thresholdKind === "plateMaterial") {
    return benefits.plateMaterialThreshold;
  }

  if (thresholdKind === "fittings") {
    return benefits.fittingsThreshold;
  }

  return benefits.threshold;
}

export function getLoyaltyTierForLifetimePoints(
  lifetimePoints: number,
  config?: LoyaltyProgramConfig,
) {
  return getLoyaltyTierForPurchaseTotal(lifetimePoints, config);
}

export function getLoyaltyTierForPurchaseTotal(
  purchaseTotal: number,
  config?: LoyaltyProgramConfig,
  thresholdKind: LoyaltyThresholdKind = "overall",
) {
  const safePurchaseTotal = Math.max(0, Math.round(purchaseTotal));

  return (
    [...loyaltyTierOrder]
      .reverse()
      .find(
        (tier) =>
          safePurchaseTotal >= getTierThreshold(tier, config, thresholdKind),
      ) ?? LoyaltyTier.BRONZE
  );
}

export function getLoyaltyTierForMonthlyPurchaseTotal(
  purchaseTotal: number,
  config?: LoyaltyProgramConfig,
  thresholdKind: LoyaltyThresholdKind = "overall",
) {
  return getLoyaltyTierForPurchaseTotal(purchaseTotal, config, thresholdKind);
}

export const MAX_PERSONAL_DISCOUNT_PERCENT = 50;

export function clampPersonalDiscountPercent(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(
    MAX_PERSONAL_DISCOUNT_PERCENT,
    Math.max(0, Math.round(value)),
  );
}

// Личная скидка клиента из админки. Скидки уровней лояльности не используются:
// уровни дают только процент начисления баллов.
export function getEffectiveDiscountPercent(
  profile: LoyaltyProfile,
  config?: LoyaltyProgramConfig,
) {
  void config;

  return clampPersonalDiscountPercent(profile.personalDiscountPercent);
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

export function getLoyaltyTierForCategory(
  categoryKind: CategoryKind | string | null | undefined,
  tierSource: LoyaltyTierSource,
) {
  if (typeof tierSource === "string") {
    return tierSource;
  }

  const fallbackTier = tierSource.loyaltyTier ?? LoyaltyTier.BRONZE;

  if (categoryKind === CategoryKind.PLATE || categoryKind === "PLATE") {
    return tierSource.plateMaterialLoyaltyTier ?? fallbackTier;
  }

  if (categoryKind === CategoryKind.FITTINGS || categoryKind === "FITTINGS") {
    return tierSource.fittingsLoyaltyTier ?? fallbackTier;
  }

  return fallbackTier;
}

export function estimateLoyaltyPointsForLines(
  lines: Array<{
    total: number;
    categoryKind?: CategoryKind | string | null;
  }>,
  tierSource: LoyaltyTierSource,
  config?: LoyaltyProgramConfig,
) {
  return lines.reduce((sum, line) => {
    const safeTotal = Math.max(0, Math.round(line.total));
    const tier = getLoyaltyTierForCategory(line.categoryKind, tierSource);
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
  thresholdKind: LoyaltyThresholdKind = "overall",
) {
  const safePurchaseTotal = Math.max(0, purchaseTotal);
  const currentTierIndex = loyaltyTierOrder.indexOf(tier);
  const nextTier = loyaltyTierOrder[currentTierIndex + 1];
  const currentThreshold = getTierThreshold(tier, config, thresholdKind);

  if (!nextTier) {
    return {
      currentThreshold,
      nextThreshold: null,
      pointsToNext: 0,
      progressPercent: 100,
      nextTier: null,
    };
  }

  const nextThreshold = getTierThreshold(nextTier, config, thresholdKind);
  const coveredPoints = Math.max(0, safePurchaseTotal - currentThreshold);
  const requiredPoints = Math.max(1, nextThreshold - currentThreshold);

  return {
    currentThreshold,
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
