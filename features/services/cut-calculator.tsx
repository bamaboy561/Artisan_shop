"use client";

import { useMemo, useState, useTransition } from "react";

import {
  Calculator,
  Check,
  Copy,
  FileDown,
  Layers3,
  Plus,
  Scissors,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  submitCuttingRequestAction,
  type SubmitCuttingRequestInput,
} from "@/app/(public)/calculator/actions";
import type { CalculatorProductContext } from "@/features/catalog/data";
import type {
  CalculatorMaterialDto,
  CalculatorPresetDto,
  CalculatorSheetFormatDto,
} from "@/lib/server/calculator-config";
import { formatPrice } from "@/lib/commerce";
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

type CalculatedDetailRow = Omit<
  DetailRow,
  "width" | "height" | "quantity"
> & {
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
    description: "Сохраняет ориентацию размеров. Удобно для текстуры и фасадов.",
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

function getGibLabFileName(date: Date) {
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
}: {
  material: MaterialOption;
  sheet: SheetFormat;
  rows: CalculatedDetailRow[];
  basisSettings: BasisMapSettings;
  sheetCount: number;
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
  const bandWidth = getBandWidthForGibLab(material);

  const partEntries = validRows.map((row, index) => {
    const partId = index + 2;
    const geometry = getGibLabPartGeometry(row);
    const hasEdging = material.edgeRatePerMeter > 0 && geometry.edgedSides.length > 0;
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
    `\t<!-- Kerf: ${basisSettings.kerf.toFixed(1)} mm -->`,
    `\t<!-- Edge trim: ${basisSettings.edgeTrim.toFixed(0)} mm -->`,
    `\t<!-- Min strip: ${basisSettings.minStrip.toFixed(0)} mm -->`,
    `\t<!-- First cut: ${basisSettings.firstCutDirection} -->`,
  ].join("\n");

  const edgeBlock =
    edgeOperationParts.length > 0
      ? `\n\t<good id="${edgeToolGoodId}" typeId="tool.edgeline" />\n\t<good id="${bandGoodId}" typeId="band" name="${escapeXml(`Кромка 1 мм ${bandWidth}x1`)}" code="ARTISAN-EDGE-1MM" unit="м" cost="${material.edgeRatePerMeter.toFixed(2)}" t="1" w="${bandWidth}" />\n\t<operation id="${edgeOperationId}" typeId="EL" tool1="${edgeToolGoodId}">\n${edgeOperationParts}\n\t\t<material id="${bandGoodId}" />\n\t</operation>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>\n<project currency="сом" version="1">\n${comments}\n\t<good id="${productGoodId}" typeId="product" count="1" name="Artisan Cut Project">\n${partEntries.map((part) => part.xml).join("\n")}\n\t</good>\n\t<good id="${cutToolGoodId}" typeId="tool.cutting" />\n\t<good id="${sheetMaterialGoodId}" typeId="sheet" name="${escapeXml(material.label)}" code="${escapeXml(`${material.id}-${sheet.id}`)}" unit="м2" cost="${material.pricePerSqM.toFixed(2)}">\n\t\t<part id="${sheetPartId}" l="${sheet.width}" w="${sheet.height}" count="${availableSheetCount}" usedCount="${Math.max(sheetCount, 0)}" />\n\t</good>\n\t<operation id="${cutOperationId}" typeId="CS" tool1="${cutToolGoodId}" cSizeMode="0">\n${cutOperationParts}\n\t\t<material id="${sheetMaterialGoodId}" />\n\t</operation>${edgeBlock}\n</project>\n`;
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

function createInitialRows(): DetailRow[] {
  return [
    {
      ...createRow(1),
      width: "720",
      height: "560",
      quantity: "2",
      edgedSides: ["top", "bottom"],
    },
    {
      ...createRow(2),
      width: "560",
      height: "420",
      quantity: "3",
      edgedSides: [...allEdgeSides],
    },
  ];
}

function getCutMapColor(index: number) {
  return cutMapPalette[index % cutMapPalette.length];
}

function parsePositive(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
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

function getReadableEdgeSelection(edgedSides: EdgeSide[]) {
  if (edgedSides.length === 0) {
    return "Кромка 1 мм не выбрана";
  }

  return `Кромка 1 мм: ${normalizeEdgeSides(edgedSides)
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
      let bestPlacement:
        | {
            rectIndex: number;
            width: number;
            height: number;
            rotated: boolean;
            score: number;
          }
        | null = null;

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
    const totalUsableArea = sheets.length * workingArea.width * workingArea.height;
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
          (item): item is NonNullable<CutMapSheet["largestOffcut"]> => item !== null,
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
      return candidate.cutLength < bestResult.cutLength ? candidate : bestResult;
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
        "min-w-0 overflow-hidden border px-3 py-2.5",
        muted
          ? "border-[color:var(--line)] bg-white"
          : "border-white/10 bg-white/6",
      )}
    >
      <p
        className={cn(
          "truncate text-[11px] tracking-[0.12em] uppercase",
          muted ? "text-[var(--muted)]" : "text-white/54",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 break-words text-[13px] leading-5 font-semibold",
          muted ? "text-[var(--foreground)]" : "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EdgeSideButton({
  side,
  active,
  disabled,
  onClick,
}: {
  side: EdgeSide;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const isVertical = side === "left" || side === "right";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center rounded-full border px-1.5 py-1.5 font-mono text-[8px] tracking-[0.14em] uppercase transition sm:px-2.5 sm:py-2 sm:text-[9px]",
        isVertical
          ? "min-h-[5rem] min-w-7 sm:min-h-[5.5rem] sm:min-w-9"
          : "min-h-8 w-full sm:min-h-9",
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
          : "border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--muted)] hover:border-[color:var(--line-strong)] hover:text-[var(--foreground)]",
        disabled && "cursor-not-allowed opacity-45",
      )}
      style={isVertical ? { writingMode: "vertical-rl" } : undefined}
    >
      {edgeSideMeta[side].label}
    </button>
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
    <div className="min-w-0 border border-[color:var(--line)] bg-[var(--surface-strong)] px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="truncate font-mono text-[9px] tracking-[0.14em] text-[var(--muted)] uppercase">
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
  if (productContext) {
    return `${productContext.brand} · ${productContext.name} · ${sheet.label}`;
  }

  if (activePreset) {
    return `${activePreset.label} · ${sheet.label}`;
  }

  return `${material.label} · ${sheet.label}`;
}

function buildCuttingRequestMessage({
  productContext,
  activePreset,
  material,
  sheet,
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
    `Кромка 1 мм: ${calculation.totalEdgeMeters.toFixed(1)} м`,
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
  const fallbackMaterial = materials[0];
  const fallbackSheet = sheets[0];
  const defaultPresetId = presets[0]?.id ?? null;

  const [manualPresetId, setManualPresetId] = useState<CalculatorPresetId | null>(
    defaultPresetId,
  );
  const [details, setDetails] = useState<DetailRow[]>(createInitialRows);
  const [requestDraft, setRequestDraft] = useState<CuttingRequestDraft>(
    initialCuttingRequestDraft,
  );
  const [requestFeedback, setRequestFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isSubmittingRequest, startSubmittingRequest] = useTransition();

  const lockedPreset = findPresetByContext(presets, productContext);
  const activePreset =
    lockedPreset ??
    (manualPresetId ? findPresetById(presets, manualPresetId) : null);
  const material =
    (activePreset
      ? materials.find((item) => item.id === activePreset.materialId)
      : null) ?? fallbackMaterial;
  const sheet =
    (activePreset
      ? sheets.find((item) => item.id === activePreset.sheetPresetId)
      : null) ?? fallbackSheet;
  const isProductMode = Boolean(lockedPreset && productContext);
  const edgingAvailable = material ? material.edgeRatePerMeter > 0 : false;

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
      const contourCutCost = perimeterMeters * material.cutRatePerMeter;
      const edgeCost = edgeMeters * material.edgeRatePerMeter;

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
    const materialCost = sheetCount * calculation.sheetAreaSqM * material.pricePerSqM;
    const cuttingCost = cutMeters * material.cutRatePerMeter;
    const edgeCost = calculation.totalEdgeMeters * material.edgeRatePerMeter;
    const setupFee = calculation.totalPieces > 0 ? material.setupFee : 0;

    return {
      sheetCount,
      cutMeters,
      materialCost,
      cuttingCost,
      edgeCost,
      setupFee,
      totalEstimate: materialCost + cuttingCost + edgeCost + setupFee,
    };
  }, [calculation.sheetAreaSqM, calculation.totalEdgeMeters, calculation.totalPieces, cutMap.cutLength, cutMap.sheets.length, material.cutRatePerMeter, material.edgeRatePerMeter, material.pricePerSqM, material.setupFee]);

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
          accumulator[entry.sheetIndex] = (accumulator[entry.sheetIndex] ?? 0) + 1;

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
              .map((sheetIndex) => `Л${sheetIndex} ×${sheetCountByIndex[sheetIndex]}`)
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

  const edgeOptionLabel = useMemo(() => {
    if (calculation.totalEdgeMeters <= 0) {
      return "Без кромки";
    }

    return edgingAvailable
      ? `Кромка 1 мм · ${calculation.totalEdgeMeters.toFixed(1)} м`
      : `Разметка кромки 1 мм · ${calculation.totalEdgeMeters.toFixed(1)} м`;
  }, [calculation.totalEdgeMeters, edgingAvailable]);

  const requestPayload = useMemo<SubmitCuttingRequestInput>(
    () => ({
      subject: productContext
        ? `Распил: ${productContext.name}`
        : activePreset
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
      edgeOption: edgeOptionLabel,
      estimatedBudget: Math.round(estimate.totalEstimate),
    }),
    [
      activePreset,
      calculation,
      cutMap,
      edgeOptionLabel,
      estimate,
      material,
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

    const projectXml = buildGibLabProjectXml({
      material,
      sheet,
      rows: exportableRows,
      basisSettings,
      sheetCount: Math.max(cutMap.sheets.length, estimate.sheetCount, 0),
    });
    const blob = new Blob([projectXml], {
      type: "application/xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = getGibLabFileName(new Date());
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const addRow = () => {
    setDetails((current) => [...current, createRow(current.length + 1)]);
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
    setDetails(createInitialRows());
    setRequestFeedback(null);
  };

  const handleRequestSubmit = () => {
    if (exportableRows.length === 0) {
      setRequestFeedback({
        tone: "error",
        message: "Добавьте хотя бы одну деталь с размерами, чтобы отправить заявку.",
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

    if (
      requestDraft.messengerType &&
      !requestDraft.messengerHandle.trim()
    ) {
      setRequestFeedback({
        tone: "error",
        message: "Добавьте контакт для выбранного мессенджера.",
      });

      return;
    }

    setRequestFeedback(null);

    startSubmittingRequest(() => {
      void (async () => {
        const result = await submitCuttingRequestAction(requestPayload);

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
        setRequestDraft((current) => ({
          ...current,
          comment: "",
        }));
      })();
    });
  };

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
      label: "Кромка 1 мм",
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
      className="overflow-hidden border-t border-[#151411]/10 bg-white"
    >
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="p-3 sm:p-6 lg:p-7 xl:p-8">
          <div className="grid gap-1.5 sm:gap-3">
            <div className="max-w-3xl">
              <p className="font-mono text-[9px] tracking-[0.18em] text-[var(--accent)] uppercase">
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
                <ContextField
                  label="Материал"
                  value={activePreset?.label ?? material.label}
                />
                <ContextField label="Формат листа" value={sheet.label} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)]">
                <div className="min-w-0 space-y-1.5">
                  <label className="min-w-0 text-[12px] font-medium text-[var(--foreground)] sm:text-sm">
                    Материал из каталога
                  </label>
                  <Select
                    className="h-9 min-w-0 text-[13px] sm:h-11 sm:text-sm"
                    value={manualPresetId ?? ""}
                    disabled={presets.length === 0}
                    onChange={(event) =>
                      setManualPresetId(event.target.value || null)
                    }
                  >
                    {presets.length === 0 ? (
                      <option value="">Подбор появится после публикации товаров</option>
                    ) : (
                      presets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label}
                        </option>
                      ))
                    )}
                  </Select>
                </div>

                <ContextField label="Формат листа" value={sheet.label} />
              </div>
            )}
          </div>

          <div className="mt-3 space-y-2.5 xl:hidden">
            <div className="grid grid-cols-2 gap-2">
              {summaryCards.slice(0, 4).map((card) => (
                <div
                  key={card.label}
                  className="min-w-0 border border-[color:var(--line)] bg-[var(--surface-strong)] px-2.5 py-2"
                >
                  <p className="truncate text-[9px] tracking-[0.12em] text-[var(--muted)] uppercase">
                    {card.label}
                  </p>
                  <p className="mt-1 break-words text-[12px] font-semibold leading-4.5 text-[var(--foreground)]">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="border border-[color:var(--line)] bg-[var(--surface-strong)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[9px] tracking-[0.14em] text-[var(--muted)] uppercase">
                    Итого ориентир
                  </p>
                  <p className="mt-1 text-[0.95rem] font-semibold text-[var(--foreground)]">
                    {formatPrice(Math.round(estimate.totalEstimate))}
                  </p>
                </div>
                <div className="text-right text-[11px] leading-[1.35] text-[var(--muted)]">
                  <p>{estimate.sheetCount} лист.</p>
                  <p>{cutMap.placedPieces} дет.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3.5 space-y-2.5 sm:mt-5 sm:space-y-3.5">
            {details.map((detail, index) => {
              const lineCalculation =
                calculation.rows.find((row) => row.id === detail.id) ??
                calculation.rows[0];
              const selectedEdgeLabel = getReadableEdgeSelection(
                detail.edgedSides,
              );

              return (
                <article
                  key={detail.id}
                  className="border-t border-[#151411]/10 bg-[#fcfaf6] py-3 sm:py-4"
                >
                  <div className="flex flex-col gap-2.5 px-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--foreground)] sm:text-sm">
                        {detail.title}
                      </p>
                      <p className="text-[11px] text-[var(--muted)]">
                        Позиция {index + 1} в карте раскроя
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                      <button
                        type="button"
                        onClick={() => duplicateRow(detail.id)}
                        className="inline-flex min-w-0 items-center justify-center gap-1.5 border border-[color:var(--line)] px-2 py-1.5 text-[11px] font-medium text-[var(--muted)] transition hover:border-[color:var(--line-strong)] hover:text-[var(--foreground)]"
                      >
                        <Copy className="size-3.5" />
                        Дублировать
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(detail.id)}
                        className={cn(
                          "inline-flex min-w-0 items-center justify-center gap-1.5 border border-[color:var(--line)] px-2 py-1.5 text-[11px] font-medium text-[var(--muted)] transition hover:border-[color:var(--line-strong)] hover:text-[var(--foreground)]",
                          details.length === 1 && "cursor-not-allowed opacity-45",
                        )}
                      >
                        <Trash2 className="size-3.5" />
                        Удалить
                      </button>
                    </div>
                  </div>

                  <div className="mt-2.5 grid gap-2.5 xl:grid-cols-[minmax(0,1.32fr)_minmax(260px,0.68fr)] xl:items-start">
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_110px_110px_96px] xl:gap-2">
                        <label className="min-w-0 grid gap-1.5 text-[11px] leading-[1.2] text-[var(--foreground)] sm:col-span-2 sm:text-sm xl:col-span-1">
                          Название
                          <Input
                            className="h-9 text-[13px] sm:h-11 sm:text-sm"
                            value={detail.title}
                            onChange={(event) =>
                              updateRow(detail.id, { title: event.target.value })
                            }
                            placeholder="Деталь"
                          />
                        </label>
                        <label className="min-w-0 grid gap-1.5 text-[11px] leading-[1.2] text-[var(--foreground)] sm:text-sm">
                          Ширина, мм
                          <Input
                            className="h-9 text-[13px] sm:h-11 sm:text-sm"
                            value={detail.width}
                            onChange={(event) =>
                              updateRow(detail.id, { width: event.target.value })
                            }
                            type="number"
                            min="0"
                            placeholder="560"
                          />
                        </label>
                        <label className="min-w-0 grid gap-1.5 text-[11px] leading-[1.2] text-[var(--foreground)] sm:text-sm">
                          Высота, мм
                          <Input
                            className="h-9 text-[13px] sm:h-11 sm:text-sm"
                            value={detail.height}
                            onChange={(event) =>
                              updateRow(detail.id, { height: event.target.value })
                            }
                            type="number"
                            min="0"
                            placeholder="420"
                          />
                        </label>
                        <label className="min-w-0 grid gap-1.5 text-[11px] leading-[1.2] text-[var(--foreground)] sm:text-sm">
                          Кол-во
                          <Input
                            className="h-9 text-[13px] sm:h-11 sm:text-sm"
                            value={detail.quantity}
                            onChange={(event) =>
                              updateRow(detail.id, {
                                quantity: event.target.value,
                              })
                            }
                            type="number"
                            min="1"
                            placeholder="1"
                          />
                        </label>
                        <label className="grid min-w-0 gap-1.5 text-[11px] text-[var(--foreground)] sm:col-span-2 sm:text-sm xl:col-span-4">
                          Ориентация / текстура
                          <Select
                            className="h-9 text-[13px] sm:h-11 sm:text-sm"
                            value={detail.orientationMode}
                            onChange={(event) =>
                              updateRow(detail.id, {
                                orientationMode:
                                  event.target.value as OrientationMode,
                              })
                            }
                          >
                            {(
                              Object.keys(orientationModeMeta) as OrientationMode[]
                            ).map((mode) => (
                              <option key={mode} value={mode}>
                                {orientationModeMeta[mode].label}
                              </option>
                            ))}
                          </Select>
                        </label>
                      </div>

                      <div className="hidden xl:grid xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] xl:gap-2">
                        <div className="border border-[color:var(--line)] bg-white px-3 py-2.5">
                          <p className="font-mono text-[9px] tracking-[0.14em] text-[var(--muted)] uppercase">
                            Параметры детали
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="inline-flex min-h-7 items-center border border-[color:var(--line)] px-2 text-[11px] text-[var(--foreground)]">
                              Кромка: {selectedEdgeLabel}
                            </span>
                            <span className="inline-flex min-h-7 items-center border border-[color:var(--line)] px-2 text-[11px] text-[var(--foreground)]">
                              Режим: {getOrientationModeLabel(detail.orientationMode)}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] leading-4 text-[var(--muted)]">
                            {orientationModeMeta[detail.orientationMode].description}
                          </p>
                          {!edgingAvailable ? (
                            <p className="mt-2 text-[11px] leading-4 text-[var(--muted)]">
                              Для этого материала кромка 1 мм в расчёте не учитывается.
                            </p>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <MetricTile
                            label="Площадь"
                            value={`${lineCalculation.areaSqM.toFixed(2)} м²`}
                            muted
                          />
                          <MetricTile
                            label="Контур"
                            value={`${lineCalculation.perimeterMeters.toFixed(1)} м`}
                            muted
                          />
                          <MetricTile
                            label="Кромка 1 мм"
                            value={`${lineCalculation.edgeMeters.toFixed(1)} м`}
                            muted
                          />
                          <MetricTile
                            label="Ориентир по детали"
                            value={formatPrice(Math.round(lineCalculation.lineTotal))}
                            muted
                          />
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 overflow-hidden border border-[color:var(--line)] bg-white p-2.5 sm:p-3">
                      <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
                        Схема кромки
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--muted)] sm:text-sm">
                        Нажмите на нужные стороны детали.
                      </p>

                      <div className="mt-2 grid max-w-full grid-cols-[24px_minmax(0,1fr)_24px] grid-rows-[24px_minmax(96px,1fr)_24px] gap-1.5 sm:grid-cols-[34px_minmax(0,1fr)_34px] sm:grid-rows-[34px_minmax(120px,1fr)_34px] sm:gap-2">
                        <div className="col-start-2 row-start-1">
                          <EdgeSideButton
                            side="top"
                            active={detail.edgedSides.includes("top")}
                            disabled={!edgingAvailable}
                            onClick={() => toggleEdgeSide(detail.id, "top")}
                          />
                        </div>

                        <div className="col-start-1 row-start-2">
                          <EdgeSideButton
                            side="left"
                            active={detail.edgedSides.includes("left")}
                            disabled={!edgingAvailable}
                            onClick={() => toggleEdgeSide(detail.id, "left")}
                          />
                        </div>

                        <div className="row-start-2 flex min-h-[96px] min-w-0 items-center justify-center overflow-hidden rounded-[14px] border-[3px] border-[var(--accent)]/85 bg-[#fbf8f1] px-2 text-center sm:min-h-[124px] sm:rounded-[20px] sm:px-3">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[9px] tracking-[0.12em] text-[var(--muted)] uppercase sm:text-[10px]">
                              {lineCalculation.width || 0} × {lineCalculation.height || 0} мм
                            </p>
                            <p className="mt-1 truncate text-[0.95rem] font-semibold text-[var(--foreground)] sm:mt-1.5 sm:text-[1.35rem]">
                              {detail.title}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[var(--muted)] sm:text-[12px]">
                              {lineCalculation.quantity || 0} шт.
                            </p>
                            <p className="mt-1 text-[8px] font-medium text-[var(--accent)] sm:text-[9px]">
                              {getOrientationModeLabel(detail.orientationMode)}
                            </p>
                          </div>
                        </div>

                        <div className="col-start-3 row-start-2">
                          <EdgeSideButton
                            side="right"
                            active={detail.edgedSides.includes("right")}
                            disabled={!edgingAvailable}
                            onClick={() => toggleEdgeSide(detail.id, "right")}
                          />
                        </div>

                        <div className="col-start-2 row-start-3">
                          <EdgeSideButton
                            side="bottom"
                            active={detail.edgedSides.includes("bottom")}
                            disabled={!edgingAvailable}
                            onClick={() => toggleEdgeSide(detail.id, "bottom")}
                          />
                        </div>
                      </div>

                      <div className="mt-2 border-t border-[color:var(--line)] pt-2 space-y-1">
                        <div>
                          <p className="font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                            Выбрано
                          </p>
                          <p className="mt-1 text-[12px] leading-4.5 text-[var(--foreground)]">
                            {selectedEdgeLabel}
                          </p>
                          <p className="mt-1 text-[11px] leading-4.5 text-[var(--muted)]">
                            Ориентация: {getOrientationModeLabel(detail.orientationMode)}
                          </p>
                        </div>

                        {!edgingAvailable ? (
                          <p className="text-[11px] leading-4 text-[var(--muted)]">
                            Для выбранного материала кромка 1 мм в этом расчете не
                            учитывается, но разметку можно сохранить для заявки.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 grid grid-cols-1 gap-2 px-1 min-[380px]:grid-cols-2 sm:gap-2.5 xl:hidden">
                    <MetricTile
                      label="Площадь"
                      value={`${lineCalculation.areaSqM.toFixed(2)} м²`}
                      muted
                    />
                    <MetricTile
                      label="Контур"
                      value={`${lineCalculation.perimeterMeters.toFixed(1)} м`}
                      muted
                    />
                    <MetricTile
                      label="Кромка 1 мм"
                      value={`${lineCalculation.edgeMeters.toFixed(1)} м`}
                      muted
                    />
                    <MetricTile
                      label="Ориентир по детали"
                      value={formatPrice(Math.round(lineCalculation.lineTotal))}
                      muted
                    />
                  </div>
                </article>
              );
            })}
          </div>

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
            className="mt-4 border border-[color:var(--line)] bg-[#fcfaf6] p-3 sm:p-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">
                  Заявка на распил
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
                  Отправьте текущий расчет менеджеру.
                </p>
              </div>
              <div className="text-[11px] leading-4.5 text-[var(--muted)] sm:max-w-[14rem] sm:text-right">
                <p>{requestPayload.material}</p>
                <p className="mt-1">
                  {exportableRows.length} поз. · {formatPrice(Math.round(estimate.totalEstimate))}
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

            <div className="mt-3 flex flex-col gap-2.5 border-t border-[color:var(--line)] pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] leading-4.5 text-[var(--muted)]">
                В заявку уйдут карта, ведомость, кромка 1 мм и ориентир по стоимости.
              </div>
              <Button
                variant="accent"
                onClick={handleRequestSubmit}
                disabled={isSubmittingRequest || exportableRows.length === 0}
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

          <div className="mt-7 overflow-hidden border-t border-[#151411]/10 bg-[#fcfaf6] pt-4 sm:mt-8 sm:pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">
                  Карта раскроя
                </p>
                <h3 className="mt-2 text-[1.35rem] leading-tight font-semibold text-[var(--foreground)] sm:text-2xl">
                  Предварительная карта листа {sheet.label}
                </h3>
                <p className="mt-2 hidden text-[13px] leading-5 text-[var(--muted)] sm:block">
                  Карта строится по полосному гильотинному алгоритму: сначала
                  формируется полезное поле листа после торцовки, затем
                  раскладываются полосы и поперечные резы с учетом ширины пропила.
                </p>
              </div>

              <div className="grid w-full min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:min-w-[250px] sm:w-auto sm:grid-cols-2 xl:grid-cols-3">
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
                        ? `${cutMap.largestOffcut.width} × ${cutMap.largestOffcut.height} мм`
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
                        className="min-w-0 overflow-hidden border border-[color:var(--line)] bg-white p-2.5 sm:p-3"
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
                          <span className="inline-flex min-h-7 items-center border border-[color:var(--line)] px-2 font-mono text-[9px] tracking-[0.12em] text-[var(--foreground)] uppercase">
                            {cutSheet.pieces.length} деталей · {fillRate.toFixed(0)}%
                          </span>
                        </div>

                        <div className="mt-2.5 border border-[color:var(--line)] bg-[#f7f3ec] p-1.5 sm:mt-3 sm:p-2">
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
                              const color = getCutMapColor(pieceIndex);

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
                                          {getOrientationModeLabel(piece.orientationMode)}
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
                                ? `${cutSheet.largestOffcut.width} × ${cutSheet.largestOffcut.height} мм`
                                : "Нет"
                            }
                            muted
                          />
                        </div>

                        {cutSheet.offcuts.length > 0 ? (
                          <div className="mt-3 border border-[color:var(--line)] bg-[var(--surface-strong)] p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-[var(--foreground)]">
                                Полезные остатки листа
                              </p>
                              <span className="text-[11px] text-[var(--muted)]">
                                {(cutSheet.offcutArea / 1_000_000).toFixed(2)} м² свободно
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                              {cutSheet.offcuts.slice(0, 4).map((offcut) => (
                                <span
                                  key={offcut.id}
                                  className="inline-flex items-center border border-[color:var(--line)] bg-white px-2.5 py-1.5 text-[11px] text-[var(--foreground)]"
                                >
                                  {offcut.width}×{offcut.height} мм
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

          <div className="mt-7 overflow-hidden border-t border-[#151411]/10 bg-[#fcfaf6] pt-4 sm:mt-8 sm:pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">
                  Ведомость для цеха
                </p>
                <h3 className="mt-2 text-[1.35rem] leading-tight font-semibold text-[var(--foreground)] sm:text-2xl">
                  Таблица деталей по фактической карте раскроя
                </h3>
                <p className="mt-2 hidden text-[13px] leading-5 text-[var(--muted)] sm:block">
                  Здесь собраны размеры, кромка, ориентация и распределение по листам. Эту часть уже удобно сверять перед распилом и кромлением.
                </p>
              </div>

              <div className="grid w-full min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:min-w-[220px] sm:w-auto sm:grid-cols-2">
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
                      <p className="font-mono text-[10px] tracking-[0.12em] uppercase">
                        Кромка
                      </p>
                      <p className="mt-0.5 text-[var(--foreground)]">{row.edgeLabel}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] tracking-[0.12em] uppercase">
                        Ориентация
                      </p>
                      <p className="mt-0.5 text-[var(--foreground)]">
                        {row.orientationLabel}
                      </p>
                    </div>
                    <div className="min-[380px]:col-span-2">
                      <p className="font-mono text-[10px] tracking-[0.12em] uppercase">
                        Листы
                      </p>
                      <p className="mt-0.5 text-[var(--foreground)]">{row.sheetsLabel}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-4 hidden overflow-x-auto border border-[color:var(--line)] bg-white md:block">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[color:var(--line)] bg-[var(--surface-strong)]">
                    <th className="px-3 py-3 text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
                      #
                    </th>
                    <th className="px-3 py-3 text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
                      Деталь
                    </th>
                    <th className="px-3 py-3 text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
                      Размер
                    </th>
                    <th className="px-3 py-3 text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
                      Кол-во
                    </th>
                    <th className="px-3 py-3 text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
                      Кромка
                    </th>
                    <th className="px-3 py-3 text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
                      Ориентация
                    </th>
                    <th className="px-3 py-3 text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
                      Листы
                    </th>
                    <th className="px-3 py-3 text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
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

        <aside className="hidden border-t border-[#151411]/10 bg-[#efe7db] p-4 text-[#151411] sm:p-5 lg:p-6 xl:sticky xl:top-20 xl:block xl:self-start xl:border-t-0 xl:border-l xl:border-[#151411]/10">
          <p className="font-mono text-[10px] tracking-[0.2em] text-[#8a7867] uppercase">
            Сводка
          </p>
          <h3 className="mt-2.5 text-[1.2rem] leading-[1.06] font-semibold text-balance sm:mt-3 sm:text-[1.45rem]">
            Рабочая сводка по карте раскроя
          </h3>
          <p className="mt-2 text-[13px] leading-5 text-[#5f554c] sm:text-sm sm:leading-6">
            Здесь собран только рабочий минимум: площадь, рез, листы, остатки и ориентир по стоимости.
          </p>

          <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-2.5 xl:grid-cols-1">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="border border-[#151411]/10 bg-[rgba(255,255,255,0.55)] p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center bg-white">
                      <Icon className="size-4 text-[var(--accent)]" />
                    </span>
                    <div>
                      <p className="text-[11px] tracking-[0.12em] text-[#7e7064] uppercase">
                        {card.label}
                      </p>
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
              <span>Распил по карте</span>
              <span>{formatPrice(Math.round(estimate.cuttingCost))}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm text-[#5f554c]">
              <span>Кромка 1 мм</span>
              <span>{formatPrice(Math.round(estimate.edgeCost))}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm text-[#5f554c]">
              <span>Подготовка</span>
              <span>{formatPrice(estimate.setupFee)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[#151411]/10 pt-3 text-[15px] font-semibold text-[#151411]">
              <span>Итого ориентир</span>
              <span>{formatPrice(Math.round(estimate.totalEstimate))}</span>
            </div>
          </div>

        </aside>
      </div>
    </section>
  );
}
