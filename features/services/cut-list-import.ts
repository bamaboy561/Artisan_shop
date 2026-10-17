import type { HardwareItem } from "./drilling-hardware";

export type DetailGroup = {
  id: string;
  label: string;
  // Для менеджера: задняя стенка и прочее, что не входит в раскрой.
  note?: string;
};

export type ImportedEdgeSide = "top" | "right" | "bottom" | "left";

export type ImportedDetail = {
  title: string;
  /** Длина вдоль текстуры, мм. В калькуляторе это поле «Ширина» (l в GibLab). */
  length: number;
  /** Ширина поперёк текстуры, мм. В калькуляторе это поле «Высота» (w в GibLab). */
  width: number;
  quantity: number;
  edgedSides: ImportedEdgeSide[];
  /** Текстура важна: деталь не поворачивать при раскрое. */
  fixedGrain?: boolean;
  /** Материал из таблицы (например, выгрузка OpenCutList из SketchUp). */
  material?: string;
  /** Присадка одной детали из проекта Базиса: диаметр → отверстий. */
  drill?: Record<string, number>;
  /** Фурнитура с чертежа (конструктор шкафа). */
  hardware?: HardwareItem[];
  /** Мебель из конструктора: клиент видит только габариты, не детали. */
  group?: DetailGroup;
};

export type CutListImportResult = {
  details: ImportedDetail[];
  skippedLines: number;
};

type ColumnRole =
  | "title"
  | "material"
  | "length"
  | "width"
  | "quantity"
  | "edge"
  | "edgeLong1"
  | "edgeLong2"
  | "edgeShort1"
  | "edgeShort2";

const LONG_SIDES: ImportedEdgeSide[] = ["top", "bottom"];
const SHORT_SIDES: ImportedEdgeSide[] = ["right", "left"];
const SIDE_ORDER: ImportedEdgeSide[] = ["top", "right", "bottom", "left"];

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[\s.,:()_-]+/g, "");
}

function detectColumnRole(header: string): ColumnRole | null {
  const value = normalizeHeader(header);

  if (!value) return null;
  // Служебные колонки OpenCutList (SketchUp): номер, «сырые» размеры с
  // припуском, площади и суммы. Берём чистовые размеры детали.
  if (/^(n|no|n°|№|nr|номер|number)$/.test(value)) return null;
  if (
    /(raw|пильная|пильна|roh|débit|cruda|crudo|surowa|total|суммарн|площад|area|edges|кромкипильн)$/.test(
      value,
    )
  ) {
    return null;
  }
  if (/^(имяматериала|materialname|материал|material)$/.test(value)) {
    return "material";
  }
  if (/^(кромка|edge)?(подлине|length|длина)1$/.test(value)) return "edgeLong1";
  if (/^(кромка|edge)?(подлине|length|длина)2$/.test(value)) return "edgeLong2";
  if (/^(кромка|edge)?(поширине|width|ширина)1$/.test(value)) {
    return "edgeShort1";
  }
  if (/^(кромка|edge)?(поширине|width|ширина)2$/.test(value)) {
    return "edgeShort2";
  }
  if (/^(пильнаядлина)$/.test(value)) return "length";
  if (/^(определение|designation|quantity|количество)$/.test(value)) {
    return value === "quantity" || value === "количество"
      ? "quantity"
      : "title";
  }
  if (/^(д1|l1|кд1|кромкад1)$/.test(value)) return "edgeLong1";
  if (/^(д2|l2|кд2|кромкад2)$/.test(value)) return "edgeLong2";
  if (/^(ш1|w1|кш1|кромкаш1)$/.test(value)) return "edgeShort1";
  if (/^(ш2|w2|кш2|кромкаш2)$/.test(value)) return "edgeShort2";
  if (value.includes("кром") || value === "edge") return "edge";
  if (/наимен|назв|детал|name|title|позиц/.test(value)) return "title";
  if (/^(длина|дл|д|l|length|высота|h|height)/.test(value)) return "length";
  if (/^(кол|колво|количество|шт|qty|count|n)/.test(value)) return "quantity";
  if (/^(ширина|шир|ш|w|width)/.test(value)) return "width";

  return null;
}

function parseNumber(value: string) {
  const normalized = value.replace(/\s+/g, "").replace(",", ".");

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  return Number(normalized);
}

