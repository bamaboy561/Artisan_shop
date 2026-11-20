"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy as CopyIcon,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { useSiteCuttingPrices } from "@/features/cutting/site-prices-context";
import { formatPrice } from "@/lib/commerce";
import { priceDrilling } from "@/lib/drilling-price";
import { cn } from "@/lib/utils";
import {
  FIELD_LABELS,
  HARDWARE,
  SIDE_LABELS,
  hardwareHoles,
  holesToDrillCounts,
  type HardwareField,
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
  grooveRect,
  hasMilling,
  LED_GROOVE,
  millingMeters,
  type PartGroove,
  type PartMilling,
} from "./part-milling";
import { formatSitePrice } from "@/features/cutting/site-prices";
import { HardwarePicker } from "./drilling-picker";
import {
  PART_ROLES,
  PART_ROLE_EDGES,
  PART_ROLE_HINTS,
  PART_ROLE_LABELS,
  edgeName,
  partTemplate,
  type PartRole,
} from "./drilling-templates";

const SIDES: PartSide[] = ["top", "right", "bottom", "left"];

const inputClass =
  "h-9 w-full min-w-0 rounded-lg border border-[color:var(--line)] bg-[var(--surface-strong)] px-2 text-[14px] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15";

function NumberField({
  label,
  title,
  value,
  onChange,
}: {
  label: string;
  title?: string;
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
    <label className="grid gap-1 text-[11px] text-[var(--muted)]" title={title}>
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

// Размерные линии выбранной фурнитуры: «от угла» вдоль края и «от края
// до центра» поперёк, с цифрами в плашках.
function DimLines({
  dims,
  length,
  width,
}: {
  dims: DrawingDims;
  length: number;
  width: number;
}) {
  const size = Math.max(length, width);
  const stroke = size / 300;
  const font = size / 26;
  const tick = size / 70;
  const flip = (y: number) => width - y;
  const color = "var(--accent)";
  // Точки в координатах SVG: начало края (угол), место вдоль края, центр.
  const horizontal = dims.side === "top" || dims.side === "bottom";
  const edgeAt = (along: number): [number, number] => {
    switch (dims.side) {
      case "top":
        return [along, flip(width)];
      case "bottom":
        return [along, flip(0)];
      case "left":
        return [0, flip(along)];
      case "right":
        return [length, flip(along)];
    }
  };
  const inward: [number, number] = {
    top: [0, 1],
    bottom: [0, -1],
    left: [1, 0],
    right: [-1, 0],
  }[dims.side] as [number, number];
  const [cx, cy] = edgeAt(dims.along);
  const indent = dims.indent ?? 0;
  const center: [number, number] = [
    cx + inward[0] * indent,
    cy + inward[1] * indent,
  ];
  // «От угла» рисуем чуть дальше от края, чем центр отверстия.
  const shift = Math.max(indent, 0) + size / 22;
  const [sx, sy] = edgeAt(0);
  const a: [number, number] = [sx + inward[0] * shift, sy + inward[1] * shift];
  const b: [number, number] = [cx + inward[0] * shift, cy + inward[1] * shift];
  const badge = (x: number, y: number, text: string) => {
    const w = font * (0.62 * text.length + 0.9);
    const h = font * 1.35;
    return (
      <g>
        <rect
          x={x - w / 2}
          y={y - h / 2}
          width={w}
          height={h}
          rx={h / 4}
          fill={color}
        />
        <text
          x={x}
          y={y + font * 0.36}
          textAnchor="middle"
          fontSize={font}
          fontWeight={700}
          fill="#fff"
        >
          {text}
        </text>
      </g>
    );
  };
  const tickAt = (x: number, y: number) =>
    horizontal ? (
      <line
        x1={x}
        y1={y - tick}
        x2={x}
        y2={y + tick}
        stroke={color}
        strokeWidth={stroke}
      />
    ) : (
      <line
        x1={x - tick}
        y1={y}
        x2={x + tick}
        y2={y}
        stroke={color}
        strokeWidth={stroke}
      />
    );
  const indentTick = (x: number, y: number) =>
    horizontal ? (
      <line
        x1={x - tick}
        y1={y}
        x2={x + tick}
        y2={y}
        stroke={color}
        strokeWidth={stroke}
      />
    ) : (
      <line
        x1={x}
        y1={y - tick}
        x2={x}
        y2={y + tick}
        stroke={color}
        strokeWidth={stroke}
      />
    );
  const fmt = (value: number) =>
    String(Math.round(value * 10) / 10).replace(".", ",");
  const perpOffset = font * 1.2;

  return (
    <g pointerEvents="none">
      {dims.showAlong ? (
        <g>
          <line
            x1={a[0]}
            y1={a[1]}
            x2={b[0]}
            y2={b[1]}
            stroke={color}
            strokeWidth={stroke}
          />
          {tickAt(a[0], a[1])}
          {tickAt(b[0], b[1])}
          {badge(
            (a[0] + b[0]) / 2 + (horizontal ? 0 : inward[0] * perpOffset),
            (a[1] + b[1]) / 2 + (horizontal ? inward[1] * perpOffset : 0),
            fmt(dims.along),
          )}
        </g>
      ) : null}
      {dims.indent !== null ? (
        <g>
          <line
            x1={cx}
            y1={cy}
            x2={center[0]}
            y2={center[1]}
            stroke={color}
            strokeWidth={stroke}
          />
          {indentTick(cx, cy)}
          {indentTick(center[0], center[1])}
          {badge(
            (cx + center[0]) / 2 + (horizontal ? perpOffset * 1.6 : 0),
            (cy + center[1]) / 2 + (horizontal ? 0 : -perpOffset),
            fmt(dims.indent),
          )}
        </g>
      ) : null}
    </g>
  );
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
  role,
  dims,
}: {
  length: number;
  width: number;
  holes: PartHole[];
  highlighted: Set<PartHole>;
  side: PartSide;
  onSide: (side: PartSide) => void;
  milling?: PartMilling;
  role?: PartRole;
  dims?: DrawingDims | null;
}) {
  const pad = Math.max(length, width) * 0.08;
  const view = `${-pad} ${-pad} ${length + pad * 2} ${width + pad * 2}`;
  const stroke = Math.max(length, width) / 300;
  const hit = Math.max(length, width) / 25;
  // y в детали идёт вверх, в SVG — вниз.
  const flip = (y: number) => width - y;
  const edgeLabel = (item: PartSide) =>
    role ? PART_ROLE_EDGES[role][item] : undefined;
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
      {(milling?.grooves ?? []).map((groove, index) => {
        const rect = grooveRect(groove, length, width);
        return (
          <rect
            key={`groove-${index}`}
            x={rect.x}
            y={flip(rect.y + rect.h)}
            width={rect.w}
            height={rect.h}
            fill="rgba(37,43,41,0.28)"
            stroke="#252b29"
            strokeWidth={stroke / 2}
            strokeDasharray={`${stroke * 3} ${stroke * 2}`}
          />
        );
      })}
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
              <title>{`Выбрать край: ${edgeName(item, role, SIDE_LABELS)}`}</title>
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
      {dims ? <DimLines dims={dims} length={length} width={width} /> : null}
      {/* Подписи краёв: размер, а у выбранного вида детали — и роль края
          («перед», «к дну»), чтобы было понятно, куда что сверлить. */}
      <text
        x={length / 2}
        y={-pad * 0.35}
        textAnchor="middle"
        fontSize={pad * 0.45}
        fill={edgeLabel("top") ? "var(--accent)" : "#69716d"}
        fontWeight={edgeLabel("top") ? 700 : 400}
      >
        {edgeLabel("top")
          ? `${edgeLabel("top")} · ${length} мм`
          : `${length} мм`}
      </text>
      <text
        x={-pad * 0.35}
        y={width / 2}
        textAnchor="middle"
        fontSize={pad * 0.45}
        fill={edgeLabel("left") ? "var(--accent)" : "#69716d"}
        fontWeight={edgeLabel("left") ? 700 : 400}
        transform={`rotate(-90 ${-pad * 0.35} ${width / 2})`}
      >
        {edgeLabel("left")
          ? `${edgeLabel("left")} · ${width} мм`
          : `${width} мм`}
      </text>
      {edgeLabel("bottom") ? (
        <text
          x={length / 2}
          y={width + pad * 0.7}
          textAnchor="middle"
          fontSize={pad * 0.45}
          fill="var(--accent)"
          fontWeight={700}
        >
          {edgeLabel("bottom")}
        </text>
      ) : null}
      {edgeLabel("right") ? (
        <text
          x={length + pad * 0.35}
          y={width / 2}
          textAnchor="middle"
          fontSize={pad * 0.45}
          fill="var(--accent)"
          fontWeight={700}
          transform={`rotate(90 ${length + pad * 0.35} ${width / 2})`}
        >
          {edgeLabel("right")}
        </text>
      ) : null}
    </svg>
  );
}

