"use client";

import type { ReactNode } from "react";

import type {
  KitchenBaseType,
  KitchenTopType,
} from "@/features/services/kitchen-builder";

// Картинки блоков для каталога: вид спереди, линии — фасады.
const BODY = { x: 8, w: 32 };
const BASE_TOP = 18;
const BASE_BOTTOM = 42;
const TALL_TOP = 4;
const TOP_TOP = 6;
const TOP_BOTTOM = 30;

const Line = (props: { x1: number; y1: number; x2: number; y2: number }) => (
  <line {...props} />
);

function Doors({
  top,
  bottom,
  x = BODY.x,
  w = BODY.w,
}: {
  top: number;
  bottom: number;
  x?: number;
  w?: number;
}) {
  const mid = x + w / 2;
  return (
    <>
      <Line x1={mid} y1={top} x2={mid} y2={bottom} />
      <Line x1={mid - 3} y1={top + 4} x2={mid - 3} y2={top + 8} />
      <Line x1={mid + 3} y1={top + 4} x2={mid + 3} y2={top + 8} />
    </>
  );
}

function Drawers({
  top,
  bottom,
  count,
}: {
  top: number;
  bottom: number;
  count: number;
}) {
  const step = (bottom - top) / count;
  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const y = top + step * index;
        return (
          <g key={index}>
            {index > 0 ? (
              <Line x1={BODY.x} y1={y} x2={BODY.x + BODY.w} y2={y} />
            ) : null}
            <Line x1={21} y1={y + step / 2} x2={27} y2={y + step / 2} />
          </g>
        );
      })}
    </>
  );
}

// Тумба: столешница, корпус и ножки.
function Base({
  children,
  x = BODY.x,
  w = BODY.w,
  dashed = false,
  worktop = true,
}: {
  children?: ReactNode;
  x?: number;
  w?: number;
  dashed?: boolean;
  worktop?: boolean;
}) {
  return (
    <>
      {worktop ? (
        <rect
          x={4}
          y={BASE_TOP - 3}
          width={40}
          height={3}
          fill="currentColor"
          stroke="none"
          opacity={0.35}
        />
      ) : null}
      <rect
        x={x}
        y={BASE_TOP}
        width={w}
        height={BASE_BOTTOM - BASE_TOP}
        strokeDasharray={dashed ? "3 2" : undefined}
      />
      <Line x1={x + 3} y1={BASE_BOTTOM} x2={x + 3} y2={BASE_BOTTOM + 3} />
      <Line
        x1={x + w - 3}
        y1={BASE_BOTTOM}
        x2={x + w - 3}
        y2={BASE_BOTTOM + 3}
      />
      {children}
    </>
  );
}

function Tall({
  children,
  dashed = false,
}: {
  children?: ReactNode;
  dashed?: boolean;
}) {
  return (
    <>
      <rect
        x={BODY.x}
        y={TALL_TOP}
        width={BODY.w}
        height={BASE_BOTTOM - TALL_TOP}
        strokeDasharray={dashed ? "3 2" : undefined}
      />
      <Line
        x1={BODY.x + 3}
        y1={BASE_BOTTOM}
        x2={BODY.x + 3}
        y2={BASE_BOTTOM + 3}
      />
      <Line
        x1={BODY.x + BODY.w - 3}
        y1={BASE_BOTTOM}
        x2={BODY.x + BODY.w - 3}
        y2={BASE_BOTTOM + 3}
      />
      {children}
    </>
  );
}

function Wall({
  children,
  bottom = TOP_BOTTOM,
  dashed = false,
}: {
  children?: ReactNode;
  bottom?: number;
  dashed?: boolean;
}) {
  return (
    <>
      <rect
        x={BODY.x}
        y={TOP_TOP}
        width={BODY.w}
        height={bottom - TOP_TOP}
        strokeDasharray={dashed ? "3 2" : undefined}
      />
      {children}
    </>
  );
}

// Глухая часть углового модуля: штриховка.
function Blind({ top, bottom }: { top: number; bottom: number }) {
  const lines = [];
  for (let x = BODY.x; x < BODY.x + 14; x += 4) {
    lines.push(
      <Line
        key={x}
        x1={x}
        y1={bottom}
        x2={Math.min(x + 6, BODY.x + 14)}
        y2={top}
      />,
    );
  }
  return (
    <>
      <Line x1={BODY.x + 14} y1={top} x2={BODY.x + 14} y2={bottom} />
      <g opacity={0.5}>{lines}</g>
    </>
  );
}

