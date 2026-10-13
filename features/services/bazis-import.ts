import type {
  ImportedDetail,
  ImportedEdgeSide,
} from "@/features/services/cut-list-import";

// Строка проекта Базиса в том виде, в каком её отдаёт /api/bazis/parts.
export type BazisImportRow = {
  name: string;
  position: string;
  material: string;
  thickness: number;
  length: number;
  width: number;
  quantity: number;
  edgedLengthSides: number;
  edgedWidthSides: number;
  complexContour: boolean;
  textured?: boolean;
};

export type BazisMaterialGroup = {
  material: string;
  thickness: number;
  pieces: number;
  areaM2: number;
  complexCount: number;
  details: ImportedDetail[];
};

export type BazisImportResponse =
  | { ok: true; orderName: string; groups: BazisMaterialGroup[] }
  | { ok: false; error: string };

const LONG_SIDES: ImportedEdgeSide[] = ["top", "bottom"];
const SHORT_SIDES: ImportedEdgeSide[] = ["right", "left"];
const SIDE_ORDER: ImportedEdgeSide[] = ["top", "right", "bottom", "left"];

export function bazisRowToDetail(row: BazisImportRow): ImportedDetail {
  const sides = new Set<ImportedEdgeSide>([
    ...LONG_SIDES.slice(0, Math.min(row.edgedLengthSides, 2)),
    ...SHORT_SIDES.slice(0, Math.min(row.edgedWidthSides, 2)),
  ]);
  const position = row.position ? ` (поз. ${row.position})` : "";

  return {
    title: `${row.name || "Деталь"}${position}${
      row.complexContour ? ", сложный контур" : ""
    }`.slice(0, 120),
    length: Math.round(row.length),
    width: Math.round(row.width),
    quantity: row.quantity,
    edgedSides: SIDE_ORDER.filter((side) => sides.has(side)),
    fixedGrain: row.textured === true,
  };
}

// Калькулятор считает один материал за раз, поэтому делим детали по
// материалу и толщине. Самый большой по площади идёт первым.
export function groupBazisRowsByMaterial(
  rows: BazisImportRow[],
): BazisMaterialGroup[] {
  const groups = new Map<string, BazisMaterialGroup>();

  for (const row of rows) {
    if (!(row.length > 0 && row.width > 0 && row.quantity > 0)) continue;

    const key = `${row.material}\u0000${row.thickness}`;
    const group = groups.get(key) ?? {
      material: row.material || "Материал не указан",
      thickness: row.thickness,
      pieces: 0,
      areaM2: 0,
      complexCount: 0,
      details: [],
    };

    group.pieces += row.quantity;
    group.areaM2 += (row.length * row.width * row.quantity) / 1_000_000;
    if (row.complexContour) group.complexCount += row.quantity;
    group.details.push(bazisRowToDetail(row));
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      areaM2: Math.round(group.areaM2 * 100) / 100,
    }))
    .sort((left, right) => right.areaM2 - left.areaM2);
}
