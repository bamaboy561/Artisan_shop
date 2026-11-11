"use client";

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Copy, Drill, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { parseCutListText, type ImportedDetail } from "./cut-list-import";
import {
  NUMBER_COLUMNS,
  edgesFromKey,
  isNumberGrid,
  nextColumn,
  parsePastedGrid,
  sanitizeNumberInput,
  type NumberColumn,
  type TableColumn,
} from "./cut-table-input";

type EdgeSide = "top" | "right" | "bottom" | "left";
type OrientationMode = "free" | "fixed" | "rotated";

export type CutDetailTableRow = {
  id: string;
  title: string;
  width: string;
  height: string;
  quantity: string;
  edgedSides: EdgeSide[];
  orientationMode: OrientationMode;
};

type CutDetailTableProps = {
  rows: CutDetailTableRow[];
  colors: Record<string, string>;
  lineTotals: Record<string, string>;
  edgeLabels: Record<string, string>;
  orientationOptions: Array<{ value: OrientationMode; label: string }>;
  edgingAvailable: boolean;
  onChange: (id: string, patch: Partial<CutDetailTableRow>) => void;
  onToggleEdge: (id: string, side: EdgeSide) => void;
  onSetEdges: (id: string, sides: EdgeSide[]) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  /** Новая деталь после указанной; возвращает её id. */
  onAddRowAfter: (id: string) => string;
  /** Столбцы чисел из Excel: с этой детали вниз, с этой колонки вправо. */
  onFillGrid: (id: string, column: NumberColumn, grid: string[][]) => void;
  /** Строки деталей из буфера (с названиями, кромкой). */
  onInsertDetails: (id: string, details: ImportedDetail[]) => void;
  // Присадка детали: подпись «12 отв.» и открытие чертежа.
  drillingLabels?: Record<string, string>;
  onDrilling?: (id: string) => void;
};

const ALL_SIDES: EdgeSide[] = ["top", "right", "bottom", "left"];
const sideTitles: Record<EdgeSide, string> = {
  top: "верхняя длинная сторона",
  bottom: "нижняя длинная сторона",
  left: "левая короткая сторона",
  right: "правая короткая сторона",
};

// Таблица в одну строку, когда ей хватает места (а не только на очень
// широком экране): @container на обёртке, @min-[780px] на строках.
const wideGrid =
  "@min-[780px]:grid-cols-[24px_minmax(90px,1fr)_76px_76px_52px_64px_112px_80px_auto]";

const fieldClass =
  "h-10 w-full min-w-0 rounded-lg border border-[color:var(--line)] bg-[var(--surface-strong)] px-2.5 text-[14px] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 @min-[780px]:h-9 @min-[780px]:px-2";

function cellSelector(rowId: string, column: TableColumn) {
  return `[data-row="${CSS.escape(rowId)}"][data-col="${column}"]`;
}

