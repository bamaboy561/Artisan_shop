// Строки «Материалы и кромка» в заказе на распил: каждый лист и каждая
// кромка — отдельная строка. Материал берут из магазина (товар сайта) или
// отмечают «привозной» (лист/кромку принёс клиент) и пишут название руками.
// Из строк собирается прежняя текстовая сводка (Request.material и
// Request.edgeOption) и итоги «листов» и «метров кромки», поэтому очередь,
// счёт, Telegram и старые заказы работают как раньше.

export type MaterialLineKind = "SHEET" | "EDGE";
export type MaterialLineSource = "STOCK" | "CLIENT";

export type MaterialLine = {
  kind: MaterialLineKind;
  source: MaterialLineSource;
  productId: string | null;
  name: string;
  sku: string | null;
  // Лист: толщина плиты (16, 18). Кромка: толщина ленты (0,4 / 0,8 / 2).
  thicknessMm: number | null;
  // Кромка: ширина ленты (19, 22, 35).
  widthMm: number | null;
  // Лист: формат «2800×2070».
  format: string | null;
  // Лист: штук. Кромка: погонные метры.
  quantity: number | null;
  note: string | null;
};

// Товар магазина в поиске строки «из магазина» (/api/admin/materials).
export type MaterialSearchItem = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  category: string;
  thicknessMm: number | null;
  edgeThicknessMm: number | null;
  edgeWidthMm: number | null;
  format: string | null;
  stockQuantity: number | null;
  price: number | null;
  image: string | null;
};

export type MaterialLineDto = MaterialLine & { id: string };

export const MAX_MATERIAL_LINES = 40;

export const materialSourceLabels: Record<MaterialLineSource, string> = {
  STOCK: "Из магазина",
  CLIENT: "Привозной",
};

export const materialKindLabels: Record<MaterialLineKind, string> = {
  SHEET: "Лист",
  EDGE: "Кромка",
};

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

export function formatMaterialNumber(value: number) {
  return numberFormatter.format(value);
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim().slice(0, max);
  return text || null;
}

function cleanNumber(value: unknown, min: number, max: number) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.replace(",", ".").replace(/\s+/g, ""))
        : NaN;
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return Math.round(number * 100) / 100;
}

export type ParsedMaterialLines =
  | { ok: true; lines: MaterialLine[] }
  | { ok: false; message: string };

// Разбор скрытого поля формы. Пустые строки (ничего не выбрано и не
// написано) молча пропускаем: менеджер мог нажать «Добавить» лишний раз.
export function parseMaterialLines(raw: unknown): ParsedMaterialLines {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, lines: [] };
  }
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, message: "Не удалось прочитать список материалов." };
    }
  }
  if (!Array.isArray(value)) {
    return { ok: false, message: "Не удалось прочитать список материалов." };
  }

  const lines: MaterialLine[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const kind: MaterialLineKind = row.kind === "EDGE" ? "EDGE" : "SHEET";
    const source: MaterialLineSource =
      row.source === "STOCK" ? "STOCK" : "CLIENT";
    const name = cleanText(row.name, 200);
    const productId = source === "STOCK" ? cleanText(row.productId, 64) : null;
    if (!name) {
      if (source === "STOCK" && !productId) continue;
      if (source === "CLIENT") {
        const hasAnything = [row.thicknessMm, row.widthMm, row.quantity]
          .concat([row.format, row.note])
          .some((part) => (typeof part === "string" ? part.trim() : part));
        if (!hasAnything) continue;
      }
      return {
        ok: false,
        message:
          kind === "EDGE"
            ? "Напишите название привозной кромки или уберите пустую строку."
            : "Напишите название привозного листа или уберите пустую строку.",
      };
    }
    if (source === "STOCK" && !productId) {
      return {
        ok: false,
        message: `Выберите «${name}» из списка магазина или отметьте строку «Привозной».`,
      };
    }

    const quantity =
      kind === "SHEET"
        ? cleanNumber(row.quantity, 0, 10000)
        : cleanNumber(row.quantity, 0, 100000);
    if (
      row.quantity !== null &&
      row.quantity !== undefined &&
      String(row.quantity).trim() !== "" &&
      quantity === null
    ) {
      return {
        ok: false,
        message:
          kind === "EDGE"
            ? `Проверьте метраж кромки «${name}».`
            : `Проверьте количество листов «${name}».`,
      };
    }

    lines.push({
      kind,
      source,
      productId,
      name,
      sku: source === "STOCK" ? cleanText(row.sku, 80) : null,
      thicknessMm: cleanNumber(row.thicknessMm, 0.1, 100),
      widthMm: kind === "EDGE" ? cleanNumber(row.widthMm, 1, 200) : null,
      format: kind === "SHEET" ? cleanText(row.format, 40) : null,
      quantity:
        quantity === null
          ? null
          : kind === "SHEET"
            ? Math.round(quantity)
            : quantity,
      note: cleanText(row.note, 200),
    });
    if (lines.length > MAX_MATERIAL_LINES) {
      return {
        ok: false,
        message: `В одном заказе не больше ${MAX_MATERIAL_LINES} строк материалов.`,
      };
    }
  }
  return { ok: true, lines };
}

