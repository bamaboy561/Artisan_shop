import "server-only";

import { parseBazisProject, readBazisGibLabSource } from "@/lib/bazis-b3d";
import {
  buildGibLabProject,
  countGibLabProject,
  encodeWindows1251,
} from "@/lib/bazis-giblab";
import { gibLabPartPosition } from "@/features/production/giblab-orders";

// Проекты Базиса (.b3d) → один файл GibLab (.project) в windows-1251.
export function exportBazisToGibLab(files: Buffer | Buffer[]) {
  return exportBazisToGibLabChecked(files).bytes;
}

// То же, плюс сверка: сколько деталей и отверстий в Базисе и сколько дошло
// до GibLab, и детали, которые стоят друг в друге (их часто копируют по
// ошибке — пусть менеджер проверит).
//
// fileNumbers — номер каждого файла среди файлов Базиса заявки. Когда файлов
// несколько, позиция детали в GibLab получает номер файла: «2-5». Иначе
// «поз. 5» есть в каждом файле, и QR «СБОРКА» открыл бы чужую деталь.
export function exportBazisToGibLabChecked(
  files: Buffer | Buffer[],
  options: { fileNumbers?: number[]; fileCount?: number } = {},
) {
  const list = Array.isArray(files) ? files : [files];
  const fileCount = options.fileCount ?? list.length;
  const xml = buildGibLabProject(
    list.map((file, index) => {
      const source = readBazisGibLabSource(file);
      const fileNumber = options.fileNumbers?.[index] ?? index + 1;
      return fileCount > 1
        ? {
            ...source,
            panels: source.panels.map((panel) => ({
              ...panel,
              artPos: gibLabPartPosition(fileNumber, fileCount, panel.artPos),
            })),
          }
        : source;
    }),
  );
  const result = countGibLabProject(xml);
  let parts = 0;
  let holes = 0;
  const twins: string[] = [];
  for (const file of list) {
    const project = parseBazisProject(file);
    parts += project.panels.length;
    holes += project.drilling.holes;
    const places = new Map<string, number>();
    for (const panel of project.panels) {
      const key = [
        ...panel.box.matrix,
        panel.box.x,
        panel.box.y,
        panel.box.sizeX,
        panel.box.sizeY,
        panel.thickness,
      ]
        .map((value) => Math.round(value * 10))
        .join(" ");
      places.set(key, (places.get(key) ?? 0) + 1);
      if (places.get(key) === 2)
        twins.push(panel.position ? `поз. ${panel.position}` : panel.name);
    }
  }
  return {
    bytes: encodeWindows1251(xml),
    check: {
      parts,
      holes,
      giblabParts: result.parts,
      giblabHoles: result.holes,
      twins,
    },
  };
}

export function describeGibLabCheck(check: {
  parts: number;
  holes: number;
  giblabParts: number;
  giblabHoles: number;
  twins: string[];
}) {
  const complete =
    check.giblabParts === check.parts && check.giblabHoles === check.holes;
  return [
    complete
      ? `${check.parts} дет., ${check.holes} отв. — всё перенесено`
      : `⚠ в GibLab ${check.giblabParts} из ${check.parts} дет., ${check.giblabHoles} из ${check.holes} отв.`,
    check.twins.length > 0
      ? `⚠ детали в одном месте: ${check.twins.slice(0, 5).join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("; ");
}
