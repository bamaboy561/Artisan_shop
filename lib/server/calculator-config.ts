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
    id: "ldsp-10",
    label: "ЛДСП 10 мм",
    pricePerSqM: 540,
    cutRatePerMeter: 36,
    edgeRatePerMeter: 26,
    setupFee: 900,
    thicknessMm: 10,
  },
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
    id: "ldsp-18",
    label: "ЛДСП 18 мм",
    pricePerSqM: 680,
    cutRatePerMeter: 40,
    edgeRatePerMeter: 30,
    setupFee: 980,
    thicknessMm: 18,
  },
  {
    id: "ldsp-22",
    label: "ЛДСП 22 мм",
    pricePerSqM: 760,
    cutRatePerMeter: 42,
    edgeRatePerMeter: 34,
    setupFee: 1050,
    thicknessMm: 22,
  },
  {
    id: "ldsp-25",
    label: "ЛДСП 25 мм",
    pricePerSqM: 840,
    cutRatePerMeter: 45,
    edgeRatePerMeter: 36,
    setupFee: 1100,
    thicknessMm: 25,
  },
  {
    id: "mdf-6",
    label: "МДФ 6 мм",
    pricePerSqM: 520,
    cutRatePerMeter: 38,
    edgeRatePerMeter: 0,
    setupFee: 950,
    thicknessMm: 6,
  },
  {
    id: "mdf-8",
    label: "МДФ 8 мм",
    pricePerSqM: 570,
    cutRatePerMeter: 39,
    edgeRatePerMeter: 20,
    setupFee: 980,
    thicknessMm: 8,
  },
  {
    id: "mdf-10",
    label: "МДФ 10 мм",
    pricePerSqM: 620,
    cutRatePerMeter: 40,
    edgeRatePerMeter: 24,
    setupFee: 1000,
    thicknessMm: 10,
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
  {
    id: "mdf-18",
    label: "МДФ 18 мм",
    pricePerSqM: 860,
    cutRatePerMeter: 45,
    edgeRatePerMeter: 36,
    setupFee: 1150,
    thicknessMm: 18,
  },
  {
    id: "mdf-22",
    label: "МДФ 22 мм",
    pricePerSqM: 980,
    cutRatePerMeter: 48,
    edgeRatePerMeter: 38,
    setupFee: 1200,
    thicknessMm: 22,
  },
  {
    id: "mdf-25",
    label: "МДФ 25 мм",
    pricePerSqM: 1120,
    cutRatePerMeter: 52,
    edgeRatePerMeter: 42,
    setupFee: 1250,
    thicknessMm: 25,
  },
  {
    id: "countertop-26",
    label: "Столешница 26 мм",
    pricePerSqM: 1900,
    cutRatePerMeter: 62,
    edgeRatePerMeter: 0,
    setupFee: 1350,
    thicknessMm: 26,
  },
  {
    id: "countertop-28",
    label: "Столешница 28 мм",
    pricePerSqM: 2050,
    cutRatePerMeter: 65,
    edgeRatePerMeter: 0,
    setupFee: 1400,
    thicknessMm: 28,
  },
  {
    id: "countertop-38",
    label: "Столешница 38 мм",
    pricePerSqM: 2400,
    cutRatePerMeter: 70,
    edgeRatePerMeter: 0,
    setupFee: 1500,
    thicknessMm: 38,
  },
  {
    id: "countertop-40",
    label: "Столешница 40 мм",
    pricePerSqM: 2500,
    cutRatePerMeter: 72,
    edgeRatePerMeter: 0,
    setupFee: 1550,
    thicknessMm: 40,
  },
  {
    id: "hpl-3",
    label: "HPL panel 3 mm",
    pricePerSqM: 1850,
    cutRatePerMeter: 62,
    edgeRatePerMeter: 0,
    setupFee: 1250,
    thicknessMm: 3,
  },
  {
    id: "hpl-4",
    label: "HPL panel 4 mm",
    pricePerSqM: 2050,
    cutRatePerMeter: 66,
    edgeRatePerMeter: 0,
    setupFee: 1300,
    thicknessMm: 4,
  },
  {
    id: "hpl-6",
    label: "HPL panel 6 mm",
    pricePerSqM: 2400,
    cutRatePerMeter: 72,
    edgeRatePerMeter: 0,
    setupFee: 1450,
    thicknessMm: 6,
  },
  {
    id: "hpl-8",
    label: "HPL panel 8 mm",
    pricePerSqM: 2700,
    cutRatePerMeter: 76,
    edgeRatePerMeter: 0,
    setupFee: 1500,
    thicknessMm: 8,
  },
  {
    id: "hpl-10",
    label: "HPL panel 10 mm",
    pricePerSqM: 2950,
    cutRatePerMeter: 80,
    edgeRatePerMeter: 0,
    setupFee: 1550,
    thicknessMm: 10,
  },
  {
    id: "hpl-12",
    label: "HPL panel 12 mm",
    pricePerSqM: 3200,
    cutRatePerMeter: 85,
    edgeRatePerMeter: 0,
    setupFee: 1600,
    thicknessMm: 12,
  },
];

