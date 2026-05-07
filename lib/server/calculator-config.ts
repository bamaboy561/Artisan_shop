import "server-only";

import { ProductStatus } from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";

export type CalculatorMaterialDto = {
  // Stable string used by Product.calculatorMaterialId. Matches slug in DB.
  id: string;
  label: string;
  pricePerSqM: number;
  cutRatePerMeter: number;
  edgeRatePerMeter: number;
  setupFee: number;
  thicknessMm: number | null;
};

export type CalculatorSheetFormatDto = {
  // Stable string used by Product.calculatorSheetPresetId. Matches slug in DB.
  id: string;
  label: string;
  width: number;
  height: number;
};

export type CalculatorPresetDto = {
  id: string;
  label: string;
  brand: string;
  materialName: string;
  materialId: string;
  sheetPresetId: string;
};

const DEFAULT_MATERIALS: CalculatorMaterialDto[] = [
  {
    id: "ldsp-16",
    label: "ЛДСП 16 мм",
    pricePerSqM: 610,
    cutRatePerMeter: 38,
    edgeRatePerMeter: 28,
    setupFee: 950,
    thicknessMm: 16,
  },
  {
    id: "mdf-16",
    label: "МДФ 16 мм",
    pricePerSqM: 760,
    cutRatePerMeter: 42,
    edgeRatePerMeter: 34,
    setupFee: 1100,
    thicknessMm: 16,
  },
];

const DEFAULT_SHEETS: CalculatorSheetFormatDto[] = [
  {
    id: "2800x2070",
    label: "2800 × 2070 мм",
    width: 2800,
    height: 2070,
  },
  {
    id: "2750x1830",
    label: "2750 × 1830 мм",
    width: 2750,
    height: 1830,
  },
  {
    id: "2800x1220",
    label: "2800 × 1220 мм",
    width: 2800,
    height: 1220,
  },
];

export async function getCalculatorMaterials(): Promise<CalculatorMaterialDto[]> {
  if (!hasDatabaseUrl()) return DEFAULT_MATERIALS;

  const db = getDb();
  const rows = await db.calculatorMaterial.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  if (rows.length === 0) return DEFAULT_MATERIALS;

  return rows.map((row) => ({
    id: row.slug,
    label: row.label,
    pricePerSqM: row.pricePerSqM,
    cutRatePerMeter: row.cutRatePerMeter,
    edgeRatePerMeter: row.edgeRatePerMeter,
    setupFee: row.setupFee,
    thicknessMm: row.thicknessMm,
  }));
}

export async function getCalculatorSheetFormats(): Promise<
  CalculatorSheetFormatDto[]
> {
  if (!hasDatabaseUrl()) return DEFAULT_SHEETS;

  const db = getDb();
  const rows = await db.calculatorSheetFormat.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  if (rows.length === 0) return DEFAULT_SHEETS;

  return rows.map((row) => ({
    id: row.slug,
    label: row.label,
    width: row.widthMm,
    height: row.heightMm,
  }));
}

export async function getCalculatorPresets(): Promise<CalculatorPresetDto[]> {
  if (!hasDatabaseUrl()) return [];

  const db = getDb();
  const rows = await db.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      calculatorMaterialId: { not: null },
      calculatorSheetPresetId: { not: null },
    },
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    select: {
      slug: true,
      name: true,
      calculatorMaterialId: true,
      calculatorSheetPresetId: true,
      brand: { select: { name: true } },
    },
  });

  return rows
    .filter(
      (row): row is typeof row & {
        calculatorMaterialId: string;
        calculatorSheetPresetId: string;
      } =>
        Boolean(row.calculatorMaterialId) &&
        Boolean(row.calculatorSheetPresetId),
    )
    .map((row) => ({
      id: row.slug,
      label: row.brand?.name ? `${row.brand.name} — ${row.name}` : row.name,
      brand: row.brand?.name ?? "",
      materialName: row.name,
      materialId: row.calculatorMaterialId,
      sheetPresetId: row.calculatorSheetPresetId,
    }));
}

export async function getCalculatorBundle() {
  const [materials, sheets, presets] = await Promise.all([
    getCalculatorMaterials(),
    getCalculatorSheetFormats(),
    getCalculatorPresets(),
  ]);
  return { materials, sheets, presets };
}
