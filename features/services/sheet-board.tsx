import type { CSSProperties } from "react";

import s from "./sheet-board.module.css";

// Лист ЛДСП как предмет из цеха: декор с текстурой, пропилы, кромка.
// Один компонент для героя (наклонённый лист с поднятыми деталями)
// и для живой карты в калькуляторе (вид сверху, детали появляются
// по мере ввода).

export type BoardSide = "top" | "right" | "bottom" | "left";

export type BoardPiece = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  edges?: BoardSide[];
};

export type BoardCut = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BoardDecor = {
  base: string;
  edge: string;
  ink: string;
  grain: number;
};

const decors: Array<{ match: RegExp; decor: BoardDecor }> = [
  {
    match: /бел|снеж|white|альпийск|жемчуж|крем|ваниль|кашемир/i,
    decor: { base: "#ece7de", edge: "#cfc6b8", ink: "#4a4339", grain: 0.18 },
  },
  {
    match: /черн|антрацит|графит|black/i,
    decor: { base: "#3a3936", edge: "#24231f", ink: "#efe9df", grain: 0.35 },
  },
  {
    match: /сер|бетон|камен|доломит|stone|grey|gray|сланец|кашмир/i,
    decor: { base: "#b9b4aa", edge: "#8f897d", ink: "#2b2924", grain: 0.28 },
  },
  {
    match: /син|скалист|navy|blue/i,
    decor: { base: "#3f5468", edge: "#2c3b4a", ink: "#eef2f5", grain: 0.3 },
  },
  {
    match: /зел|олив|green/i,
    decor: { base: "#5d6b55", edge: "#434e3d", ink: "#f0f2ec", grain: 0.3 },
  },
  {
    match: /орех|венге|махагон|тик|walnut|wenge/i,
    decor: { base: "#8a5a3b", edge: "#5e3b25", ink: "#fbf3ea", grain: 0.7 },
  },
];

// Нейтральный тёплый декор «дуб» для ЛДСП, когда по названию не понять.
export const defaultDecor: BoardDecor = {
  base: "#cfa77d",
  edge: "#9c7148",
  ink: "#3b2a1c",
  grain: 0.55,
};

export const walnutDecor: BoardDecor = decors[decors.length - 1].decor;

export function decorFromLabel(label: string | null | undefined): BoardDecor {
  if (!label) return defaultDecor;
  return decors.find((item) => item.match.test(label))?.decor ?? defaultDecor;
}

function pct(value: number, total: number) {
  return `${(value / total) * 100}%`;
}

type SheetBoardProps = {
  sheetWidth: number;
  sheetHeight: number;
  pieces: BoardPiece[];
  cuts?: BoardCut[];
  decor?: BoardDecor;
  /** Лист лежит на столе под углом, детали поднимаются — для героя. */
  tilt?: boolean;
  /** Подписи размеров на деталях. */
  showLabels?: boolean;
  className?: string;
  ariaLabel: string;
  emptyHint?: string;
};

export function SheetBoard({
  sheetWidth,
  sheetHeight,
  pieces,
  cuts = [],
  decor = defaultDecor,
  tilt = false,
  showLabels = true,
  className,
  ariaLabel,
  emptyHint,
}: SheetBoardProps) {
  const style = {
    "--decor": decor.base,
    "--decor-edge": decor.edge,
    "--decor-ink": decor.ink,
    "--grain": decor.grain,
    aspectRatio: `${sheetWidth} / ${sheetHeight}`,
  } as CSSProperties;

  return (
    <div
      className={[s.stage, tilt ? s.tilt : "", className ?? ""].join(" ")}
      role="img"
      aria-label={ariaLabel}
    >
      <div className={s.board} style={style}>
        {cuts.map((cut, index) => (
          <span
            key={cut.id}
            className={s.kerf}
            data-dir={cut.width >= cut.height ? "h" : "v"}
            style={
              {
                left: pct(cut.x, sheetWidth),
                top: pct(cut.y, sheetHeight),
                width:
                  cut.width >= cut.height
                    ? pct(cut.width, sheetWidth)
                    : undefined,
                height:
                  cut.width >= cut.height
                    ? undefined
                    : pct(cut.height, sheetHeight),
                "--i": index,
              } as CSSProperties
            }
          />
        ))}
        {pieces.map((piece, index) => {
          const edges = new Set(piece.edges ?? []);
          const small = piece.width / sheetWidth < 0.12;
          return (
            <span
              key={piece.id}
              className={s.piece}
              data-small={small ? "" : undefined}
              style={
                {
                  left: pct(piece.x, sheetWidth),
                  top: pct(piece.y, sheetHeight),
                  width: pct(piece.width, sheetWidth),
                  height: pct(piece.height, sheetHeight),
                  "--i": index,
                  borderTopColor: edges.has("top") ? undefined : "transparent",
                  borderRightColor: edges.has("right")
                    ? undefined
                    : "transparent",
                  borderBottomColor: edges.has("bottom")
                    ? undefined
                    : "transparent",
                  borderLeftColor: edges.has("left")
                    ? undefined
                    : "transparent",
                } as CSSProperties
              }
            >
              {showLabels && piece.label ? (
                <span className={s.label}>{piece.label}</span>
              ) : null}
            </span>
          );
        })}
        {pieces.length === 0 && emptyHint ? (
          <span className={s.empty}>{emptyHint}</span>
        ) : null}
      </div>
    </div>
  );
}
