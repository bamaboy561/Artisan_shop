import { InventoryStatus } from "@/generated/prisma";
import type { ProductImportRow } from "@/features/admin/product-import";

export type StockImportMode = "all" | "stock" | "price";
export type StockValues = {
  price: number | null;
  compareAtPrice: number | null;
  stockQuantity: number | null;
  inventoryStatus: InventoryStatus;
};
export type StockProduct = StockValues & {
  id: string;
  sku: string;
  name: string;
  updatedAt: Date;
};
export type StockImportStatus =
  | "ready"
  | "unchanged"
  | "skipped"
  | "updated"
  | "conflict"
  | "error";
export type StockImportEntry = {
  sheet: string;
  row: number;
  sku: string;
  name: string;
  status: StockImportStatus;
  reason: string;
  before: StockValues | null;
  changes: Partial<StockValues>;
};
export type StockMatch = "sku" | "name" | "similar" | "linked";
export type StockImportPlanEntry = StockImportEntry & {
  productId: string | null;
  updatedAt: string | null;
  match?: StockMatch | null;
  // Подходит несколько товаров сайта: строку нужно проверить, а не добавлять.
  ambiguous?: boolean;
  // Товары, между которыми не удалось выбрать: они не считаются «нет в файле».
  candidateIds?: string[];
  // Сумма остатков нескольких позиций 1С, которые ведут на один товар сайта.
  fileQuantity?: number;
  // Похожие товары сайта для строки без совпадения: из них выбирают «Это он».
  suggestions?: StockProductOption[];
};
export type StockProductOption = { id: string; sku: string; name: string };
export type StockImportResult = {
  phase: "preview" | "done" | "error";
  message: string;
  fingerprint?: string;
  fileName?: string;
  counts?: Record<StockImportStatus, number>;
  entries?: StockImportEntry[];
  total?: number;
  warnings?: string[];
  columns?: Array<{ source: string; target: string }>;
  reportCsv?: string;
  reconciliation?: StockReconciliationEntry[];
  pendingCount?: number;
};

export type StockReconciliationEntry = {
  key: string;
  sku: string;
  name: string;
  siteQuantity: number | null;
  fileQuantity: number | null;
  unit: string;
  difference: number | null;
  kind: "difference" | "unchanged" | "notFound" | "missing" | "review";
  match: StockMatch | null;
  status: StockImportStatus;
  reason: string;
  selectable: boolean;
  // Ключ, по которому запоминается связь строки 1С с товаром сайта.
  linkKey?: string;
  suggestions?: StockProductOption[];
  // Товар сайта, к которому строка уже сопоставлена.
  productId?: string | null;
};

export function stockRowKey(entry: { sheet: string; row: number }) {
  return JSON.stringify([entry.sheet, entry.row]);
}

export function buildStockReconciliation(
  rows: ProductImportRow[],
  products: StockProduct[],
  plan: StockImportPlanEntry[],
): StockReconciliationEntry[] {
  const referencedSkus = new Set(
    rows.filter((row) => row.sku).map((row) => skuKey(row.sku)),
  );
  const referencedNames = new Set(
    rows.filter((row) => !row.sku).map((row) => nameKey(row.name)),
  );
  const referencedIds = new Set(
    plan.flatMap((entry) => [entry.productId, ...(entry.candidateIds ?? [])]),
  );
  const catalogSkus = new Set(products.map((product) => skuKey(product.sku)));
  const catalogNames = new Set(
    products.map((product) => nameKey(product.name)),
  );
  const entries: StockReconciliationEntry[] = plan.map((entry, index) => {
    const row = rows[index];
    const siteQuantity = entry.before?.stockQuantity ?? null;
    const fileQuantity = entry.fileQuantity ?? row.stockQuantity;
    const difference =
      siteQuantity !== null && fileQuantity !== null
        ? fileQuantity - siteQuantity
        : null;
    return {
      key: stockRowKey(entry),
      sku: entry.sku,
      name: entry.name,
      siteQuantity,
      fileQuantity,
      difference,
      unit: row.stockUnit ?? "",
      kind:
        entry.status === "skipped" ||
        entry.status === "error" ||
        entry.status === "conflict"
          ? !entry.productId &&
            !entry.ambiguous &&
            !(row.sku
              ? catalogSkus.has(skuKey(row.sku))
              : catalogNames.has(nameKey(row.name)))
            ? "notFound"
            : "review"
          : entry.status === "unchanged"
            ? "unchanged"
            : "difference",
      match: entry.productId
        ? (entry.match ?? (row.sku ? "sku" : "name"))
        : null,
      status: entry.status,
      reason: entry.reason,
      selectable: entry.status === "ready",
      linkKey: row.name.trim() ? stockLinkKey(row) : undefined,
      suggestions: entry.suggestions,
      productId: entry.productId,
    };
  });
  for (const product of products) {
    // An ambiguous match still references every candidate; absence is not proof of zero stock.
    if (
      referencedIds.has(product.id) ||
      referencedSkus.has(skuKey(product.sku)) ||
      referencedNames.has(nameKey(product.name))
    )
      continue;
    entries.push({
      key: `missing:${product.id}`,
      sku: product.sku,
      name: product.name,
      siteQuantity: product.stockQuantity,
      fileQuantity: null,
      difference: null,
      unit: "",
      kind: "missing",
      match: null,
      status: "skipped",
      selectable: false,
      reason: "Нет в загруженном файле. Остаток сайта не изменяется.",
    });
  }
  return entries;
}

