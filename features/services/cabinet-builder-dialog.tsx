"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CABINET_KINDS,
  buildCabinet,
  type CabinetKind,
  type CabinetPart,
  type CabinetSpec,
} from "./cabinet-builder";
import { hardwareHoles } from "./drilling-hardware";

const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-[color:var(--line)] bg-white px-2.5 text-[14px] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15";

const sizeFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 1,
});

function Field({
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

  if (shown !== value) {
    setShown(value);
    if (Number(text) !== value) setText(String(value));
  }

  return (
    <label className="grid gap-1 text-[12px] text-[var(--muted)]">
      {label}
      <input
        className={inputClass}
        value={text}
        inputMode="numeric"
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

// Вид спереди: корпус, полки пунктиром, двери поверх.
function FrontView({
  spec,
  thickness,
  shelvesAt,
  doorWidth,
}: {
  spec: CabinetSpec;
  thickness: number;
  shelvesAt: number[];
  doorWidth: number;
}) {
  const { width: W, height: H, plinth } = spec;
  if (!(W > 0 && H > 0)) return null;
  const pad = Math.max(W, H) * 0.06;
  const stroke = Math.max(W, H) / 250;
  const y = (fromFloor: number) => H - fromFloor;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`}
      className="mx-auto h-auto max-h-[42vh] w-full"
      role="img"
      aria-label={`${spec.name}: ${W} × ${H} мм`}
    >
      <rect
        x={0}
        y={0}
        width={W}
        height={H}
        fill="#f3ece1"
        stroke="#7a6a55"
        strokeWidth={stroke}
      />
      <rect x={0} y={0} width={thickness} height={H} fill="#e2d5c1" />
      <rect
        x={W - thickness}
        y={0}
        width={thickness}
        height={H}
        fill="#e2d5c1"
      />
      <rect
        x={thickness}
        y={0}
        width={W - 2 * thickness}
        height={thickness}
        fill="#e2d5c1"
      />
      <rect
        x={thickness}
        y={y(plinth + thickness)}
        width={W - 2 * thickness}
        height={thickness}
        fill="#e2d5c1"
      />
      {plinth > 0 ? (
        <rect
          x={thickness}
          y={y(plinth)}
          width={W - 2 * thickness}
          height={plinth}
          fill="#d3c2a8"
        />
      ) : null}
      {shelvesAt.map((shelf) => (
        <rect
          key={shelf}
          x={thickness}
          y={y(shelf + thickness)}
          width={W - 2 * thickness}
          height={thickness}
          fill="#e2d5c1"
          stroke="#7a6a55"
          strokeWidth={stroke / 2}
        />
      ))}
      {Array.from({ length: spec.doors }, (_, index) => {
        const x = 3 + index * (doorWidth + 3);
        return (
          <rect
            key={index}
            x={x}
            y={0}
            width={doorWidth}
            height={H - plinth - 3}
            fill="rgba(196,83,43,0.08)"
            stroke="var(--accent)"
            strokeWidth={stroke}
            strokeDasharray={`${stroke * 4} ${stroke * 3}`}
          />
        );
      })}
      <text
        x={W / 2}
        y={-pad * 0.3}
        textAnchor="middle"
        fontSize={pad * 0.55}
        fill="#69716d"
      >
        {W} мм
      </text>
      <text
        x={-pad * 0.3}
        y={H / 2}
        textAnchor="middle"
        fontSize={pad * 0.55}
        fill="#69716d"
        transform={`rotate(-90 ${-pad * 0.3} ${H / 2})`}
      >
        {H} мм
      </text>
    </svg>
  );
}

export function CabinetBuilderDialog({
  thickness,
  materialLabel,
  onAdd,
  onClose,
}: {
  thickness: number;
  materialLabel: string;
  onAdd: (parts: CabinetPart[], note: string) => void;
  onClose: () => void;
}) {
  const [spec, setSpec] = useState<CabinetSpec>({
    kind: "wardrobe",
    ...CABINET_KINDS.wardrobe.defaults,
  });
  const result = useMemo(
    () => buildCabinet(spec, thickness),
    [spec, thickness],
  );
  const holes = useMemo(
    () =>
      result.parts.reduce(
        (sum, part) =>
          sum +
          hardwareHoles(part.hardware, part.length, part.width, thickness)
            .length *
            part.quantity,
        0,
      ),
    [result.parts, thickness],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (patch: Partial<CabinetSpec>) =>
    setSpec((current) => ({ ...current, ...patch }));
  const backNote = result.back
    ? `${spec.name}, задняя стенка: ХДФ ${sizeFormatter.format(result.back.length)} × ${sizeFormatter.format(result.back.width)} мм, 1 шт. (накладная, отдельный материал).`
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(21,20,17,0.45)] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Конструктор шкафа"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-[var(--foreground)]">
              Конструктор шкафа
            </p>
            <p className="text-xs text-[var(--muted)]">
              Плита: {materialLabel}, толщина {thickness} мм. Детали с кромкой и
              присадкой уйдут в раскрой, там их можно поправить.
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

        <div className="grid min-h-0 flex-1 gap-4 overflow-x-hidden overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="grid min-w-0 content-start gap-3">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CABINET_KINDS) as CabinetKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() =>
                    setSpec({ kind, ...CABINET_KINDS[kind].defaults })
                  }
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[13px]",
                    spec.kind === kind
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[color:var(--line)] hover:border-[var(--foreground)]",
                  )}
                >
                  {CABINET_KINDS[kind].label}
                </button>
              ))}
            </div>
            <label className="grid gap-1 text-[12px] text-[var(--muted)]">
              Название
              <input
                className={inputClass}
                value={spec.name}
                onChange={(event) => set({ name: event.target.value })}
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Field
                label="Ширина, мм"
                value={spec.width}
                onChange={(width) => set({ width })}
              />
              <Field
                label="Высота, мм"
                value={spec.height}
                onChange={(height) => set({ height })}
              />
              <Field
                label="Глубина, мм"
                value={spec.depth}
                onChange={(depth) => set({ depth })}
              />
              <Field
                label="Цоколь, мм"
                value={spec.plinth}
                onChange={(plinth) => set({ plinth })}
              />
              <Field
                label="Полок, шт."
                value={spec.shelves}
                onChange={(shelves) => set({ shelves })}
              />
              <label className="grid gap-1 text-[12px] text-[var(--muted)]">
                Дверей
                <select
                  className={inputClass}
                  value={spec.doors}
                  onChange={(event) =>
                    set({ doors: Number(event.target.value) as 0 | 1 | 2 })
                  }
                >
                  <option value={0}>без дверей</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </label>
            </div>
            <FrontView
              spec={spec}
              thickness={thickness}
              shelvesAt={result.shelvesAt}
              doorWidth={result.doorWidth}
            />
          </div>

          <div className="grid min-w-0 content-start gap-3">
            {result.problems.length > 0 ? (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {result.problems.join(" ")}
              </p>
            ) : null}
            <div className="overflow-hidden rounded-xl border border-[color:var(--line)]">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#faf7f2] text-[11px] text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Деталь</th>
                    <th className="px-2 py-2 font-medium">Размер, мм</th>
                    <th className="px-2 py-2 text-right font-medium">Шт.</th>
                  </tr>
                </thead>
                <tbody>
                  {result.parts.map((part) => (
                    <tr
                      key={part.title}
                      className="border-t border-[color:var(--line)]"
                    >
                      <td className="px-3 py-1.5">
                        {part.title.replace(`${spec.name}: `, "")}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {sizeFormatter.format(part.length)} ×{" "}
                        {sizeFormatter.format(part.width)}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {part.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] leading-5 text-[var(--muted)]">
              Присадка: {holes} отв. — минификсы крыша и дно к боковинам,
              полкодержатели под каждую полку, петли на дверях. Кромка по
              переднему торцу корпуса и полок, двери по кругу.
            </p>
            {backNote ? (
              <p className="rounded-xl bg-[#faf7f2] p-3 text-[13px] leading-5">
                {backNote} Она не входит в этот раскрой — добавьте в комментарий
                к заявке или посчитайте отдельно.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--line)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-full border border-[color:var(--line-strong)] px-5 text-sm font-medium"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={result.problems.length > 0}
            onClick={() => onAdd(result.parts, backNote)}
            className="inline-flex h-10 items-center rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Добавить в раскрой
          </button>
        </div>
      </div>
    </div>
  );
}
