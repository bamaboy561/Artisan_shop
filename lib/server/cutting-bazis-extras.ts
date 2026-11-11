import "server-only";

import { parseBazisProject } from "@/lib/bazis-b3d";
import type { CuttingExtras } from "@/features/cutting/quote";
import { readRequestFileBytes } from "@/lib/server/request-file-content";

const isBazisFile = (name: string) => /\.b3d$/i.test(name);

// Присадка из проектов Базиса (.b3d): отверстия в пласть и в торец по
// диаметрам. Нечитаемый файл просто пропускается — посчитает менеджер.
export function bazisDrillingExtras(files: Buffer[]): CuttingExtras | null {
  const drilling: Record<string, number> = {};

  for (const bytes of files) {
    try {
      const project = parseBazisProject(bytes);
      for (const row of project.drilling.rows) {
        const holes = Math.round(row.face + row.edge);
        if (!(row.diameter > 0) || !(holes > 0)) continue;
        const key = String(Math.round(row.diameter * 10) / 10);
        drilling[key] = (drilling[key] ?? 0) + holes;
      }
    } catch (error) {
      console.error("[cutting:bazis-extras]", error);
    }
  }

  return Object.keys(drilling).length > 0
    ? { drilling, curveMeters: 0, bevelMeters: 0, source: "bazis" }
    : null;
}

export async function bazisExtrasFromUploads(files: File[]) {
  const bazis = files.filter((file) => isBazisFile(file.name));
  if (bazis.length === 0) return null;
  const buffers = await Promise.all(
    bazis.map(async (file) => Buffer.from(await file.arrayBuffer())),
  );
  return bazisDrillingExtras(buffers);
}

export async function bazisExtrasFromRequestFiles(
  files: Array<{ fileName: string; fileUrl: string }>,
) {
  const bazis = files.filter((file) => isBazisFile(file.fileName));
  if (bazis.length === 0) return null;
  const buffers = (
    await Promise.all(bazis.map((file) => readRequestFileBytes(file.fileUrl)))
  ).flatMap((bytes) => (bytes ? [bytes] : []));
  return bazisDrillingExtras(buffers);
}