const SIZE_PAIR = /^(\d+(?:[.,]\d+)?)\s*[xх×*]\s*(\d+(?:[.,]\d+)?)$/i;

// Строка CSV с кавычками: "Кромка (0,4 x 22)" остаётся одной ячейкой.
function splitQuoted(line: string, separator: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"' && current.trim() === "") {
      quoted = true;
      current = "";
    } else if (char === separator) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function splitCells(line: string) {
  if (line.includes('"')) {
    const separator = line.includes("\t")
      ? "\t"
      : line.includes(";")
        ? ";"
        : ",";
    return splitQuoted(line, separator);
  }
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(";")) return line.split(";");
  if (/\d,\d/.test(line) && !line.includes(" ")) return line.split(",");
  if (line.includes(",")) return line.split(/,(?!\d)/);

  return line
    .replace(/(\d)\s*[xх×*]\s*(?=\d)/gi, "$1 ")
    .trim()
    .split(/\s{2,}|\s+(?=\d)|(?<=\d)\s+/);
}

function splitLine(line: string) {
  return splitCells(line).flatMap((cell) => {
    const pair = cell.trim().match(SIZE_PAIR);
    return pair ? [pair[1], pair[2]] : [cell];
  });
}

/**
 * Разбирает кромку, записанную текстом: «все», «кругом», «2Д», «1Д 1Ш», «Д+Ш».
 * Д (длинные) стороны идут вдоль длины детали, Ш (короткие) вдоль ширины.
 */
export function parseEdgeText(value: string): ImportedEdgeSide[] {
  const text = value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/кромк[а-я]*/g, "")
    .trim();

  if (!text || /^(нет|без|-|0$)/.test(text)) return [];
  if (/все|круг|по\s*периметру|4\s*стор|^4$/.test(text)) return [...SIDE_ORDER];

  const sides = new Set<ImportedEdgeSide>();
  const longMatch = text.match(/(\d)?\s*д/);
  const shortMatch = text.match(/(\d)?\s*[шк]/);

  if (longMatch) {
    const count = Number(longMatch[1] ?? 2);
    LONG_SIDES.slice(0, Math.min(count, 2)).forEach((side) => sides.add(side));
  }

  if (shortMatch) {
    const count = Number(shortMatch[1] ?? 2);
    SHORT_SIDES.slice(0, Math.min(count, 2)).forEach((side) => sides.add(side));
  }

  return SIDE_ORDER.filter((side) => sides.has(side));
}

/**
 * Размер в мм. Понимает «720», «720,5», а также размеры с единицами, как их
 * пишет SketchUp: «720 mm», «72 см», «0,72 m», «~ 720mm».
 */
export function parseLength(value: string) {
  const text = value
    .trim()
    .toLowerCase()
    .replace(/^~\s*/, "")
    .replace(/\s+/g, "");
  const match = text.match(/^(-?\d+(?:[.,]\d+)?)(mm|мм|cm|см|m|м)?$/);

  if (!match) return null;

  const number = Number(match[1].replace(",", "."));
  const unit = match[2] ?? "mm";
  const factor =
    unit === "cm" || unit === "см"
      ? 10
      : unit === "m" || unit === "м"
        ? 1000
        : 1;

  return number * factor;
}

function edgeFlag(value: string | undefined) {
  if (!value) return false;
  const text = value.trim().toLowerCase();
  if (!text) return false;
  const numeric = parseNumber(text);
  if (numeric !== null) return numeric > 0;
  if (/^(нет|no|-|–|false|0)$/.test(text)) return false;

  // В колонке стороны любое название кромки значит «кромка есть»
  // (OpenCutList пишет туда материал кромки).
  return true;
}

function sidesFromFlags(flags: {
  long1?: boolean;
  long2?: boolean;
  short1?: boolean;
  short2?: boolean;
}) {
  const sides: ImportedEdgeSide[] = [];
  if (flags.long1) sides.push("top");
  if (flags.short1) sides.push("right");
  if (flags.long2) sides.push("bottom");
  if (flags.short2) sides.push("left");

  return sides;
}

function buildHeaderMap(cells: string[]) {
  const map = new Map<ColumnRole, number>();

  cells.forEach((cell, index) => {
    const role = detectColumnRole(cell);
    if (role && !map.has(role)) {
      map.set(role, index);
    }
  });

  return map.has("length") && map.has("width") ? map : null;
}