export function stockReconciliationCsv(entries: StockReconciliationEntry[]) {
  const escape = (value: unknown) => {
    let text = value == null ? "" : String(value);
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const labels = {
    difference: "Расхождение",
    unchanged: "Совпадает",
    notFound: "Нет на сайте",
    missing: "Нет в файле",
    review: "Нужна проверка",
  };
  return (
    "\uFEFF" +
    [
      [
        "Артикул",
        "Товар",
        "На сайте до обновления",
        "В файле",
        "Разница",
        "Ед. изм.",
        "Сверка",
        "Результат",
        "Примечание",
      ],
      ...entries.map((entry) => [
        entry.sku,
        entry.name,
        entry.siteQuantity,
        entry.fileQuantity,
        entry.difference,
        entry.unit,
        labels[entry.kind],
        stockImportStatusLabels[entry.status],
        entry.reason,
      ]),
    ]
      .map((row) => row.map(escape).join(";"))
      .join("\r\n")
  );
}

export const stockImportStatusLabels: Record<StockImportStatus, string> = {
  ready: "Будет обновлён",
  unchanged: "Без изменений",
  skipped: "Пропущен",
  updated: "Обновлён",
  conflict: "Изменён другим пользователем",
  error: "Ошибка обновления",
};
export const inventoryStatusLabels: Record<InventoryStatus, string> = {
  IN_STOCK: "В наличии",
  LIMITED: "Ограничен",
  OUT_OF_STOCK: "Нет в наличии",
  ON_REQUEST: "Под запрос",
};

function skuKey(value: string) {
  // Preserve punctuation and leading zeroes: distinct SKUs must not be merged.
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/\s+/g, "")
    .replace(/[–—−]/g, "-");
}
function nameKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/\s+/g, " ");
}
function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    if (!value) continue;
    const group = groups.get(value);
    if (group) group.push(item);
    else groups.set(value, [item]);
  }
  return groups;
}

