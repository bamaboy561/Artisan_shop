"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Search, Trash2, Truck, Store } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  formatMaterialNumber,
  isLdspSheet,
  MAX_MATERIAL_LINES,
  type MaterialLine,
  type MaterialLineKind,
  type MaterialLineSource,
  type MaterialSearchItem,
} from "@/features/cutting/material-lines";
import { cn } from "@/lib/utils";

type EditorRow = {
  key: string;
  kind: MaterialLineKind;
  source: MaterialLineSource;
  productId: string | null;
  name: string;
  sku: string | null;
  thicknessMm: string;
  widthMm: string;
  format: string;
  quantity: string;
  note: string;
  stockQuantity: number | null;
  brand: string | null;
};

let rowCounter = 0;
function nextKey() {
  rowCounter += 1;
  return `row-${Date.now()}-${rowCounter}`;
}

function numberText(value: number | null | undefined) {
  return value === null || value === undefined
    ? ""
    : String(value).replace(".", ",");
}

function emptyRow(kind: MaterialLineKind): EditorRow {
  return {
    key: nextKey(),
    kind,
    source: "STOCK",
    productId: null,
    name: "",
    sku: null,
    thicknessMm: "",
    widthMm: "",
    format: "",
    quantity: "",
    note: "",
    stockQuantity: null,
    brand: null,
  };
}

function rowFromLine(line: MaterialLine): EditorRow {
  return {
    key: nextKey(),
    kind: line.kind,
    source: line.source,
    productId: line.productId,
    name: line.name,
    sku: line.sku,
    thicknessMm: numberText(line.thicknessMm),
    widthMm: numberText(line.widthMm),
    format: line.format ?? "",
    quantity: numberText(line.quantity),
    note: line.note ?? "",
    stockQuantity: null,
    brand: null,
  };
}

function parseNumber(value: string) {
  const number = Number(value.replace(",", ".").replace(/\s+/g, ""));
  return value.trim() && Number.isFinite(number) ? number : null;
}

function serialize(rows: EditorRow[]) {
  return JSON.stringify(
    rows.map((row) => ({
      kind: row.kind,
      source: row.source,
      productId: row.source === "STOCK" ? row.productId : null,
      name: row.name,
      sku: row.sku,
      thicknessMm: row.thicknessMm,
      widthMm: row.widthMm,
      format: row.format,
      quantity: row.quantity,
      note: row.note,
    })),
  );
}

async function searchMaterials(
  kind: MaterialLineKind,
  query: string,
  signal: AbortSignal,
) {
  const response = await fetch(
    `/api/admin/materials?kind=${kind === "EDGE" ? "edge" : "sheet"}&q=${encodeURIComponent(query)}`,
    { headers: { Accept: "application/json" }, signal },
  );
  if (!response.ok) throw new Error("search failed");
  return (await response.json()) as {
    products: MaterialSearchItem[];
    other: boolean;
  };
}

function productSize(product: MaterialSearchItem, kind: MaterialLineKind) {
  if (kind === "EDGE") {
    const t = product.edgeThicknessMm;
    const w = product.edgeWidthMm;
    if (t !== null && w !== null)
      return `${formatMaterialNumber(t)}×${formatMaterialNumber(w)} мм`;
    if (t !== null) return `${formatMaterialNumber(t)} мм`;
    return null;
  }
  return (
    [
      product.thicknessMm !== null ? `${product.thicknessMm} мм` : null,
      product.format,
    ]
      .filter(Boolean)
      .join(", ") || null
  );
}

