"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  Calculator,
  Check,
  Copy,
  FileDown,
  Layers3,
  Paperclip,
  Plus,
  Search,
  Scissors,
  ShoppingCart,
  X,
} from "lucide-react";

import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  submitCuttingRequestAction,
  type SubmitCuttingRequestInput,
} from "@/app/(public)/calculator/actions";
import type { CalculatorProductContext } from "@/features/catalog/data";
import { CALCULATOR_PRESET_HANDOFF_KEY } from "@/features/bazis/project-view";
import type { ImportedDetail } from "@/features/services/cut-list-import";
import { CutDetailTable } from "@/features/services/cut-detail-table";
import { CutListImportPanel } from "@/features/services/cut-list-import-panel";
import type {
  CalculatorMaterialDto,
  CalculatorPresetDto,
  CalculatorSheetFormatDto,
} from "@/lib/server/calculator-config";
import { formatPrice } from "@/lib/commerce";
import { cuttingSiteIncentive, cuttingSitePrices } from "@/lib/site-config";
import { cn } from "@/lib/utils";

type EdgeSide = "top" | "right" | "bottom" | "left";
type BasisFirstCutDirection = "auto" | "vertical" | "horizontal";
type CutStageDirection = Exclude<BasisFirstCutDirection, "auto">;
type OrientationMode = "free" | "fixed" | "rotated";
type RequestMessengerType = "" | "WHATSAPP" | "TELEGRAM";

type DetailRow = {
  id: string;
  title: string;
  width: string;
  height: string;
  quantity: string;
  edgedSides: EdgeSide[];
  orientationMode: OrientationMode;
};

type CalculatedDetailRow = Omit<DetailRow, "width" | "height" | "quantity"> & {
  width: number;
  height: number;
  quantity: number;
  areaSqM: number;
  perimeterMeters: number;
  edgeMeters: number;
  lineTotal: number;
};

type CutMapPiece = {
  id: string;
  title: string;
  width: number;
  height: number;
  edgedSides: EdgeSide[];
  orientationMode: OrientationMode;
};

type PlacedCutMapPiece = CutMapPiece & {
  x: number;
  y: number;
  rotated: boolean;
  sheetIndex: number;
  level: number;
};

type CutMapCut = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: CutStageDirection;
  level: number;
};

type CutMapSheet = {
  index: number;
  pieces: PlacedCutMapPiece[];
  cuts: CutMapCut[];
  offcuts: Array<{
    id: string;
    width: number;
    height: number;
    area: number;
  }>;
  offcutArea: number;
  largestOffcut: {
    width: number;
    height: number;
    area: number;
  } | null;
  usedArea: number;
  usableArea: number;
  cutLength: number;
  cutCount: number;
  workingArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

type CutMapResult = {
  sheets: CutMapSheet[];
  unplacedPieces: CutMapPiece[];
  totalPieces: number;
  placedPieces: number;
  utilization: number;
  cutLength: number;
  cutCount: number;
  rotatedPieces: number;
  offcutArea: number;
  largestOffcut: {
    width: number;
    height: number;
    area: number;
  } | null;
  firstCutDirection: CutStageDirection;
};

type BasisMapSettings = {
  kerf: number;
  edgeTrim: number;
  minStrip: number;
  firstCutDirection: BasisFirstCutDirection;
};

type WorkshopRow = {
  id: string;
  sequence: number;
  title: string;
  sizeLabel: string;
  quantity: number;
  edgeLabel: string;
  orientationLabel: string;
  sheetsLabel: string;
  statusLabel: string;
};

type CuttingRequestDraft = {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  messengerType: RequestMessengerType;
  messengerHandle: string;
  comment: string;
};

type FreeCutRect = {
  id: string;
  sheetIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  stage: CutStageDirection;
  level: number;
};

const edgeSideOrder: EdgeSide[] = ["top", "right", "bottom", "left"];
const allEdgeSides = [...edgeSideOrder];

const edgeSideMeta: Record<
  EdgeSide,
  { label: string; compactLabel: string; axis: "width" | "height" }
> = {
  top: { label: "Верх", compactLabel: "В", axis: "width" },
  right: { label: "Правая", compactLabel: "П", axis: "height" },
  bottom: { label: "Низ", compactLabel: "Н", axis: "width" },
  left: { label: "Левая", compactLabel: "Л", axis: "height" },
};

const orientationModeMeta: Record<
  OrientationMode,
  { label: string; description: string }
> = {
  free: {
    label: "Свободно",
    description: "Калькулятор может развернуть деталь ради лучшего КИМ.",
  },
  fixed: {
    label: "Как введено",
    description:
      "Сохраняет ориентацию размеров. Удобно для текстуры и фасадов.",
  },
  rotated: {
    label: "Повернуть 90°",
    description: "Жестко меняет ориентацию детали на листе.",
  },
};

const defaultBasisSettings: BasisMapSettings = {
  kerf: 4.2,
  edgeTrim: 10,
  minStrip: 60,
  firstCutDirection: "auto",
};

const cutMapPalette = [
  "#d66c3a",
  "#c88f52",
  "#8f9d80",
  "#5e8f9e",
  "#7f6d9f",
  "#a67c63",
];

type MaterialOption = CalculatorMaterialDto;
type SheetFormat = CalculatorSheetFormatDto;
type CalculatorPreset = CalculatorPresetDto;
type CalculatorPresetId = string;
type MaterialPresetScope = "all" | "cart";

const giblabEdgeAttributeBySide: Record<EdgeSide, string> = {
  top: "elt",
  right: "elr",
  bottom: "elb",
  left: "ell",
};

const rotatedEdgeSideMap: Record<EdgeSide, EdgeSide> = {
  top: "right",
  right: "bottom",
  bottom: "left",
  left: "top",
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getMaterialThickness(label: string) {
  const match = label.match(/(\d+(?:[.,]\d+)?)\s*мм/i);

  if (!match) {
    return 18;
  }

  return Number(match[1].replace(",", ".")) || 18;
}

function getBandWidthForGibLab(material: MaterialOption) {
  return Math.max(Math.ceil(getMaterialThickness(material.label)) + 3, 15);
}

function rotateEdgeSides(sides: EdgeSide[]) {
  return normalizeEdgeSides(sides.map((side) => rotatedEdgeSideMap[side]));
}

function getGibLabPartGeometry(row: CalculatedDetailRow) {
  if (row.orientationMode !== "rotated") {
    return {
      length: row.width,
      width: row.height,
      edgedSides: normalizeEdgeSides(row.edgedSides),
      textured: row.orientationMode !== "free",
      name: row.title,
    };
  }

  return {
    length: row.height,
    width: row.width,
    edgedSides: rotateEdgeSides(row.edgedSides),
    textured: true,
    name: `${row.title} 90`,
  };
}

function getGibLabFileName(date: Date, projectReference?: string | null) {
  if (projectReference) {
    const safeReference = projectReference.replace(/[^a-zA-Z0-9_-]+/g, "-");
    return `${safeReference}-giblab.project`;
  }

  const stamp = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(",", "")
    .replaceAll(" ", "-")
    .replaceAll(":", "");

  return `artisan-giblab-${stamp}.project`;
}

function buildGibLabProjectXml({
  material,
  sheet,
  rows,
  basisSettings,
  sheetCount,
  edgeThicknessMm,
  edgeWidthMm,
  projectReference,
}: {
  material: MaterialOption;
  sheet: SheetFormat;
  rows: CalculatedDetailRow[];
  basisSettings: BasisMapSettings;
  sheetCount: number;
  edgeThicknessMm: number;
  edgeWidthMm: number;
  projectReference?: string | null;
}) {
  const validRows = rows.filter(
    (row) => row.width > 0 && row.height > 0 && row.quantity > 0,
  );

  const productGoodId = 1;
  const cutToolGoodId = 2;
  const sheetMaterialGoodId = 3;
  const edgeToolGoodId = 4;
  const bandGoodId = 5;
  const sheetPartId = 1;
  const cutOperationId = 1;
  const edgeOperationId = 2;
  const availableSheetCount = Math.max(sheetCount + 2, 10);
  const bandWidth = edgeWidthMm;

  const partEntries = validRows.map((row, index) => {
    const partId = index + 2;
    const geometry = getGibLabPartGeometry(row);
    const hasEdging =
      material.edgeRatePerMeter > 0 && geometry.edgedSides.length > 0;
    const edgeAttributes = hasEdging
      ? geometry.edgedSides
          .map(
            (side) =>
              `${giblabEdgeAttributeBySide[side]}="@operation#${edgeOperationId}"`,
          )
          .join(" ")
      : "";

    return {
      id: partId,
      xml: `\t\t<part id="${partId}" l="${geometry.length}" w="${geometry.width}" count="${row.quantity}" txt="${geometry.textured ? "true" : "false"}" name="${escapeXml(geometry.name)}"${edgeAttributes ? ` ${edgeAttributes}` : ""} />`,
      hasEdging,
    };
  });

  const cutOperationParts = [
    ...partEntries.map((part) => `\t\t<part id="${part.id}" />`),
    `\t\t<part id="${sheetPartId}" />`,
  ].join("\n");

  const edgeOperationParts = partEntries
    .filter((part) => part.hasEdging)
    .map((part) => `\t\t<part id="${part.id}" />`)
    .join("\n");

  const comments = [
    `\t<!-- Artisan export for GibLab -->`,
    projectReference
      ? `\t<!-- Request: ${escapeXml(projectReference)} -->`
      : null,
    `\t<!-- Kerf: ${basisSettings.kerf.toFixed(1)} mm -->`,
    `\t<!-- Edge trim: ${basisSettings.edgeTrim.toFixed(0)} mm -->`,
    `\t<!-- Min strip: ${basisSettings.minStrip.toFixed(0)} mm -->`,
    `\t<!-- First cut: ${basisSettings.firstCutDirection} -->`,
  ]
    .filter(Boolean)
    .join("\n");

  const projectName = projectReference
    ? `Artisan ${projectReference}`
    : "Artisan Cut Project";

  const edgeBlock =
    edgeOperationParts.length > 0
      ? `\n\t<good id="${edgeToolGoodId}" typeId="tool.edgeline" />\n\t<good id="${bandGoodId}" typeId="band" name="${escapeXml(`Кромка ${edgeThicknessMm} мм ${bandWidth}x${edgeThicknessMm}`)}" code="${escapeXml(`ARTISAN-EDGE-${String(edgeThicknessMm).replace(".", "_")}MM`)}" unit="м" cost="${material.edgeRatePerMeter.toFixed(2)}" t="${edgeThicknessMm}" w="${bandWidth}" />\n\t<operation id="${edgeOperationId}" typeId="EL" tool1="${edgeToolGoodId}">\n${edgeOperationParts}\n\t\t<material id="${bandGoodId}" />\n\t</operation>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>\n<project currency="сом" version="1">\n${comments}\n\t<good id="${productGoodId}" typeId="product" count="1" name="${escapeXml(projectName)}">\n${partEntries.map((part) => part.xml).join("\n")}\n\t</good>\n\t<good id="${cutToolGoodId}" typeId="tool.cutting" />\n\t<good id="${sheetMaterialGoodId}" typeId="sheet" name="${escapeXml(material.label)}" code="${escapeXml(`${material.id}-${sheet.id}`)}" unit="м2" cost="${material.pricePerSqM.toFixed(2)}">\n\t\t<part id="${sheetPartId}" l="${sheet.width}" w="${sheet.height}" count="${availableSheetCount}" usedCount="${Math.max(sheetCount, 0)}" />\n\t</good>\n\t<operation id="${cutOperationId}" typeId="CS" tool1="${cutToolGoodId}" cSizeMode="0">\n${cutOperationParts}\n\t\t<material id="${sheetMaterialGoodId}" />\n\t</operation>${edgeBlock}\n</project>\n`;
}

function createDetailId(seed: number | string) {
  return `detail-${seed}-${Math.random().toString(36).slice(2, 7)}`;
}

function createRow(index: number): DetailRow {
  return {
    id: createDetailId(index),
    title: `Деталь ${index}`,
    width: "",
    height: "",
    quantity: "1",
    edgedSides: [...allEdgeSides],
    orientationMode: "free",
  };
}

// Калькулятор открывается с одной пустой строкой: пример с готовыми
// размерами новички принимали за свой расчёт.
function createInitialRows(): DetailRow[] {
  return [createRow(1)];
}

const DRAFT_STORAGE_KEY = "artisan:cut-calculator:draft:v1";
const MAX_REQUEST_ATTACHMENTS = 5;
// Vercel принимает запрос до 4,5 МБ, оставляем запас на данные заявки.
const MAX_REQUEST_ATTACHMENTS_BYTES = 4 * 1024 * 1024;
const requestAttachmentAccept =
  ".jpg,.jpeg,.png,.webp,.heic,.pdf,.xls,.xlsx,.csv,.txt,.doc,.docx,.zip,.rar,.b3d,.bpr,.sto,.project,.xml,.dxf,.dwg";

type CalculatorDraft = {
  details: DetailRow[];
  contact: Pick<
    CuttingRequestDraft,
    | "contactName"
    | "contactPhone"
    | "contactEmail"
    | "messengerType"
    | "messengerHandle"
  >;
  savedAt: string;
};

function isDetailRow(value: unknown): value is DetailRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;

  return (
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    typeof row.width === "string" &&
    typeof row.height === "string" &&
    typeof row.quantity === "string" &&
    Array.isArray(row.edgedSides) &&
    row.edgedSides.every((side) => allEdgeSides.includes(side as EdgeSide)) &&
    (row.orientationMode === "free" ||
      row.orientationMode === "fixed" ||
      row.orientationMode === "rotated")
  );
}

function isSampleRows(rows: DetailRow[]) {
  const sample = createInitialRows();

  return (
    rows.length === sample.length &&
    rows.every(
      (row, index) =>
        row.title === sample[index].title &&
        row.width === sample[index].width &&
        row.height === sample[index].height &&
        row.quantity === sample[index].quantity,
    )
  );
}

function readCalculatorDraft(): CalculatorDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CalculatorDraft>;
    const details = Array.isArray(parsed.details)
      ? parsed.details.filter(isDetailRow)
      : [];

    if (details.length === 0) return null;

    return {
      details,
      contact: {
        contactName: String(parsed.contact?.contactName ?? ""),
        contactPhone: String(parsed.contact?.contactPhone ?? ""),
        contactEmail: String(parsed.contact?.contactEmail ?? ""),
        messengerType:
          parsed.contact?.messengerType === "WHATSAPP" ||
          parsed.contact?.messengerType === "TELEGRAM"
            ? parsed.contact.messengerType
            : "",
        messengerHandle: String(parsed.contact?.messengerHandle ?? ""),
      },
      savedAt: String(parsed.savedAt ?? ""),
    };
  } catch {
    return null;
  }
}