const BASE_ICONS: Record<KitchenBaseType, ReactNode> = {
  doors: (
    <Base>
      <Doors top={BASE_TOP} bottom={BASE_BOTTOM} />
    </Base>
  ),
  drawers: (
    <Base>
      <Drawers top={BASE_TOP} bottom={BASE_BOTTOM} count={3} />
    </Base>
  ),
  sink: (
    <Base>
      <path
        d="M17 15 v4 a7 5 0 0 0 14 0 v-4"
        fill="var(--surface-strong, #fff)"
      />
      <Doors top={BASE_TOP + 5} bottom={BASE_BOTTOM} />
    </Base>
  ),
  hob: (
    <Base>
      <ellipse cx={18} cy={12} rx={4} ry={1.5} />
      <ellipse cx={30} cy={12} rx={4} ry={1.5} />
      <Drawers top={BASE_TOP} bottom={BASE_BOTTOM} count={3} />
    </Base>
  ),
  oven: (
    <Base>
      <rect x={11} y={BASE_TOP + 3} width={26} height={12} rx={1} />
      <Line x1={14} y1={BASE_TOP + 1.5} x2={34} y2={BASE_TOP + 1.5} />
      <Line
        x1={BODY.x}
        y1={BASE_BOTTOM - 6}
        x2={BODY.x + BODY.w}
        y2={BASE_BOTTOM - 6}
      />
    </Base>
  ),
  dishwasher: (
    <Base dashed>
      <Line
        x1={BODY.x}
        y1={BASE_TOP + 5}
        x2={BODY.x + BODY.w}
        y2={BASE_TOP + 5}
      />
      <Line x1={20} y1={BASE_TOP + 2.5} x2={28} y2={BASE_TOP + 2.5} />
    </Base>
  ),
  bottle: (
    <Base x={18} w={12}>
      <Line x1={24} y1={BASE_TOP + 3} x2={24} y2={BASE_TOP + 9} />
    </Base>
  ),
  appliance: (
    <Base dashed>
      <circle cx={24} cy={30} r={6} strokeDasharray="2 2" />
    </Base>
  ),
  corner: (
    <Base>
      <Blind top={BASE_TOP} bottom={BASE_BOTTOM} />
      <Line
        x1={BODY.x + 18}
        y1={BASE_TOP + 4}
        x2={BODY.x + 18}
        y2={BASE_TOP + 9}
      />
    </Base>
  ),
  tallPantry: (
    <Tall>
      <Line x1={BODY.x} y1={20} x2={BODY.x + BODY.w} y2={20} />
      <Line x1={BODY.x + 4} y1={14} x2={BODY.x + 4} y2={18} />
      <Line x1={BODY.x + 4} y1={22} x2={BODY.x + 4} y2={26} />
    </Tall>
  ),
  tallOven: (
    <Tall>
      <Line x1={BODY.x} y1={14} x2={BODY.x + BODY.w} y2={14} />
      <rect x={11} y={17} width={26} height={11} rx={1} />
      <Drawers top={31} bottom={BASE_BOTTOM} count={2} />
      <Line x1={BODY.x} y1={31} x2={BODY.x + BODY.w} y2={31} />
    </Tall>
  ),
  fridge: (
    <Tall dashed>
      <Line x1={BODY.x} y1={18} x2={BODY.x + BODY.w} y2={18} />
      <Line x1={BODY.x + 4} y1={9} x2={BODY.x + 4} y2={14} />
      <Line x1={BODY.x + 4} y1={22} x2={BODY.x + 4} y2={28} />
    </Tall>
  ),
};

const TOP_ICONS: Record<KitchenTopType, ReactNode> = {
  doors: (
    <Wall>
      <Doors top={TOP_TOP + 14} bottom={TOP_BOTTOM} />
      <Line x1={24} y1={TOP_TOP} x2={24} y2={TOP_TOP + 14} />
    </Wall>
  ),
  lift: (
    <Wall>
      <Line x1={20} y1={TOP_BOTTOM - 3} x2={28} y2={TOP_BOTTOM - 3} />
      <path d="M24 24 V12 M20 16 L24 12 L28 16" />
    </Wall>
  ),
  dryer: (
    <Wall>
      <g opacity={0.5}>
        {[14, 19, 24, 29, 34].map((x) => (
          <Line key={x} x1={x} y1={TOP_TOP + 6} x2={x} y2={TOP_TOP + 12} />
        ))}
        {[14, 19, 24, 29, 34].map((x) => (
          <Line
            key={`b${x}`}
            x1={x}
            y1={TOP_TOP + 16}
            x2={x}
            y2={TOP_TOP + 21}
          />
        ))}
      </g>
      <Doors top={TOP_TOP} bottom={TOP_BOTTOM} />
    </Wall>
  ),
  hood: (
    <Wall bottom={TOP_TOP + 12}>
      <Line x1={24} y1={TOP_TOP} x2={24} y2={TOP_TOP + 12} />
      <path d="M20 18 h8 l8 10 h-24 z" strokeDasharray="2 2" />
    </Wall>
  ),
  open: (
    <Wall>
      <Line x1={BODY.x} y1={14} x2={BODY.x + BODY.w} y2={14} />
      <Line x1={BODY.x} y1={22} x2={BODY.x + BODY.w} y2={22} />
    </Wall>
  ),
  corner: (
    <Wall>
      <Blind top={TOP_TOP} bottom={TOP_BOTTOM} />
      <Line
        x1={BODY.x + 18}
        y1={TOP_BOTTOM - 8}
        x2={BODY.x + 18}
        y2={TOP_BOTTOM - 3}
      />
    </Wall>
  ),
  none: <Wall dashed />,
};

export function BlockIcon({
  row,
  type,
  className,
}: {
  row: "base" | "top";
  type: string;
  className?: string;
}) {
  const icon =
    row === "base"
      ? BASE_ICONS[type as KitchenBaseType]
      : TOP_ICONS[type as KitchenTopType];
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {icon}
    </svg>
  );
}

// Каталог блоков: нажали — блок встал в конец ряда.
export function BlockCatalog<T extends string>({
  row,
  types,
  onPick,
}: {
  row: "base" | "top";
  types: Record<T, { label: string; width: number; hint: string }>;
  onPick: (type: T) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {(Object.keys(types) as T[]).map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onPick(type)}
          title={types[type].hint || types[type].label}
          className="grid justify-items-center gap-1 rounded-xl border border-[color:var(--line)] p-2 text-center hover:border-[var(--accent)]"
        >
          <BlockIcon row={row} type={type} className="size-12" />
          <span className="text-[11px] leading-[14px]">
            {types[type].label}
          </span>
          <span className="text-[10px] text-[var(--muted)]">
            {types[type].width} мм
          </span>
        </button>
      ))}
    </div>
  );
}
