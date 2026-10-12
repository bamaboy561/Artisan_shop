import type { Prisma } from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";

const inventoryValuationSettingKey = "inventory.latest-valuation";

export type LatestInventoryValuation = {
  amount: number;
  sourceFile: string;
  sourceSheet: string;
  reportTitle: string | null;
  importedAt: Date;
};

type StoredInventoryValuation = {
  amount?: unknown;
  sourceFile?: unknown;
  sourceSheet?: unknown;
  reportTitle?: unknown;
  importedAt?: unknown;
};

function normalizeInventoryValuation(
  value: StoredInventoryValuation | null,
  fallbackImportedAt?: Date,
): LatestInventoryValuation | null {
  const amount =
    typeof value?.amount === "number" && Number.isFinite(value.amount)
      ? value.amount
      : null;
  const sourceFile =
    typeof value?.sourceFile === "string" ? value.sourceFile.trim() : "";
  const sourceSheet =
    typeof value?.sourceSheet === "string" ? value.sourceSheet.trim() : "";
  const reportTitle =
    typeof value?.reportTitle === "string" && value.reportTitle.trim()
      ? value.reportTitle.trim()
      : null;
  const parsedImportedAt =
    typeof value?.importedAt === "string"
      ? new Date(value.importedAt)
      : fallbackImportedAt;
  const importedAt =
    parsedImportedAt && !Number.isNaN(parsedImportedAt.getTime())
      ? parsedImportedAt
      : fallbackImportedAt;

  if (amount === null || amount < 0 || !sourceFile || !importedAt) {
    return null;
  }

  return {
    amount: Math.round(amount * 100) / 100,
    sourceFile,
    sourceSheet,
    reportTitle,
    importedAt,
  };
}

export async function getLatestInventoryValuation() {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const setting = await getDb().siteSetting.findUnique({
    where: { key: inventoryValuationSettingKey },
    select: { value: true, updatedAt: true },
  });

  if (!setting) {
    return null;
  }

  return normalizeInventoryValuation(
    setting.value as StoredInventoryValuation | null,
    setting.updatedAt,
  );
}

export async function saveLatestInventoryValuation(input: {
  amount: number;
  sourceFile: string;
  sourceSheet: string;
  reportTitle: string | null;
}) {
  const importedAt = new Date();
  const normalized = normalizeInventoryValuation(
    {
      amount: input.amount,
      sourceFile: input.sourceFile,
      sourceSheet: input.sourceSheet,
      reportTitle: input.reportTitle,
      importedAt: importedAt.toISOString(),
    },
    importedAt,
  );

  if (!normalized) {
    throw new Error("Некорректная сумма склада в файле остатков.");
  }

  const value = {
    amount: normalized.amount,
    sourceFile: normalized.sourceFile,
    sourceSheet: normalized.sourceSheet,
    reportTitle: normalized.reportTitle,
    importedAt: normalized.importedAt.toISOString(),
  };

  await getDb().siteSetting.upsert({
    where: { key: inventoryValuationSettingKey },
    create: {
      key: inventoryValuationSettingKey,
      value: value as Prisma.InputJsonValue,
      description:
        "Последняя сумма склада из загруженного отчета цен и остатков.",
    },
    update: {
      value: value as Prisma.InputJsonValue,
      description:
        "Последняя сумма склада из загруженного отчета цен и остатков.",
    },
  });

  return normalized;
}