function writeCalculatorDraft(draft: CalculatorDraft | null) {
  try {
    if (draft) {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } else {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  } catch {
    // Хранилище недоступно (приватный режим), черновик просто не сохраняем.
  }
}

function importedDetailToRow(detail: ImportedDetail, index: number): DetailRow {
  return {
    ...createRow(index),
    title: detail.title,
    width: String(detail.length),
    height: String(detail.width),
    quantity: String(detail.quantity),
    edgedSides: normalizeEdgeSides(detail.edgedSides),
    orientationMode: detail.fixedGrain ? "fixed" : "free",
  };
}

async function compressImageAttachment(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 600_000) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );

    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} МБ`
    : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function getCutMapColor(index: number) {
  return cutMapPalette[index % cutMapPalette.length];
}

function parsePositive(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseManualSize(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatManualSize(value: number) {
  return Number.isInteger(value)
    ? value.toFixed(0)
    : value.toString().replace(".", ",");
}

function isManualSizingMaterial(material: MaterialOption | null | undefined) {
  const materialId = material?.id.toLowerCase() ?? "";
  return materialId.startsWith("countertop-") || materialId.startsWith("hpl-");
}

function getManualMaterialLabel(material: MaterialOption, thicknessMm: number) {
  const baseLabel = material.label
    .replace(/\s*\d+(?:[.,]\d+)?\s*(?:мм|mm)\b/i, "")
    .trim();

  return `${baseLabel || material.label} ${formatManualSize(thicknessMm)} мм`;
}

function getManualSheetLabel(width: number, height: number) {
  return `${formatManualSize(width)} × ${formatManualSize(height)} мм`;
}

function normalizeEdgeSides(sides: EdgeSide[]) {
  return edgeSideOrder.filter((side) => sides.includes(side));
}

function hasSameSides(left: EdgeSide[], right: EdgeSide[]) {
  if (left.length !== right.length) {
    return false;
  }

  return normalizeEdgeSides(left).every((side) => right.includes(side));
}

function getEdgeMeters(
  width: number,
  height: number,
  quantity: number,
  edgedSides: EdgeSide[],
) {
  const totalMillimeters = edgedSides.reduce((sum, side) => {
    return sum + (edgeSideMeta[side].axis === "width" ? width : height);
  }, 0);

  return (totalMillimeters * quantity) / 1000;
}

function getReadableEdgeSelection(
  edgedSides: EdgeSide[],
  edgeThicknessLabel: string,
) {
  if (edgedSides.length === 0) {
    return `Кромка ${edgeThicknessLabel} не выбрана`;
  }

  return `Кромка ${edgeThicknessLabel}: ${normalizeEdgeSides(edgedSides)
    .map((side) => edgeSideMeta[side].label)
    .join(", ")}`;
}

function getCompactEdgeLabel(edgedSides: EdgeSide[]) {
  const normalizedSides = normalizeEdgeSides(edgedSides);

  if (normalizedSides.length === 0) {
    return "Без кромки";
  }

  if (hasSameSides(normalizedSides, allEdgeSides)) {
    return "Периметр";
  }

  if (hasSameSides(normalizedSides, ["top", "bottom"])) {
    return "2 длинные";
  }

  if (hasSameSides(normalizedSides, ["left", "right"])) {
    return "2 короткие";
  }

  return normalizedSides.map((side) => edgeSideMeta[side].label).join(", ");
}

function getSourceRowId(pieceId: string) {
  return pieceId.replace(/-\d+$/, "");
}

function getOrientationModeLabel(mode: OrientationMode) {
  return orientationModeMeta[mode].label;
}

function findPresetById(
  presets: CalculatorPreset[],
  presetId: CalculatorPresetId,
): CalculatorPreset | null {
  return presets.find((preset) => preset.id === presetId) ?? null;
}

function findPresetByContext(
  presets: CalculatorPreset[],
  productContext: CalculatorProductContext | null,
): CalculatorPreset | null {
  if (!productContext) return null;

  return (
    presets.find(
      (preset) =>
        preset.materialId === productContext.calculatorMaterialId &&
        preset.sheetPresetId === productContext.sheetPresetId,
    ) ?? null
  );
}

function normalizeMaterialSearch(value: string) {
  return value
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizeArticle(value: string) {
  return value.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]+/gu, "");
}

function matchesMaterialSearch(
  preset: CalculatorPreset,
  query: string,
  materials: MaterialOption[],
  sheets: SheetFormat[],
) {
  const normalizedQuery = normalizeMaterialSearch(query);

  if (!normalizedQuery) {
    return true;
  }

  const normalizedArticleQuery = normalizeArticle(query);
  const normalizedSku = normalizeArticle(preset.sku);

  if (
    normalizedArticleQuery.length >= 3 &&
    normalizedSku.includes(normalizedArticleQuery)
  ) {
    return true;
  }

  const material = materials.find((item) => item.id === preset.materialId);
  const sheet = sheets.find((item) => item.id === preset.sheetPresetId);
  const searchableText = normalizeMaterialSearch(
    [
      preset.label,
      preset.brand,
      preset.sku,
      preset.materialName,
      material?.label,
      material?.thicknessMm ? `${material.thicknessMm} мм` : "",
      sheet?.label,
    ].join(" "),
  );
  const searchableTerms = searchableText.split(/\s+/);

  return normalizedQuery
    .split(/\s+/)
    .every((term) =>
      /^\d+$/.test(term)
        ? searchableTerms.includes(term)
        : searchableText.includes(term),
    );
}

function buildCutMap(
  rows: CalculatedDetailRow[],
  sheet: SheetFormat,
  settings: BasisMapSettings,
): CutMapResult {
  const pieces: CutMapPiece[] = rows.flatMap((row) => {
    if (!row.width || !row.height || !row.quantity) {
      return [];
    }

    return Array.from({ length: row.quantity }, (_, index) => ({
      id: `${row.id}-${index + 1}`,
      title: row.quantity > 1 ? `${row.title} ${index + 1}` : row.title,
      width: row.width,
      height: row.height,
      edgedSides: row.edgedSides,
      orientationMode: row.orientationMode,
    }));
  });

  const fallbackDirection: CutStageDirection =
    settings.firstCutDirection === "auto"
      ? "vertical"
      : settings.firstCutDirection;

  if (pieces.length === 0) {
    return {
      sheets: [],
      unplacedPieces: [],
      totalPieces: 0,
      placedPieces: 0,
      utilization: 0,
      cutLength: 0,
      cutCount: 0,
      rotatedPieces: 0,
      offcutArea: 0,
      largestOffcut: null,
      firstCutDirection: fallbackDirection,
    };
  }

  const sortedPieces = [...pieces].sort((left, right) => {
    const areaDelta = right.width * right.height - left.width * left.height;

    if (areaDelta !== 0) {
      return areaDelta;
    }

    return (
      Math.max(right.width, right.height) - Math.max(left.width, left.height)
    );
  });

  const workingArea = {
    x: settings.edgeTrim,
    y: settings.edgeTrim,
    width: Math.max(sheet.width - settings.edgeTrim * 2, 0),
    height: Math.max(sheet.height - settings.edgeTrim * 2, 0),
  };

  const getOrientations = (piece: CutMapPiece) => {
    if (piece.orientationMode === "fixed" || piece.width === piece.height) {
      return [{ width: piece.width, height: piece.height, rotated: false }];
    }

    if (piece.orientationMode === "rotated") {
      return [{ width: piece.height, height: piece.width, rotated: true }];
    }

    return [
      { width: piece.width, height: piece.height, rotated: false },
      { width: piece.height, height: piece.width, rotated: true },
    ];
  };

  const isPrimaryStripAllowed = (
    stage: CutStageDirection,
    width: number,
    height: number,
  ) => {
    const primarySize = stage === "vertical" ? width : height;
    return primarySize >= settings.minStrip;
  };

  const canKeepRect = (rect: FreeCutRect) => {
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    const primarySize = rect.stage === "vertical" ? rect.width : rect.height;
    return primarySize >= settings.minStrip;
  };

  const canFitFreshSheet = (
    piece: CutMapPiece,
    firstCutDirection: CutStageDirection,
  ) => {
    return getOrientations(piece).some((orientation) => {
      return (
        orientation.width <= workingArea.width &&
        orientation.height <= workingArea.height &&
        isPrimaryStripAllowed(
          firstCutDirection,
          orientation.width,
          orientation.height,
        )
      );
    });
  };

  const buildByDirection = (firstCutDirection: CutStageDirection) => {
    if (workingArea.width <= 0 || workingArea.height <= 0) {
      return {
        sheets: [],
        unplacedPieces: pieces,
        totalPieces: pieces.length,
        placedPieces: 0,
        utilization: 0,
        cutLength: 0,
        cutCount: 0,
        rotatedPieces: 0,
        offcutArea: 0,
        largestOffcut: null,
        firstCutDirection,
      } satisfies CutMapResult;
    }

    const sheetStates = new Map<
      number,
      {
        index: number;
        pieces: PlacedCutMapPiece[];
        cuts: CutMapCut[];
        usedArea: number;
        cutLength: number;
        cutCount: number;
        workingArea: CutMapSheet["workingArea"];
      }
    >();
    const freeRects: FreeCutRect[] = [];
    const unplacedPieces: CutMapPiece[] = [];
    let rotatedPieces = 0;
    let cutLineIndex = 0;
    let nextSheetIndex = 1;

    const createSheetState = (index: number) => {
      sheetStates.set(index, {
        index,
        pieces: [],
        cuts: [],
        usedArea: 0,
        cutLength: 0,
        cutCount: 0,
        workingArea: { ...workingArea },
      });
      freeRects.push({
        id: `sheet-${index}-root`,
        sheetIndex: index,
        x: workingArea.x,
        y: workingArea.y,
        width: workingArea.width,
        height: workingArea.height,
        stage: firstCutDirection,
        level: 0,
      });
    };

    const findBestPlacement = (piece: CutMapPiece) => {
      let bestPlacement: {
        rectIndex: number;
        width: number;
        height: number;
        rotated: boolean;
        score: number;
      } | null = null;

      for (const [rectIndex, rect] of freeRects.entries()) {
        for (const orientation of getOrientations(piece)) {
          if (
            orientation.width > rect.width ||
            orientation.height > rect.height ||
            !isPrimaryStripAllowed(
              rect.stage,
              orientation.width,
              orientation.height,
            )
          ) {
            continue;
          }

          const pieceArea = orientation.width * orientation.height;
          const rectArea = rect.width * rect.height;
          const primaryWaste =
            rect.stage === "vertical"
              ? rect.width - orientation.width
              : rect.height - orientation.height;
          const secondaryWaste =
            rect.stage === "vertical"
              ? rect.height - orientation.height
              : rect.width - orientation.width;
          const stripFillRatio =
            rect.stage === "vertical"
              ? orientation.height / rect.height
              : orientation.width / rect.width;
          const score =
            rectArea -
            pieceArea -
            stripFillRatio * 1200 +
            secondaryWaste * 0.85 +
            primaryWaste * 0.35 +
            rect.level * 18 +
            rect.sheetIndex * 2 +
            (orientation.rotated ? 4 : 0);

          if (!bestPlacement || score < bestPlacement.score) {
            bestPlacement = {
              rectIndex,
              width: orientation.width,
              height: orientation.height,
              rotated: orientation.rotated,
              score,
            };
          }
        }
      }

      return bestPlacement;
    };

    createSheetState(nextSheetIndex);

    for (const piece of sortedPieces) {
      let isPlaced = false;

      while (!isPlaced) {
        const placement = findBestPlacement(piece);

        if (!placement) {
          if (!canFitFreshSheet(piece, firstCutDirection)) {
            unplacedPieces.push(piece);
            break;
          }

          nextSheetIndex += 1;
          createSheetState(nextSheetIndex);
          continue;
        }

        const targetRect = freeRects.splice(placement.rectIndex, 1)[0];
        const sheetState = sheetStates.get(targetRect.sheetIndex);

        if (!sheetState) {
          break;
        }

        const placedPiece: PlacedCutMapPiece = {
          ...piece,
          x: targetRect.x,
          y: targetRect.y,
          width: placement.width,
          height: placement.height,
          rotated: placement.rotated,
          sheetIndex: targetRect.sheetIndex,
          level: targetRect.level,
        };

        sheetState.pieces.push(placedPiece);
        sheetState.usedArea += placement.width * placement.height;
        if (placement.rotated) {
          rotatedPieces += 1;
        }

        if (targetRect.stage === "vertical") {
          const rightRect: FreeCutRect = {
            id: `${targetRect.id}-right`,
            sheetIndex: targetRect.sheetIndex,
            x: targetRect.x + placement.width + settings.kerf,
            y: targetRect.y,
            width: targetRect.width - placement.width - settings.kerf,
            height: targetRect.height,
            stage: "vertical",
            level: targetRect.level,
          };
          const bottomRect: FreeCutRect = {
            id: `${targetRect.id}-bottom`,
            sheetIndex: targetRect.sheetIndex,
            x: targetRect.x,
            y: targetRect.y + placement.height + settings.kerf,
            width: placement.width,
            height: targetRect.height - placement.height - settings.kerf,
            stage: "horizontal",
            level: targetRect.level + 1,
          };

          if (canKeepRect(rightRect)) {
            sheetState.cuts.push({
              id: `cut-${cutLineIndex + 1}`,
              x: targetRect.x + placement.width,
              y: targetRect.y,
              width: settings.kerf,
              height: targetRect.height,
              orientation: "vertical",
              level: targetRect.level,
            });
            cutLineIndex += 1;
            sheetState.cutLength += targetRect.height;
            sheetState.cutCount += 1;
            freeRects.push(rightRect);
          }

          if (canKeepRect(bottomRect)) {
            sheetState.cuts.push({
              id: `cut-${cutLineIndex + 1}`,
              x: targetRect.x,
              y: targetRect.y + placement.height,
              width: placement.width,
              height: settings.kerf,
              orientation: "horizontal",
              level: targetRect.level + 1,
            });
            cutLineIndex += 1;
            sheetState.cutLength += placement.width;
            sheetState.cutCount += 1;
            freeRects.push(bottomRect);
          }
        } else {
          const bottomRect: FreeCutRect = {
            id: `${targetRect.id}-bottom`,
            sheetIndex: targetRect.sheetIndex,
            x: targetRect.x,
            y: targetRect.y + placement.height + settings.kerf,
            width: targetRect.width,
            height: targetRect.height - placement.height - settings.kerf,
            stage: "horizontal",
            level: targetRect.level,
          };
          const rightRect: FreeCutRect = {
            id: `${targetRect.id}-right`,
            sheetIndex: targetRect.sheetIndex,
            x: targetRect.x + placement.width + settings.kerf,
            y: targetRect.y,
            width: targetRect.width - placement.width - settings.kerf,
            height: placement.height,
            stage: "vertical",
            level: targetRect.level + 1,
          };

          if (canKeepRect(bottomRect)) {
            sheetState.cuts.push({
              id: `cut-${cutLineIndex + 1}`,
              x: targetRect.x,
              y: targetRect.y + placement.height,
              width: targetRect.width,
              height: settings.kerf,
              orientation: "horizontal",
              level: targetRect.level,
            });
            cutLineIndex += 1;
            sheetState.cutLength += targetRect.width;
            sheetState.cutCount += 1;
            freeRects.push(bottomRect);
          }

          if (canKeepRect(rightRect)) {
            sheetState.cuts.push({
              id: `cut-${cutLineIndex + 1}`,
              x: targetRect.x + placement.width,
              y: targetRect.y,
              width: settings.kerf,
              height: placement.height,
              orientation: "vertical",
              level: targetRect.level + 1,
            });
            cutLineIndex += 1;
            sheetState.cutLength += placement.height;
            sheetState.cutCount += 1;
            freeRects.push(rightRect);
          }
        }

        isPlaced = true;
      }
    }

    const sheets = Array.from(sheetStates.values())
      .sort((left, right) => left.index - right.index)
      .map((sheetState) => {
        const offcuts = freeRects
          .filter((rect) => rect.sheetIndex === sheetState.index)
          .map((rect) => ({
            id: rect.id,
            width: rect.width,
            height: rect.height,
            area: rect.width * rect.height,
          }))
          .sort((left, right) => right.area - left.area);
        const offcutArea = offcuts.reduce((sum, item) => sum + item.area, 0);
        const largestOffcut = offcuts[0]
          ? {
              width: offcuts[0].width,
              height: offcuts[0].height,
              area: offcuts[0].area,
            }
          : null;

        return {
          index: sheetState.index,
          pieces: sheetState.pieces,
          cuts: sheetState.cuts,
          offcuts,
          offcutArea,
          largestOffcut,
          usedArea: sheetState.usedArea,
          usableArea: workingArea.width * workingArea.height,
          cutLength: sheetState.cutLength,
          cutCount: sheetState.cutCount,
          workingArea: sheetState.workingArea,
        };
      });
    const totalUsedArea = sheets.reduce(
      (sum, sheetState) => sum + sheetState.usedArea,
      0,
    );
    const totalUsableArea =
      sheets.length * workingArea.width * workingArea.height;
    const totalCutLength = sheets.reduce(
      (sum, sheetState) => sum + sheetState.cutLength,
      0,
    );
    const totalCutCount = sheets.reduce(
      (sum, sheetState) => sum + sheetState.cutCount,
      0,
    );
    const totalOffcutArea = sheets.reduce(
      (sum, sheetState) => sum + sheetState.offcutArea,
      0,
    );
    const largestOffcut =
      sheets
        .map((sheetState) => sheetState.largestOffcut)
        .filter(
          (item): item is NonNullable<CutMapSheet["largestOffcut"]> =>
            item !== null,
        )
        .sort((left, right) => right.area - left.area)[0] ?? null;

    return {
      sheets,
      unplacedPieces,
      totalPieces: pieces.length,
      placedPieces: pieces.length - unplacedPieces.length,
      utilization: totalUsableArea > 0 ? totalUsedArea / totalUsableArea : 0,
      cutLength: totalCutLength,
      cutCount: totalCutCount,
      rotatedPieces,
      offcutArea: totalOffcutArea,
      largestOffcut,
      firstCutDirection,
    } satisfies CutMapResult;
  };

  const candidates =
    settings.firstCutDirection === "auto"
      ? [buildByDirection("vertical"), buildByDirection("horizontal")]
      : [buildByDirection(settings.firstCutDirection)];

  return candidates.reduce((bestResult, candidate) => {
    if (candidate.unplacedPieces.length !== bestResult.unplacedPieces.length) {
      return candidate.unplacedPieces.length < bestResult.unplacedPieces.length
        ? candidate
        : bestResult;
    }

    if (candidate.sheets.length !== bestResult.sheets.length) {
      return candidate.sheets.length < bestResult.sheets.length
        ? candidate
        : bestResult;
    }

    if (Math.abs(candidate.utilization - bestResult.utilization) > 0.0001) {
      return candidate.utilization > bestResult.utilization
        ? candidate
        : bestResult;
    }

    if (candidate.cutCount !== bestResult.cutCount) {
      return candidate.cutCount < bestResult.cutCount ? candidate : bestResult;
    }

    if (Math.abs(candidate.cutLength - bestResult.cutLength) > 0.5) {
      return candidate.cutLength < bestResult.cutLength
        ? candidate
        : bestResult;
    }

    if (candidate.rotatedPieces !== bestResult.rotatedPieces) {
      return candidate.rotatedPieces < bestResult.rotatedPieces
        ? candidate
        : bestResult;
    }

    return bestResult;
  });
}

function MetricTile({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-[14px] border px-3 py-2.5",
        muted
          ? "border-[color:var(--line)] bg-white"
          : "border-white/10 bg-white/6",
      )}
    >
      <p
        className={cn(
          "truncate text-xs font-medium",
          muted ? "text-[var(--muted)]" : "text-white/54",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-[13px] leading-5 font-semibold break-words",
          muted ? "text-[var(--foreground)]" : "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ContextField({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0 rounded-[14px] border border-[color:var(--line)] bg-[var(--surface-strong)] px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="truncate text-xs font-medium text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 truncate text-[13px] font-medium text-[var(--foreground)] sm:text-sm">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 truncate text-[11px] text-[var(--muted)] sm:text-[12px]">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

const initialCuttingRequestDraft: CuttingRequestDraft = {
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  messengerType: "",
  messengerHandle: "",
  comment: "",
};

function getCuttingRequestMaterialLabel({
  productContext,
  activePreset,
  material,
  sheet,
}: {
  productContext: CalculatorProductContext | null;
  activePreset: CalculatorPreset | null;
  material: MaterialOption;
  sheet: SheetFormat;
}) {
  const usesPresetValues = Boolean(
    activePreset &&
    activePreset.materialId === material.id &&
    activePreset.sheetPresetId === sheet.id,
  );

  if (productContext) {
    const productLabel = `${productContext.brand} · ${productContext.name}`;
    return usesPresetValues
      ? `${productLabel} · ${sheet.label}`
      : `${productLabel} · ${material.label} · ${sheet.label}`;
  }

  if (activePreset && usesPresetValues) {
    return `${activePreset.label} · ${sheet.label}`;
  }

  return `${material.label} · ${sheet.label}`;
}

function buildCuttingRequestMessage({
  productContext,
  activePreset,
  material,
  sheet,
  edgeThicknessLabel,
  calculation,
  cutMap,
  estimate,
  workshopRows,
  comment,
}: {
  productContext: CalculatorProductContext | null;
  activePreset: CalculatorPreset | null;
  material: MaterialOption;
  sheet: SheetFormat;
  edgeThicknessLabel: string;
  calculation: {
    totalPieces: number;
    totalAreaSqM: number;
    totalContourCutMeters: number;
    totalEdgeMeters: number;
  };
  cutMap: {
    sheets: Array<{ index: number }>;
    placedPieces: number;
    totalPieces: number;
    cutLength: number;
    utilization: number;
  };
  estimate: {
    totalEstimate: number;
  };
  workshopRows: WorkshopRow[];
  comment: string;
}) {
  const lines = [
    `Материал: ${getCuttingRequestMaterialLabel({
      productContext,
      activePreset,
      material,
      sheet,
    })}`,
    `Формат листа: ${sheet.label}`,
    `Позиций: ${workshopRows.length}`,
    `Деталей: ${calculation.totalPieces}`,
    `Площадь деталей: ${calculation.totalAreaSqM.toFixed(2)} м²`,
    `Рез по карте: ${(cutMap.cutLength / 1000).toFixed(1)} м`,
    `Контур деталей: ${calculation.totalContourCutMeters.toFixed(1)} м`,
    `Кромка ${edgeThicknessLabel}: ${calculation.totalEdgeMeters.toFixed(1)} м`,
    `Листов по карте: ${cutMap.sheets.length}`,
    `Размещено: ${cutMap.placedPieces} из ${cutMap.totalPieces}`,
    `КИМ: ${(cutMap.utilization * 100).toFixed(0)}%`,
    `Ориентир: ${formatPrice(Math.round(estimate.totalEstimate))}`,
    "",
    "Детали:",
    ...workshopRows.map(
      (row) =>
        `${row.sequence}. ${row.title} — ${row.sizeLabel} · ${row.quantity} шт. · ${row.edgeLabel} · ${row.orientationLabel} · ${row.sheetsLabel}`,
    ),
  ];

  if (comment.trim()) {
    lines.push("", "Комментарий клиента:", comment.trim());
  }

  return lines.join("\n");
}

type CutCalculatorProps = {
  productContext?: CalculatorProductContext | null;
  materials: MaterialOption[];
  sheets: SheetFormat[];
  presets: CalculatorPreset[];
};

export function CutCalculator({
  productContext = null,
  materials,
  sheets,
  presets,
}: CutCalculatorProps) {
  const { items: cartItems } = useCart();
  const fallbackMaterial = materials[0];
  const fallbackSheet = sheets[0];
  const defaultPresetId = presets[0]?.id ?? null;

  const [manualPresetId, setManualPresetId] =
    useState<CalculatorPresetId | null>(defaultPresetId);
  const [materialPresetScope, setMaterialPresetScope] =
    useState<MaterialPresetScope>("all");
  const [materialSearch, setMaterialSearch] = useState("");
  const [manualThicknessMm, setManualThicknessMm] = useState("");
  const [manualSheetWidthMm, setManualSheetWidthMm] = useState("");
  const [manualSheetHeightMm, setManualSheetHeightMm] = useState("");
  const [edgeThicknessMm, setEdgeThicknessMm] = useState("1");
  const [edgeWidthMm, setEdgeWidthMm] = useState("");
  const [details, setDetails] = useState<DetailRow[]>(createInitialRows);
  const [requestDraft, setRequestDraft] = useState<CuttingRequestDraft>(
    initialCuttingRequestDraft,
  );
  const [requestFeedback, setRequestFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [submittedProjectReference, setSubmittedProjectReference] = useState<{
    number: string;
    signature: string;
  } | null>(null);
  const [isSubmittingRequest, startSubmittingRequest] = useTransition();
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isPreparingAttachments, setIsPreparingAttachments] = useState(false);
  const [restoredDraftAt, setRestoredDraftAt] = useState<string | null>(null);
  const draftReadyRef = useRef(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const calculatorSectionRef = useRef<HTMLElement>(null);
  const [showStickySummary, setShowStickySummary] = useState(false);

  useEffect(() => {
    const section = calculatorSectionRef.current;
    const requestForm = document.getElementById("cut-request-form");

    if (!section || !requestForm || !("IntersectionObserver" in window)) {
      return;
    }

    let sectionVisible = false;
    let formVisible = false;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === section) sectionVisible = entry.isIntersecting;
        if (entry.target === requestForm) formVisible = entry.isIntersecting;
      }
      setShowStickySummary(sectionVisible && !formVisible);
    });

    observer.observe(section);
    observer.observe(requestForm);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const draft = readCalculatorDraft();

    if (draft) {
      // Черновик живёт в localStorage и доступен только после гидратации.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetails(draft.details);
      setRequestDraft((current) => ({ ...current, ...draft.contact }));
      setRestoredDraftAt(draft.savedAt || null);
    }

    try {
      const handedPresetId = window.localStorage.getItem(
        CALCULATOR_PRESET_HANDOFF_KEY,
      );

      if (handedPresetId) {
        window.localStorage.removeItem(CALCULATOR_PRESET_HANDOFF_KEY);

        if (presets.some((preset) => preset.id === handedPresetId)) {
          setManualPresetId(handedPresetId);
        }
      }
    } catch {
      // Хранилище недоступно: материал клиент выберет сам.
    }

    draftReadyRef.current = true;
    // Читаем один раз при открытии страницы.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftReadyRef.current) return;

    const timer = window.setTimeout(() => {
      if (isSampleRows(details) && !requestDraft.contactPhone.trim()) {
        writeCalculatorDraft(null);
        return;
      }

      writeCalculatorDraft({
        details,
        contact: {
          contactName: requestDraft.contactName,
          contactPhone: requestDraft.contactPhone,
          contactEmail: requestDraft.contactEmail,
          messengerType: requestDraft.messengerType,
          messengerHandle: requestDraft.messengerHandle,
        },
        savedAt: new Date().toISOString(),
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    details,
    requestDraft.contactEmail,
    requestDraft.contactName,
    requestDraft.contactPhone,
    requestDraft.messengerHandle,
    requestDraft.messengerType,
  ]);
  const cartProductSlugs = useMemo(
    () => new Set(cartItems.map((item) => item.productSlug)),
    [cartItems],
  );
  const cartPresets = useMemo(
    () => presets.filter((preset) => cartProductSlugs.has(preset.id)),
    [cartProductSlugs, presets],
  );
  const scopedPresets = materialPresetScope === "cart" ? cartPresets : presets;
  const visiblePresets = useMemo(
    () =>
      scopedPresets.filter((preset) =>
        matchesMaterialSearch(preset, materialSearch, materials, sheets),
      ),
    [materialSearch, materials, scopedPresets, sheets],
  );

  const lockedPreset = findPresetByContext(presets, productContext);
  const activePreset =
    lockedPreset ??
    (manualPresetId ? findPresetById(presets, manualPresetId) : null);
  const baseMaterial =
    (activePreset
      ? materials.find((item) => item.id === activePreset.materialId)
      : null) ?? fallbackMaterial;
  const baseSheet =
    (activePreset
      ? sheets.find((item) => item.id === activePreset.sheetPresetId)
      : null) ?? fallbackSheet;
  const manualSizingAvailable = isManualSizingMaterial(baseMaterial);
  const manualThicknessValue = manualSizingAvailable
    ? parseManualSize(manualThicknessMm)
    : null;
  const manualSheetWidthValue = manualSizingAvailable
    ? parseManualSize(manualSheetWidthMm)
    : null;
  const manualSheetHeightValue = manualSizingAvailable
    ? parseManualSize(manualSheetHeightMm)
    : null;
  const manualSizingCustomized = Boolean(
    manualThicknessValue || manualSheetWidthValue || manualSheetHeightValue,
  );
  const material = useMemo<MaterialOption>(() => {
    if (!manualThicknessValue) {
      return baseMaterial;
    }

    return {
      ...baseMaterial,
      id: `${baseMaterial.id}-manual-${formatManualSize(manualThicknessValue)}`,
      label: getManualMaterialLabel(baseMaterial, manualThicknessValue),
      thicknessMm: manualThicknessValue,
    };
  }, [baseMaterial, manualThicknessValue]);
  const sheet = useMemo<SheetFormat>(() => {
    const width = manualSheetWidthValue ?? baseSheet.width;
    const height = manualSheetHeightValue ?? baseSheet.height;

    if (!manualSheetWidthValue && !manualSheetHeightValue) {
      return baseSheet;
    }

    return {
      ...baseSheet,
      id: `${baseSheet.id}-manual-${formatManualSize(width)}x${formatManualSize(
        height,
      )}`,
      label: getManualSheetLabel(width, height),
      width,
      height,
    };
  }, [baseSheet, manualSheetHeightValue, manualSheetWidthValue]);
  const isProductMode = Boolean(lockedPreset && productContext);
  const edgingAvailable = material ? material.edgeRatePerMeter > 0 : false;
  const edgeThicknessValue = parseManualSize(edgeThicknessMm) ?? 1;
  const edgeWidthValue =
    parseManualSize(edgeWidthMm) ?? getBandWidthForGibLab(material);
  const edgeThicknessLabel = `${formatManualSize(edgeThicknessValue)} мм`;
  const edgeWidthLabel = `${formatManualSize(edgeWidthValue)} мм`;
  const edgeSizeLabel = `${edgeThicknessLabel} × ${edgeWidthLabel}`;

  const basisSettings = defaultBasisSettings;

  const calculation = useMemo(() => {
    const rows = details.map((detail) => {
      const width = parsePositive(detail.width);
      const height = parsePositive(detail.height);
      const quantity = parsePositive(detail.quantity);
      const areaSqM = (width * height * quantity) / 1_000_000;
      const perimeterMeters = ((width + height) * 2 * quantity) / 1000;
      const edgeMeters = getEdgeMeters(
        width,
        height,
        quantity,
        detail.edgedSides,
      );
      const materialCost = areaSqM * material.pricePerSqM;
      // По ценам сайта распил считается за лист и в строку детали не входит.
      const contourCutCost = cuttingSiteIncentive
        ? 0
        : perimeterMeters * material.cutRatePerMeter;
      const edgeCost =
        edgeMeters *
        (cuttingSiteIncentive
          ? cuttingSitePrices.edge
          : material.edgeRatePerMeter);

      return {
        ...detail,
        width,
        height,
        quantity,
        areaSqM,
        perimeterMeters,
        edgeMeters,
        lineTotal: materialCost + contourCutCost + edgeCost,
      };
    });

    return {
      rows,
      totalPieces: rows.reduce((sum, row) => sum + row.quantity, 0),
      totalAreaSqM: rows.reduce((sum, row) => sum + row.areaSqM, 0),
      totalContourCutMeters: rows.reduce(
        (sum, row) => sum + row.perimeterMeters,
        0,
      ),
      totalEdgeMeters: rows.reduce((sum, row) => sum + row.edgeMeters, 0),
      sheetAreaSqM: (sheet.width * sheet.height) / 1_000_000,
    };
  }, [details, material, sheet]);

  const cutMap = useMemo(() => {
    return buildCutMap(calculation.rows, sheet, basisSettings);
  }, [basisSettings, calculation.rows, sheet]);

  const estimate = useMemo(() => {
    const sheetCount = cutMap.sheets.length;
    const cutMeters = cutMap.cutLength / 1000;
    const materialCost =
      sheetCount * calculation.sheetAreaSqM * material.pricePerSqM;
    // Раскрой, собранный на сайте, считается по сниженной цене:
    // распил за лист и кромка за метр, как обещано в плашке.
    const siteRates = cuttingSiteIncentive !== null;
    const cuttingCost = siteRates
      ? sheetCount * cuttingSitePrices.sheet
      : cutMeters * material.cutRatePerMeter;
    const edgeCost =
      calculation.totalEdgeMeters *
      (siteRates ? cuttingSitePrices.edge : material.edgeRatePerMeter);
    const setupFee =
      !siteRates && calculation.totalPieces > 0 ? material.setupFee : 0;

    return {
      sheetCount,
      cutMeters,
      materialCost,
      cuttingCost,
      edgeCost,
      setupFee,
      totalEstimate: materialCost + cuttingCost + edgeCost + setupFee,
    };
  }, [
    calculation.sheetAreaSqM,
    calculation.totalEdgeMeters,
    calculation.totalPieces,
    cutMap.cutLength,
    cutMap.sheets.length,
    material.cutRatePerMeter,
    material.edgeRatePerMeter,
    material.pricePerSqM,
    material.setupFee,
  ]);

  const workshopRows = useMemo<WorkshopRow[]>(() => {
    const placedEntries = cutMap.sheets.flatMap((cutSheet) =>
      cutSheet.pieces.map((piece) => ({
        piece,
        sheetIndex: cutSheet.index,
        sourceRowId: getSourceRowId(piece.id),
      })),
    );

    const unplacedCountByRowId = cutMap.unplacedPieces.reduce<
      Record<string, number>
    >((accumulator, piece) => {
      const sourceRowId = getSourceRowId(piece.id);

      accumulator[sourceRowId] = (accumulator[sourceRowId] ?? 0) + 1;

      return accumulator;
    }, {});

    return calculation.rows.map((row, index) => {
      const rowPlacements = placedEntries.filter(
        (entry) => entry.sourceRowId === row.id,
      );
      const sheetCountByIndex = rowPlacements.reduce<Record<number, number>>(
        (accumulator, entry) => {
          accumulator[entry.sheetIndex] =
            (accumulator[entry.sheetIndex] ?? 0) + 1;

          return accumulator;
        },
        {},
      );
      const sheetIndexes = Object.keys(sheetCountByIndex)
        .map((value) => Number(value))
        .sort((left, right) => left - right);
      const rotatedCount = rowPlacements.filter(
        (entry) => entry.piece.rotated,
      ).length;
      const placedCount = rowPlacements.length;
      const unplacedCount = unplacedCountByRowId[row.id] ?? 0;
      const sheetsLabel =
        sheetIndexes.length > 0
          ? sheetIndexes
              .map(
                (sheetIndex) =>
                  `Л${sheetIndex} ×${sheetCountByIndex[sheetIndex]}`,
              )
              .join(", ")
          : "Не разложено";
      const orientationLabel =
        row.orientationMode === "free" && placedCount > 0
          ? rotatedCount > 0
            ? `Свободно · повернуто ${rotatedCount}/${placedCount}`
            : "Свободно"
          : getOrientationModeLabel(row.orientationMode);
      const statusLabel =
        unplacedCount > 0
          ? `В карте ${placedCount}/${row.quantity}, вне карты ${unplacedCount}`
          : placedCount > 0
            ? `В карте ${placedCount}/${row.quantity}`
            : "Ждет раскладки";

      return {
        id: row.id,
        sequence: index + 1,
        title: row.title,
        sizeLabel: `${row.width} × ${row.height} мм`,
        quantity: row.quantity,
        edgeLabel: getCompactEdgeLabel(row.edgedSides),
        orientationLabel,
        sheetsLabel,
        statusLabel,
      };
    });
  }, [calculation.rows, cutMap.sheets, cutMap.unplacedPieces]);

  const exportableRows = useMemo(
    () =>
      calculation.rows.filter(
        (row) => row.width > 0 && row.height > 0 && row.quantity > 0,
      ),
    [calculation.rows],
  );

  const gibLabProjectSignature = useMemo(
    () =>
      JSON.stringify({
        material: {
          id: material.id,
          label: material.label,
          thicknessMm: material.thicknessMm,
        },
        sheet: {
          id: sheet.id,
          width: sheet.width,
          height: sheet.height,
        },
        rows: exportableRows.map((row) => ({
          title: row.title,
          width: row.width,
          height: row.height,
          quantity: row.quantity,
          edgedSides: row.edgedSides,
          orientationMode: row.orientationMode,
        })),
        edgeThicknessValue,
        edgeWidthValue,
      }),
    [
      edgeThicknessValue,
      edgeWidthValue,
      exportableRows,
      material.id,
      material.label,
      material.thicknessMm,
      sheet.height,
      sheet.id,
      sheet.width,
    ],
  );

  const edgeOptionLabel = useMemo(() => {
    if (calculation.totalEdgeMeters <= 0) {
      return "Без кромки";
    }

    return edgingAvailable
      ? `Кромка ${edgeSizeLabel} · ${calculation.totalEdgeMeters.toFixed(1)} м`
      : `Разметка кромки ${edgeSizeLabel} · ${calculation.totalEdgeMeters.toFixed(1)} м`;
  }, [calculation.totalEdgeMeters, edgeSizeLabel, edgingAvailable]);

  const requestPayload = useMemo<SubmitCuttingRequestInput>(
    () => ({
      subject: productContext
        ? `Распил: ${productContext.name}`
        : activePreset && !manualSizingCustomized
          ? `Распил: ${activePreset.label}`
          : `Распил: ${material.label}`,
      message: buildCuttingRequestMessage({
        productContext,
        activePreset,
        material,
        sheet,
        calculation,
        cutMap,
        estimate,
        edgeThicknessLabel: edgeSizeLabel,
        workshopRows,
        comment: requestDraft.comment,
      }),
      contactName: requestDraft.contactName,
      contactPhone: requestDraft.contactPhone,
      contactEmail: requestDraft.contactEmail,
      messengerType: requestDraft.messengerType,
      messengerHandle: requestDraft.messengerHandle,
      material: getCuttingRequestMaterialLabel({
        productContext,
        activePreset,
        material,
        sheet,
      }),
      cuttingSheetCount: cutMap.sheets.length || null,
      cuttingEdgeMeters: calculation.totalEdgeMeters || null,
      edgeOption: edgeOptionLabel,
      estimatedBudget: Math.round(estimate.totalEstimate),
    }),
    [
      activePreset,
      calculation,
      cutMap,
      edgeOptionLabel,
      edgeSizeLabel,
      estimate,
      material,
      manualSizingCustomized,
      productContext,
      requestDraft.comment,
      requestDraft.contactEmail,
      requestDraft.contactName,
      requestDraft.contactPhone,
      requestDraft.messengerHandle,
      requestDraft.messengerType,
      sheet,
      workshopRows,
    ],
  );

  const exportToGibLab = () => {
    if (exportableRows.length === 0) {
      return;
    }

    const projectReference =
      submittedProjectReference?.signature === gibLabProjectSignature
        ? submittedProjectReference.number
        : null;
    const projectXml = buildGibLabProjectXml({
      material,
      sheet,
      rows: exportableRows,
      basisSettings,
      sheetCount: Math.max(cutMap.sheets.length, estimate.sheetCount, 0),
      edgeThicknessMm: edgeThicknessValue,
      edgeWidthMm: edgeWidthValue,
      projectReference,
    });
    const blob = new Blob([projectXml], {
      type: "application/xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = getGibLabFileName(new Date(), projectReference);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const addRow = () => {
    setDetails((current) => [...current, createRow(current.length + 1)]);
  };

  const importDetails = (
    imported: ImportedDetail[],
    mode: "append" | "replace",
  ) => {
    setDetails((current) => {
      const keepCurrent =
        mode === "append" &&
        current.some(
          (row) => parsePositive(row.width) && parsePositive(row.height),
        );
      const base = keepCurrent ? current : [];

      return [
        ...base,
        ...imported.map((detail, index) =>
          importedDetailToRow(detail, base.length + index + 1),
        ),
      ];
    });
    setRestoredDraftAt(null);
  };

  const addAttachments = async (fileList: FileList | File[] | null) => {
    const picked = Array.from(fileList ?? []);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
    if (picked.length === 0) return;

    setIsPreparingAttachments(true);
    const prepared = await Promise.all(picked.map(compressImageAttachment));
    setIsPreparingAttachments(false);

    const next = [...attachments, ...prepared].slice(
      0,
      MAX_REQUEST_ATTACHMENTS,
    );
    const totalBytes = next.reduce((sum, file) => sum + file.size, 0);

    if (totalBytes > MAX_REQUEST_ATTACHMENTS_BYTES) {
      setRequestFeedback({
        tone: "error",
        message:
          "Файлы больше 4 МБ вместе. Прикрепите меньше файлов или отправьте большой проект менеджеру в WhatsApp.",
      });
      return;
    }

    if (attachments.length + prepared.length > MAX_REQUEST_ATTACHMENTS) {
      setRequestFeedback({
        tone: "error",
        message: `Можно прикрепить до ${MAX_REQUEST_ATTACHMENTS} файлов.`,
      });
    } else {
      setRequestFeedback(null);
    }

    setAttachments(next);
  };

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, i) => i !== index));
  };

  const duplicateRow = (id: string) => {
    setDetails((current) => {
      const targetIndex = current.findIndex((row) => row.id === id);

      if (targetIndex === -1) {
        return current;
      }

      const targetRow = current[targetIndex];
      const duplicate: DetailRow = {
        ...targetRow,
        id: createDetailId(`${targetIndex + 1}-copy`),
        title: `${targetRow.title} копия`,
      };

      return [
        ...current.slice(0, targetIndex + 1),
        duplicate,
        ...current.slice(targetIndex + 1),
      ];
    });
  };

  const updateRow = (id: string, patch: Partial<DetailRow>) => {
    setDetails((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const updateRequestDraft = <Key extends keyof CuttingRequestDraft>(
    key: Key,
    value: CuttingRequestDraft[Key],
  ) => {
    setRequestDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handlePresetChange = (presetId: string) => {
    const nextPresetId = presetId || null;
    const nextPreset = nextPresetId
      ? findPresetById(presets, nextPresetId)
      : null;
    const nextMaterial =
      (nextPreset
        ? materials.find((item) => item.id === nextPreset.materialId)
        : null) ?? fallbackMaterial;

    setManualPresetId(nextPresetId);

    if (!isManualSizingMaterial(nextMaterial)) {
      setManualThicknessMm("");
      setManualSheetWidthMm("");
      setManualSheetHeightMm("");
    }
  };

  const handleMaterialScopeChange = (scope: MaterialPresetScope) => {
    const nextPresets = scope === "cart" ? cartPresets : presets;

    setMaterialPresetScope(scope);
    setMaterialSearch("");

    if (
      nextPresets.length > 0 &&
      !nextPresets.some((preset) => preset.id === manualPresetId)
    ) {
      handlePresetChange(nextPresets[0].id);
    }
  };

  const handleMaterialSearchChange = (query: string) => {
    const nextVisiblePresets = scopedPresets.filter((preset) =>
      matchesMaterialSearch(preset, query, materials, sheets),
    );

    setMaterialSearch(query);

    if (
      nextVisiblePresets.length > 0 &&
      !nextVisiblePresets.some((preset) => preset.id === manualPresetId)
    ) {
      handlePresetChange(nextVisiblePresets[0].id);
    }
  };

  const removeRow = (id: string) => {
    setDetails((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id),
    );
  };

  const toggleEdgeSide = (id: string, side: EdgeSide) => {
    setDetails((current) =>
      current.map((row) => {
        if (row.id !== id) {
          return row;
        }

        const nextSides = row.edgedSides.includes(side)
          ? row.edgedSides.filter((currentSide) => currentSide !== side)
          : [...row.edgedSides, side];

        return {
          ...row,
          edgedSides: normalizeEdgeSides(nextSides),
        };
      }),
    );
  };

  const resetCalculator = () => {
    if (!lockedPreset) {
      setManualPresetId(defaultPresetId);
    }
    setManualThicknessMm("");
    setManualSheetWidthMm("");
    setManualSheetHeightMm("");
    setDetails(createInitialRows());
    setRequestFeedback(null);
    setSubmittedProjectReference(null);
    setAttachments([]);
    setRestoredDraftAt(null);
  };

  const handleRequestSubmit = () => {
    const hasDetails = exportableRows.length > 0;

    if (!hasDetails && attachments.length === 0) {
      setRequestFeedback({
        tone: "error",
        message:
          "Добавьте детали с размерами или прикрепите проект, Excel или фото списка.",
      });

      return;
    }

    if (!requestDraft.contactName.trim() || !requestDraft.contactPhone.trim()) {
      setRequestFeedback({
        tone: "error",
        message: "Укажите имя и телефон для заявки.",
      });

      return;
    }

    if (requestDraft.messengerType && !requestDraft.messengerHandle.trim()) {
      setRequestFeedback({
        tone: "error",
        message: "Добавьте контакт для выбранного мессенджера.",
      });

      return;
    }

    setRequestFeedback(null);

    startSubmittingRequest(() => {
      void (async () => {
        const formData = new FormData();
        const attachmentNames = attachments.map((file) => file.name);

        attachments.forEach((file) => formData.append("files", file));

        if (hasDetails) {
          const projectXml = buildGibLabProjectXml({
            material,
            sheet,
            rows: exportableRows,
            basisSettings,
            sheetCount: Math.max(cutMap.sheets.length, estimate.sheetCount, 0),
            edgeThicknessMm: edgeThicknessValue,
            edgeWidthMm: edgeWidthValue,
            projectReference: null,
          });
          formData.append(
            "files",
            new File([projectXml], getGibLabFileName(new Date()), {
              type: "application/xml",
            }),
          );
        }

        const payload: SubmitCuttingRequestInput = hasDetails
          ? {
              ...requestPayload,
              message:
                attachmentNames.length > 0
                  ? `${requestPayload.message}\n\nВложения клиента: ${attachmentNames.join(", ")}`
                  : requestPayload.message,
            }
          : {
              ...requestPayload,
              subject: `Распил по файлу: ${requestPayload.material}`,
              message: [
                `Материал: ${requestPayload.material}`,
                `Детали в файлах клиента: ${attachmentNames.join(", ")}`,
                requestDraft.comment.trim()
                  ? `\nКомментарий клиента:\n${requestDraft.comment.trim()}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n"),
              cuttingSheetCount: null,
              cuttingEdgeMeters: null,
              estimatedBudget: null,
            };
        if (cuttingSiteIncentive) {
          payload.message = `${payload.message}\n\n${cuttingSiteIncentive.managerNote}`;
        }

        const result = await submitCuttingRequestAction(payload, formData);

        if (!result.ok) {
          setRequestFeedback({
            tone: "error",
            message: result.message,
          });
          return;
        }

        setRequestFeedback({
          tone: "success",
          message: result.number
            ? `Заявка ${result.number} отправлена в работу.`
            : "Заявка отправлена в работу.",
        });
        if (result.number) {
          setSubmittedProjectReference({
            number: result.number,
            signature: gibLabProjectSignature,
          });
        }
        setRequestDraft((current) => ({
          ...current,
          comment: "",
        }));
        setAttachments([]);
      })();
    });
  };

  const detailColors = Object.fromEntries(
    details.map((detail, index) => [detail.id, getCutMapColor(index)]),
  );
  const detailLineTotals = Object.fromEntries(
    calculation.rows.map((row) => [
      row.id,
      row.lineTotal > 0 ? formatPrice(Math.round(row.lineTotal)) : "—",
    ]),
  );
  const detailEdgeLabels = Object.fromEntries(
    details.map((detail) => [
      detail.id,
      getReadableEdgeSelection(detail.edgedSides, edgeSizeLabel),
    ]),
  );
  const orientationOptions = (
    Object.keys(orientationModeMeta) as OrientationMode[]
  ).map((mode) => ({ value: mode, label: orientationModeMeta[mode].label }));

  const summaryCards = [
    {
      label: "Площадь деталей",
      value: `${calculation.totalAreaSqM.toFixed(2)} м²`,
      icon: Layers3,
    },
    {
      label: "Рез по карте",
      value: `${estimate.cutMeters.toFixed(1)} м`,
      icon: Scissors,
    },
    {
      label: `Кромка ${edgeSizeLabel}`,
      value: `${calculation.totalEdgeMeters.toFixed(1)} м`,
      icon: Check,
    },
    {
      label: "Листы по карте",
      value: `${estimate.sheetCount} шт.`,
      icon: Calculator,
    },
    {
      label: "КИМ карты",
      value: `${(cutMap.utilization * 100).toFixed(0)}%`,
      icon: Layers3,
    },
    {
      label: "Полезный остаток",
      value: `${(cutMap.offcutArea / 1_000_000).toFixed(2)} м²`,
      icon: Copy,
    },
  ];

  return (
    <section
      id="cut-calculator"
      ref={calculatorSectionRef}
      className="overflow-hidden rounded-[24px] border border-[#e3ddd2] bg-white"
    >
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="p-3 sm:p-6 lg:p-7 xl:p-8">
          <div className="grid gap-1.5 sm:gap-3">
            <div className="max-w-3xl">
              <p className="text-[13px] font-semibold text-[var(--accent)]">
                Параметры расчета
              </p>
            </div>
          </div>

          <div className="mt-3 border-y border-[#151411]/10 py-2.5 sm:mt-5 sm:py-4">
            {isProductMode && productContext ? (
              <div className="grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.8fr)]">
                <ContextField
                  label="Товар"
                  value={productContext.name}
                  detail={productContext.brand}
                />
                <ContextField label="Материал" value={material.label} />
                <ContextField label="Формат листа" value={sheet.label} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)]">
                <div className="min-w-0 space-y-2.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label
                      htmlFor="calculator-material-search"
                      className="min-w-0 text-[12px] font-medium text-[var(--foreground)] sm:text-sm"
                    >
                      Материал из каталога
                    </label>

                    <div
                      className="grid h-8 grid-cols-2 border border-[color:var(--line)] bg-[var(--surface-strong)]"
                      role="group"
                      aria-label="Источник материалов"
                    >
                      <button
                        type="button"
                        className={cn(
                          "inline-flex min-w-0 items-center justify-center gap-1.5 px-2.5 text-[10px] font-semibold text-[var(--muted)] transition sm:px-3 sm:text-xs",
                          materialPresetScope === "all" &&
                            "bg-[var(--foreground)] text-white",
                        )}
                        aria-pressed={materialPresetScope === "all"}
                        onClick={() => handleMaterialScopeChange("all")}
                      >
                        <Layers3 aria-hidden="true" className="size-3.5" />
                        Все плиты
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "inline-flex min-w-0 items-center justify-center gap-1.5 border-l border-[color:var(--line)] px-2.5 text-[10px] font-semibold text-[var(--muted)] transition sm:px-3 sm:text-xs",
                          materialPresetScope === "cart" &&
                            "border-l-transparent bg-[var(--foreground)] text-white",
                        )}
                        aria-pressed={materialPresetScope === "cart"}
                        onClick={() => handleMaterialScopeChange("cart")}
                      >
                        <ShoppingCart aria-hidden="true" className="size-3.5" />
                        В корзине {cartPresets.length}
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--muted)]"
                    />
                    <Input
                      id="calculator-material-search"
                      type="search"
                      className="h-9 min-w-0 pl-10 text-[13px] sm:h-10 sm:text-sm"
                      placeholder="Название, артикул, бренд, толщина или формат"
                      value={materialSearch}
                      onChange={(event) =>
                        handleMaterialSearchChange(event.target.value)
                      }
                    />
                  </div>

                  <Select
                    className="h-9 min-w-0 text-[13px] sm:h-11 sm:text-sm"
                    value={
                      visiblePresets.some(
                        (preset) => preset.id === manualPresetId,
                      )
                        ? (manualPresetId ?? "")
                        : ""
                    }
                    disabled={visiblePresets.length === 0}
                    onChange={(event) => handlePresetChange(event.target.value)}
                  >
                    {visiblePresets.length === 0 ? (
                      <option value="">
                        {materialPresetScope === "cart"
                          ? cartPresets.length === 0
                            ? "В корзине нет плитных материалов"
                            : "По запросу ничего не найдено"
                          : presets.length === 0
                            ? "Подбор появится после публикации товаров"
                            : "По запросу ничего не найдено"}
                      </option>
                    ) : (
                      <>
                        {!visiblePresets.some(
                          (preset) => preset.id === manualPresetId,
                        ) ? (
                          <option value="" disabled>
                            Выберите найденный материал
                          </option>
                        ) : null}
                        {visiblePresets.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.sku
                              ? `${preset.label} · арт. ${preset.sku}`
                              : preset.label}
                          </option>
                        ))}
                      </>
                    )}
                  </Select>

                  <p className="text-[10px] leading-4 text-[var(--muted)] sm:text-xs">
                    {materialPresetScope === "cart"
                      ? cartPresets.length > 0
                        ? `Доступно плит из корзины: ${cartPresets.length}.`
                        : "Добавьте плитный материал в корзину, и он появится здесь."
                      : materialSearch
                        ? `Найдено: ${visiblePresets.length}.`
                        : `Доступно материалов: ${presets.length}.`}
                  </p>
                </div>

                <ContextField label="Формат листа" value={sheet.label} />
              </div>
            )}

            {manualSizingAvailable ? (
              <div className="mt-3 grid grid-cols-1 gap-2 border-t border-[#151411]/10 pt-3 sm:grid-cols-3 sm:gap-3">
                <label className="grid min-w-0 gap-1.5 text-[12px] font-medium text-[var(--foreground)] sm:text-sm">
                  Толщина материала, мм
                  <Input
                    className="h-9 text-[13px] sm:h-10 sm:text-sm"
                    inputMode="decimal"
                    placeholder={
                      baseMaterial.thicknessMm
                        ? formatManualSize(baseMaterial.thicknessMm)
                        : "18"
                    }
                    value={manualThicknessMm}
                    onChange={(event) =>
                      setManualThicknessMm(event.target.value)
                    }
                  />
                </label>

                <label className="grid min-w-0 gap-1.5 text-[12px] font-medium text-[var(--foreground)] sm:text-sm">
                  Длина листа, мм
                  <Input
                    className="h-9 text-[13px] sm:h-10 sm:text-sm"
                    inputMode="numeric"
                    placeholder={formatManualSize(baseSheet.width)}
                    value={manualSheetWidthMm}
                    onChange={(event) =>
                      setManualSheetWidthMm(event.target.value)
                    }
                  />
                </label>

                <label className="grid min-w-0 gap-1.5 text-[12px] font-medium text-[var(--foreground)] sm:text-sm">
                  Ширина листа, мм
                  <Input
                    className="h-9 text-[13px] sm:h-10 sm:text-sm"
                    inputMode="numeric"
                    placeholder={formatManualSize(baseSheet.height)}
                    value={manualSheetHeightMm}
                    onChange={(event) =>
                      setManualSheetHeightMm(event.target.value)
                    }
                  />
                </label>
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-1 gap-2 border-t border-[#151411]/10 pt-3 sm:grid-cols-[minmax(0,150px)_minmax(0,150px)_minmax(0,1fr)] sm:gap-3">
              <label className="grid min-w-0 gap-1.5 text-[12px] font-medium text-[var(--foreground)] sm:text-sm">
                Толщина кромки, мм
                <Input
                  className="h-9 text-[13px] sm:h-10 sm:text-sm"
                  inputMode="decimal"
                  placeholder="0.8"
                  value={edgeThicknessMm}
                  disabled={!edgingAvailable}
                  onChange={(event) => setEdgeThicknessMm(event.target.value)}
                />
              </label>
              <label className="grid min-w-0 gap-1.5 text-[12px] font-medium text-[var(--foreground)] sm:text-sm">
                Ширина кромки, мм
                <Input
                  className="h-9 text-[13px] sm:h-10 sm:text-sm"
                  inputMode="decimal"
                  placeholder={formatManualSize(
                    getBandWidthForGibLab(material),
                  )}
                  value={edgeWidthMm}
                  disabled={!edgingAvailable}
                  onChange={(event) => setEdgeWidthMm(event.target.value)}
                />
              </label>
              <div className="min-w-0 border border-[color:var(--line)] bg-white px-3 py-2 text-[11px] leading-4 text-[var(--muted)]">
                {edgingAvailable
                  ? `В заявке и расчете будет указана кромка ${edgeSizeLabel}.`
                  : "Для выбранного материала кромка отмечается только как разметка."}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-[#1f2b25] p-4 text-white xl:hidden">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-white/60">
                  Ориентир по раскрою
                </p>
                <p className="mt-1 font-[family-name:var(--font-unbounded)] text-[1.7rem] leading-none font-medium">
                  {formatPrice(Math.round(estimate.totalEstimate))}
                </p>
              </div>
              <div className="text-right">
                <p className="font-[family-name:var(--font-unbounded)] text-[1.35rem] leading-none text-[#f08a55]">
                  {estimate.sheetCount}
                </p>
                <p className="mt-1 text-[11px] text-white/55">
                  {estimate.sheetCount === 1 ? "лист" : "листа"}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-[12px]">
              <div>
                <p className="text-white/50">Деталей</p>
                <p className="mt-0.5 font-semibold">{cutMap.placedPieces}</p>
              </div>
              <div>
                <p className="text-white/50">КИМ</p>
                <p className="mt-0.5 font-semibold">
                  {(cutMap.utilization * 100).toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-white/50">Кромка</p>
                <p className="mt-0.5 font-semibold">
                  {calculation.totalEdgeMeters.toFixed(1)} м
                </p>
              </div>
            </div>
          </div>

          {cuttingSiteIncentive ? (
            <div className="mt-3.5 flex items-center gap-3 rounded-[20px] bg-[var(--accent)] px-4 py-3 text-white sm:mt-5 sm:px-4 sm:py-3">
              <span className="shrink-0 font-[family-name:var(--font-unbounded)] text-lg font-medium sm:text-xl">
                {cuttingSiteIncentive.badge}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-5 font-semibold sm:text-sm">
                  {cuttingSiteIncentive.title}
                </p>
                <p className="hidden text-[12px] leading-4.5 text-white/85 sm:block">
                  {cuttingSiteIncentive.text}
                </p>
              </div>
            </div>
          ) : null}

          <CutListImportPanel
            onImport={importDetails}
            onProjectFile={(file) => {
              // Проект Базиса уходит менеджеру вместе с заявкой.
              if (!attachments.some((item) => item.name === file.name)) {
                void addAttachments([file]);
              }
            }}
          />

          {restoredDraftAt ? (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] leading-5 text-[var(--muted)]">
              <span>Восстановили ваш прошлый раскрой на этом устройстве.</span>
              <button
                type="button"
                onClick={resetCalculator}
                className="text-[var(--foreground)] underline underline-offset-2"
              >
                Начать заново
              </button>
            </div>
          ) : null}

          <CutDetailTable
            rows={details}
            colors={detailColors}
            lineTotals={detailLineTotals}
            edgeLabels={detailEdgeLabels}
            orientationOptions={orientationOptions}
            edgingAvailable={edgingAvailable}
            onChange={updateRow}
            onToggleEdge={toggleEdgeSide}
            onSetEdges={(id, sides) =>
              updateRow(id, { edgedSides: normalizeEdgeSides(sides) })
            }
            onDuplicate={duplicateRow}
            onRemove={removeRow}
          />

          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
            <Button
              variant="accent"
              onClick={addRow}
              className="col-span-2 w-full sm:w-auto"
            >
              <Plus className="size-4" />
              Добавить деталь
            </Button>
            <Button
              variant="secondary"
              onClick={exportToGibLab}
              disabled={exportableRows.length === 0}
              className="w-full sm:w-auto"
            >
              <FileDown className="size-4" />
              Экспорт GibLab
            </Button>
            <Button
              variant="secondary"
              onClick={resetCalculator}
              className="w-full sm:w-auto"
            >
              Сбросить расчет
            </Button>
          </div>

          <div
            id="cut-request-form"
            className="mt-4 rounded-[20px] border border-[color:var(--line)] bg-[#faf8f4] p-3 sm:p-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[13px] font-semibold text-[var(--accent)]">
                  Заявка на распил
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
                  Отправьте текущий расчет менеджеру.
                </p>
              </div>
              <div className="text-[11px] leading-4.5 text-[var(--muted)] sm:max-w-[14rem] sm:text-right">
                <p>{requestPayload.material}</p>
                <p className="mt-1">
                  {exportableRows.length} поз. ·{" "}
                  {formatPrice(Math.round(estimate.totalEstimate))}
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-1.5 text-[11px] text-[var(--foreground)] sm:text-sm">
                Имя
                <Input
                  className="h-9 text-[13px] sm:h-11 sm:text-sm"
                  value={requestDraft.contactName}
                  onChange={(event) =>
                    updateRequestDraft("contactName", event.target.value)
                  }
                  placeholder="Как к вам обращаться"
                />
              </label>
              <label className="grid gap-1.5 text-[11px] text-[var(--foreground)] sm:text-sm">
                Телефон
                <Input
                  className="h-9 text-[13px] sm:h-11 sm:text-sm"
                  value={requestDraft.contactPhone}
                  onChange={(event) =>
                    updateRequestDraft("contactPhone", event.target.value)
                  }
                  placeholder="+996 700 000 000"
                />
              </label>
              <label className="grid gap-1.5 text-[11px] text-[var(--foreground)] sm:text-sm">
                Email
                <Input
                  className="h-9 text-[13px] sm:h-11 sm:text-sm"
                  value={requestDraft.contactEmail}
                  onChange={(event) =>
                    updateRequestDraft("contactEmail", event.target.value)
                  }
                  placeholder="mail@example.com"
                  type="email"
                />
              </label>
              <label className="grid gap-1.5 text-[11px] text-[var(--foreground)] sm:text-sm">
                Мессенджер
                <Select
                  className="h-9 text-[13px] sm:h-11 sm:text-sm"
                  value={requestDraft.messengerType}
                  onChange={(event) =>
                    updateRequestDraft(
                      "messengerType",
                      event.target.value as RequestMessengerType,
                    )
                  }
                >
                  <option value="">Не выбран</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="TELEGRAM">Telegram</option>
                </Select>
              </label>
              <label className="grid gap-1.5 text-[11px] text-[var(--foreground)] sm:text-sm md:col-span-2 xl:col-span-1">
                Контакт в мессенджере
                <Input
                  className="h-9 text-[13px] sm:h-11 sm:text-sm"
                  value={requestDraft.messengerHandle}
                  onChange={(event) =>
                    updateRequestDraft("messengerHandle", event.target.value)
                  }
                  placeholder="@artisan или +996..."
                />
              </label>
              <label className="grid gap-1.5 text-[11px] text-[var(--foreground)] sm:text-sm md:col-span-2 xl:col-span-3">
                Комментарий
                <Textarea
                  className="min-h-[86px] text-[13px] sm:text-sm"
                  value={requestDraft.comment}
                  onChange={(event) =>
                    updateRequestDraft("comment", event.target.value)
                  }
                  placeholder="Если нужно, оставьте комментарий для менеджера."
                />
              </label>
            </div>

            <div className="mt-3 border border-dashed border-[color:var(--line-strong)] bg-white p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--foreground)]">
                    Проект Базиса, Excel или фото списка
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4.5 text-[var(--muted)]">
                    Не хотите вводить детали? Прикрепите файл, менеджер
                    перенесёт его в раскрой. До {MAX_REQUEST_ATTACHMENTS}{" "}
                    файлов, вместе до 4 МБ.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={
                    isPreparingAttachments ||
                    attachments.length >= MAX_REQUEST_ATTACHMENTS
                  }
                  className="w-full shrink-0 sm:w-auto"
                >
                  <Paperclip className="size-4" />
                  {isPreparingAttachments ? "Готовим..." : "Прикрепить"}
                </Button>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  multiple
                  accept={requestAttachmentAccept}
                  className="hidden"
                  onChange={(event) => void addAttachments(event.target.files)}
                />
              </div>
              {attachments.length > 0 ? (
                <ul className="mt-2.5 grid gap-1.5">
                  {attachments.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between gap-2 border border-[color:var(--line)] bg-[var(--surface-strong)] px-2.5 py-1.5 text-[12px]"
                    >
                      <span className="min-w-0 truncate text-[var(--foreground)]">
                        {file.name}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-[var(--muted)]">
                        {formatFileSize(file.size)}
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          aria-label={`Убрать ${file.name}`}
                          className="text-[var(--muted)] hover:text-[var(--foreground)]"
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="mt-3 flex flex-col gap-2.5 border-t border-[color:var(--line)] pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] leading-4.5 text-[var(--muted)]">
                В заявку уйдут карта, файл для GibLab, кромка и ориентир по
                стоимости. Точную сумму подтвердит менеджер.
              </div>
              <Button
                variant="accent"
                onClick={handleRequestSubmit}
                disabled={
                  isSubmittingRequest ||
                  isPreparingAttachments ||
                  (exportableRows.length === 0 && attachments.length === 0)
                }
                className="w-full sm:w-auto"
              >
                {isSubmittingRequest ? "Отправляем..." : "Отправить заявку"}
              </Button>
            </div>

            {requestFeedback ? (
              <div
                className={cn(
                  "mt-3 border px-3 py-2 text-[12px] leading-5 sm:text-[13px]",
                  requestFeedback.tone === "success"
                    ? "border-[rgba(55,131,82,0.2)] bg-[rgba(55,131,82,0.08)] text-[#2f6a41]"
                    : "border-[rgba(185,88,45,0.18)] bg-[rgba(185,88,45,0.08)] text-[#8c4a27]",
                )}
              >
                {requestFeedback.message}
              </div>
            ) : null}
          </div>

          <p className="mt-3 text-[11px] leading-4.5 text-[var(--muted)] sm:text-[12px] sm:leading-5">
            Экспорт собирает файл <span className="font-mono">.project</span>{" "}
            для GibLab по текущим деталям, кромке 1 мм, формату листа и
            параметрам раскроя.
          </p>

          <div className="mt-7 overflow-hidden border-t border-[#e3ddd2] pt-4 sm:mt-8 sm:pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-[13px] font-semibold text-[var(--accent)]">
                  Карта раскроя
                </p>
                <h3 className="mt-2 text-[1.35rem] leading-tight font-semibold text-[var(--foreground)] sm:text-2xl">
                  Предварительная карта листа {sheet.label}
                </h3>
                <p className="mt-2 hidden text-[13px] leading-5 text-[var(--muted)] sm:block">
                  Карта строится по полосному гильотинному алгоритму: сначала
                  формируется полезное поле листа после торцовки, затем
                  раскладываются полосы и поперечные резы с учетом ширины
                  пропила.
                </p>
              </div>

              <div className="grid w-full min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:w-auto sm:min-w-[250px] sm:grid-cols-2 xl:grid-cols-3">
                <MetricTile label="Формат листа" value={sheet.label} muted />
                <MetricTile
                  label="Полезное поле"
                  value={`${Math.max(sheet.width - basisSettings.edgeTrim * 2, 0).toFixed(0)} × ${Math.max(sheet.height - basisSettings.edgeTrim * 2, 0).toFixed(0)} мм`}
                  muted
                />
                <MetricTile
                  label="Размещено"
                  value={`${cutMap.placedPieces} из ${cutMap.totalPieces} шт.`}
                  muted
                />
                <MetricTile
                  label="Листов на карте"
                  value={`${cutMap.sheets.length} шт.`}
                  muted
                />
                <div className="hidden sm:block">
                  <MetricTile
                    label="КИМ"
                    value={`${(cutMap.utilization * 100).toFixed(0)}%`}
                    muted
                  />
                </div>
                <div className="hidden sm:block">
                  <MetricTile
                    label="Полезный остаток"
                    value={`${(cutMap.offcutArea / 1_000_000).toFixed(2)} м²`}
                    muted
                  />
                </div>
                <div className="hidden sm:block">
                  <MetricTile
                    label="Крупный остаток"
                    value={
                      cutMap.largestOffcut
                        ? `${Math.floor(cutMap.largestOffcut.width)} × ${Math.floor(cutMap.largestOffcut.height)} мм`
                        : "Нет"
                    }
                    muted
                  />
                </div>
              </div>
            </div>

            {cutMap.totalPieces === 0 ? (
              <div className="mt-4 border border-dashed border-[color:var(--line)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
                Добавьте размеры деталей и количество, чтобы построить карту
                раскроя по модели БАЗИС-Раскрой.
              </div>
            ) : (
              <div className="mt-4 space-y-3.5 sm:space-y-4">
                <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
                  {cutMap.sheets.map((cutSheet) => {
                    const fillRate =
                      cutSheet.usableArea > 0
                        ? (cutSheet.usedArea / cutSheet.usableArea) * 100
                        : 0;
                    const workingLeft =
                      (cutSheet.workingArea.x / sheet.width) * 100;
                    const workingTop =
                      (cutSheet.workingArea.y / sheet.height) * 100;
                    const workingWidth =
                      (cutSheet.workingArea.width / sheet.width) * 100;
                    const workingHeight =
                      (cutSheet.workingArea.height / sheet.height) * 100;

                    return (
                      <div
                        key={cutSheet.index}
                        className="min-w-0 overflow-hidden rounded-[20px] border border-[color:var(--line)] bg-white p-2.5 sm:p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                          <div>
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                              Лист {cutSheet.index}
                            </p>
                            <p className="text-xs text-[var(--muted)]">
                              {sheet.width} × {sheet.height} мм
                            </p>
                          </div>
                          <span className="inline-flex min-h-7 items-center rounded-full border border-[color:var(--line)] px-3 text-xs font-medium text-[var(--foreground)]">
                            {cutSheet.pieces.length} деталей ·{" "}
                            {fillRate.toFixed(0)}%
                          </span>
                        </div>

                        <div className="mt-2.5 rounded-[14px] border border-[color:var(--line)] bg-[#f4f1eb] p-1.5 sm:mt-3 sm:p-2">
                          <div
                            className="relative w-full overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(244,238,228,0.96)_100%)]"
                            style={{
                              aspectRatio: `${sheet.width} / ${sheet.height}`,
                            }}
                          >
                            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(21,20,17,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(21,20,17,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />
                            <div
                              className="pointer-events-none absolute border border-dashed border-[rgba(21,20,17,0.22)]"
                              style={{
                                left: `${workingLeft}%`,
                                top: `${workingTop}%`,
                                width: `${workingWidth}%`,
                                height: `${workingHeight}%`,
                              }}
                            />

                            {cutSheet.cuts.map((cut) => (
                              <div
                                key={cut.id}
                                className={cn(
                                  "pointer-events-none absolute bg-[rgba(21,20,17,0.08)]",
                                  cut.orientation === "vertical"
                                    ? "border-x border-white/30"
                                    : "border-y border-white/30",
                                )}
                                style={{
                                  left: `${(cut.x / sheet.width) * 100}%`,
                                  top: `${(cut.y / sheet.height) * 100}%`,
                                  width: `${(cut.width / sheet.width) * 100}%`,
                                  height: `${(cut.height / sheet.height) * 100}%`,
                                }}
                              />
                            ))}

                            {cutSheet.pieces.map((piece, pieceIndex) => {
                              const widthPercent =
                                (piece.width / sheet.width) * 100;
                              const heightPercent =
                                (piece.height / sheet.height) * 100;
                              const showMeta =
                                widthPercent > 16 && heightPercent > 12;
                              const color =
                                detailColors[
                                  piece.id.slice(0, piece.id.lastIndexOf("-"))
                                ] ?? getCutMapColor(pieceIndex);

                              return (
                                <div
                                  key={piece.id}
                                  className="absolute overflow-hidden border border-white/85 shadow-[0_10px_30px_rgba(21,20,17,0.14)]"
                                  style={{
                                    left: `${(piece.x / sheet.width) * 100}%`,
                                    top: `${(piece.y / sheet.height) * 100}%`,
                                    width: `${widthPercent}%`,
                                    height: `${heightPercent}%`,
                                    backgroundColor: color,
                                  }}
                                >
                                  <div className="flex h-full flex-col justify-between p-1.5 text-white">
                                    <p className="text-[9px] leading-3 font-semibold sm:text-[10px]">
                                      {piece.title}
                                    </p>
                                    {showMeta ? (
                                      <div className="space-y-0.5">
                                        <p className="font-mono text-[8px] tracking-[0.1em] uppercase opacity-85 sm:text-[9px]">
                                          {piece.width} × {piece.height} мм
                                        </p>
                                        <p className="text-[8px] opacity-75 sm:text-[9px]">
                                          {getOrientationModeLabel(
                                            piece.orientationMode,
                                          )}
                                        </p>
                                        {piece.rotated ? (
                                          <p className="font-mono text-[8px] tracking-[0.1em] uppercase opacity-70 sm:text-[9px]">
                                            Повернуто
                                          </p>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-2.5 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 xl:grid-cols-4">
                          <MetricTile
                            label="Резов"
                            value={`${cutSheet.cutCount}`}
                            muted
                          />
                          <MetricTile
                            label="Длина реза"
                            value={`${(cutSheet.cutLength / 1000).toFixed(1)} м`}
                            muted
                          />
                          <MetricTile
                            label="КИМ листа"
                            value={`${fillRate.toFixed(0)}%`}
                            muted
                          />
                          <MetricTile
                            label="Крупный остаток"
                            value={
                              cutSheet.largestOffcut
                                ? `${Math.floor(cutSheet.largestOffcut.width)} × ${Math.floor(cutSheet.largestOffcut.height)} мм`
                                : "Нет"
                            }
                            muted
                          />
                        </div>

                        {cutSheet.offcuts.length > 0 ? (
                          <div className="mt-3 rounded-[14px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-[var(--foreground)]">
                                Полезные остатки листа
                              </p>
                              <span className="text-[11px] text-[var(--muted)]">
                                {(cutSheet.offcutArea / 1_000_000).toFixed(2)}{" "}
                                м² свободно
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                              {cutSheet.offcuts.slice(0, 4).map((offcut) => (
                                <span
                                  key={offcut.id}
                                  className="inline-flex items-center border border-[color:var(--line)] bg-white px-2.5 py-1.5 text-[11px] text-[var(--foreground)]"
                                >
                                  {Math.floor(offcut.width)}×
                                  {Math.floor(offcut.height)} мм
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {cutMap.unplacedPieces.length > 0 ? (
                  <div className="border border-[color:var(--line)] bg-white p-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      Не вошли в Basis-like карту
                    </p>
                    <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">
                      Эти позиции не поместились в текущую карту с заданными
                      параметрами полос, торцовки и ширины реза. Для них нужен
                      другой формат листа или ручная корректировка менеджером.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                      {cutMap.unplacedPieces.map((piece) => (
                        <span
                          key={piece.id}
                          className="inline-flex items-center border border-[color:var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-xs text-[var(--foreground)]"
                        >
                          {piece.title} · {piece.width}×{piece.height} мм
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="mt-7 overflow-hidden border-t border-[#e3ddd2] pt-4 sm:mt-8 sm:pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-[13px] font-semibold text-[var(--accent)]">
                  Ведомость для цеха
                </p>
                <h3 className="mt-2 text-[1.35rem] leading-tight font-semibold text-[var(--foreground)] sm:text-2xl">
                  Таблица деталей по фактической карте раскроя
                </h3>
                <p className="mt-2 hidden text-[13px] leading-5 text-[var(--muted)] sm:block">
                  Здесь собраны размеры, кромка, ориентация и распределение по
                  листам. Эту часть уже удобно сверять перед распилом и
                  кромлением.
                </p>
              </div>

              <div className="grid w-full min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:w-auto sm:min-w-[220px] sm:grid-cols-2">
                <MetricTile
                  label="Позиций"
                  value={`${workshopRows.length} шт.`}
                  muted
                />
                <MetricTile
                  label="Деталей в карте"
                  value={`${cutMap.placedPieces} шт.`}
                  muted
                />
              </div>
            </div>

            <div className="mt-4 grid gap-2.5 md:hidden">
              {workshopRows.map((row) => (
                <article
                  key={row.id}
                  className="border border-[color:var(--line)] bg-white p-3"
                >
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {row.sequence}. {row.title}
                      </p>
                      <p className="mt-1 text-[12px] text-[var(--muted)]">
                        {row.sizeLabel} · {row.quantity} шт.
                      </p>
                    </div>
                    <span className="inline-flex w-fit items-center border border-[color:var(--line)] bg-[var(--surface-strong)] px-2 py-1 text-[10px] text-[var(--muted)]">
                      {row.statusLabel}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-[12px] leading-5 text-[var(--muted)] min-[380px]:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium">Кромка</p>
                      <p className="mt-0.5 text-[var(--foreground)]">
                        {row.edgeLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium">Ориентация</p>
                      <p className="mt-0.5 text-[var(--foreground)]">
                        {row.orientationLabel}
                      </p>
                    </div>
                    <div className="min-[380px]:col-span-2">
                      <p className="text-xs font-medium">Листы</p>
                      <p className="mt-0.5 text-[var(--foreground)]">
                        {row.sheetsLabel}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-4 hidden overflow-x-auto border border-[color:var(--line)] bg-white md:block">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[color:var(--line)] bg-[var(--surface-strong)]">
                    <th className="px-3 py-3 text-xs font-semibold text-[var(--muted)]">
                      #
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-[var(--muted)]">
                      Деталь
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-[var(--muted)]">
                      Размер
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-[var(--muted)]">
                      Кол-во
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-[var(--muted)]">
                      Кромка
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-[var(--muted)]">
                      Ориентация
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-[var(--muted)]">
                      Листы
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-[var(--muted)]">
                      Статус
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {workshopRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[color:var(--line)] align-top last:border-b-0"
                    >
                      <td className="px-3 py-3 text-sm text-[var(--muted)]">
                        {row.sequence}
                      </td>
                      <td className="px-3 py-3 text-sm font-medium text-[var(--foreground)]">
                        {row.title}
                      </td>
                      <td className="px-3 py-3 text-sm text-[var(--foreground)]">
                        {row.sizeLabel}
                      </td>
                      <td className="px-3 py-3 text-sm text-[var(--foreground)]">
                        {row.quantity}
                      </td>
                      <td className="px-3 py-3 text-sm text-[var(--foreground)]">
                        {row.edgeLabel}
                      </td>
                      <td className="px-3 py-3 text-sm text-[var(--foreground)]">
                        {row.orientationLabel}
                      </td>
                      <td className="px-3 py-3 text-sm text-[var(--foreground)]">
                        {row.sheetsLabel}
                      </td>
                      <td className="px-3 py-3 text-sm text-[var(--muted)]">
                        {row.statusLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="hidden border-t border-[#151411]/10 bg-[#faf8f4] p-4 text-[#1b1c19] sm:p-5 lg:p-6 xl:sticky xl:top-20 xl:block xl:self-start xl:border-t-0 xl:border-l xl:border-[#151411]/10">
          <div className="rounded-2xl bg-[#1f2b25] p-5 text-white shadow-[0_18px_40px_rgba(21,20,17,0.25)]">
            <p className="text-[13px] font-semibold text-white/60">
              Ориентир по раскрою
            </p>
            <p className="mt-2 font-[family-name:var(--font-unbounded)] text-[2rem] leading-none font-medium">
              {formatPrice(Math.round(estimate.totalEstimate))}
            </p>
            <p className="mt-3 text-[13px] text-white/70">
              <span className="font-semibold text-[#f08a55]">
                {estimate.sheetCount} лист.
              </span>{" "}
              · {cutMap.placedPieces} дет. · КИМ{" "}
              {(cutMap.utilization * 100).toFixed(0)}%
            </p>
            <a
              href="#cut-request-form"
              className="mt-4 flex h-11 items-center justify-center rounded-full bg-[#c4532b] text-sm font-semibold transition hover:bg-[#a8431f]"
            >
              Отправить заявку
            </a>
            <p className="mt-2 text-center text-[11px] text-white/45">
              Точную сумму подтвердит менеджер
            </p>
          </div>

          <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-2.5 xl:grid-cols-1">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="rounded-[14px] border border-[#e3ddd2] bg-white p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-[#f4f1eb]">
                      <Icon className="size-4 text-[var(--accent)]" />
                    </span>
                    <div>
                      <p className="text-xs text-[#6e6b63]">{card.label}</p>
                      <p className="mt-0.5 text-base font-semibold text-[#151411]">
                        {card.value}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 space-y-2.5 border border-[#151411]/10 bg-[rgba(255,255,255,0.55)] p-4 sm:mt-5">
            <div className="flex items-center justify-between gap-3 text-sm text-[#5f554c]">
              <span>Материал</span>
              <span>{formatPrice(Math.round(estimate.materialCost))}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm text-[#5f554c]">
              <span>
                {cuttingSiteIncentive
                  ? `Распил, ${estimate.sheetCount} × ${cuttingSitePrices.sheet} сом`
                  : "Распил по карте"}
              </span>
              <span>{formatPrice(Math.round(estimate.cuttingCost))}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm text-[#5f554c]">
              <span>Кромка {edgeSizeLabel}</span>
              <span>{formatPrice(Math.round(estimate.edgeCost))}</span>
            </div>
            {estimate.setupFee > 0 ? (
              <div className="flex items-center justify-between gap-3 text-sm text-[#5f554c]">
                <span>Подготовка</span>
                <span>{formatPrice(estimate.setupFee)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 border-t border-[#151411]/10 pt-3 text-[15px] font-semibold text-[#151411]">
              <span>Итого ориентир</span>
              <span>{formatPrice(Math.round(estimate.totalEstimate))}</span>
            </div>
          </div>
        </aside>
      </div>

      <div
        className={cn(
          "fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 rounded-2xl bg-[#1f2b25] px-4 py-3 text-white shadow-[0_18px_40px_rgba(21,20,17,0.35)] transition duration-300 xl:hidden",
          showStickySummary
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-white/60">
            {estimate.sheetCount} лист. · {cutMap.placedPieces} дет. · КИМ{" "}
            {(cutMap.utilization * 100).toFixed(0)}%
          </p>
          <p className="text-[1.05rem] leading-tight font-semibold">
            {formatPrice(Math.round(estimate.totalEstimate))}
          </p>
        </div>
        <a
          href="#cut-request-form"
          className="inline-flex h-11 shrink-0 items-center rounded-full bg-[#c4532b] px-5 text-sm font-semibold"
        >
          Отправить
        </a>
      </div>
    </section>
  );
}