function StockPicker({
  kind,
  onPick,
}: {
  kind: MaterialLineKind;
  onPick: (product: MaterialSearchItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MaterialSearchItem[]>([]);
  const [other, setOther] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await searchMaterials(
          kind,
          query.trim(),
          controller.signal,
        );
        setResults(payload.products);
        setOther(payload.other);
      } catch (searchError) {
        if (
          searchError instanceof DOMException &&
          searchError.name === "AbortError"
        )
          return;
        setError("Не удалось загрузить товары магазина.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [kind, open, query]);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <span className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
        <Input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (results[0]) {
                onPick(results[0]);
                setOpen(false);
              }
            }
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder={
            kind === "EDGE"
              ? "Кромка: декор, код, 0,8 22…"
              : "Лист: название, декор, код, 16 мм…"
          }
          className="pl-9 sm:pl-10"
          aria-label={
            kind === "EDGE"
              ? "Найти кромку в магазине"
              : "Найти лист в магазине"
          }
        />
        {loading ? (
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-[var(--muted)]">
            Поиск…
          </span>
        ) : null}
      </span>
      {open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto border border-[color:var(--line-strong)] bg-white shadow-lg">
          {error ? (
            <p className="px-3 py-3 text-sm text-[#b42318]">{error}</p>
          ) : null}
          {other && results.length ? (
            <p className="border-b border-[color:var(--line)] bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Среди {kind === "EDGE" ? "кромки" : "листов"} не нашли — показаны
              другие товары магазина.
            </p>
          ) : null}
          {results.map((product) => {
            const size = productSize(product, kind);
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => {
                  onPick(product);
                  setOpen(false);
                  setQuery("");
                }}
                className="grid w-full gap-0.5 border-b border-[color:var(--line)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--surface)]"
              >
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  {product.name}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {[
                    product.sku,
                    size,
                    product.brand,
                    product.stockQuantity !== null
                      ? `остаток ${product.stockQuantity}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            );
          })}
          {!loading && !error && results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-[var(--muted)]">
              {query.trim()
                ? "В магазине не нашли. Если материал клиента — нажмите «Привозной»."
                : "Начните вводить название или код."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MaterialRow({
  row,
  index,
  onChange,
  onRemove,
}: {
  row: EditorRow;
  index: number;
  onChange: (patch: Partial<EditorRow>) => void;
  onRemove: () => void;
}) {
  const isEdge = row.kind === "EDGE";
  const picked = row.source === "STOCK" && row.productId;

  return (
    <div
      className={cn(
        "grid gap-3 border p-3",
        row.source === "CLIENT"
          ? "border-amber-300 bg-amber-50/50"
          : "border-[color:var(--line)] bg-white",
      )}
      data-material-row={row.kind}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-[var(--muted)]">
            {isEdge ? "К" : "Л"}
            {index + 1}
          </span>
          <div className="grid grid-cols-2 border border-[color:var(--line)] bg-[var(--surface)] p-0.5">
            {(["STOCK", "CLIENT"] as const).map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => onChange({ source })}
                aria-pressed={row.source === source}
                className={cn(
                  "flex h-8 items-center gap-1.5 px-2.5 text-xs font-semibold transition",
                  row.source === source
                    ? source === "CLIENT"
                      ? "bg-amber-500 text-white"
                      : "bg-[var(--foreground)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {source === "STOCK" ? (
                  <Store className="size-3.5" />
                ) : (
                  <Truck className="size-3.5" />
                )}
                {source === "STOCK" ? "Из магазина" : "Привозной"}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-8 items-center gap-1.5 px-2 text-xs text-[var(--muted)] transition hover:bg-rose-50 hover:text-rose-700"
          aria-label={isEdge ? "Убрать кромку" : "Убрать лист"}
        >
          <Trash2 className="size-3.5" />
          Убрать
        </button>
      </div>

      <div className="grid gap-3 @min-[860px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] @min-[860px]:items-end">
        {row.source === "STOCK" ? (
          picked ? (
            <div className="flex items-start justify-between gap-3 border border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                  <Check className="size-4 shrink-0" />
                  <span className="break-words">{row.name}</span>
                </p>
                <p className="mt-0.5 text-xs text-emerald-900/75">
                  {[
                    row.sku,
                    row.brand,
                    row.stockQuantity !== null
                      ? `остаток ${row.stockQuantity}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    productId: null,
                    name: "",
                    sku: null,
                    stockQuantity: null,
                    brand: null,
                  })
                }
                className="shrink-0 px-2 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
              >
                Сменить
              </button>
            </div>
          ) : (
            <StockPicker
              kind={row.kind}
              onPick={(product) =>
                onChange({
                  productId: product.id,
                  name: product.name,
                  sku: product.sku,
                  brand: product.brand,
                  stockQuantity: product.stockQuantity,
                  thicknessMm: numberText(
                    isEdge ? product.edgeThicknessMm : product.thicknessMm,
                  ),
                  widthMm: isEdge ? numberText(product.edgeWidthMm) : "",
                  format: isEdge ? "" : (product.format ?? ""),
                })
              }
            />
          )
        ) : (
          <label className="grid gap-1 text-xs font-medium">
            {isEdge
              ? "Какая кромка (цвет, код)"
              : "Какой лист (название, декор)"}
            <Input
              value={row.name}
              maxLength={200}
              onChange={(event) => onChange({ name: event.target.value })}
              placeholder={
                isEdge
                  ? "Например: белая 101, ABS"
                  : "Например: ЛДСП Egger Кашемир U702"
              }
            />
          </label>
        )}

        <div
          className={cn(
            "grid gap-2",
            isEdge ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-[1fr_1.4fr_1fr]",
          )}
        >
          <label className="grid gap-1 text-xs font-medium">
            Толщина, мм
            <Input
              value={row.thicknessMm}
              inputMode="decimal"
              onChange={(event) =>
                onChange({ thicknessMm: event.target.value })
              }
              placeholder={isEdge ? "0,8" : "16"}
              className="h-9 sm:h-9"
            />
          </label>
          {isEdge ? (
            <label className="grid gap-1 text-xs font-medium">
              Ширина, мм
              <Input
                value={row.widthMm}
                inputMode="decimal"
                onChange={(event) => onChange({ widthMm: event.target.value })}
                placeholder="22"
                className="h-9 sm:h-9"
              />
            </label>
          ) : (
            <label className="grid gap-1 text-xs font-medium">
              Формат листа
              <Input
                value={row.format}
                maxLength={40}
                onChange={(event) => onChange({ format: event.target.value })}
                placeholder="2800×2070"
                className="h-9 sm:h-9"
              />
            </label>
          )}
          <label
            className={cn(
              "grid gap-1 text-xs font-medium",
              !isEdge && "col-span-2 sm:col-span-1",
            )}
          >
            {isEdge ? "Метров" : "Листов"}
            <Input
              value={row.quantity}
              inputMode={isEdge ? "decimal" : "numeric"}
              onChange={(event) => onChange({ quantity: event.target.value })}
              placeholder={isEdge ? "48,5" : "4"}
              className="h-9 sm:h-9"
            />
          </label>
        </div>
      </div>
      {!isEdge &&
      (row.name || row.thicknessMm) &&
      !isLdspSheet(row.name, parseNumber(row.thicknessMm)) ? (
        <p className="text-xs text-amber-800">
          Не ЛДСП: в «Листов ЛДСП» не входит. Цену распила укажите в «Другие
          работы».
        </p>
      ) : null}
      <Input
        value={row.note}
        maxLength={200}
        onChange={(event) => onChange({ note: event.target.value })}
        placeholder={
          isEdge
            ? "Примечание: на фасады, по длинным сторонам…"
            : "Примечание: корпус, фасады, задняя стенка…"
        }
        className="h-9 text-xs sm:h-9"
        aria-label="Примечание"
      />
    </div>
  );
}

