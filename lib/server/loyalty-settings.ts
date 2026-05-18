import "server-only";

import { LoyaltyTier, Prisma } from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import {
  defaultLoyaltyProgramConfig,
  loyaltyTierOrder,
  type LoyaltyProgramConfig,
  type LoyaltyTierBenefits,
} from "@/lib/server/pricing";

export const loyaltySettingsKey = "loyalty.program.v1";

type RawTierSettings = {
  label?: unknown;
  baseDiscountPercent?: unknown;
  accrualPercent?: unknown;
  threshold?: unknown;
};

type RawLoyaltySettings = {
  tiers?: Partial<Record<LoyaltyTier, RawTierSettings>>;
  maxTotalDiscountPercent?: unknown;
  maxRedeemPercent?: unknown;
};

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

function normalizeTierSettings(raw: RawLoyaltySettings | null) {
  const tiers = {} as LoyaltyTierBenefits;

  for (const tier of loyaltyTierOrder) {
    const defaults = defaultLoyaltyProgramConfig.tiers[tier];
    const rawTier = raw?.tiers?.[tier];

    tiers[tier] = {
      label:
        typeof rawTier?.label === "string" && rawTier.label.trim()
          ? rawTier.label.trim()
          : defaults.label,
      baseDiscountPercent: clampPercent(
        rawTier?.baseDiscountPercent,
        defaults.baseDiscountPercent,
        50,
      ),
      accrualPercent: clampPercent(
        rawTier?.accrualPercent,
        defaults.accrualPercent,
        50,
      ),
      threshold: clampInt(rawTier?.threshold, defaults.threshold),
    };
  }

  return tiers;
}

export function normalizeLoyaltyProgramConfig(
  raw: RawLoyaltySettings | null | undefined,
): LoyaltyProgramConfig {
  return {
    tiers: normalizeTierSettings(raw ?? null),
    maxTotalDiscountPercent: clampPercent(
      raw?.maxTotalDiscountPercent,
      defaultLoyaltyProgramConfig.maxTotalDiscountPercent,
      50,
    ),
    maxRedeemPercent: clampPercent(
      raw?.maxRedeemPercent,
      defaultLoyaltyProgramConfig.maxRedeemPercent,
      100,
    ),
  };
}

export async function getLoyaltyProgramConfig() {
  if (!hasDatabaseUrl()) {
    return defaultLoyaltyProgramConfig;
  }

  const setting = await getDb().siteSetting.findUnique({
    where: { key: loyaltySettingsKey },
    select: { value: true },
  });

  return normalizeLoyaltyProgramConfig(
    (setting?.value ?? null) as RawLoyaltySettings | null,
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
