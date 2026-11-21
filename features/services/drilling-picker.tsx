"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  createHardware,
  type HardwareItem,
  type PartSide,
} from "./drilling-hardware";
import {
  dowelPlaces,
  minifixPlaces,
  type PartRole,
} from "./drilling-templates";

// Выбор фурнитуры карточками: что это и для чего, по группам. Крепёж
// («Эксцентрик», «Конфирмат», «Шкант») сам встаёт как надо: на боковине —
// отверстия в пласть, на крыше и дне — в торец. Если вид детали не выбран,
// карточка спрашивает, для какой детали.

type Variant = "side" | "roof";

type Pick = {
  key: string;
  title: string;
  hint: string;
  icon: ReactNode;
  /** edge — длина выбранного края, мм: от неё зависит, сколько мест крепежа. */
  make: (
    side: PartSide,
    thickness: number,
    variant: Variant,
    edge: number,
  ) => HardwareItem;
  /** Крепёж: на боковине и на крыше сверлится по-разному. */
  joint?: boolean;
};

const round = (value: number) => Math.round(value * 10) / 10;

const icon = (children: ReactNode) => (
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
    {children}
  </svg>
);

const ACCENT = "var(--accent)";
const MUTED = "#6E6B63";

const GROUPS: { title: string; picks: Pick[] }[] = [
  {
    title: "Соединить детали",
    picks: [
      {
        key: "minifix",
        title: "Эксцентрик",
        hint: "стяжка, шкаф можно разобрать",
        joint: true,
        icon: icon(
          <>
            <circle
              cx="15"
              cy="15"
              r="10"
              fill="none"
              stroke={ACCENT}
              strokeWidth="2.5"
            />
            <path d="M9 15h12" stroke={ACCENT} strokeWidth="2.5" />
          </>,
        ),
        // На боковине — отверстие под шток, на крыше — корпус и канал.
        make: (side, t, variant, edge) =>
          variant === "side"
            ? {
                ...createHardware("faceRow", side),
                ...minifixPlaces(edge),
                indent: round(t / 2),
                mirror: true,
                holes: [{ diameter: 5, depth: 12 }],
              }
            : {
                ...createHardware("minifix", side),
                ...minifixPlaces(edge),
                mirror: true,
              },
      },
      {
        key: "confirmat",
        title: "Конфирмат",
        hint: "винт-стяжка, крепко и недорого",
        joint: true,
        icon: icon(
          <>
            <path d="M8 6h14v4H8z" fill={ACCENT} />
            <path d="M15 10v15" stroke={ACCENT} strokeWidth="3" />
          </>,
        ),
        make: (side, t, variant, edge) =>
          variant === "side"
            ? {
                ...createHardware("faceRow", side),
                ...minifixPlaces(edge),
                indent: round(t / 2),
                mirror: true,
                holes: [{ diameter: 7, depth: 0 }],
              }
            : {
                ...createHardware("confirmatEdge", side),
                ...minifixPlaces(edge),
                mirror: true,
              },
      },
      {
        key: "dowel",
        title: "Шкант",
        hint: "штырь, держит детали ровно",
        joint: true,
        icon: icon(
          <>
            <rect x="11" y="4" width="8" height="22" rx="3" fill="#c99558" />
            <path d="M11 9h8M11 13h8M11 17h8M11 21h8" stroke="#a87a42" />
          </>,
        ),
        make: (side, t, variant, edge) =>
          variant === "side"
            ? {
                ...createHardware("faceRow", side),
                ...dowelPlaces(edge),
                indent: round(t / 2),
                mirror: true,
                holes: [{ diameter: 8, depth: 12 }],
              }
            : {
                ...createHardware("dowelEdge", side),
                ...dowelPlaces(edge),
                mirror: true,
                holes: [{ diameter: 8, depth: 20 }],
              },
      },
    ],
  },
  {
    title: "Полки и двери",
    picks: [
      {
        key: "shelfPins",
        title: "Полкодержатели",
        hint: "полка на нужной высоте",
        icon: icon(
          <>
            <path d="M5 16h20" stroke={MUTED} strokeWidth="3" />
            <circle cx="9" cy="21" r="2" fill={ACCENT} />
            <circle cx="21" cy="21" r="2" fill={ACCENT} />
          </>,
        ),
        make: (side) => createHardware("shelfPins", side),
      },
      {
        key: "hinge",
        title: "Петля",
        hint: "чашка Ø35 на двери",
        icon: icon(
          <>
            <circle
              cx="12"
              cy="15"
              r="7"
              fill="none"
              stroke={ACCENT}
              strokeWidth="2.5"
            />
            <path d="M19 15h7" stroke={MUTED} strokeWidth="3" />
          </>,
        ),
        make: (side) => createHardware("hinge", side),
      },
      {
        key: "hingePlate",
        title: "Планка петли",
        hint: "на боковину, напротив петли",
        icon: icon(
          <>
            <rect
              x="9"
              y="6"
              width="12"
              height="18"
              rx="2"
              fill="none"
              stroke={MUTED}
              strokeWidth="2"
            />
            <circle cx="15" cy="11" r="1.8" fill={ACCENT} />
            <circle cx="15" cy="19" r="1.8" fill={ACCENT} />
          </>,
        ),
        make: (side) => createHardware("hingePlate", side),
      },
    ],
  },
  {
    title: "Другое",
    picks: [
      {
        key: "handle",
        title: "Ручка",
        hint: "2 отверстия на межосевом",
        icon: icon(
          <>
            <path
              d="M7 12c0 6 16 6 16 0"
              fill="none"
              stroke={MUTED}
              strokeWidth="3"
            />
            <circle cx="7" cy="12" r="2" fill={ACCENT} />
            <circle cx="23" cy="12" r="2" fill={ACCENT} />
          </>,
        ),
        make: (side) => createHardware("handle", side),
      },
      {
        key: "hole",
        title: "Своё отверстие",
        hint: "любой диаметр и глубина",
        icon: icon(
          <circle
            cx="15"
            cy="15"
            r="6"
            fill="none"
            stroke={ACCENT}
            strokeWidth="2.5"
            strokeDasharray="3 2"
          />,
        ),
        make: (side) => createHardware("hole", side),
      },
    ],
  },
];

