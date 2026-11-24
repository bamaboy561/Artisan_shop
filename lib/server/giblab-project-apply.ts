import "server-only";

import type { CuttingExtras } from "@/features/cutting/quote";
import {
  summarizeMaterialLines,
  type MaterialLine,
} from "@/features/cutting/material-lines";
import {
  decodeGibLabProject,
  isGibLabProjectXml,
  isHdfSheet,
  readGibLabProject,
  type GibLabProjectSummary,
} from "@/features/production/giblab-project-read";
import { getDb } from "@/lib/db";
import { readCuttingExtras } from "@/lib/server/cutting-pricing";
import { readRequestFileBytes } from "@/lib/server/request-file-content";
import { updateRequestCuttingDetails } from "@/lib/server/request-inbox";
import {
  getRequestMaterialLines,
  replaceRequestMaterialLines,
} from "@/lib/server/request-material-lines";

export const isGibLabProjectFileName = (name: string) =>
  /\.project$/i.test(name);

// Сводка готового проекта GibLab из файла заявки; null — файл не читается.
export async function readRequestGibLabSummary(fileUrl: string) {
  const bytes = await readRequestFileBytes(fileUrl);
  if (!bytes) return null;
  const xml = decodeGibLabProject(bytes);
  if (!isGibLabProjectXml(xml)) return null;
  return readGibLabProject(xml);
}

const sameName = (a: string, b: string) =>
  a
    .toLowerCase()
    .replace(/[\s.]+/g, " ")
    .trim() ===
  b
    .toLowerCase()
    .replace(/[\s.]+/g, " ")
    .trim();

// Строки «Листы и кромка» из GibLab. Если такой декор уже выбран из
// магазина, строку оставляем магазинной и меняем только количество.
export function gibLabMaterialLines(
  summary: GibLabProjectSummary,
  existing: MaterialLine[],
): MaterialLine[] {
  const lines: MaterialLine[] = [];
  for (const sheet of summary.sheets) {
    const saved = existing.find(
      (line) => line.kind === "SHEET" && sameName(line.name, sheet.name),
    );
    lines.push({
      kind: "SHEET",
      source: saved?.source ?? "CLIENT",
      productId: saved?.productId ?? null,
      name: saved?.name ?? sheet.name,
      sku: saved?.sku ?? sheet.code,
      thicknessMm: sheet.thicknessMm ?? saved?.thicknessMm ?? null,
      widthMm: null,
      format:
        sheet.lengthMm && sheet.widthMm
          ? `${sheet.lengthMm}×${sheet.widthMm}`
          : (saved?.format ?? null),
      quantity: sheet.sheets,
      note: saved?.note ?? "Из GibLab",
    });
  }
  for (const band of summary.bands) {
    const saved = existing.find(
      (line) => line.kind === "EDGE" && sameName(line.name, band.name),
    );
    lines.push({
      kind: "EDGE",
      source: saved?.source ?? "CLIENT",
      productId: saved?.productId ?? null,
      name: saved?.name ?? band.name,
      sku: saved?.sku ?? band.code,
      thicknessMm: band.thicknessMm ?? saved?.thicknessMm ?? null,
      widthMm: band.widthMm ?? saved?.widthMm ?? null,
      format: null,
      quantity: band.meters,
      note: saved?.note ?? "Из GibLab",
    });
  }
  return lines;
}

// Присадка, фрезеровка, пазы и листы ХДФ из GibLab. Другие работы
// (утолщёнка, HPL, мойка…) менеджер вводил сам — их не трогаем.
export function gibLabExtras(
  summary: GibLabProjectSummary,
  previous: CuttingExtras | null,
): CuttingExtras {
  const hdfSheets = summary.sheets
    .filter(isHdfSheet)
    .reduce((sum, sheet) => sum + sheet.sheets, 0);
  return {
    ...(previous ?? {}),
    drilling: { ...summary.drilling },
    curveMeters: summary.millMeters,
    bevelMeters: previous?.bevelMeters ?? 0,
    grooveMeters: summary.grooveMeters,
    hdfSheets,
    source: "manager",
  };
}

// Переносит готовый заказ GibLab в заявку: строки листов и кромки, итоги
// листов ЛДСП и метров кромки. Присадку возвращает — сумму пересчитывает
// вызывающий (repriceCuttingRequest).
export async function applyGibLabProjectToRequest(
  requestId: string,
  summary: GibLabProjectSummary,
) {
  const existing = await getRequestMaterialLines(requestId).catch(() => []);
  const lines = gibLabMaterialLines(summary, existing);
  const sheetLines = lines.filter((line) => line.kind === "SHEET");
  if (sheetLines.length === 0) {
    throw new Error("В проекте GibLab нет карт раскроя с листами.");
  }
  const totals = summarizeMaterialLines(lines);
  const request = await getDb().request.findUnique({
    where: { id: requestId },
    select: { edgeOption: true, cuttingEdgeMeters: true },
  });
  await updateRequestCuttingDetails({
    id: requestId,
    material: totals.material ?? sheetLines[0].name,
    cuttingSheetCount: totals.sheetCount,
    cuttingEdgeMeters: totals.edgeMeters ?? request?.cuttingEdgeMeters ?? 0,
    edgeOption: totals.edgeOption ?? request?.edgeOption ?? null,
  });
  await replaceRequestMaterialLines(requestId, lines);
  return gibLabExtras(summary, await readCuttingExtras(getDb(), requestId));
}