// Подписи полей фурнитуры обычными словами: от чего мерить, видно ещё и
// по размерам на чертеже.
function fieldLabel(field: HardwareField, item: HardwareItem) {
  switch (field) {
    case "count":
      return "Сколько";
    case "offset":
      if (item.kind === "shelfPins") return "От угла до первого";
      return Math.round(item.count) === 1 ? "От угла, 0 — центр" : "От угла";
    case "indent":
      return "От края до центра";
    case "spacing":
      return item.kind === "shelfPins" ? "Шаг" : "Между отверстиями";
  }
}

const OPPOSITE_SIDE: Record<PartSide, PartSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

// Фурнитура только в торец: расстояния «от края» у неё нет.
function hasIndent(item: HardwareItem) {
  if (item.kind === "confirmatEdge" || item.kind === "dowelEdge") return false;
  if (item.kind === "hole" && item.edge) return false;
  return true;
}

export type DrawingDims = {
  side: PartSide;
  // Первое место вдоль края, мм от угла; null — по центру, без размера.
  along: number;
  showAlong: boolean;
  indent: number | null;
};

// Размеры выбранной фурнитуры для чертежа: от угла до первого места и от
// края до центра отверстия.
function drawingDims(
  item: HardwareItem,
  length: number,
  width: number,
): DrawingDims {
  const available =
    item.side === "top" || item.side === "bottom" ? length : width;
  const count = Math.max(1, Math.round(item.count));
  const centred =
    item.kind !== "shelfPins" && count === 1 && !(item.offset > 0);
  return {
    side: item.side,
    along: centred ? available / 2 : item.offset,
    showAlong: !centred && item.offset > 0,
    indent: hasIndent(item) && item.indent > 0 ? item.indent : null,
  };
}