const DEFAULT_SHEETS: CalculatorSheetFormatDto[] = [
  {
    id: "2440x1220",
    label: "2440 × 1220 мм",
    width: 2440,
    height: 1220,
  },
  {
    id: "2500x1250",
    label: "2500 × 1250 мм",
    width: 2500,
    height: 1250,
  },
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
  {
    id: "3050x1220",
    label: "3050 × 1220 мм",
    width: 3050,
    height: 1220,
  },
  {
    id: "3660x1830",
    label: "3660 × 1830 мм",
    width: 3660,
    height: 1830,
  },
  {
    id: "4100x600",
    label: "4100 × 600 мм",
    width: 4100,
    height: 600,
  },
  {
    id: "4100x1200",
    label: "4100 × 1200 мм",
    width: 4100,
    height: 1200,
  },
  {
    id: "4200x600",
    label: "4200 × 600 мм",
    width: 4200,
    height: 600,
  },
  {
    id: "4200x1200",
    label: "4200 × 1200 мм",
    width: 4200,
    height: 1200,
  },
  {
    id: "3050x1300",
    label: "3050 × 1300 мм",
    width: 3050,
    height: 1300,
  },
  {
    id: "3050x1320",
    label: "3050 x 1320 mm",
    width: 3050,
    height: 1320,
  },
  {
    id: "3660x1320",
    label: "3660 x 1320 mm",
    width: 3660,
    height: 1320,
  },
  {
    id: "4200x1320",
    label: "4200 x 1320 mm",
    width: 4200,
    height: 1320,
  },
];

const MANUAL_PRESET_DEFINITIONS = [
  {
    materialId: "ldsp-10",
    sheetIds: ["2440x1220", "2800x2070", "2750x1830", "2800x1220"],
  },
  {
    materialId: "ldsp-16",
    sheetIds: [
      "2440x1220",
      "2500x1250",
      "2800x2070",
      "2750x1830",
      "2800x1220",
      "3050x1220",
    ],
  },
  {
    materialId: "ldsp-18",
    sheetIds: [
      "2440x1220",
      "2500x1250",
      "2800x2070",
      "2750x1830",
      "2800x1220",
      "3050x1220",
    ],
  },
  {
    materialId: "ldsp-22",
    sheetIds: ["2800x2070", "2750x1830", "3050x1220"],
  },
  {
    materialId: "ldsp-25",
    sheetIds: ["2800x2070", "2750x1830", "3050x1220"],
  },
  {
    materialId: "mdf-6",
    sheetIds: ["2440x1220", "2800x2070", "2800x1220", "3050x1220"],
  },
  {
    materialId: "mdf-8",
    sheetIds: ["2440x1220", "2800x2070", "2800x1220", "3050x1220"],
  },
  {
    materialId: "mdf-10",
    sheetIds: ["2440x1220", "2800x2070", "2800x1220", "3050x1220"],
  },
  {
    materialId: "mdf-16",
    sheetIds: [
      "2440x1220",
      "2500x1250",
      "2800x2070",
      "2750x1830",
      "2800x1220",
      "3050x1220",
    ],
  },
  {
    materialId: "mdf-18",
    sheetIds: ["2440x1220", "2800x2070", "2800x1220", "3050x1220"],
  },
  {
    materialId: "mdf-22",
    sheetIds: ["2800x2070", "2800x1220", "3050x1220"],
  },
  {
    materialId: "mdf-25",
    sheetIds: ["2800x2070", "2800x1220", "3050x1220"],
  },
  {
    materialId: "countertop-26",
    sheetIds: ["4100x600", "4100x1200", "4200x600", "4200x1200"],
  },
  {
    materialId: "countertop-28",
    sheetIds: ["4100x600", "4100x1200", "4200x600", "4200x1200"],
  },
  {
    materialId: "countertop-38",
    sheetIds: ["4100x600", "4100x1200", "4200x600", "4200x1200"],
  },
  {
    materialId: "countertop-40",
    sheetIds: ["4100x600", "4100x1200", "4200x600", "4200x1200"],
  },
  {
    materialId: "hpl-3",
    sheetIds: ["3050x1220", "3050x1300", "3050x1320", "3660x1320", "4200x1320"],
  },
  {
    materialId: "hpl-4",
    sheetIds: ["3050x1220", "3050x1300", "3050x1320", "3660x1320", "4200x1320"],
  },
  {
    materialId: "hpl-6",
    sheetIds: ["3050x1220", "3050x1300", "3050x1320", "3660x1320", "4200x1320"],
  },
  {
    materialId: "hpl-8",
    sheetIds: ["3050x1220", "3050x1300", "3050x1320", "3660x1320", "4200x1320"],
  },
  {
    materialId: "hpl-10",
    sheetIds: ["3050x1220", "3050x1300", "3050x1320", "3660x1320", "4200x1320"],
  },
  {
    materialId: "hpl-12",
    sheetIds: ["3050x1220", "3050x1300", "3050x1320", "3660x1320", "4200x1320"],
  },
] as const;

