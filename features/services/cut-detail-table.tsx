"use client";

import { Copy, Drill, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

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

const fieldClass =
  "h-10 w-full min-w-0 rounded-lg border border-[color:var(--line)] bg-[var(--surface-strong)] px-2.5 text-[14px] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15";

function EdgePicker({
  row,
  disabled,
  onToggle,
  onSetAll,
}: {
  row: CutDetailTableRow;
  disabled: boolean;
  onToggle: (side: EdgeSide) => void;
  onSetAll: (sides: EdgeSide[]) => void;
}) {
  const allActive = ALL_SIDES.every((side) => row.edgedSides.includes(side));

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "relative h-16 w-28 shrink-0 sm:h-10 sm:w-16",
          disabled && "pointer-events-none opacity-40",
        )}
      >
        <span className="absolute inset-4 rounded-[3px] bg-[var(--surface)] sm:inset-[7px]" />
        {ALL_SIDES.map((side) => {
          const active = row.edgedSides.includes(side);
          const horizontal = side === "top" || side === "bottom";

          return (
            <button
              key={side}
              type="button"
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
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSetAll(allActive ? [] : [...ALL_SIDES])}
        className="px-2 py-2.5 text-[13px] whitespace-nowrap text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline disabled:opacity-40 sm:p-0 sm:text-[11px]"
      >
        {allActive ? "Убрать" : "Кругом"}
      </button>
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
  drillingLabels = {},
  onDrilling,
}: CutDetailTableProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[var(--surface-strong)] shadow-[0_1px_0_rgba(21,20,17,0.04)] sm:mt-5">
      <div className="hidden grid-cols-[28px_minmax(0,1.4fr)_92px_92px_64px_128px_minmax(0,1fr)_96px_112px] gap-2 border-b border-[color:var(--line)] bg-[var(--surface)] px-3 py-2.5 text-xs font-semibold text-[var(--muted)] 2xl:grid">
        <span>№</span>
        <span>Название</span>
        <span>Длина, мм</span>
        <span>Ширина, мм</span>
        <span>Шт.</span>
        <span>Кромка</span>
        <span>Текстура</span>
        <span className="text-right">Цена</span>
        <span />
      </div>

      <ol>
        {rows.map((row, index) => (
          <li
            key={row.id}
            className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2.5 border-b border-[color:var(--line)] px-3 py-3 last:border-b-0 2xl:grid-cols-[28px_minmax(0,1.4fr)_92px_92px_64px_128px_minmax(0,1fr)_96px_112px] 2xl:gap-y-0 2xl:py-2"
          >
            <span
              className="flex size-6 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ backgroundColor: colors[row.id] }}
            >
              {index + 1}
            </span>

            <input
              aria-label={`Название детали ${index + 1}`}
              className={fieldClass}
              value={row.title}
              onChange={(event) =>
                onChange(row.id, { title: event.target.value })
              }
              placeholder="Деталь"
            />

            <div className="flex items-center justify-end gap-1 2xl:order-last">
              {onDrilling ? (
                <button
                  type="button"
                  onClick={() => onDrilling(row.id)}
                  disabled={!(Number(row.width) > 0 && Number(row.height) > 0)}
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
                  {/* В широкой таблице подпись не помещается: только значок. */}
                  <span className="2xl:sr-only">
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

            <div className="col-span-3 grid grid-cols-3 gap-2 2xl:contents">
              <label className="grid gap-1 text-[10px] tracking-[0.08em] text-[var(--muted)] uppercase 2xl:block">
                <span className="2xl:hidden">Длина</span>
                <input
                  aria-label={`Длина детали ${index + 1}, мм`}
                  className={fieldClass}
                  value={row.width}
                  onChange={(event) =>
                    onChange(row.id, { width: event.target.value })
                  }
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="720"
                />
              </label>
              <label className="grid gap-1 text-[10px] tracking-[0.08em] text-[var(--muted)] uppercase 2xl:block">
                <span className="2xl:hidden">Ширина</span>
                <input
                  aria-label={`Ширина детали ${index + 1}, мм`}
                  className={fieldClass}
                  value={row.height}
                  onChange={(event) =>
                    onChange(row.id, { height: event.target.value })
                  }
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="560"
                />
              </label>
              <label className="grid gap-1 text-[10px] tracking-[0.08em] text-[var(--muted)] uppercase 2xl:block">
                <span className="2xl:hidden">Шт.</span>
                <input
                  aria-label={`Количество деталей ${index + 1}`}
                  className={fieldClass}
                  value={row.quantity}
                  onChange={(event) =>
                    onChange(row.id, { quantity: event.target.value })
                  }
                  type="number"
                  min="1"
                  inputMode="numeric"
                  placeholder="1"
                />
              </label>
            </div>

            <div className="col-span-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 2xl:contents">
              <div title={edgeLabels[row.id]}>
                <EdgePicker
                  row={row}
                  disabled={!edgingAvailable}
                  onToggle={(side) => onToggleEdge(row.id, side)}
                  onSetAll={(sides) => onSetEdges(row.id, sides)}
                />
              </div>
              <select
                aria-label={`Текстура детали ${index + 1}`}
                className={cn(fieldClass, "w-auto min-w-[9rem] 2xl:w-full")}
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
              <span className="ml-auto text-right text-[14px] font-semibold whitespace-nowrap text-[var(--foreground)] 2xl:ml-0">
                {lineTotals[row.id]}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
