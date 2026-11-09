import { z } from "zod";

import {
  parseEdgeText,
  type ImportedDetail,
  type ImportedEdgeSide,
} from "./cut-list-import";

// Ответ модели по фото списка деталей. Всё, что не видно на фото, — null:
// модель только переписывает, а не считает и не додумывает.
const nullableText = z.string().max(200).nullable();
const nullableSize = z.number().positive().max(10_000).nullable();
const nullableSideCount = z.number().int().min(0).max(2).nullable();

export const cutListPhotoSchema = z
  .object({
    complete: z.boolean(),
    warnings: z.array(z.string().max(300)).max(20),
    rows: z
      .array(
        z
          .object({
            title: nullableText,
            material: nullableText,
            length: nullableSize,
            width: nullableSize,
            quantity: z.number().int().positive().max(10_000).nullable(),
            edgeText: z.string().max(100).nullable(),
            edgeLong: nullableSideCount,
            edgeShort: nullableSideCount,
            uncertain: z.boolean(),
          })
          .strict(),
      )
      .max(150),
  })
  .strict();

export type CutListPhotoResult = {
  details: ImportedDetail[];
  skippedLines: number;
  warnings: string[];
};

export type CutListPhotoResponse =
  | ({ ok: true } & CutListPhotoResult)
  | { ok: false; error: string };

export class CutListPhotoError extends Error {}

// Больше стандартного листа ЛДСП бывает только у HPL и ошибок распознавания.
const SUSPICIOUS_SIZE_MM = 2800;

function edgeSides(
  edgeText: string | null,
  edgeLong: number | null,
  edgeShort: number | null,
): ImportedEdgeSide[] {
  if (edgeText?.trim()) return parseEdgeText(edgeText);
  const sides: ImportedEdgeSide[] = [];
  if ((edgeLong ?? 0) >= 1) sides.push("top");
  if ((edgeShort ?? 0) >= 1) sides.push("right");
  if ((edgeLong ?? 0) >= 2) sides.push("bottom");
  if ((edgeShort ?? 0) >= 2) sides.push("left");
  return sides;
}

export function parseCutListPhotoResult(value: unknown): CutListPhotoResult {
  const parsed = cutListPhotoSchema.safeParse(value);
  if (!parsed.success)
    throw new CutListPhotoError(
      "Не удалось разобрать список на фото. Сделайте более чёткое фото.",
    );

  const result = parsed.data;
  if (result.rows.length === 0)
    throw new CutListPhotoError(
      "На фото не нашли списка деталей с размерами. Прикрепите фото к заявке, менеджер разберёт его.",
    );

  const warnings: string[] = [
    "Детали распознаны по фото. Сверьте каждую строку с оригиналом: размеры, количество, кромку.",
  ];
  if (!result.complete)
    warnings.push(
      "Часть фото обрезана или неразборчива. Проверьте, что перенесены все детали.",
    );
  warnings.push(...result.warnings);

  const details: ImportedDetail[] = [];
  let skippedLines = 0;

  result.rows.forEach((row, index) => {
    const line = index + 1;
    if (row.length === null || row.width === null) {
      skippedLines += 1;
      warnings.push(
        `Строка ${line}${row.title ? ` («${row.title.trim()}»)` : ""}: размер не разобрали, добавьте деталь вручную.`,
      );
      return;
    }

    const length = Math.round(row.length);
    const width = Math.round(row.width);
    const title = row.title?.trim() || `Деталь ${details.length + 1}`;
    const notes: string[] = [];

    if (row.uncertain) notes.push("есть неразборчивые данные");
    if (row.quantity === null) notes.push("количество не видно, поставили 1");
    if (length > SUSPICIOUS_SIZE_MM || width > SUSPICIOUS_SIZE_MM)
      notes.push("размер больше листа");
    if (row.edgeText === null && row.edgeLong === null && row.edgeShort === null)
      notes.push("кромка не указана");

    if (notes.length > 0)
      warnings.push(`«${title}» (строка ${line}): ${notes.join(", ")}.`);

    const material = row.material?.trim();
    details.push({
      title,
      length,
      width,
      quantity: row.quantity ?? 1,
      edgedSides: edgeSides(row.edgeText, row.edgeLong, row.edgeShort),
      ...(material ? { material } : {}),
    });
  });

  if (details.length === 0)
    throw new CutListPhotoError(
      "Не получилось разобрать размеры ни одной детали. Прикрепите фото к заявке, менеджер разберёт его.",
    );

  return { details, skippedLines, warnings };
}