function normalizeCalculatorText(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("ru-RU");
}

function inferThicknessMm(input: {
  thicknessMm?: number | null;
  name?: string | null;
  format?: string | null;
}) {
  if (input.thicknessMm) {
    return input.thicknessMm;
  }

  const text = [input.name, input.format].filter(Boolean).join(" ");
  const matches = [...text.matchAll(/(\d{1,2})(?:[.,]\d+)?\s*(?:мм|mm)\b/giu)]
    .map((match) => Number(match[1]))
    .filter((value) => value >= 3 && value <= 60);

  return matches.at(-1) ?? null;
}

function materialIdWithThickness(
  prefix: string,
  thicknessMm: number | null,
  fallback: string,
) {
  if (!thicknessMm) return fallback;

  return `${prefix}-${thicknessMm}`;
}

function inferSheetIdFromFormat(format: string | null | undefined) {
  const match = (format ?? "").match(/(\d{3,4})\s*(?:x|х|×|\*)\s*(\d{3,4})/iu);

  if (!match) {
    return null;
  }

  return `${match[1]}x${match[2]}`;
}

function applyManualThicknessToMaterialId(
  materialId: string,
  thicknessMm: number | null,
) {
  if (materialId.startsWith("mdf-agt-")) {
    const storedThickness = Number.parseInt(
      materialId.replace("mdf-agt-", ""),
      10,
    );
    const nextThickness = thicknessMm ?? storedThickness;

    return `mdf-${nextThickness}`;
  }

  if (!thicknessMm) return materialId;

  if (materialId.startsWith("hpl-")) {
    return `hpl-${thicknessMm}`;
  }

  if (materialId.startsWith("countertop-")) {
    return `countertop-${thicknessMm}`;
  }

  return materialId;
}

function inferMaterialId(input: {
  calculatorMaterialId: string | null;
  name: string;
  format: string | null;
  thicknessMm: number | null;
  brand: { slug: string; name: string } | null;
  category: { slug: string; name: string };
}) {
  if (input.calculatorMaterialId) {
    return applyManualThicknessToMaterialId(
      input.calculatorMaterialId,
      inferThicknessMm(input),
    );
  }

  const text = normalizeCalculatorText(
    [
      input.name,
      input.brand?.slug,
      input.brand?.name,
      input.category.slug,
      input.category.name,
      input.format,
    ].join(" "),
  );
  const thicknessMm = inferThicknessMm(input);

  if (
    text.includes("agt") ||
    text.includes("trendy") ||
    text.includes("supramat")
  ) {
    return materialIdWithThickness("mdf", thicknessMm, "mdf-18");
  }

  if (text.includes("hpl")) {
    return materialIdWithThickness("hpl", thicknessMm, "hpl-12");
  }

  if (text.includes("столеш")) {
    return materialIdWithThickness("countertop", thicknessMm, "countertop-38");
  }

  if (text.includes("мдф") || text.includes("mdf")) {
    return materialIdWithThickness("mdf", thicknessMm, "mdf-18");
  }

  if (
    text.includes("лдсп") ||
    text.includes("ldsp") ||
    text.includes("extravert")
  ) {
    return materialIdWithThickness("ldsp", thicknessMm, "ldsp-16");
  }

  return null;
}