// Латиница и кириллица в 1С и на сайте смешиваются в одинаковых по виду
// буквах («ABS» и «АВS»), поэтому для сравнения названий приводим их к одной.
const homoglyphs: Record<string, string> = {
  а: "a",
  в: "b",
  с: "c",
  е: "e",
  н: "h",
  к: "k",
  м: "m",
  о: "o",
  р: "p",
  т: "t",
  х: "x",
  у: "y",
};
function looseSkuKey(value: string) {
  return skuKey(value)
    .replace(/[а-я]/g, (char) => homoglyphs[char] ?? char)
    .replace(/[^0-9a-zа-я]/g, "")
    .replace(/(^|\D)0+(?=\d)/g, "$1");
}
function foldLetters(value: string) {
  return nameKey(value).replace(/[а-я]/g, (char) => homoglyphs[char] ?? char);
}
// Слово-код: артикул или код 1С внутри названия («WQ9WE71406-02», «160001112»).
// Его можно убрать из названия на сайте, остальное название должно совпасть.
function isNameCode(word: string) {
  const plain = word.replace(/[^0-9a-zа-я]/g, "");
  // Число с разделителями — размер или диапазон («564-764»), не артикул.
  if (/^\d{6,}$/.test(word)) return true;
  // Размер вида «M8x100» или «1*22» тоже не код.
  if (/\d[x×*]\d/.test(word)) return false;
  // Коды пишутся латиницей: слово с русскими буквами («печенье1*22мм») не код.
  return (
    plain.length >= 6 &&
    /\d/.test(plain) &&
    /[a-z]/.test(plain) &&
    !/[а-я]/.test(plain) &&
    !/^\d+([*x×.,/]\d+)*(mm|m|cm|мм|см|м)?$/.test(word)
  );
}
// Короткий код поставщика: «S-1032-», «WQ1234».
function isShortCode(word: string) {
  return (
    !/[а-я]/.test(word) &&
    /^[a-z]{1,4}\d{4,}[a-z]?$/.test(word.replace(/[^0-9a-z]/g, ""))
  );
}
function nameTokens(value: string) {
  return foldLetters(value)
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/(\d)(?=[a-zа-я])|([a-zа-я])(?=\d)/g, "$1$2 ")
    .split(/[^0-9a-zа-я.]+/)
    .map((token) => token.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
}
// Название без кодов, разбитое на слова и числа: регистр, пробелы, знаки
// и похожие буквы не важны.
function coreTokens(value: string) {
  const words = foldLetters(value)
    .split(/[\s/\\(),;"«»]+/)
    .filter(Boolean);
  // Коды поставщика стоят в начале или в конце названия. В середине такое слово чаще
  // размер или исполнение («AKS:192MM», «M.101.S01»), его не выбрасываем;
  // там убираем только числовой артикул.
  let start = 0;
  let end = words.length;
  while (
    start < end - 1 &&
    (isNameCode(words[start]) || isShortCode(words[start]))
  )
    start += 1;
  // В конце убираем только явный код поставщика («WQ63853M», «6051606S»):
  // «AKS:320MM» или «M.101.S01» в конце — это исполнение товара.
  if (
    end > start + 1 &&
    /^([a-z]{1,4}\d{4,}[a-z]?|\d{6,}[a-z]?)$/.test(words[end - 1])
  )
    end -= 1;
  return words
    .slice(start, end)
    .filter((word) => !/^\d{6,}$/.test(word))
    .flatMap(nameTokens);
}
// Одна опечатка в длинном слове допустима: «Галифакс» и «Галифах».
function oneEditApart(left: string, right: string) {
  if (left.length < 6 || right.length < 6) return false;
  if (/\d/.test(left) || /\d/.test(right)) return false;
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) i += 1;
    else if (right.length > left.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (left.length - i) + (right.length - j) <= 1;
}
// Порядок слов важен: «под панель L / над R» и «под панель R / над L» разные.
function sameCore(left: string[], right: string[]) {
  if (left.length !== right.length || left.length < 2) return false;
  return left.every(
    (token, index) =>
      token === right[index] || oneEditApart(token, right[index]),
  );
}
export function stockNamesSimilar(left: string, right: string) {
  return sameCore(coreTokens(left), coreTokens(right));
}

// Сопоставление строки отчёта с товаром сайта, от строгого к мягкому:
// артикул, артикул без знаков и ведущих нулей, артикул в названии,
// точное название и, наконец, то же название без кодов и с одной опечаткой.
export function createStockMatcher<
  P extends { id: string; sku: string; name: string },
>(products: P[], links: ReadonlyMap<string, string> = new Map()) {
  const byId = new Map(products.map((product) => [product.id, product]));
  const bySku = groupBy(products, (product) => skuKey(product.sku));
  const byLooseSku = groupBy(products, (product) => looseSkuKey(product.sku));
  const byName = groupBy(products, (product) => nameKey(product.name));
  const cores = new Map<string, string[]>();
  const byCoreToken = new Map<string, P[]>();
  const byNameToken = new Map<string, P[]>();
  const add = (map: Map<string, P[]>, key: string, product: P) => {
    const list = map.get(key);
    if (list) {
      if (list[list.length - 1] !== product) list.push(product);
    } else map.set(key, [product]);
  };
  for (const product of products) {
    const core = coreTokens(product.name);
    cores.set(product.id, core);
    for (const token of core) add(byCoreToken, token, product);
    for (const word of foldLetters(product.name).split(/[\s/\\(),;"«»]+/))
      if (word) add(byNameToken, looseSkuKey(word), product);
  }
  const similar = (name: string, candidates: Iterable<P>) => {
    const core = coreTokens(name);
    return [...new Set(candidates)].filter((candidate) =>
      sameCore(core, cores.get(candidate.id)!),
    );
  };

  return {
    find(row: { sku: string; name: string }): {
      product: P | null;
      matches: P[];
      via: StockMatch | null;
    } {
      // Позицию 1С уже связали с товаром вручную в списке «Нет на сайте».
      // Связь привязана к артикулу вместе с названием: другая позиция 1С
      // с тем же артикулом её не наследует.
      const linked = byId.get(links.get(stockLinkKey(row)) ?? "");
      if (linked) return { product: linked, matches: [linked], via: "linked" };
      if (row.sku) {
        const exact = bySku.get(skuKey(row.sku)) ?? [];
        if (exact.length === 1)
          return { product: exact[0], matches: exact, via: "sku" };
        if (exact.length > 1) {
          // Один артикул у нескольких товаров: выбираем по названию.
          let named = exact.filter(
            (product) => nameKey(product.name) === nameKey(row.name),
          );
          if (!named.length) named = similar(row.name, exact);
          return named.length === 1
            ? { product: named[0], matches: exact, via: "sku" }
            : { product: null, matches: exact, via: null };
        }
        const loose = looseSkuKey(row.sku);
        const looseMatches = loose.length >= 3 ? byLooseSku.get(loose) : null;
        if (looseMatches?.length === 1)
          return {
            product: looseMatches[0],
            matches: looseMatches,
            via: "sku",
          };
        // Артикул из 1С записан на сайте в названии товара.
        if (loose.length >= 5) {
          // «Шуруп для 48080140YA» упоминает чужой артикул: нужно хотя бы
          // одно общее слово в названиях.
          const rowCore = new Set(
            coreTokens(row.name).filter((token) =>
              /^[a-zа-я]{4,}$/.test(token),
            ),
          );
          const inName = (byNameToken.get(loose) ?? []).filter((product) =>
            cores.get(product.id)!.some((token) => rowCore.has(token)),
          );
          if (inName.length === 1)
            return { product: inName[0], matches: inName, via: "sku" };
        }
      }
      // Артикул записан в названии строки («WQ63853M Меренга 1*22мм»),
      // а на сайте он стоит в поле «Артикул».
      const words = foldLetters(row.name)
        .split(/[\s/\\(),;"«»]+/)
        .filter(Boolean);
      const rowCore = new Set(
        coreTokens(row.name).filter((token) => /^[a-zа-я]{4,}$/.test(token)),
      );
      const shareWord = (product: P) =>
        cores.get(product.id)!.some((token) => rowCore.has(token));
      const bySkuInName = new Set<P>();
      words.forEach((word, index) => {
        // Размеры («1*22мм», «2000x22») артикулом не считаем.
        if (!isNameCode(word) && !isShortCode(word)) return;
        const hits =
          bySku.get(skuKey(word)) ?? byLooseSku.get(looseSkuKey(word));
        // Код в начале названия — это артикул самой позиции; в середине
        // («шуруп для 48080140YA») может быть чужой, тогда нужно общее слово.
        for (const product of hits ?? [])
          if (index === 0 || shareWord(product)) bySkuInName.add(product);
      });
      if (bySkuInName.size) {
        let hits = [...bySkuInName];
        if (hits.length > 1) {
          const narrowed = hits.filter(
            (product) => nameKey(product.name) === nameKey(row.name),
          );
          hits = narrowed.length ? narrowed : similar(row.name, hits);
        }
        if (hits.length === 1)
          return { product: hits[0], matches: hits, via: "sku" };
        // Несколько товаров с похожими артикулами: решает человек.
        return { product: null, matches: [...bySkuInName], via: null };
      }
      const named = byName.get(nameKey(row.name)) ?? [];
      if (named.length === 1)
        return { product: named[0], matches: named, via: "name" };
      if (named.length > 1) return { product: null, matches: named, via: null };

      const core = coreTokens(row.name);
      const rare = [...core]
        .filter((token) => token.length >= 3)
        .sort(
          (a, b) =>
            (byCoreToken.get(a)?.length ?? 0) -
            (byCoreToken.get(b)?.length ?? 0),
        )[0];
      const pool = rare
        ? (byCoreToken.get(rare) ?? [])
        : core.length
          ? (byCoreToken.get(core[0]) ?? [])
          : [];
      let found = similar(row.name, pool);
      // Опечатка могла попасть в самое редкое слово: проверяем всех.
      if (!found.length && rare) found = similar(row.name, products);
      if (found.length === 1)
        return { product: found[0], matches: found, via: "similar" };
      return { product: null, matches: found, via: null };
    },
    // Ближайшие товары сайта для позиции, которую не удалось сопоставить:
    // человек выбирает нужный, и связь запоминается.
    suggest(row: { sku: string; name: string }, limit = 3): P[] {
      // Редкое слово («кашемир») весит больше частого («кромка», «22»).
      const weight = (token: string) =>
        1 / Math.log(2 + (byCoreToken.get(token)?.length ?? 0));
      const total = (tokens: Iterable<string>) =>
        [...new Set(tokens)].reduce((sum, token) => sum + weight(token), 0);
      const core = new Set(coreTokens(row.name));
      const rowWeight = total(core);
      const codes = [row.sku, ...foldLetters(row.name).split(/\s+/)]
        .map(looseSkuKey)
        .filter((code) => code.length >= 4 && /\d/.test(code));
      const shared = new Map<P, number>();
      for (const token of core)
        for (const product of byCoreToken.get(token) ?? [])
          shared.set(product, (shared.get(product) ?? 0) + weight(token));
      const scores = [...shared].map(
        ([product, value]) =>
          [
            product,
            (2 * value) / (rowWeight + total(cores.get(product.id)!)),
          ] as const,
      );
      for (const code of codes)
        for (const product of [
          ...(byLooseSku.get(code) ?? []),
          ...(byNameToken.get(code) ?? []),
        ])
          scores.push([product, 1]);
      const best = new Map<P, number>();
      for (const [product, score] of scores)
        best.set(product, Math.max(best.get(product) ?? 0, score));
      return [...best]
        .filter(([, score]) => score >= 0.5)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([product]) => product);
    },
  };
}

export function buildStockImportPlan(
  rows: ProductImportRow[],
  products: StockProduct[],
  mode: StockImportMode,
  links: ReadonlyMap<string, string> = new Map(),
) {
  const matcher = createStockMatcher(products, links);
  const plan: StockImportPlanEntry[] = rows.map((row) => {
    const { product, matches, via } = matcher.find(row);
    const entry: StockImportPlanEntry = {
      sheet: row.sheetName,
      row: row.rowNumber,
      sku: row.sku,
      name: row.name,
      status: "skipped",
      reason: "",
      before: null,
      changes: {},
      productId: product?.id ?? null,
      updatedAt: product?.updatedAt.toISOString() ?? null,
      match: product ? via : null,
    };
    if (!product) {
      if (matches.length) {
        entry.ambiguous = true;
        entry.candidateIds = matches.map((match) => match.id);
      }
      const nearest = matches.length ? matches : matcher.suggest(row);
      entry.suggestions = nearest
        .slice(0, 5)
        .map(({ id, sku, name }) => ({ id, sku, name }));
      entry.reason = matches.length
        ? "Несколько товаров совпадают. Выберите нужный: «Это он»."
        : nearest.length
          ? `Товар не найден. Похожий на сайте: «${nearest[0].name}» (${nearest[0].sku}). Если это он, выберите его: «Это он».`
          : "Товар не найден. Найдите его на сайте через «Это он» или добавьте карточку.";
      return entry;
    }
    const fileName = row.name.trim();
    entry.name = product.name;
    entry.sku = product.sku;
    entry.before = {
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      stockQuantity: product.stockQuantity,
      inventoryStatus: product.inventoryStatus,
    };
    const fields =
      mode === "stock" || (row.inventoryReport && mode === "all")
        ? (["stockQuantity"] as const)
        : mode === "price"
          ? (["price", "compareAtPrice"] as const)
          : (["price", "compareAtPrice", "stockQuantity"] as const);
    // Кромка и плинтус учитываются в 1С в метрах с дробной частью, а сайт
    // хранит целый остаток: дробное количество округляем вниз.
    const fractionalStock =
      row.stockQuantity !== null &&
      row.stockQuantity >= 0 &&
      row.stockQuantity <= 2147483647 &&
      !Number.isInteger(row.stockQuantity);
    const stockQuantity =
      row.stockQuantity !== null && fractionalStock
        ? Math.floor(row.stockQuantity)
        : row.stockQuantity;
    const errors = fields.flatMap((field) =>
      row.stockImportErrors[field] &&
      !(field === "stockQuantity" && fractionalStock)
        ? [row.stockImportErrors[field]]
        : [],
    );
    if (row.inventoryReport && mode === "price") {
      entry.reason =
        "Отчёт остатков не содержит цен продажи. Выберите «Только остатки».";
      return entry;
    }
    if (errors.length) {
      entry.reason = errors.join("; ");
      return entry;
    }
    const proposed: Partial<StockValues> = {};
    for (const field of fields) {
      const value = field === "stockQuantity" ? stockQuantity : row[field];
      if (value !== null) proposed[field] = value;
    }
    if (mode !== "price") {
      if (stockQuantity !== null) {
        proposed.inventoryStatus = stockStatus(stockQuantity);
      } else if (row.inventoryStatus) {
        proposed.inventoryStatus = row.inventoryStatus;
      }
    }
    if (!Object.keys(proposed).length) {
      entry.reason =
        "Нет данных для выбранного режима. Пустые ячейки не меняют товар.";
      return entry;
    }
    entry.changes = Object.fromEntries(
      Object.entries(proposed).filter(
        ([key, value]) => product[key as keyof StockValues] !== value,
      ),
    );
    entry.status = Object.keys(entry.changes).length ? "ready" : "unchanged";
    entry.reason = [
      via === "linked"
        ? `Связано вручную: «${fileName}»`
        : via === "similar"
          ? `Похожее название в файле: «${fileName}»`
          : via === "name"
            ? row.sku
              ? `Артикул ${row.sku} не найден на сайте, совпало название`
              : "Совпадение по уникальному названию (артикул в файле отсутствует)"
            : !row.sku
              ? `Артикул ${product.sku} найден в названии в файле`
              : skuKey(row.sku) !== skuKey(product.sku)
                ? `Артикул в файле: ${row.sku}`
                : "",
      fractionalStock && (fields as readonly string[]).includes("stockQuantity")
        ? `Остаток округлён вниз: ${String(row.stockQuantity).replace(".", ",")} → ${stockQuantity}`
        : "",
    ]
      .filter(Boolean)
      .join(". ");
    return entry;
  });
  // Never silently choose the last warehouse/sheet row for the same product.
  const byProduct = groupBy(
    plan.filter((entry) => entry.productId),
    (entry) => entry.productId!,
  );
  const productById = new Map(products.map((product) => [product.id, product]));
  for (const entries of byProduct.values()) {
    if (entries.length < 2) continue;
    const groupRows = entries.map((entry) => rows[plan.indexOf(entry)]);
    // Один цвет кромки от разных поставщиков (PGR, WQ) — разные позиции 1С,
    // а на сайте одна карточка: её остаток равен сумме этих позиций.
    const distinctItems =
      new Set(groupRows.map((row) => `${skuKey(row.sku)}|${nameKey(row.name)}`))
        .size === entries.length;
    const stockOnly = groupRows.every(
      (row) => mode === "stock" || (mode === "all" && row.inventoryReport),
    );
    if (
      distinctItems &&
      stockOnly &&
      entries.every(
        (entry) => entry.status === "ready" || entry.status === "unchanged",
      ) &&
      groupRows.every(
        (row) => row.stockQuantity !== null && row.stockQuantity >= 0,
      )
    ) {
      const product = productById.get(entries[0].productId!)!;
      const primary =
        entries.find((entry) => entry.match !== "similar") ?? entries[0];
      const total =
        Math.round(
          groupRows.reduce((sum, row) => sum + row.stockQuantity!, 0) * 1000,
        ) / 1000;
      const quantity = Math.floor(total);
      const proposed: Partial<StockValues> = {
        stockQuantity: quantity,
        inventoryStatus: stockStatus(quantity),
      };
      primary.changes = Object.fromEntries(
        Object.entries(proposed).filter(
          ([key, value]) => product[key as keyof StockValues] !== value,
        ),
      );
      primary.status = Object.keys(primary.changes).length
        ? "ready"
        : "unchanged";
      primary.fileQuantity = total;
      const format = (value: number) => String(value).replace(".", ",");
      primary.reason = `Остатки сложены (${entries.length} позиции файла): ${groupRows
        .map((row) => `«${row.name.trim()}» ${format(row.stockQuantity!)}`)
        .join(" + ")} = ${format(total)}${
        quantity !== total ? `, округлено до ${quantity}` : ""
      }`;
      for (const entry of entries) {
        if (entry === primary) continue;
        entry.status = "unchanged";
        entry.changes = {};
        entry.reason = `Тот же товар на сайте: остаток прибавлен к строке ${primary.row}`;
      }
      continue;
    }
    // Похожее название уступает точному совпадению с тем же товаром.
    const exact = entries.filter((entry) => entry.match !== "similar");
    if (exact.length === 1) {
      for (const entry of entries) {
        if (entry === exact[0]) continue;
        const row = rows[plan.indexOf(entry)];
        Object.assign(entry, {
          sku: row.sku,
          name: row.name,
          status: "skipped",
          reason:
            "Товар не найден. Добавьте карточку через полный импорт товаров.",
          before: null,
          changes: {},
          productId: null,
          updatedAt: null,
          match: null,
        });
      }
      continue;
    }
    for (const entry of entries) {
      entry.status = "skipped";
      entry.reason =
        "Товар повторяется в файле. Оставьте одну итоговую строку на артикул.";
      entry.changes = {};
    }
  }
  return plan;
}

function stockStatus(quantity: number) {
  return quantity <= 0
    ? InventoryStatus.OUT_OF_STOCK
    : quantity <= 5
      ? InventoryStatus.LIMITED
      : InventoryStatus.IN_STOCK;
}

export function summarizeStockImport(entries: StockImportEntry[]) {
  const counts: Record<StockImportStatus, number> = {
    ready: 0,
    unchanged: 0,
    skipped: 0,
    updated: 0,
    conflict: 0,
    error: 0,
  };
  for (const entry of entries) counts[entry.status]++;
  return counts;
}

export function stockImportReportCsv(entries: StockImportEntry[]) {
  function escape(value: unknown) {
    let text = value === null || value === undefined ? "" : String(value);
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }
  const header = [
    "Лист",
    "Строка",
    "Артикул",
    "Товар",
    "Результат",
    "Примечание",
    "Цена до",
    "Цена после",
    "Старая цена до",
    "Старая цена после",
    "Остаток до",
    "Остаток после",
    "Наличие до",
    "Наличие после",
  ];
  const rows = entries.map((entry) => {
    const after = { ...entry.before, ...entry.changes };
    return [
      entry.sheet,
      entry.row,
      entry.sku,
      entry.name,
      stockImportStatusLabels[entry.status],
      entry.reason,
      entry.before?.price,
      after.price,
      entry.before?.compareAtPrice,
      after.compareAtPrice,
      entry.before?.stockQuantity,
      after.stockQuantity,
      entry.before ? inventoryStatusLabels[entry.before.inventoryStatus] : "",
      after.inventoryStatus ? inventoryStatusLabels[after.inventoryStatus] : "",
    ];
  });
  return (
    "\uFEFF" +
    [header, ...rows].map((row) => row.map(escape).join(";")).join("\r\n")
  );
}

export type StockPendingCandidate = {
  matchKey: string;
  sku: string | null;
  name: string;
  unit: string | null;
  quantity: number | null;
  note: string | null;
};

// Один ключ на позицию: по артикулу, а без артикула по названию.
// Так повторная загрузка того же отчёта не создаёт дублей в списке.
export function stockLinkKey(item: { sku?: string | null; name: string }) {
  return `${stockPendingKey(item)}|name:${nameKey(item.name)}`;
}

export function stockPendingKey(item: { sku?: string | null; name: string }) {
  const sku = item.sku ? skuKey(item.sku) : "";
  return sku ? `sku:${sku}` : `name:${nameKey(item.name)}`;
}

export function collectStockPendingItems(
  reconciliation: StockReconciliationEntry[],
): StockPendingCandidate[] {
  const groups = groupBy(
    reconciliation.filter(
      (entry) => entry.kind === "notFound" && entry.name.trim(),
    ),
    (entry) => stockPendingKey(entry),
  );
  const items: StockPendingCandidate[] = [];
  for (const [baseKey, entries] of groups) {
    const names = groupBy(entries, (entry) => nameKey(entry.name));
    // В 1С один артикул бывает у разных позиций: каждая остаётся в списке
    // отдельно, а артикул помечается к исправлению.
    const sharedSku = names.size > 1;
    for (const [name, rows] of names) {
      const first = rows[0];
      const repeated = rows.length > 1;
      items.push({
        matchKey: sharedSku ? `${baseKey}|name:${name}` : baseKey,
        sku: first.sku.trim() || null,
        name: first.name.trim(),
        unit: first.unit.trim() || null,
        // Повтор одной позиции в файле не угадываем: количество не выбираем.
        quantity: repeated ? null : first.fileQuantity,
        note: sharedSku
          ? "Артикул повторяется в отчёте у разных позиций. Исправьте артикул в 1С перед добавлением."
          : repeated
            ? "Позиция повторяется в отчёте. Количество не определено."
            : null,
      });
    }
  }
  return items;
}

// Ключи строк отчёта, которые теперь нашлись на сайте (в том числе по
// похожему названию): такие позиции убираются из списка «Нет на сайте».
export function stockMatchedPendingKeys(
  rows: Array<{ sku: string; name: string }>,
  plan: StockImportPlanEntry[],
) {
  const keys = new Set<string>();
  plan.forEach((entry, index) => {
    const row = rows[index];
    if (!entry.productId || !row) return;
    const key = stockPendingKey(row);
    keys.add(key);
    keys.add(`${key}|name:${nameKey(row.name)}`);
  });
  return keys;
}

// Совпадения, которые стоит запомнить после применения: найденные не по
// точному артикулу, обновлённые или уже совпадающие по остатку (строки,
// снятые с обновления, не запоминаем). В следующий раз они найдутся сразу.
export function stockLinksToRemember(
  rows: Array<{ sku: string; name: string }>,
  plan: StockImportPlanEntry[],
) {
  const links = new Map<
    string,
    { matchKey: string; productId: string; sku: string | null; name: string }
  >();
  plan.forEach((entry, index) => {
    const row = rows[index];
    if (!row || !row.name.trim() || !entry.productId) return;
    if (entry.status !== "updated" && entry.status !== "unchanged") return;
    const exactSku =
      entry.match === "sku" &&
      !!row.sku &&
      skuKey(row.sku) === skuKey(entry.sku);
    if (entry.match === "linked" || exactSku) return;
    const matchKey = stockLinkKey(row);
    links.set(matchKey, {
      matchKey,
      productId: entry.productId,
      sku: row.sku.trim() || null,
      name: row.name.trim(),
    });
  });
  return [...links.values()];
}

// Ключи товаров сайта: позиция уходит из списка, когда появляется товар
// с тем же артикулом (или с тем же названием, если артикула в файле не было).
export function stockPendingCatalogKeys(
  products: Array<{ sku: string; name: string }>,
) {
  const keys = new Set<string>();
  for (const product of products) {
    keys.add(stockPendingKey(product));
    keys.add(`name:${nameKey(product.name)}`);
    keys.add(`${stockPendingKey(product)}|name:${nameKey(product.name)}`);
  }
  return keys;
}