function roleVariant(role: PartRole | undefined): Variant | null {
  if (role === "side") return "side";
  if (role === "roof" || role === "shelf") return "roof";
  return null;
}

export function HardwarePicker({
  role,
  side,
  sideName,
  thickness,
  length,
  width,
  onPick,
  className,
}: {
  role?: PartRole;
  side: PartSide;
  /** «перед», «к дну» или «левый край». */
  sideName: string;
  thickness: number;
  /** Размеры детали, мм: «Длина» по x, «Ширина» по y. */
  length: number;
  width: number;
  onPick: (item: HardwareItem) => void;
  className?: string;
}) {
  const variant = roleVariant(role);
  const edge = side === "top" || side === "bottom" ? length : width;
  const cardClass =
    "flex min-w-0 items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] px-2 py-1.5 text-left";

  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <p className="text-[12px] text-[var(--muted)]">
        Добавить на край{" "}
        <span className="font-semibold text-[var(--accent)]">«{sideName}»</span>
        . Край меняется нажатием на чертёж.
      </p>
      {GROUPS.map((group) => (
        <div key={group.title} className="grid gap-1.5">
          <p className="mt-1 text-[10.5px] font-bold tracking-[0.06em] text-[var(--muted)] uppercase">
            {group.title}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {group.picks.map((pick) => {
              const text = (
                <span className="min-w-0">
                  <span className="block text-[13px] leading-tight font-semibold text-[var(--foreground)]">
                    {pick.title}
                  </span>
                  <span className="block text-[11px] leading-tight text-[var(--muted)]">
                    {pick.hint}
                  </span>
                </span>
              );
              if (pick.joint && !variant) {
                // Вид детали не выбран: спрашиваем, на какую деталь.
                return (
                  <div key={pick.key} className={cn(cardClass, "col-span-2")}>
                    <span className="shrink-0">{pick.icon}</span>
                    <span className="min-w-0 flex-1">{text}</span>
                    <span className="grid w-[124px] shrink-0 gap-1">
                      {(
                        [
                          ["side", "на боковину"],
                          ["roof", "на крышу, дно"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            onPick(pick.make(side, thickness, value, edge))
                          }
                          className="rounded-full border border-[color:var(--line)] px-2 py-1 text-left text-[11.5px] whitespace-nowrap hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        >
                          + {label}
                        </button>
                      ))}
                    </span>
                  </div>
                );
              }
              return (
                <button
                  key={pick.key}
                  type="button"
                  onClick={() =>
                    onPick(pick.make(side, thickness, variant ?? "roof", edge))
                  }
                  className={cn(
                    cardClass,
                    "transition hover:border-[var(--accent)]",
                  )}
                >
                  <span className="shrink-0">{pick.icon}</span>
                  {text}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {variant ? (
        <p className="mt-1 text-[11.5px] leading-5 text-[var(--muted)]">
          Крепёж сам встаёт как нужно:{" "}
          {variant === "side"
            ? "на боковине — отверстия в пласть."
            : "на крыше, дне и полке — в торец."}
        </p>
      ) : null}
    </div>
  );
}