function inferSheetPresetId(
  input: {
    calculatorSheetPresetId: string | null;
    format?: string | null;
  },
  materialId: string | null,
) {
  if (input.calculatorSheetPresetId) return input.calculatorSheetPresetId;

  const formatSheetId = inferSheetIdFromFormat(input.format);
  if (formatSheetId) return formatSheetId;

  switch (materialId) {
    case "countertop-26":
    case "countertop-28":
    case "countertop-38":
    case "countertop-40":
      return "4100x600";
    case "hpl-3":
    case "hpl-4":
    case "hpl-6":
    case "hpl-8":
    case "hpl-10":
    case "hpl-12":
      return "3050x1320";
    case "ldsp-10":
    case "ldsp-16":
    case "ldsp-18":
    case "ldsp-22":
    case "ldsp-25":
    case "mdf-6":
    case "mdf-8":
    case "mdf-10":
    case "mdf-16":
    case "mdf-18":
    case "mdf-22":
    case "mdf-25":
      return "2800x2070";
    default:
      return null;
  }
}

function mapCalculatorMaterialRow(row: {
  slug: string;
  label: string;
  pricePerSqM: number;
  cutRatePerMeter: number;
  edgeRatePerMeter: number;
  setupFee: number;
  thicknessMm: number | null;
}): CalculatorMaterialDto {
  return {
    id: row.slug,
    label: row.label,
    pricePerSqM: row.pricePerSqM,
    cutRatePerMeter: row.cutRatePerMeter,
    edgeRatePerMeter: row.edgeRatePerMeter,
    setupFee: row.setupFee,
    thicknessMm: row.thicknessMm,
  };
}

function mapCalculatorSheetRow(row: {
  slug: string;
  label: string;
  widthMm: number;
  heightMm: number;
}): CalculatorSheetFormatDto {
  return {
    id: row.slug,
    label: row.label,
    width: row.widthMm,
    height: row.heightMm,
  };
}

function mergeMissingDefaults<T extends { id: string }>(
  rows: T[],
  defaults: T[],
  existingIds: Set<string>,
) {
  return [...rows, ...defaults.filter((item) => !existingIds.has(item.id))];
}

function parseThicknessFromMaterialId(materialId: string, prefix: string) {
  const match = materialId.match(new RegExp(`^${prefix}-(\\d+)$`));
  return match ? Number(match[1]) : null;
}

function createCustomCalculatorMaterial(
  materialId: string,
  materials: CalculatorMaterialDto[],
) {
  const hplThickness = parseThicknessFromMaterialId(materialId, "hpl");
  const countertopThickness = parseThicknessFromMaterialId(
    materialId,
    "countertop",
  );
  const thicknessMm = hplThickness ?? countertopThickness;

  if (!thicknessMm || (!hplThickness && !countertopThickness)) {
    return null;
  }

  const fallbackId = hplThickness ? "hpl-12" : "countertop-38";
  const fallback =
    materials.find((material) => material.id === fallbackId) ??
    DEFAULT_MATERIALS.find((material) => material.id === fallbackId);

  if (!fallback) {
    return null;
  }

  return {
    ...fallback,
    id: materialId,
    label: hplThickness
      ? `HPL panel ${thicknessMm} mm`
      : `Столешница ${thicknessMm} мм`,
    thicknessMm,
  } satisfies CalculatorMaterialDto;
}

