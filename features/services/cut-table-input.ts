import { parseLength } from "./cut-list-import";

// Быстрый ввод в таблице деталей: клавиатура и вставка из Excel.

export type TableEdgeSide = "top" | "right" | "bottom" | "left";

/** Колонки таблицы деталей в порядке, в котором по ним ходит Enter. */
export const TABLE_COLUMNS = [
  "title",
  "width",
  "height",
  "quantity",
  "edge",
] as const;
export type TableColumn = (typeof TABLE_COLUMNS)[number];

/** Числовые колонки: сюда вставляются столбцы чисел из Excel. */
export const NUMBER_COLUMNS = ["width", "height", "quantity"] as const;
export type NumberColumn = (typeof NUMBER_COLUMNS)[number];

const ALL_SIDES: TableEdgeSide[] = ["top", "right", "bottom", "left"];
const LONG: TableEdgeSide[] = ["top", "bottom"];
const SHORT: TableEdgeSide[] = ["right", "left"];

/** Куда идёт Enter из колонки; null — на следующую деталь. */
export function nextColumn(column: TableColumn): TableColumn | null {
  const index = TABLE_COLUMNS.indexOf(column);
  return index >= 0 && index < TABLE_COLUMNS.length - 1
    ? TABLE_COLUMNS[index + 1]
    : null;
}

/** В числовом поле оставляем цифры, запятую превращаем в точку. */
export function sanitizeNumberInput(value: string) {
  const text = value.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const dot = text.indexOf(".");
  return dot === -1
    ? text
    : text.slice(0, dot + 1) + text.slice(dot + 1).replace(/\./g, "");
}

function toggleGroup(current: TableEdgeSide[], group: TableEdgeSide[]) {
  const hasAll = group.every((side) => current.includes(side));
  const next = hasAll
    ? current.filter((side) => !group.includes(side))
    : [...new Set([...current, ...group])];
  return ALL_SIDES.filter((side) => next.includes(side));
}

/**
 * Кромка с клавиатуры, когда фокус на рисунке кромки. Клавиши берём по
 * месту на клавиатуре (event.code), чтобы работало и в русской, и в
 * английской раскладке: К — кругом, Д — длинные, Ш — короткие,
 * 0 / Delete — без кромки, пробел — кругом или убрать.
 */
export function edgesFromKey(
  code: string,
  current: TableEdgeSide[],
): TableEdgeSide[] | null {
  switch (code) {
    case "KeyR": // К
    case "KeyK":
      return [...ALL_SIDES];
    case "KeyL": // Д
    case "KeyD":
      return toggleGroup(current, LONG);
    case "KeyI": // Ш
    case "KeyS":
      return toggleGroup(current, SHORT);
    case "Digit0":
    case "Numpad0":
    case "Minus":
    case "NumpadSubtract":
    case "Delete":
    case "Backspace":
      return [];
    case "Space":
      return ALL_SIDES.every((side) => current.includes(side))
        ? []
        : [...ALL_SIDES];
    default:
      return null;
  }
}

/**
 * Текст из буфера как таблица. null — это одно значение, его вставляет
 * само поле.
 */
export function parsePastedGrid(text: string): string[][] | null {
  const normalized = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");

  if (!normalized.includes("\t") && !normalized.includes("\n")) {
    return null;
  }

  return normalized.split("\n").map((line) => line.split("\t"));
}

/** Все ячейки — числа (или пустые), и их не больше, чем колонок справа. */
export function isNumberGrid(grid: string[][], startColumn: NumberColumn) {
  const room = NUMBER_COLUMNS.length - NUMBER_COLUMNS.indexOf(startColumn);
  let hasValue = false;

  for (const cells of grid) {
    if (cells.length > room) return false;
    for (const cell of cells) {
      if (!cell.trim()) continue;
      if (parseLength(cell) === null) return false;
      hasValue = true;
    }
  }

  return hasValue;
}

/** Значение ячейки для числового поля: «720 мм» → «720». */
export function gridCellValue(cell: string) {
  const value = parseLength(cell);
  return value === null || value <= 0 ? null : String(Math.round(value));
}