function parseByHeader(
  cells: string[],
  map: Map<ColumnRole, number>,
  fallbackIndex: number,
): ImportedDetail | null {
  const cell = (role: ColumnRole) => {
    const index = map.get(role);
    return index === undefined ? undefined : cells[index]?.trim();
  };

  const length = parseLength(cell("length") ?? "");
  const width = parseLength(cell("width") ?? "");

  if (!length || !width || length <= 0 || width <= 0) {
    return null;
  }

  const quantity = parseNumber(cell("quantity") ?? "") ?? 1;
  const material = cell("material");
  const hasSideColumns =
    map.has("edgeLong1") ||
    map.has("edgeLong2") ||
    map.has("edgeShort1") ||
    map.has("edgeShort2");

  return {
    title: cell("title") || `Деталь ${fallbackIndex}`,
    length: Math.round(length),
    width: Math.round(width),
    quantity: Math.max(1, Math.round(quantity)),
    edgedSides: hasSideColumns
      ? sidesFromFlags({
          long1: edgeFlag(cell("edgeLong1")),
          long2: edgeFlag(cell("edgeLong2")),
          short1: edgeFlag(cell("edgeShort1")),
          short2: edgeFlag(cell("edgeShort2")),
        })
      : parseEdgeText(cell("edge") ?? ""),
    ...(material ? { material } : {}),
  };
}

/**
 * Без заголовка: [название] длина ширина [кол-во] [кромка текстом | Д1 Д2 Ш1 Ш2].
 */
function parseByPosition(
  cells: string[],
  fallbackIndex: number,
): ImportedDetail | null {
  const trimmed = cells.map((cell) => cell.trim()).filter(Boolean);
  const firstNumberIndex = trimmed.findIndex(
    (cell) => parseNumber(cell) !== null,
  );

  if (firstNumberIndex === -1) {
    return null;
  }

  const title = trimmed.slice(0, firstNumberIndex).join(" ");
  const rest = trimmed.slice(firstNumberIndex);
  const numbers: number[] = [];
  let index = 0;

  while (index < rest.length && numbers.length < 3) {
    const value = parseNumber(rest[index]);
    if (value === null) break;
    numbers.push(value);
    index += 1;
  }

  const [length, width, quantity = 1] = numbers;

  if (!length || !width || length <= 0 || width <= 0) {
    return null;
  }

  const tail = rest.slice(index);
  let edgedSides: ImportedEdgeSide[] = [];

  if (
    tail.length >= 4 &&
    tail.slice(0, 4).every((cell) => parseNumber(cell) !== null)
  ) {
    edgedSides = sidesFromFlags({
      long1: edgeFlag(tail[0]),
      long2: edgeFlag(tail[1]),
      short1: edgeFlag(tail[2]),
      short2: edgeFlag(tail[3]),
    });
  } else if (tail.length > 0) {
    edgedSides = parseEdgeText(tail.join(" "));
  }

  return {
    title: title || `Деталь ${fallbackIndex}`,
    length: Math.round(length),
    width: Math.round(width),
    quantity: Math.max(1, Math.round(quantity)),
    edgedSides,
  };
}

export function parseCutListRows(rows: string[][]): CutListImportResult {
  const details: ImportedDetail[] = [];
  let skippedLines = 0;
  let headerMap: Map<ColumnRole, number> | null = null;

  for (const cells of rows) {
    if (cells.every((cell) => !cell?.trim())) {
      continue;
    }

    if (!headerMap) {
      const candidate = buildHeaderMap(cells);
      if (candidate) {
        headerMap = candidate;
        continue;
      }
    }

    const detail = headerMap
      ? parseByHeader(cells, headerMap, details.length + 1)
      : parseByPosition(cells, details.length + 1);

    if (detail) {
      details.push(detail);
    } else {
      skippedLines += 1;
    }
  }

  return { details, skippedLines };
}

export function parseCutListText(text: string): CutListImportResult {
  const rows = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => splitLine(line));

  return parseCutListRows(rows);
}

export const cutListTemplateRows = [
  ["Название", "Длина", "Ширина", "Кол-во", "Д1", "Д2", "Ш1", "Ш2"],
  ["Боковина", "720", "560", "2", "1", "0", "0", "0"],
  ["Полка", "564", "540", "3", "1", "0", "0", "0"],
  ["Фасад", "716", "396", "2", "1", "1", "1", "1"],
];
