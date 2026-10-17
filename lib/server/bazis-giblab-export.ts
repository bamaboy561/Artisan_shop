import "server-only";

import { readBazisGibLabSource } from "@/lib/bazis-b3d";
import { buildGibLabProject, encodeWindows1251 } from "@/lib/bazis-giblab";

// Проект Базиса (.b3d) → файл GibLab (.project) в windows-1251.
export function exportBazisToGibLab(file: Buffer) {
  return encodeWindows1251(buildGibLabProject(readBazisGibLabSource(file)));
}