export function MaterialLinesEditor({
  initialLines,
  legacyMaterial,
  legacyEdge,
  initialSheetCount,
  initialEdgeMeters,
}: {
  initialLines?: MaterialLine[];
  // Старый заказ без строк: показываем, что было записано текстом.
  legacyMaterial?: string | null;
  legacyEdge?: string | null;
  initialSheetCount?: number | null;
  initialEdgeMeters?: number | null;
}) {
  const [rows, setRows] = useState<EditorRow[]>(() => {
    const fromLines = (initialLines ?? []).map(rowFromLine);
    if (fromLines.length || legacyMaterial || legacyEdge) return fromLines;
    return [emptyRow("SHEET"), emptyRow("EDGE")];
  });
  // Итог, посчитанный из строк, не становится «ручным»: если строки этого
  // вида убрать, старый метраж не должен остаться в заказе и в счёте.
  const derivedFromLines = (kind: MaterialLineKind) =>
    (initialLines ?? []).some(
      (line) => line.kind === kind && line.quantity !== null,
    );
  const [manualSheets, setManualSheets] = useState(() =>
    derivedFromLines("SHEET") ? "" : numberText(initialSheetCount),
  );
  const [manualEdge, setManualEdge] = useState(() =>
    derivedFromLines("EDGE") ? "" : numberText(initialEdgeMeters),
  );

  const sheetRows = rows.filter((row) => row.kind === "SHEET");
  const edgeRows = rows.filter((row) => row.kind === "EDGE");

  const totals = useMemo(() => {
    const sheetValues = sheetRows
      .filter((row) => isLdspSheet(row.name, parseNumber(row.thicknessMm)))
      .map((row) => parseNumber(row.quantity))
      .filter((value): value is number => value !== null);
    const edgeValues = edgeRows
      .map((row) => parseNumber(row.quantity))
      .filter((value): value is number => value !== null);
    return {
      sheets: sheetValues.length
        ? sheetValues.reduce((sum, value) => sum + Math.round(value), 0)
        : null,
      edge: edgeValues.length
        ? Math.round(edgeValues.reduce((sum, value) => sum + value, 0) * 100) /
          100
        : null,
    };
  }, [sheetRows, edgeRows]);

  function update(key: string, patch: Partial<EditorRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function remove(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function add(kind: MaterialLineKind) {
    setRows((current) =>
      current.length >= MAX_MATERIAL_LINES
        ? current
        : [...current, emptyRow(kind)],
    );
  }

  // Страница передаёт текст только того вида, у которого ещё нет строк.
  const showLegacy = Boolean(legacyMaterial || legacyEdge);

  return (
    <div className="@container grid gap-5">
      <input type="hidden" name="materialLines" value={serialize(rows)} />
      <input type="hidden" name="materialLinesForm" value="1" />

      {showLegacy ? (
        <div className="border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2 text-sm">
          <p className="text-xs text-[var(--muted)]">
            Сейчас записано текстом:
          </p>
          {legacyMaterial ? <p className="mt-1">{legacyMaterial}</p> : null}
          {legacyEdge ? <p className="mt-1">Кромка: {legacyEdge}</p> : null}
          <p className="mt-1 text-xs text-[var(--muted)]">
            Добавьте строки ниже — тогда эта запись заменится списком. Если
            строк не добавлять, запись останется как есть.
          </p>
        </div>
      ) : null}

      {(
        [
          ["SHEET", sheetRows, "Листы", "Добавить лист"],
          ["EDGE", edgeRows, "Кромка", "Добавить кромку"],
        ] as const
      ).map(([kind, list, title, addLabel]) => (
        <div key={kind} className="grid gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {title}
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                {list.length
                  ? `${list.length} поз.`
                  : kind === "EDGE"
                    ? "без кромки"
                    : "не добавлены"}
              </span>
            </p>
          </div>
          {list.map((row, index) => (
            <MaterialRow
              key={row.key}
              row={row}
              index={index}
              onChange={(patch) => update(row.key, patch)}
              onRemove={() => remove(row.key)}
            />
          ))}
          <button
            type="button"
            onClick={() => add(kind)}
            disabled={rows.length >= MAX_MATERIAL_LINES}
            className="flex h-10 items-center justify-center gap-2 border border-dashed border-[color:var(--line-strong)] text-sm font-semibold text-[var(--foreground)] transition hover:border-[color:var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-40"
          >
            <Plus className="size-4" />
            {addLabel}
          </button>
        </div>
      ))}

      <div className="grid gap-3 border-t border-[color:var(--line)] pt-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          Листов ЛДСП всего
          <Input
            name="cuttingSheetCount"
            type="number"
            min={1}
            max={10000}
            step={1}
            inputMode="numeric"
            value={
              totals.sheets !== null ? String(totals.sheets) : manualSheets
            }
            readOnly={totals.sheets !== null}
            onChange={(event) => setManualSheets(event.target.value)}
            placeholder="Например: 12"
            className={cn(totals.sheets !== null && "bg-[var(--surface)]")}
          />
          <span className="text-xs font-normal text-[var(--muted)]">
            {totals.sheets !== null
              ? "Считается из строк ЛДСП. ХДФ, HPL и столешницу укажите в «Другие работы»."
              : "Можно заполнить позже."}
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Кромка всего, пог. м
          <Input
            name="cuttingEdgeMeters"
            type="number"
            min={0}
            max={100000}
            step={0.1}
            inputMode="decimal"
            value={
              totals.edge !== null
                ? String(totals.edge)
                : manualEdge.replace(",", ".")
            }
            readOnly={totals.edge !== null}
            onChange={(event) => setManualEdge(event.target.value)}
            placeholder="Например: 48,5"
            className={cn(totals.edge !== null && "bg-[var(--surface)]")}
          />
          <span className="text-xs font-normal text-[var(--muted)]">
            {totals.edge !== null
              ? "Считается из строк."
              : "Общий метраж кромки по заказу."}
          </span>
        </label>
      </div>
    </div>
  );
}
