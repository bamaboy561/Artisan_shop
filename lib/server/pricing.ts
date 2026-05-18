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

export type LoyaltyTierBenefits = Record<
  LoyaltyTier,
  {
    label: string;
    baseDiscountPercent: number;
    accrualPercent: number;
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

export const defaultLoyaltyProgramConfig: LoyaltyProgramConfig = {
  tiers: loyaltyTierBenefits,
  maxTotalDiscountPercent: 25,
  maxRedeemPercent: 100,
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
  const safeLifetimePoints = Math.max(0, lifetimePoints);
  const tiers = getConfig(config).tiers;

  return (
    [...loyaltyTierOrder]
      .reverse()
      .find((tier) => safeLifetimePoints >= tiers[tier].threshold) ??
    LoyaltyTier.BRONZE
  );
}

export function getEffectiveDiscountPercent(
  profile: LoyaltyProfile,
  config?: LoyaltyProgramConfig,
) {
  const loyaltyConfig = getConfig(config);
  const tierDiscount =
    loyaltyConfig.tiers[profile.loyaltyTier].baseDiscountPercent;
  const personalDiscount = Math.max(0, profile.personalDiscountPercent ?? 0);

  return Math.min(
    loyaltyConfig.maxTotalDiscountPercent,
    tierDiscount + personalDiscount,
  );
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

export function getRedeemableLoyaltyPoints(
  requestedPoints: number,
  balancePoints: number,
  eligibleTotal: number,
  config?: LoyaltyProgramConfig,
) {
  const safeRequestedPoints = Math.max(0, Math.floor(requestedPoints));
  const safeBalancePoints = Math.max(0, Math.floor(balancePoints));
  const safeEligibleTotal = Math.max(0, Math.floor(eligibleTotal));
  const maxRedeemableByOrder = Math.floor(
    (safeEligibleTotal * getConfig(config).maxRedeemPercent) / 100,
  );

  return Math.min(
    safeRequestedPoints,
    safeBalancePoints,
    maxRedeemableByOrder,
  );
}

export function getLoyaltyProgress(
  lifetimePoints: number,
  tier: LoyaltyTier,
  config?: LoyaltyProgramConfig,
) {
  const safeLifetimePoints = Math.max(0, lifetimePoints);
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