const SHORT_KIND_LABELS: Partial<Record<HardwareKind, string>> = {
  minifix: "Эксцентрик",
  faceRow: "Отверстия в пласть",
  confirmatEdge: "Конфирмат в торец",
  dowelEdge: "Шкант в торец",
  hingePlate: "Планка петли",
};

// Название фурнитуры в списке. Ряд в пласть по диаметру понятнее:
// Ø5 — под шток эксцентрика, Ø7 — конфирмат, Ø8 — шкант.
function itemLabel(item: HardwareItem) {
  if (item.kind === "faceRow") {
    const diameter = item.holes[0]?.diameter;
    if (diameter === 5) return "Под шток эксцентрика";
    if (diameter === 7) return "Конфирмат в пласть";
    if (diameter === 8) return "Шкант в пласть";
  }
  return SHORT_KIND_LABELS[item.kind] ?? HARDWARE[item.kind].label;
}

export type DrillingCopyTarget = {
  id: string;
  title: string;
  size: string;
  /** Тот же размер, что у открытой детали: обычно парная деталь. */
  sameSize: boolean;
  holes: number;
};

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
  position,
  onPrev,
  onNext,
  copyTargets = [],
  onCopyTo,
  role,
  onRoleChange,
  note = "",
  onNoteChange,
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
  /** «3 из 8» — какая это деталь в списке. */
  position?: { index: number; total: number };
  onPrev?: () => void;
  onNext?: () => void;
  copyTargets?: DrillingCopyTarget[];
  onCopyTo?: (ids: string[]) => void;
  /** Что это за деталь: от этого типовая присадка и названия краёв. */
  role?: PartRole;
  onRoleChange?: (role: PartRole | undefined) => void;
  /** Присадка словами для менеджера, если клиент не уверен. */
  note?: string;
  onNoteChange?: (note: string) => void;
}) {
  const prices = useSiteCuttingPrices();
  const [side, setSide] = useState<PartSide>("left");
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyIds, setCopyIds] = useState<Set<string>>(
    () =>
      new Set(
        copyTargets.filter((item) => item.sameSize).map((item) => item.id),
      ),
  );
  const [notice, setNotice] = useState<string | null>(null);
  // Присадка до шаблона: можно вернуть, если шаблон заменил свою.
  const [beforeTemplate, setBeforeTemplate] = useState<{
    items: HardwareItem[];
    role: PartRole | undefined;
  } | null>(null);
  const [noteOpen, setNoteOpen] = useState(note.trim() !== "");
  // На телефоне выбор фурнитуры открывается поверх списка.
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (pickerOpen) setPickerOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pickerOpen]);

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
  const selectedItem = value.find((item) => item.id === selected) ?? null;
  const highlighted = useMemo(
    () => new Set(selected ? (byItem.get(selected) ?? []) : []),
    [byItem, selected],
  );
  const millingCost = useMemo(() => {
    const meters = millingMeters(length, width, milling);
    return (
      (meters.curve * prices.milling +
        meters.bevel * prices.bevel +
        meters.groove * prices.groove) *
      quantity
    );
  }, [
    length,
    milling,
    prices.bevel,
    prices.groove,
    prices.milling,
    quantity,
    width,
  ]);
  const setGrooves = (grooves: PartGroove[]) => {
    const base = milling ?? emptyMilling();
    const updated: PartMilling = { ...base, grooves };
    if (grooves.length === 0) delete updated.grooves;
    onMillingChange(hasMilling(updated) ? updated : undefined);
  };
  const grooves = milling?.grooves ?? [];
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
  const add = (item: HardwareItem) => {
    onChange([...value, item]);
    setSelected(item.id);
    setNotice(null);
    setPickerOpen(false);
  };
  const chooseRole = (next: PartRole) => {
    const template = partTemplate(next, length, width, thickness);
    // Пустой шаблон (полка, «другая») свою присадку не трогает.
    if (template.length > 0) {
      setBeforeTemplate(value.length > 0 ? { items: value, role } : null);
      onChange(template);
      setSelected(null);
    } else {
      setBeforeTemplate(null);
    }
    onRoleChange?.(next);
    setNotice(null);
  };
  const undoTemplate = () => {
    if (!beforeTemplate) return;
    onChange(beforeTemplate.items);
    onRoleChange?.(beforeTemplate.role);
    setBeforeTemplate(null);
  };
  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleCopyId = (id: string) =>
    setCopyIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const applyCopy = () => {
    if (!onCopyTo || copyIds.size === 0) return;
    onCopyTo([...copyIds]);
    setNotice(
      `Присадку скопировали на ${copyIds.size} ${copyIds.size === 1 ? "деталь" : copyIds.size < 5 ? "детали" : "деталей"}.`,
    );
    setCopyOpen(false);
  };

  const navButtonClass =
    "flex size-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--line)] text-[var(--foreground)] hover:border-[var(--foreground)] disabled:opacity-30 disabled:hover:border-[color:var(--line)]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(21,20,17,0.45)] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Присадка: ${title}`}
      onClick={onClose}
    >
      <div
        className="relative flex h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-[var(--surface-strong)] shadow-xl sm:h-auto sm:max-h-[94vh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[color:var(--line)] px-3 py-2 sm:px-4">
          {position ? (
            <button
              type="button"
              onClick={onPrev}
              disabled={!onPrev}
              aria-label="Предыдущая деталь"
              title="Предыдущая деталь"
              className={navButtonClass}
            >
              <ChevronLeft className="size-4" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
              {position ? (
                <span className="font-normal text-[var(--muted)]">
                  {position.index + 1}/{position.total} ·{" "}
                </span>
              ) : null}
              {title || "Деталь"}
            </p>
            <p className="truncate text-xs text-[var(--muted)]">
              {length} × {width} × {thickness} мм · {quantity} шт. · вид на
              лицевую сторону
            </p>
          </div>
          {position ? (
            <button
              type="button"
              onClick={onNext}
              disabled={!onNext}
              aria-label="Следующая деталь"
              title="Следующая деталь"
              className={navButtonClass}
            >
              <ChevronRight className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)]"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:overflow-hidden">
          {/* Чертёж всегда на виду: на телефоне прилипает к верху окна,
              на компьютере стоит слева, а листается только список. */}
          <div className="sticky top-0 z-10 grid content-start gap-2 border-b border-[color:var(--line)] bg-[var(--surface-strong)] px-3 pt-2 pb-2.5 sm:px-4 lg:static lg:overflow-y-auto lg:border-r lg:border-b-0 lg:py-4">
            <div className="flex justify-center [&>svg]:max-h-[26dvh] lg:[&>svg]:max-h-[52vh]">
              <PartDrawing
                length={length}
                width={width}
                holes={holes}
                highlighted={highlighted}
                dims={
                  selectedItem ? drawingDims(selectedItem, length, width) : null
                }
                side={side}
                onSide={setSide}
                milling={milling}
                role={role}
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto text-[12px] [scrollbar-width:none]">
              <span className="shrink-0 pr-1 text-[var(--muted)]">
                Сторона:
              </span>
              {SIDES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSide(item)}
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 whitespace-nowrap",
                    item === side
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                      : "border-[color:var(--line)] hover:border-[var(--foreground)]",
                  )}
                >
                  {edgeName(item, role, SIDE_LABELS).replace(" край", "")}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-dashed border-[var(--accent)] text-[14px] font-semibold text-[var(--accent)] lg:hidden"
            >
              <Plus className="size-4" />
              Добавить фурнитуру
            </button>
            <HardwarePicker
              className="hidden lg:grid"
              role={role}
              side={side}
              sideName={edgeName(side, role, SIDE_LABELS).replace(" край", "")}
              thickness={thickness}
              onPick={add}
            />
          </div>

          <div className="grid min-w-0 content-start gap-2 p-3 sm:p-4 lg:overflow-y-auto">
            {notice ? (
              <p
                role="status"
                className="rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--foreground)]"
              >
                {notice}
              </p>
            ) : null}

            {copyOpen ? (
              <div className="grid gap-2 rounded-xl border border-[var(--accent)] p-3">
                <p className="text-sm font-semibold">
                  Скопировать присадку на детали
                </p>
                <p className="text-[12px] leading-5 text-[var(--muted)]">
                  Фурнитура на выбранных деталях заменится этой. Детали того же
                  размера отмечены сразу.
                </p>
                <div className="grid max-h-60 gap-1 overflow-y-auto">
                  {copyTargets.map((target) => (
                    <label
                      key={target.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-[var(--surface)]"
                    >
                      <input
                        type="checkbox"
                        checked={copyIds.has(target.id)}
                        onChange={() => toggleCopyId(target.id)}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {target.title || "Деталь"}{" "}
                        <span className="text-[var(--muted)]">
                          {target.size}
                          {target.holes > 0
                            ? ` · уже ${target.holes} отв.`
                            : ""}
                        </span>
                      </span>
                      {target.sameSize ? (
                        <span className="shrink-0 text-[11px] text-[var(--accent)]">
                          тот же размер
                        </span>
                      ) : null}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyCopy}
                    disabled={copyIds.size === 0}
                    className="inline-flex h-9 items-center rounded-full bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--accent-ink)] disabled:opacity-40"
                  >
                    Скопировать ({copyIds.size})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCopyOpen(false)}
                    className="inline-flex h-9 items-center rounded-full border border-[color:var(--line)] px-4 text-[13px]"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : null}

            {onRoleChange ? (
              <div className="grid gap-2 rounded-xl bg-[var(--surface)] p-3">
                <p className="text-[13px] font-semibold text-[var(--foreground)]">
                  Что это за деталь?
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PART_ROLES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => chooseRole(item)}
                      aria-pressed={role === item}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[13px] leading-none whitespace-nowrap transition",
                        role === item
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                          : "border-[color:var(--line)] bg-[var(--surface-strong)] hover:border-[var(--foreground)]",
                      )}
                    >
                      {role === item ? "✓ " : ""}
                      {PART_ROLE_LABELS[item]}
                    </button>
                  ))}
                </div>
                <p
                  className={cn(
                    "text-[12px] leading-5",
                    role ? "text-[#1f5a37]" : "text-[var(--muted)]",
                  )}
                >
                  {role
                    ? PART_ROLE_HINTS[role]
                    : "Выберите — и мы поставим обычную присадку для такой детали. Отступы, диаметры и глубину потом можно поменять."}
                  {beforeTemplate ? (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={undoTemplate}
                        className="font-semibold text-[var(--accent)] underline underline-offset-2"
                      >
                        Вернуть как было
                      </button>
                    </>
                  ) : null}
                </p>
                {onNoteChange ? (
                  noteOpen ? (
                    <label className="grid gap-1 text-[12px] text-[var(--muted)]">
                      Присадка словами — менеджер сделает по описанию
                      <textarea
                        value={note}
                        maxLength={300}
                        rows={2}
                        autoFocus={note === ""}
                        placeholder="Например: под минификсы, полки на трёх уровнях"
                        onChange={(event) => onNoteChange(event.target.value)}
                        className="min-h-16 w-full rounded-lg border border-[color:var(--line)] bg-[var(--surface-strong)] px-2.5 py-2 text-[14px] text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
                      />
                    </label>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNoteOpen(true)}
                      className="justify-self-start text-left text-[12px] text-[var(--accent)] underline underline-offset-2"
                    >
                      Не знаете, какая нужна? Опишите словами, менеджер сделает
                    </button>
                  )
                ) : null}
              </div>
            ) : null}
            {value.length === 0 && !onRoleChange ? (
              <p className="rounded-xl bg-[var(--surface)] p-3 text-[13px] leading-5 text-[var(--muted)]">
                Нажмите на край детали на чертеже (или выберите сторону) и
                добавьте фурнитуру кнопками «+». Отступы, диаметры и глубину
                можно поменять — у каждого цеха свои.
              </p>
            ) : null}
            {value.map((item) => {
              const definition = HARDWARE[item.kind];
              const count = byItem.get(item.id)?.length ?? 0;
              const open = expanded.has(item.id);
              return (
                <div
                  key={item.id}
                  onFocus={() => setSelected(item.id)}
                  onMouseEnter={() => setSelected(item.id)}
                  onClick={() => setSelected(item.id)}
                  className={cn(
                    "grid gap-2 rounded-xl border px-3 py-2",
                    selected === item.id
                      ? "border-[var(--accent)]"
                      : "border-[color:var(--line)]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                      {itemLabel(item)}
                      <span className="ml-1.5 font-normal text-[var(--muted)]">
                        {count} отв.
                      </span>
                    </p>
                    <select
                      aria-label="Сторона"
                      className={cn(inputClass, "h-8 w-auto text-[12px]")}
                      value={item.side}
                      onChange={(event) =>
                        update(item.id, {
                          side: event.target.value as PartSide,
                        })
                      }
                    >
                      {SIDES.map((option) => (
                        <option key={option} value={option}>
                          {edgeName(option, role, SIDE_LABELS)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        onChange(value.filter((other) => other.id !== item.id))
                      }
                      aria-label="Убрать фурнитуру"
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--accent)]"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 items-end gap-1.5">
                    {definition.fields.map((field) => (
                      <NumberField
                        key={field}
                        label={fieldLabel(field, item)}
                        title={FIELD_LABELS[field]}
                        value={item[field]}
                        onChange={(next) => update(item.id, { [field]: next })}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(item.id)}
                      aria-expanded={open}
                      className="text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
                    >
                      {open
                        ? "Скрыть диаметр и глубину"
                        : `${item.holes.map((hole) => `Ø${String(hole.diameter).replace(".", ",")} ${hole.depth ? `глубина ${hole.depth}` : "насквозь"}`).join(" и ")} · изменить`}
                    </button>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={item.mirror}
                        onChange={(event) =>
                          update(item.id, { mirror: event.target.checked })
                        }
                      />
                      И у противоположного края («
                      {edgeName(
                        OPPOSITE_SIDE[item.side],
                        role,
                        SIDE_LABELS,
                      ).replace(" край", "")}
                      »)
                    </label>
                    {item.kind === "hole" ? (
                      <label className="flex items-center gap-1.5">
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
                  {open
                    ? item.holes.map((hole, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-[minmax(0,1fr)_72px_72px] items-end gap-1.5"
                        >
                          <span className="pb-2 text-[12px] leading-tight font-medium">
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
                            label="Глубина, 0 — насквозь"
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
                      ))
                    : null}
                </div>
              );
            })}

            <details
              open={hasMilling(milling)}
              className="rounded-xl border border-[color:var(--line)] px-3 py-2"
            >
              <summary className="cursor-pointer text-[13px] font-semibold">
                Фрезеровка: скругления, скосы, пазы
              </summary>
              <div className="mt-3 grid gap-3">
                <div className="grid gap-2">
                  {grooves.map((groove, index) => {
                    const change = (patch: Partial<PartGroove>) =>
                      setGrooves(
                        grooves.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, ...patch } : item,
                        ),
                      );
                    return (
                      <div
                        key={index}
                        className="grid gap-2 rounded-lg bg-[var(--surface)] p-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-[12px] font-semibold">
                          Паз {index + 1}: вдоль края
                          <button
                            type="button"
                            onClick={() =>
                              setGrooves(
                                grooves.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              )
                            }
                            className="text-[12px] font-normal text-[var(--muted)] underline underline-offset-2"
                          >
                            Убрать
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <label className="grid gap-1 text-[11px] text-[var(--muted)]">
                            Край
                            <select
                              className={inputClass}
                              value={groove.side}
                              onChange={(event) =>
                                change({
                                  side: event.target.value as PartSide,
                                })
                              }
                            >
                              {SIDES.map((item) => (
                                <option key={item} value={item}>
                                  {SIDE_LABELS[item]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <NumberField
                            label="От края, мм"
                            value={groove.indent}
                            onChange={(indent) => change({ indent })}
                          />
                          <NumberField
                            label="Ширина, мм"
                            value={groove.width}
                            onChange={(next) => change({ width: next })}
                          />
                          <NumberField
                            label="Глубина, мм"
                            value={groove.depth}
                            onChange={(depth) => change({ depth })}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      setGrooves([
                        ...grooves,
                        { side, indent: 20, ...LED_GROOVE },
                      ])
                    }
                    className="justify-self-start rounded-full border border-[color:var(--line)] px-3 py-1.5 text-[13px] font-medium"
                  >
                    + Паз под LED-профиль 10×10
                  </button>
                </div>
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
                  Скругление и паз уходят в файл GibLab фрезеровкой, скос — в
                  заявку и в название детали. Паз идёт по лицевой пласти на всю
                  длину края.{" "}
                  {millingCost > 0
                    ? `На ${quantity} шт.: ${formatPrice(Math.round(millingCost))} по прайсу за метр (скругления ${formatSitePrice(prices.milling)} сом/м, скосы ${formatSitePrice(prices.bevel)} сом/м, пазы ${formatSitePrice(prices.groove)} сом/м).`
                    : `Цена за метр: скругления ${formatSitePrice(prices.milling)} сом, скосы ${formatSitePrice(prices.bevel)} сом, пазы ${formatSitePrice(prices.groove)} сом.`}
                </p>
              </div>
            </details>
          </div>
        </div>

        {pickerOpen ? (
          <div className="absolute inset-x-0 top-0 bottom-0 z-30 flex flex-col bg-[var(--surface-strong)] lg:hidden">
            <div className="flex items-center gap-2 border-b border-[color:var(--line)] px-3 py-2">
              <p className="min-w-0 flex-1 text-[15px] font-semibold">
                Добавить фурнитуру
              </p>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label="Закрыть выбор фурнитуры"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)]"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="mb-2 flex flex-wrap items-center gap-1 text-[12px]">
                <span className="pr-1 text-[var(--muted)]">Край:</span>
                {SIDES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setSide(item)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 whitespace-nowrap",
                      item === side
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                        : "border-[color:var(--line)]",
                    )}
                  >
                    {edgeName(item, role, SIDE_LABELS).replace(" край", "")}
                  </button>
                ))}
              </div>
              <HardwarePicker
                role={role}
                side={side}
                sideName={edgeName(side, role, SIDE_LABELS).replace(
                  " край",
                  "",
                )}
                thickness={thickness}
                onPick={add}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--line)] px-3 py-2.5 sm:px-4">
          <p className="min-w-0 flex-1 text-[13px] text-[var(--foreground)]">
            {price.holes > 0 ? (
              <>
                {price.holes} отв. на {quantity} шт. —{" "}
                <span className="font-semibold">{formatPrice(price.cost)}</span>
                {price.unpricedHoles > 0
                  ? ` (ещё ${price.unpricedHoles} отв. без цены, посчитает менеджер)`
                  : ""}
              </>
            ) : (
              "Отверстий пока нет."
            )}
          </p>
          <div className="flex gap-2">
            {onCopyTo && copyTargets.length > 0 ? (
              <button
                type="button"
                onClick={() => setCopyOpen((current) => !current)}
                disabled={value.length === 0}
                title={
                  value.length === 0
                    ? "Сначала добавьте фурнитуру"
                    : "Та же присадка на другие детали"
                }
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[color:var(--line)] px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--foreground)] disabled:opacity-40"
              >
                <CopyIcon className="size-4" />
                <span className="hidden sm:inline">Копировать на…</span>
                <span className="sm:hidden">Копировать</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-full bg-[var(--foreground)] px-5 text-sm font-semibold text-[var(--background)]"
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