function EdgePicker({
  row,
  index,
  disabled,
  onToggle,
  onSetAll,
  onKeyDown,
}: {
  row: CutDetailTableRow;
  index: number;
  disabled: boolean;
  onToggle: (side: EdgeSide) => void;
  onSetAll: (sides: EdgeSide[]) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const allActive = ALL_SIDES.every((side) => row.edgedSides.includes(side));

  return (
    <div className="flex items-center gap-2">
      <div
        role="group"
        tabIndex={disabled ? -1 : 0}
        data-row={row.id}
        data-col="edge"
        aria-label={`Кромка детали ${index + 1}. Клавиши: К — кругом, Д — длинные, Ш — короткие, 0 — без кромки`}
        title="Нажмите на сторону. С клавиатуры: К — кругом, Д — длинные, Ш — короткие, 0 — без кромки"
        onKeyDown={onKeyDown}
        className={cn(
          "relative h-14 w-24 shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 sm:h-10 sm:w-16",
          disabled && "pointer-events-none opacity-40",
        )}
      >
        {/* Середина рисунка: кругом / убрать одним нажатием. */}
        <button
          type="button"
          tabIndex={-1}
          aria-label={allActive ? "Убрать кромку" : "Кромка кругом"}
          title={allActive ? "Убрать кромку" : "Кромка кругом"}
          onClick={() => onSetAll(allActive ? [] : [...ALL_SIDES])}
          className="absolute inset-4 flex items-center justify-center rounded-[3px] bg-[var(--surface)] text-[11px] text-[var(--muted)] hover:bg-[#e9e1d5] sm:inset-[7px]"
        >
          <span className="sm:hidden">{allActive ? "убрать" : "кругом"}</span>
        </button>
        {ALL_SIDES.map((side) => {
          const active = row.edgedSides.includes(side);
          const horizontal = side === "top" || side === "bottom";

          return (
            <button
              key={side}
              type="button"
              tabIndex={-1}
              aria-pressed={active}
              aria-label={`Кромка: ${sideTitles[side]}`}
              title={sideTitles[side]}
              onClick={() => onToggle(side)}
              className={cn(
                "absolute flex items-center justify-center",
                horizontal
                  ? "inset-x-4 h-4 sm:inset-x-[7px] sm:h-[9px]"
                  : "inset-y-4 w-4 sm:inset-y-[7px] sm:w-[9px]",
                side === "top" && "top-0",
                side === "bottom" && "bottom-0",
                side === "left" && "left-0",
                side === "right" && "right-0",
              )}
            >
              <span
                className={cn(
                  "block rounded-full transition",
                  horizontal ? "h-[4px] w-full" : "h-full w-[4px]",
                  active
                    ? "bg-[var(--accent)]"
                    : "bg-[#d9cfc1] hover:bg-[#bfae99]",
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CutDetailTable({
  rows,
  colors,
  lineTotals,
  edgeLabels,
  orientationOptions,
  edgingAvailable,
  onChange,
  onToggleEdge,
  onSetEdges,
  onDuplicate,
  onRemove,
  onAddRowAfter,
  onFillGrid,
  onInsertDetails,
  drillingLabels = {},
  onDrilling,
}: CutDetailTableProps) {
  const listRef = useRef<HTMLOListElement>(null);
  // Куда поставить курсор, когда новая строка появится на экране.
  const pendingFocus = useRef<{ rowId: string; column: TableColumn } | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const focusCell = (rowId: string, column: TableColumn) => {
    const element = listRef.current?.querySelector<HTMLElement>(
      cellSelector(rowId, column),
    );

    if (!element || element.getAttribute("tabindex") === "-1") return false;
    element.focus();
    if (element instanceof HTMLInputElement) element.select();
    return true;
  };

  useEffect(() => {
    const target = pendingFocus.current;
    if (target && focusCell(target.rowId, target.column)) {
      pendingFocus.current = null;
    }
  }, [rows]);

  const goNext = (rowIndex: number, column: TableColumn) => {
    const row = rows[rowIndex];
    let next = nextColumn(column);

    // Кромка недоступна (материал без кромки) — сразу к следующей детали.
    if (next === "edge" && !edgingAvailable) next = null;
    if (next) {
      focusCell(row.id, next);
      return;
    }

    const below = rows[rowIndex + 1];
    if (below) {
      focusCell(below.id, "width");
      return;
    }

    // Новую деталь создаём, только когда эта заполнена.
    if (!(Number(row.width) > 0 && Number(row.height) > 0)) {
      focusCell(row.id, Number(row.width) > 0 ? "height" : "width");
      return;
    }

    pendingFocus.current = { rowId: onAddRowAfter(row.id), column: "width" };
  };

  const handleCellKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    rowIndex: number,
    column: TableColumn,
  ) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    if (event.key === "Enter") {
      event.preventDefault();
      goNext(rowIndex, column);
      return;
    }

    // Стрелки вверх/вниз — как в Excel: та же колонка соседней детали.
    // В числовом поле браузер иначе менял бы само число.
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const neighbour = rows[rowIndex + (event.key === "ArrowDown" ? 1 : -1)];
      if (neighbour) {
        event.preventDefault();
        focusCell(neighbour.id, column);
      }
    }
  };

  const handleEdgeKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    rowIndex: number,
  ) => {
    const row = rows[rowIndex];
    if (!event.altKey && !event.ctrlKey && !event.metaKey) {
      const sides = edgesFromKey(event.code, row.edgedSides);
      if (sides) {
        event.preventDefault();
        onSetEdges(row.id, sides);
        return;
      }
    }
    handleCellKeyDown(event, rowIndex, "edge");
  };

  const handlePaste = (event: ClipboardEvent<HTMLOListElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-row][data-col]",
    );
    if (!target) return;

    const rowId = target.dataset.row ?? "";
    const column = target.dataset.col as TableColumn;
    const text = event.clipboardData.getData("text/plain");
    const grid = parsePastedGrid(text);

    // Одно значение вставляет само поле.
    if (!grid) return;

    event.preventDefault();

    if (
      (NUMBER_COLUMNS as readonly string[]).includes(column) &&
      isNumberGrid(grid, column as NumberColumn)
    ) {
      onFillGrid(rowId, column as NumberColumn, grid);
      setNotice(
        grid.length > 1
          ? `Вставили ${grid.length} строк из буфера.`
          : "Вставили значения из буфера.",
      );
      return;
    }

    const result = parseCutListText(text);

    if (result.details.length === 0) {
      setNotice(
        "Не поняли вставленный текст. Нужны колонки: название, длина, ширина, количество, кромка.",
      );
      return;
    }

    onInsertDetails(rowId, result.details);
    setNotice(
      `Вставили деталей: ${result.details.length}.` +
        (result.skippedLines > 0
          ? ` Пропущено строк без размеров: ${result.skippedLines}.`
          : ""),
    );
  };

  const numberInput = (
    row: CutDetailTableRow,
    rowIndex: number,
    column: NumberColumn,
    label: string,
    placeholder: string,
  ) => (
    <input
      aria-label={label}
      data-row={row.id}
      data-col={column}
      className={fieldClass}
      value={row[column]}
      onChange={(event) =>
        onChange(row.id, { [column]: sanitizeNumberInput(event.target.value) })
      }
      onKeyDown={(event) => handleCellKeyDown(event, rowIndex, column)}
      onFocus={(event) => event.currentTarget.select()}
      // Текстовое поле: колесо мыши не меняет размер при прокрутке.
      type="text"
      inputMode="decimal"
      enterKeyHint="next"
      autoComplete="off"
      placeholder={placeholder}
    />
  );

  return (
    <div className="@container mt-4 sm:mt-5">
      <div className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[var(--surface-strong)] shadow-[0_1px_0_rgba(21,20,17,0.04)]">
        <div
          className={cn(
            "hidden gap-2 border-b border-[color:var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--muted)] @min-[780px]:grid",
            wideGrid,
          )}
        >
          <span>№</span>
          <span>Название</span>
          <span>Длина</span>
          <span>Ширина</span>
          <span>Шт.</span>
          <span>Кромка</span>
          <span>Текстура</span>
          <span className="text-right">Цена</span>
          <span className="w-[100px]" />
        </div>

        <ol ref={listRef} onPaste={handlePaste}>
          {rows.map((row, index) => (
            <li
              key={row.id}
              className={cn(
                "grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2.5 border-b border-[color:var(--line)] px-3 py-3 last:border-b-0 focus-within:bg-[#fbf8f3] @min-[780px]:gap-y-0 @min-[780px]:py-1.5",
                wideGrid,
              )}
            >
              <span
                className="flex size-6 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{ backgroundColor: colors[row.id] }}
              >
                {index + 1}
              </span>

              <input
                aria-label={`Название детали ${index + 1}`}
                data-row={row.id}
                data-col="title"
                className={fieldClass}
                value={row.title}
                onChange={(event) =>
                  onChange(row.id, { title: event.target.value })
                }
                onKeyDown={(event) => handleCellKeyDown(event, index, "title")}
                enterKeyHint="next"
                autoComplete="off"
                placeholder="Деталь"
              />

              {/* Размеры и кромка идут в DOM раньше кнопок, чтобы Tab и
                  Enter шли по ним подряд; на телефоне кнопки остаются в
                  первой строке за счёт order. */}
              <div className="order-1 col-span-3 grid grid-cols-3 gap-2 @min-[780px]:order-none @min-[780px]:contents">
                <label className="grid gap-1 text-[10px] tracking-[0.08em] text-[var(--muted)] uppercase @min-[780px]:block">
                  <span className="@min-[780px]:hidden">Длина</span>
                  {numberInput(
                    row,
                    index,
                    "width",
                    `Длина детали ${index + 1}, мм`,
                    "720",
                  )}
                </label>
                <label className="grid gap-1 text-[10px] tracking-[0.08em] text-[var(--muted)] uppercase @min-[780px]:block">
                  <span className="@min-[780px]:hidden">Ширина</span>
                  {numberInput(
                    row,
                    index,
                    "height",
                    `Ширина детали ${index + 1}, мм`,
                    "560",
                  )}
                </label>
                <label className="grid gap-1 text-[10px] tracking-[0.08em] text-[var(--muted)] uppercase @min-[780px]:block">
                  <span className="@min-[780px]:hidden">Шт.</span>
                  {numberInput(
                    row,
                    index,
                    "quantity",
                    `Количество деталей ${index + 1}`,
                    "1",
                  )}
                </label>
              </div>

              <div className="order-1 col-span-3 flex items-center justify-between gap-x-3 @min-[780px]:order-none @min-[780px]:contents">
                <div title={edgeLabels[row.id]}>
                  <EdgePicker
                    row={row}
                    index={index}
                    disabled={!edgingAvailable}
                    onToggle={(side) => onToggleEdge(row.id, side)}
                    onSetAll={(sides) => onSetEdges(row.id, sides)}
                    onKeyDown={(event) => handleEdgeKeyDown(event, index)}
                  />
                </div>
                <select
                  aria-label={`Текстура детали ${index + 1}`}
                  className={cn(
                    fieldClass,
                    "w-auto min-w-0 flex-1 @min-[780px]:w-full @min-[780px]:min-w-0 @min-[780px]:flex-none @min-[780px]:text-[13px]",
                  )}
                  value={row.orientationMode}
                  onChange={(event) =>
                    onChange(row.id, {
                      orientationMode: event.target.value as OrientationMode,
                    })
                  }
                >
                  {orientationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="ml-auto text-right text-[14px] font-semibold whitespace-nowrap text-[var(--foreground)] @min-[780px]:ml-0 @min-[780px]:text-[13px]">
                  {lineTotals[row.id]}
                </span>
              </div>

              <div className="flex items-center justify-end gap-0.5 @min-[780px]:w-[100px]">
                {onDrilling ? (
                  <button
                    type="button"
                    onClick={() => onDrilling(row.id)}
                    disabled={
                      !(Number(row.width) > 0 && Number(row.height) > 0)
                    }
                    aria-label={`Присадка детали ${index + 1}`}
                    title={
                      drillingLabels[row.id]
                        ? `Присадка: ${drillingLabels[row.id]}`
                        : "Присадка: фурнитура на чертеже детали"
                    }
                    className={cn(
                      "flex h-9 items-center justify-center gap-1 rounded-lg px-2 text-[12px] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-30",
                      drillingLabels[row.id]
                        ? "font-semibold text-[var(--accent)]"
                        : "text-[var(--muted)]",
                    )}
                  >
                    <Drill className="size-4" />
                    {/* В строке таблицы подпись не помещается: только значок. */}
                    <span className="@min-[780px]:sr-only">
                      {drillingLabels[row.id] || "Присадка"}
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onDuplicate(row.id)}
                  aria-label="Дублировать деталь"
                  title="Дублировать"
                  className="flex size-9 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                >
                  <Copy className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(row.id)}
                  disabled={rows.length === 1}
                  aria-label="Удалить деталь"
                  title="Удалить"
                  className="flex size-9 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--accent)] disabled:opacity-30"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {notice ? (
        <p
          role="status"
          className="mt-2 text-[12px] leading-5 text-[var(--foreground)]"
        >
          {notice}
        </p>
      ) : null}
      <p className="mt-2 hidden text-[12px] leading-5 text-[var(--muted)] sm:block">
        Быстрый ввод: Enter — следующее поле, на последнем поле Enter добавляет
        деталь. Стрелки ↑ ↓ — соседняя деталь. На кромке: К — кругом, Д —
        длинные, Ш — короткие, 0 — без кромки. Строки из Excel можно вставить
        сюда через Ctrl+V.
      </p>
    </div>
  );
}
