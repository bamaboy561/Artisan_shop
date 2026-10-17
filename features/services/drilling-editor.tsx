"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { useSiteCuttingPrices } from "@/features/cutting/site-prices-context";
import { formatPrice } from "@/lib/commerce";
import { priceDrilling } from "@/lib/drilling-price";
import { cn } from "@/lib/utils";
import {
  FIELD_LABELS,
  HARDWARE,
  HARDWARE_KINDS,
  SIDE_LABELS,
  createHardware,
  hardwareHoles,
  holesToDrillCounts,
  type HardwareItem,
  type HardwareKind,
  type PartHole,
  type PartSide,
} from "./drilling-hardware";
import {
  BEVEL_ANGLES,
  CORNERS,
  CORNER_LABELS,
  cornerRadius,
  emptyMilling,
  hasMilling,
  millingMeters,
  type PartMilling,
} from "./part-milling";
import { formatSitePrice } from "@/features/cutting/site-prices";

const SIDES: PartSide[] = ["top", "right", "bottom", "left"];

const inputClass =
  "h-9 w-full min-w-0 rounded-lg border border-[color:var(--line)] bg-white px-2 text-[14px] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15";

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);

  // Значение поменяли снаружи — показываем его, свой ввод не трогаем.
  if (shown !== value) {
    setShown(value);
    if (Number(text) !== value) setText(String(value));
  }

  return (
    <label className="grid gap-1 text-[11px] text-[var(--muted)]">
      {label}
      <input
        className={inputClass}
        value={text}
        inputMode="decimal"
        onChange={(event) => {
          const next = event.target.value.replace(",", ".");
          setText(next);
          const parsed = Number(next);
          if (next.trim() !== "" && Number.isFinite(parsed) && parsed >= 0) {
            onChange(parsed);
          }
        }}
      />
    </label>
  );
}

// Контур детали в координатах SVG (y вниз) со скруглёнными углами.
function outlinePath(length: number, width: number, milling?: PartMilling) {
  const r = (corner: (typeof CORNERS)[number]) =>
    cornerRadius(milling, corner, length, width);
  const tl = r("topLeft");
  const tr = r("topRight");
  const br = r("bottomRight");
  const bl = r("bottomLeft");
  return [
    `M ${tl} 0`,
    `H ${length - tr}`,
    tr ? `A ${tr} ${tr} 0 0 1 ${length} ${tr}` : "",
    `V ${width - br}`,
    br ? `A ${br} ${br} 0 0 1 ${length - br} ${width}` : "",
    `H ${bl}`,
    bl ? `A ${bl} ${bl} 0 0 1 0 ${width - bl}` : "",
    `V ${tl}`,
    tl ? `A ${tl} ${tl} 0 0 1 ${tl} 0` : "",
    "Z",
  ]
    .filter(Boolean)
    .join(" ");
}

