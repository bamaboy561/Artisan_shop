"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  SheetBoard,
  decorFromLabel,
  type BoardCut,
  type BoardPiece,
  type BoardSide,
} from "./sheet-board";

type LiveSheetPiece = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  edgedSides: BoardSide[];
};

type LiveSheet = {
  index: number;
  pieces: LiveSheetPiece[];
  cuts: BoardCut[];
};

// Кромка задана для детали «как в таблице»; если раскрой повернул деталь,
// стороны поворачиваются вместе с ней.
const rotateSide: Record<BoardSide, BoardSide> = {
  top: "right",
  right: "bottom",
  bottom: "left",
  left: "top",
};

function toBoardPieces(sheet: LiveSheet | undefined): BoardPiece[] {
  if (!sheet) return [];
  return sheet.pieces.map((piece) => ({
    id: piece.id,
    x: piece.x,
    y: piece.y,
    width: piece.width,
    height: piece.height,
    label: `${Math.round(piece.width)} × ${Math.round(piece.height)}`,
    edges: piece.rotated
      ? piece.edgedSides.map((side) => rotateSide[side])
      : piece.edgedSides,
  }));
}

type LiveSheetCardProps = {
  sheetWidth: number;
  sheetHeight: number;
  sheets: LiveSheet[];
  materialLabel: string;
  total: string;
  meta: string;
  onSend: () => void;
  compact?: boolean;
};

export function LiveSheetCard({
  sheetWidth,
  sheetHeight,
  sheets,
  materialLabel,
  total,
  meta,
  onSend,
  compact = false,
}: LiveSheetCardProps) {
  const [requested, setRequested] = useState(0);
  const active = Math.min(requested, Math.max(sheets.length - 1, 0));
  const current = sheets[active];

  return (
    <section
      aria-label="Ваш раскрой"
      className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-4 sm:p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-semibold text-[var(--foreground)]">
          {sheets.length > 1
            ? `Лист ${active + 1} из ${sheets.length}`
            : "Ваш лист"}
        </p>
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-[var(--muted)] tabular-nums">
            {sheetWidth} × {sheetHeight}
          </span>
          {sheets.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Предыдущий лист"
                disabled={active === 0}
                onClick={() => setRequested(active - 1)}
                className="ml-2 grid size-7 place-items-center rounded-full border border-[color:var(--line)] transition-colors hover:border-[color:var(--foreground)]"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Следующий лист"
                disabled={active >= sheets.length - 1}
                onClick={() => setRequested(active + 1)}
                className="grid size-7 place-items-center rounded-full border border-[color:var(--line)] transition-colors hover:border-[color:var(--foreground)]"
              >
                <ChevronRight className="size-4" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className={compact ? "mt-3" : "mt-4"}>
        <SheetBoard
          key={current?.index ?? 0}
          sheetWidth={sheetWidth}
          sheetHeight={sheetHeight}
          pieces={toBoardPieces(current)}
          cuts={current?.cuts ?? []}
          decor={decorFromLabel(materialLabel)}
          showLabels={!compact}
          ariaLabel={`Карта раскроя, лист ${sheetWidth} на ${sheetHeight}`}
          emptyHint="Введите размеры — детали появятся на листе"
        />
      </div>

      <div
        className={
          compact
            ? "mt-4 flex items-end justify-between gap-3"
            : "mt-5 border-t border-[color:var(--line)] pt-4"
        }
      >
        <div>
          <p
            className={
              compact
                ? "text-[28px] leading-none font-medium tracking-[-0.02em] tabular-nums"
                : "text-[40px] leading-none font-medium tracking-[-0.03em] tabular-nums"
            }
          >
            {total}
          </p>
          <p className="mt-2 text-[13px] text-[var(--muted)]">{meta}</p>
        </div>
        {compact ? null : (
          <button
            type="button"
            onClick={onSend}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-[var(--accent)] text-[15px] font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-strong)]"
          >
            Отправить заявку
          </button>
        )}
      </div>
      {compact ? null : (
        <p className="mt-2 text-center text-xs text-[var(--muted)]">
          Оплата при получении. Точную сумму подтвердит менеджер
        </p>
      )}
    </section>
  );
}