function parseSheetDimensionsFromId(sheetId: string) {
  const match = sheetId.match(/^(\d{3,4})x(\d{3,4})$/);

  if (!match) {
    return null;
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function createCustomCalculatorSheet(sheetId: string) {
  const dimensions = parseSheetDimensionsFromId(sheetId);

  if (!dimensions) {
    return null;
  }

  return {
    id: sheetId,
    label: `${dimensions.width} × ${dimensions.height} мм`,
    width: dimensions.width,
    height: dimensions.height,
  } satisfies CalculatorSheetFormatDto;
}

function appendPresetMaterials(
  materials: CalculatorMaterialDto[],
  presets: CalculatorPresetDto[],
) {
  const existingIds = new Set(materials.map((material) => material.id));
  const additions: CalculatorMaterialDto[] = [];

  for (const preset of presets) {
    if (existingIds.has(preset.materialId)) {
      continue;
    }

    const material = createCustomCalculatorMaterial(preset.materialId, [
      ...materials,
      ...additions,
    ]);

    if (!material) {
      continue;
    }

    existingIds.add(material.id);
    additions.push(material);
  }

  return [...materials, ...additions];
}

function appendPresetSheets(
  sheets: CalculatorSheetFormatDto[],
  presets: CalculatorPresetDto[],
) {
  const existingIds = new Set(sheets.map((sheet) => sheet.id));
  const additions: CalculatorSheetFormatDto[] = [];

  for (const preset of presets) {
    if (existingIds.has(preset.sheetPresetId)) {
      continue;
    }

    const sheet = createCustomCalculatorSheet(preset.sheetPresetId);

    if (!sheet) {
      continue;
    }

    existingIds.add(sheet.id);
    additions.push(sheet);
  }

  return [...sheets, ...additions];
}

function getManualCalculatorPresets(
  materials: CalculatorMaterialDto[],
  sheets: CalculatorSheetFormatDto[],
): CalculatorPresetDto[] {
  const materialById = new Map(
    materials.map((material) => [material.id, material]),
  );
  const sheetById = new Map(sheets.map((sheet) => [sheet.id, sheet]));

  return MANUAL_PRESET_DEFINITIONS.flatMap((definition) => {
    const material = materialById.get(definition.materialId);

    if (!material) return [];

    return definition.sheetIds.flatMap((sheetId) => {
      const sheet = sheetById.get(sheetId);

      if (!sheet) return [];

      return {
        id: `manual:${material.id}:${sheet.id}`,
        label: `Материал: ${material.label} · ${sheet.label}`,
        brand: "",
        materialName: material.label,
        materialId: material.id,
        sheetPresetId: sheet.id,
      };
    });
  });
}

let calculatorDbFallbackActive = false;

function logCalculatorFallback(scope: string, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown database error";

  console.error(`[calculator-db-fallback] ${scope}: ${message}`);
}

async function withCalculatorDbFallback<T>(
  scope: string,
  fallback: T,
  loader: () => Promise<T>,
) {
  if (!hasDatabaseUrl()) return fallback;
  if (calculatorDbFallbackActive) return fallback;

  try {
    return await loader();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";

    if (
      message.includes("data transfer quota") ||
      message.includes("exceeded") ||
      message.includes("Raw query failed")
    ) {
      calculatorDbFallbackActive = true;
    }

    logCalculatorFallback(scope, error);
    return fallback;
  }
}

export async function getCalculatorMaterials(): Promise<
  CalculatorMaterialDto[]
> {
  return withCalculatorDbFallback(
    "getCalculatorMaterials",
    DEFAULT_MATERIALS,
    async () => {
      const db = getDb();
      const rows = await db.calculatorMaterial.findMany({
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      });
      const existingIds = new Set(rows.map((row) => row.slug));
      const activeRows = rows.filter((row) => row.isActive);

      if (activeRows.length === 0) return DEFAULT_MATERIALS;

      return mergeMissingDefaults(
        activeRows.map(mapCalculatorMaterialRow),
        DEFAULT_MATERIALS,
        existingIds,
      );
    },
  );
}

export async function getCalculatorSheetFormats(): Promise<
  CalculatorSheetFormatDto[]
> {
  return withCalculatorDbFallback(
    "getCalculatorSheetFormats",
    DEFAULT_SHEETS,
    async () => {
      const db = getDb();
      const rows = await db.calculatorSheetFormat.findMany({
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      });
      const existingIds = new Set(rows.map((row) => row.slug));
      const activeRows = rows.filter((row) => row.isActive);

      if (activeRows.length === 0) return DEFAULT_SHEETS;

      return mergeMissingDefaults(
        activeRows.map(mapCalculatorSheetRow),
        DEFAULT_SHEETS,
        existingIds,
      );
    },
  );
}

export async function getCalculatorPresets(): Promise<CalculatorPresetDto[]> {
  return withCalculatorDbFallback("getCalculatorPresets", [], async () => {
    const db = getDb();
    const rows = await db.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
      },
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
      select: {
        slug: true,
        name: true,
        format: true,
        thicknessMm: true,
        calculatorMaterialId: true,
        calculatorSheetPresetId: true,
        brand: { select: { slug: true, name: true } },
        category: { select: { slug: true, name: true } },
      },
    });

    return rows
      .map((row) => {
        const materialId = inferMaterialId(row);
        const sheetPresetId = inferSheetPresetId(row, materialId);

        if (!materialId || !sheetPresetId) return null;

        return {
          id: row.slug,
          label: row.brand?.name ? `${row.brand.name} — ${row.name}` : row.name,
          brand: row.brand?.name ?? "",
          materialName: row.name,
          materialId,
          sheetPresetId,
        };
      })
      .filter((preset): preset is CalculatorPresetDto => Boolean(preset));
  });
}

export async function getCalculatorBundle() {
  const [baseMaterials, baseSheets, presets] = await Promise.all([
    getCalculatorMaterials(),
    getCalculatorSheetFormats(),
    getCalculatorPresets(),
  ]);
  const materials = appendPresetMaterials(baseMaterials, presets);
  const sheets = appendPresetSheets(baseSheets, presets);

  return {
    materials,
    sheets,
    presets: [...getManualCalculatorPresets(materials, sheets), ...presets],
  };
}