function sizeText(line: MaterialLine) {
  if (line.kind === "EDGE") {
    if (line.thicknessMm !== null && line.widthMm !== null) {
      return `${formatMaterialNumber(line.thicknessMm)}×${formatMaterialNumber(line.widthMm)} мм`;
    }
    if (line.thicknessMm !== null)
      return `${formatMaterialNumber(line.thicknessMm)} мм`;
    if (line.widthMm !== null)
      return `ширина ${formatMaterialNumber(line.widthMm)} мм`;
    return null;
  }
  return (
    [
      line.thicknessMm !== null &&
      !new RegExp(
        `(^|\\D)${String(line.thicknessMm).replace(".", "[.,]")}\\s*мм`,
      ).test(line.name)
        ? `${formatMaterialNumber(line.thicknessMm)} мм`
        : null,
      line.format,
    ]
      .filter(Boolean)
      .join(", ") || null
  );
}

export function materialLineQuantityText(line: MaterialLine) {
  if (line.quantity === null) return null;
  return line.kind === "EDGE"
    ? `${formatMaterialNumber(line.quantity)} м`
    : `${line.quantity} шт.`;
}

export function materialLineSizeText(line: MaterialLine) {
  return sizeText(line);
}

// «ЛДСП Кашемир 16 мм, 2800×2070 — 4 шт. (привозной)»
export function materialLineText(line: MaterialLine) {
  const size = sizeText(line);
  const quantity = materialLineQuantityText(line);
  return [
    [line.name, size].filter(Boolean).join(", "),
    quantity ? ` — ${quantity}` : "",
    line.source === "CLIENT" ? " (привозной)" : "",
  ].join("");
}

function joinLimited(parts: string[], max: number) {
  const text = parts.join("; ");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export type MaterialSummary = {
  material: string | null;
  edgeOption: string | null;
  sheetCount: number | null;
  edgeMeters: number | null;
};

export function summarizeMaterialLines(lines: MaterialLine[]): MaterialSummary {
  const sheets = lines.filter((line) => line.kind === "SHEET");
  const edges = lines.filter((line) => line.kind === "EDGE");
  const sheetQuantities = sheets
    .map((line) => line.quantity)
    .filter((value): value is number => value !== null);
  const edgeQuantities = edges
    .map((line) => line.quantity)
    .filter((value): value is number => value !== null);
  return {
    material: sheets.length
      ? joinLimited(sheets.map(materialLineText), 500)
      : null,
    edgeOption: edges.length
      ? joinLimited(edges.map(materialLineText), 240)
      : null,
    sheetCount: sheetQuantities.length
      ? sheetQuantities.reduce((sum, value) => sum + value, 0)
      : null,
    edgeMeters: edgeQuantities.length
      ? Math.round(
          edgeQuantities.reduce((sum, value) => sum + value, 0) * 100,
        ) / 100
      : null,
  };
}

// Размер кромки из названия товара: «1*19 мм», «19/1», «22/1.0», «0,4х19».
export function edgeSizeFromName(name: string) {
  const pattern =
    /(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:мм)?\s*[*xх×/]\s*(\d{1,2}(?:[.,]\d{1,2})?)/gi;
  for (const match of name.matchAll(pattern)) {
    const left = Number(match[1].replace(",", "."));
    const right = Number(match[2].replace(",", "."));
    const [thickness, width] = left < right ? [left, right] : [right, left];
    if (thickness > 0 && thickness <= 3 && width >= 10 && width <= 100) {
      return { thicknessMm: thickness, widthMm: width };
    }
  }
  return null;
}

// Толщина плиты из названия: «ЛДСП 16 мм Кашемир», «МДФ 18мм».
export function sheetThicknessFromName(name: string) {
  const match = name.match(/(?:^|[^\d.,])(\d{1,2}(?:[.,]\d)?)\s*мм/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return value >= 2 && value <= 60 ? value : null;
}
