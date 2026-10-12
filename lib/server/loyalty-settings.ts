import "server-only";

import { LoyaltyTier, Prisma } from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import {
  defaultLoyaltyProgramConfig,
  loyaltyTierOrder,
  type LoyaltyProgramConfig,
  type LoyaltyTierBenefits,
} from "@/lib/server/pricing";

export const loyaltySettingsKey = "loyalty.program.v4";
const legacyLoyaltySettingsKeys = [
  "loyalty.program.v3",
  "loyalty.program.v2",
  "loyalty.program.v1",
];

type RawTierSettings = {
  label?: unknown;
  baseDiscountPercent?: unknown;
  accrualPercent?: unknown;
  plateMaterialAccrualPercent?: unknown;
  fittingsAccrualPercent?: unknown;
  threshold?: unknown;
  plateMaterialThreshold?: unknown;
  fittingsThreshold?: unknown;
};

type RawLoyaltySettings = {
  tiers?: Partial<Record<LoyaltyTier, RawTierSettings>>;
  maxTotalDiscountPercent?: unknown;
  maxRedeemPercent?: unknown;
};

type NormalizeLoyaltyOptions = {
  enforceCurrentMinimumThresholds?: boolean;
  useCurrentTierRules?: boolean;
};

const legacyLoyaltyThresholdSets: Array<Record<LoyaltyTier, number>> = [
  {
    BRONZE: 0,
    SILVER: 200000,
    GOLD: 300000,
    PLATINUM: 400000,
  },
  {
    BRONZE: 0,
    SILVER: 300000,
    GOLD: 500000,
    PLATINUM: 700000,
  },
];

function clampPercent(value: unknown, fallback: number, max = 100) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(0, Math.round(parsed)));
}

function clampInt(value: unknown, fallback: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.round(parsed));
}

function isLegacyThresholdConfig(raw: RawLoyaltySettings | null) {
  if (!raw?.tiers) {
    return false;
  }

  return legacyLoyaltyThresholdSets.some((thresholdSet) =>
    loyaltyTierOrder.every((tier) => {
      const rawTier = raw.tiers?.[tier];
      const rawThreshold = rawTier?.threshold;
      const rawPlateThreshold = rawTier?.plateMaterialThreshold ?? rawThreshold;
      const rawFittingsThreshold = rawTier?.fittingsThreshold ?? rawThreshold;

      if (
        rawPlateThreshold === undefined ||
        rawPlateThreshold === null ||
        rawFittingsThreshold === undefined ||
        rawFittingsThreshold === null
      ) {
        return false;
      }

      return (
        clampInt(rawPlateThreshold, -1) === thresholdSet[tier] &&
        clampInt(rawFittingsThreshold, -1) === thresholdSet[tier]
      );
    }),
  );
}

function normalizeTierSettings(
  raw: RawLoyaltySettings | null,
  options: NormalizeLoyaltyOptions = {},
) {
  const tiers = {} as LoyaltyTierBenefits;
  const useDefaultThresholds = isLegacyThresholdConfig(raw);

  for (const tier of loyaltyTierOrder) {
    const defaults = defaultLoyaltyProgramConfig.tiers[tier];
    const rawTier = raw?.tiers?.[tier];
    let plateMaterialThreshold =
      options.useCurrentTierRules || useDefaultThresholds
        ? defaults.plateMaterialThreshold
        : clampInt(
            rawTier?.plateMaterialThreshold ?? rawTier?.threshold,
            defaults.plateMaterialThreshold,
          );
    let fittingsThreshold =
      options.useCurrentTierRules || useDefaultThresholds
        ? defaults.fittingsThreshold
        : clampInt(
            rawTier?.fittingsThreshold ?? rawTier?.threshold,
            defaults.fittingsThreshold,
          );

    if (options.enforceCurrentMinimumThresholds) {
      plateMaterialThreshold = Math.max(
        plateMaterialThreshold,
        defaults.plateMaterialThreshold,
      );
      fittingsThreshold = Math.max(
        fittingsThreshold,
        defaults.fittingsThreshold,
      );
    }

    tiers[tier] = {
      label:
        typeof rawTier?.label === "string" && rawTier.label.trim()
          ? rawTier.label.trim()
          : defaults.label,
      baseDiscountPercent: clampPercent(0, 0, 50),
      accrualPercent: options.useCurrentTierRules
        ? defaults.accrualPercent
        : clampPercent(rawTier?.accrualPercent, defaults.accrualPercent, 50),
      plateMaterialAccrualPercent: options.useCurrentTierRules
        ? defaults.plateMaterialAccrualPercent
        : clampPercent(
            rawTier?.plateMaterialAccrualPercent ?? rawTier?.accrualPercent,
            defaults.plateMaterialAccrualPercent,
            50,
          ),
      fittingsAccrualPercent: options.useCurrentTierRules
        ? defaults.fittingsAccrualPercent
        : clampPercent(
            rawTier?.fittingsAccrualPercent ?? rawTier?.accrualPercent,
            defaults.fittingsAccrualPercent,
            50,
          ),
      threshold: Math.min(plateMaterialThreshold, fittingsThreshold),
      plateMaterialThreshold,
      fittingsThreshold,
    };
  }

  return tiers;
}

export function normalizeLoyaltyProgramConfig(
  raw: RawLoyaltySettings | null | undefined,
  options: NormalizeLoyaltyOptions = {},
): LoyaltyProgramConfig {
  return {
    tiers: normalizeTierSettings(raw ?? null, options),
    maxTotalDiscountPercent: clampPercent(0, 0, 50),
    maxRedeemPercent: clampPercent(
      50,
      defaultLoyaltyProgramConfig.maxRedeemPercent,
      100,
    ),
  };
}

export async function getLoyaltyProgramConfig() {
  if (!hasDatabaseUrl()) {
    return defaultLoyaltyProgramConfig;
  }

  const db = getDb();
  const setting = await db.siteSetting.findUnique({
    where: { key: loyaltySettingsKey },
    select: { value: true },
  });

  if (setting) {
    return normalizeLoyaltyProgramConfig(
      setting.value as RawLoyaltySettings | null,
    );
  }

  const legacySetting = await db.siteSetting.findFirst({
    where: {
      key: {
        in: legacyLoyaltySettingsKeys,
      },
    },
    orderBy: { updatedAt: "desc" },
    select: { value: true },
  });

  return normalizeLoyaltyProgramConfig(
    (legacySetting?.value ?? null) as RawLoyaltySettings | null,
    { useCurrentTierRules: true },
  );
}

export async function saveLoyaltyProgramConfig(config: LoyaltyProgramConfig) {
  const normalized = normalizeLoyaltyProgramConfig(config);

  await getDb().siteSetting.upsert({
    where: { key: loyaltySettingsKey },
    create: {
      key: loyaltySettingsKey,
      value: normalized as unknown as Prisma.InputJsonValue,
      description:
        "Правила уровней, процентов начисления и лимита списания бонусов Artisan.",
    },
    update: {
      value: normalized as unknown as Prisma.InputJsonValue,
      description:
        "Правила уровней, процентов начисления и лимита списания бонусов Artisan.",
    },
  });

  return normalized;
}