// Чертёж детали: вид на лицевую пласть. Щелчок по краю выбирает сторону,
// к которой добавится фурнитура.
function PartDrawing({
  length,
  width,
  holes,
  highlighted,
  side,
  onSide,
  milling,
}: {
  length: number;
  width: number;
  holes: PartHole[];
  highlighted: Set<PartHole>;
  side: PartSide;
  onSide: (side: PartSide) => void;
  milling?: PartMilling;
}) {
  const pad = Math.max(length, width) * 0.08;
  const view = `${-pad} ${-pad} ${length + pad * 2} ${width + pad * 2}`;
  const stroke = Math.max(length, width) / 300;
  const hit = Math.max(length, width) / 25;
  // y в детали идёт вверх, в SVG — вниз.
  const flip = (y: number) => width - y;
  const edgeLine: Record<PartSide, [number, number, number, number]> = {
    top: [0, 0, length, 0],
    bottom: [0, width, length, width],
    left: [0, 0, 0, width],
    right: [length, 0, length, width],
  };

  return (
    <svg
      viewBox={view}
      className="h-auto max-h-[46vh] w-full touch-manipulation"
      role="img"
      aria-label={`Деталь ${length} × ${width} мм`}
    >
      <path
        d={outlinePath(length, width, milling)}
        fill="#f3ece1"
        stroke="#b9a991"
        strokeWidth={stroke}
      />
      {SIDES.filter((item) => (milling?.bevels[item] ?? 0) > 0).map((item) => {
        const band = Math.max(length, width) / 60;
        const [x1, y1, x2, y2] = edgeLine[item];
        const horizontal = item === "top" || item === "bottom";
        const inward = item === "top" || item === "left" ? band : -band;
        return (
          <g key={`bevel-${item}`}>
            <polygon
              points={
                horizontal
                  ? `${x1},${y1} ${x2},${y2} ${x2},${y2 + inward} ${x1},${y1 + inward}`
                  : `${x1},${y1} ${x2},${y2} ${x2 + inward},${y2} ${x1 + inward},${y1}`
              }
              fill="rgba(37,43,41,0.18)"
            />
            <text
              x={horizontal ? (x1 + x2) / 2 : x1 + inward * 2.6}
              y={horizontal ? y1 + inward * 2.6 : (y1 + y2) / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={band * 1.6}
              fill="#252b29"
            >
              {`скос ${String(milling?.bevels[item]).replace(".", ",")}°`}
            </text>
          </g>
        );
      })}
      {SIDES.map((item) => {
        const [x1, y1, x2, y2] = edgeLine[item];
        const active = item === side;
        return (
          <g key={item}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={active ? "var(--accent)" : "#b9a991"}
              strokeWidth={active ? stroke * 4 : stroke}
              strokeLinecap="round"
            />
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="transparent"
              strokeWidth={hit}
              className="cursor-pointer"
              onClick={() => onSide(item)}
            >
              <title>{`Выбрать ${SIDE_LABELS[item]}`}</title>
            </line>
          </g>
        );
      })}
      {holes.map((hole, index) => {
        const strong = highlighted.has(hole);
        const color = strong ? "var(--accent)" : "#252b29";
        if (hole.kind === "face") {
          return (
            <circle
              key={index}
              cx={hole.x}
              cy={flip(hole.y)}
              r={Math.max(hole.diameter / 2, stroke * 2)}
              fill={strong ? "rgba(196,83,43,0.18)" : "rgba(37,43,41,0.08)"}
              stroke={color}
              strokeWidth={stroke}
            />
          );
        }
        // Отверстие в торец: канал внутрь детали на глубину.
        const horizontal = hole.side === "top" || hole.side === "bottom";
        const half = hole.diameter / 2;
        const rect = horizontal
          ? {
              x: hole.position - half,
              y: hole.side === "top" ? 0 : width - hole.depth,
              w: hole.diameter,
              h: hole.depth,
            }
          : {
              x: hole.side === "left" ? 0 : length - hole.depth,
              y: flip(hole.position) - half,
              w: hole.depth,
              h: hole.diameter,
            };
        return (
          <rect
            key={index}
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${stroke * 3} ${stroke * 2}`}
          />
        );
      })}
      <text
        x={length / 2}
        y={-pad * 0.35}
        textAnchor="middle"
        fontSize={pad * 0.45}
        fill="#69716d"
      >
        {length} мм
      </text>
      <text
        x={-pad * 0.35}
        y={width / 2}
        textAnchor="middle"
        fontSize={pad * 0.45}
        fill="#69716d"
        transform={`rotate(-90 ${-pad * 0.35} ${width / 2})`}
      >
        {width} мм
      </text>
    </svg>
  );
}

export function DrillingEditor({
  title,
  length,
  width,
  thickness,
  quantity,
  value,
  onChange,
  milling,
  onMillingChange,
  onClose,
}: {
  title: string;
  length: number;
  width: number;
  thickness: number;
  quantity: number;
  value: HardwareItem[];
  onChange: (items: HardwareItem[]) => void;
  milling?: PartMilling;
  onMillingChange: (milling: PartMilling | undefined) => void;
  onClose: () => void;
}) {
  const prices = useSiteCuttingPrices();
  const [side, setSide] = useState<PartSide>("left");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const byItem = useMemo(
    () =>
      new Map(
        value.map((item) => [
          item.id,
          hardwareHoles([item], length, width, thickness),
        ]),
      ),
    [length, thickness, value, width],
  );
  const holes = useMemo(() => [...byItem.values()].flat(), [byItem]);
  const highlighted = useMemo(
    () => new Set(selected ? (byItem.get(selected) ?? []) : []),
    [byItem, selected],
  );
  const millingCost = useMemo(() => {
    const meters = millingMeters(length, width, milling);
    return (
      (meters.curve * prices.milling + meters.bevel * prices.bevel) * quantity
    );
  }, [length, milling, prices.bevel, prices.milling, quantity, width]);
  const price = useMemo(
    () =>
      priceDrilling(
        [{ drill: holesToDrillCounts(holes), quantity }],
        prices.drilling,
      ),
    [holes, prices.drilling, quantity],
  );

  const update = (id: string, patch: Partial<HardwareItem>) =>
    onChange(
      value.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const add = (kind: HardwareKind) => {
    const item = createHardware(kind, side);
    onChange([...value, item]);
    setSelected(item.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(21,20,17,0.45)] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Присадка: ${title}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-[var(--foreground)]">
              Присадка: {title || "деталь"}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {length} × {width} × {thickness} мм · {quantity} шт. Вид на
              лицевую сторону. Нажмите на край детали, чтобы выбрать сторону.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[#f3ece1]"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-x-hidden overflow-y-auto p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="grid min-w-0 content-start gap-3">
            <PartDrawing
              length={length}
              width={width}
              holes={holes}
              highlighted={highlighted}
              side={side}
              onSide={setSide}
              milling={milling}
            />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[var(--muted)]">Сторона:</span>
              {SIDES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSide(item)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[13px]",
                    item === side
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[color:var(--line)] hover:border-[var(--foreground)]",
                  )}
                >
                  {SIDE_LABELS[item]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {HARDWARE_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => add(kind)}
                  title={HARDWARE[kind].hint}
                  className="flex min-h-10 items-center gap-1.5 rounded-lg border border-[color:var(--line)] px-2.5 py-1.5 text-left text-[13px] leading-tight hover:border-[var(--accent)]"
                >
                  <Plus className="size-3.5 shrink-0 text-[var(--accent)]" />
                  {HARDWARE[kind].label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid min-w-0 content-start gap-3">
            <details
              open={hasMilling(milling)}
              className="rounded-xl border border-[color:var(--line)] p-3"
            >
              <summary className="cursor-pointer text-sm font-semibold">
                Фрезеровка: скругления углов и скосы торцов
              </summary>
              <div className="mt-3 grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  {CORNERS.map((corner) => (
                    <NumberField
                      key={corner}
                      label={`${CORNER_LABELS[corner]} угол, радиус мм`}
                      value={milling?.corners[corner] ?? 0}
                      onChange={(next) => {
                        const base = milling ?? emptyMilling();
                        const updated = {
                          ...base,
                          corners: { ...base.corners, [corner]: next },
                        };
                        onMillingChange(
                          hasMilling(updated) ? updated : undefined,
                        );
                      }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SIDES.map((item) => (
                    <label
                      key={item}
                      className="grid gap-1 text-[11px] text-[var(--muted)]"
                    >
                      Скос: {SIDE_LABELS[item]}
                      <select
                        className={inputClass}
                        value={milling?.bevels[item] ?? 0}
                        onChange={(event) => {
                          const base = milling ?? emptyMilling();
                          const updated = {
                            ...base,
                            bevels: {
                              ...base.bevels,
                              [item]: Number(event.target.value),
                            },
                          };
                          onMillingChange(
                            hasMilling(updated) ? updated : undefined,
                          );
                        }}
                      >
                        {BEVEL_ANGLES.map((angle) => (
                          <option key={angle} value={angle}>
                            {angle === 0
                              ? "без скоса"
                              : `${String(angle).replace(".", ",")}°`}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <p className="text-[12px] leading-5 text-[var(--muted)]">
                  Скругление уходит в файл GibLab фрезеровкой контура, скос — в
                  заявку и в название детали.{" "}
                  {millingCost > 0
                    ? `На ${quantity} шт.: ${formatPrice(Math.round(millingCost))} по прайсу за метр (скругления ${formatSitePrice(prices.milling)} сом/м, скосы ${formatSitePrice(prices.bevel)} сом/м).`
                    : `Цена за метр: скругления ${formatSitePrice(prices.milling)} сом, скосы ${formatSitePrice(prices.bevel)} сом.`}
                </p>
              </div>
            </details>
            {value.length === 0 ? (
              <p className="rounded-xl bg-[#faf7f2] p-4 text-sm leading-6 text-[var(--muted)]">
                Выберите сторону детали и добавьте фурнитуру кнопками слева.
                Отступы, диаметры и глубину можно поменять — у каждого цеха
                свои.
              </p>
            ) : null}
            {value.map((item) => {
              const definition = HARDWARE[item.kind];
              const count = byItem.get(item.id)?.length ?? 0;
              return (
                <div
                  key={item.id}
                  onFocus={() => setSelected(item.id)}
                  onMouseEnter={() => setSelected(item.id)}
                  className={cn(
                    "grid gap-2 rounded-xl border p-3",
                    selected === item.id
                      ? "border-[var(--accent)]"
                      : "border-[color:var(--line)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {definition.label}
                      <span className="ml-2 font-normal text-[var(--muted)]">
                        {count} отв.
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        onChange(value.filter((other) => other.id !== item.id))
                      }
                      aria-label="Убрать фурнитуру"
                      className="flex size-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[#fbe9e2] hover:text-[#b4492a]"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <label className="grid gap-1 text-[11px] text-[var(--muted)]">
                      Сторона
                      <select
                        className={inputClass}
                        value={item.side}
                        onChange={(event) =>
                          update(item.id, {
                            side: event.target.value as PartSide,
                          })
                        }
                      >
                        {SIDES.map((option) => (
                          <option key={option} value={option}>
                            {SIDE_LABELS[option]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {definition.fields.map((field) => (
                      <NumberField
                        key={field}
                        label={FIELD_LABELS[field]}
                        value={item[field]}
                        onChange={(next) => update(item.id, { [field]: next })}
                      />
                    ))}
                    {item.holes.map((hole, index) => (
                      <div
                        key={index}
                        className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-3 sm:grid-cols-[minmax(0,1fr)_90px_90px] sm:items-end"
                      >
                        <span className="col-span-2 text-[12px] font-medium sm:col-span-1 sm:pb-2">
                          {definition.holeLabels[index]}
                        </span>
                        <NumberField
                          label="Ø, мм"
                          value={hole.diameter}
                          onChange={(next) =>
                            update(item.id, {
                              holes: item.holes.map((spec, specIndex) =>
                                specIndex === index
                                  ? { ...spec, diameter: next }
                                  : spec,
                              ),
                            })
                          }
                        />
                        <NumberField
                          label="Глубина, мм"
                          value={hole.depth}
                          onChange={(next) =>
                            update(item.id, {
                              holes: item.holes.map((spec, specIndex) =>
                                specIndex === index
                                  ? { ...spec, depth: next }
                                  : spec,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.mirror}
                        onChange={(event) =>
                          update(item.id, { mirror: event.target.checked })
                        }
                      />
                      Зеркально у противоположного края
                    </label>
                    {item.kind === "hole" ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.edge}
                          onChange={(event) =>
                            update(item.id, { edge: event.target.checked })
                          }
                        />
                        В торец
                      </label>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] px-4 py-3">
          <p className="text-sm text-[var(--foreground)]">
            {price.holes > 0 ? (
              <>
                {price.holes} отв. на {quantity} шт. —{" "}
                <span className="font-semibold">{formatPrice(price.cost)}</span>
                {price.unpricedHoles > 0
                  ? ` (ещё ${price.unpricedHoles} отв. без цены, посчитает менеджер)`
                  : ""}
                . Глубина 0 — сквозное.
              </>
            ) : (
              "Отверстий пока нет. Глубина 0 — сквозное отверстие."
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-full bg-[var(--foreground)] px-5 text-sm font-semibold text-white"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
