"use client";

import { useMemo, useState } from "react";
import { DoorOpen, DoorClosed, Scissors, Search } from "lucide-react";

import { BazisViewer } from "@/components/bazis/bazis-viewer";
import { guessDecorColor } from "@/features/bazis/decor-color";
import {
  CALCULATOR_DRAFT_KEY,
  CALCULATOR_PRESET_HANDOFF_KEY,
} from "@/features/bazis/project-view";
import {
  CABINET_KINDS,
  buildCabinet,
  cabinetGroupLabel,
  type CabinetKind,
  type CabinetPart,
  type CabinetSpec,
} from "@/features/services/cabinet-builder";
import { Field, inputClass } from "@/features/services/cabinet-builder-dialog";
import { hardwareHoles } from "@/features/services/drilling-hardware";
import { cn } from "@/lib/utils";
import type { ConstructorDecor } from "@/lib/server/constructor-decors";

import {
  buildCabinetModel,
  countCabinetFittings,
  TONE_BACK,
  TONE_BODY,
  TONE_FACADE,
} from "./cabinet-model";

const FALLBACK_COLOR = [214, 206, 192];
const BACK_COLOR = [198, 170, 132];
const sizeFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 1,
});

function decorColor(decor: ConstructorDecor | undefined) {
  return (decor && guessDecorColor(decor.name)) ?? FALLBACK_COLOR;
}

function Swatch({
  decor,
  className,
}: {
  decor: ConstructorDecor | undefined;
  className?: string;
}) {
  const [r, g, b] = decorColor(decor);
  return (
    <span
      className={cn(
        "block shrink-0 overflow-hidden rounded-md border border-[color:var(--line)] bg-cover bg-center",
        className,
      )}
      style={{
        backgroundColor: `rgb(${r}, ${g}, ${b})`,
        backgroundImage: decor?.imageUrl
          ? `url("${decor.imageUrl}")`
          : undefined,
      }}
      aria-hidden
    />
  );
}

// Выбор декора: поиск по названию и плитки с фото декора из каталога.
function DecorPicker({
  title,
  decors,
  value,
  onChange,
}: {
  title: string;
  decors: ConstructorDecor[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = decors.find((decor) => decor.id === value);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = decors.filter((decor) => {
    const text =
      `${decor.label} ${decor.category} ${decor.thickness}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });

  return (
    <div className="grid gap-2">
      <p className="text-[12px] text-[var(--muted)]">{title}</p>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-3 rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] p-2 text-left hover:border-[var(--foreground)]"
      >
        <Swatch decor={selected} className="size-11" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--foreground)]">
            {selected?.label ?? "Выберите декор"}
          </span>
          <span className="block text-xs text-[var(--muted)]">
            {selected ? `${selected.thickness} мм` : ""}
            {selected?.category ? ` · ${selected.category}` : ""}
          </span>
        </span>
        <span className="text-xs font-medium text-[var(--accent)]">
          {open ? "Скрыть" : "Сменить"}
        </span>
      </button>
      {open ? (
        <div className="grid gap-2 rounded-xl border border-[color:var(--line)] p-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              className={cn(inputClass, "pl-8")}
              placeholder="Белый, дуб, Egger, 18…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
            {shown.slice(0, 120).map((decor) => (
              <button
                key={decor.id}
                type="button"
                onClick={() => {
                  onChange(decor.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-1.5 text-left text-[12px] leading-4",
                  decor.id === value
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-transparent hover:border-[color:var(--line)]",
                )}
              >
                <Swatch decor={decor} className="size-9" />
                <span className="line-clamp-2 min-w-0">
                  {decor.label}
                  <span className="text-[var(--muted)]">
                    {" "}
                    · {decor.thickness}
                  </span>
                </span>
              </button>
            ))}
            {shown.length === 0 ? (
              <p className="col-span-full p-3 text-sm text-[var(--muted)]">
                Ничего не нашли. Попробуйте другое слово.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function partsToDraftRows(parts: CabinetPart[]) {
  const stamp = Date.now().toString(36);
  return parts.map((part, index) => ({
    id: `constructor-${stamp}-${index + 1}`,
    title: part.title,
    width: String(part.length),
    height: String(part.width),
    quantity: String(part.quantity),
    edgedSides: ["top", "right", "bottom", "left"].filter((side) =>
      part.edgedSides.includes(side as CabinetPart["edgedSides"][number]),
    ),
    orientationMode: part.fixedGrain ? "fixed" : "free",
    ...(part.hardware?.length ? { hardware: part.hardware } : {}),
    ...(part.group ? { group: part.group } : {}),
  }));
}

// Отдаём детали калькулятору распила тем же путём, что страница проекта
// Базиса: черновик калькулятора и плита из каталога.
function sendToCalculator(
  parts: CabinetPart[],
  decor: ConstructorDecor | undefined,
) {
  const saved = window.localStorage.getItem(CALCULATOR_DRAFT_KEY);
  let contact: unknown = {};
  try {
    contact = saved
      ? ((JSON.parse(saved) as { contact?: unknown }).contact ?? {})
      : {};
  } catch {
    contact = {};
  }
  window.localStorage.setItem(
    CALCULATOR_DRAFT_KEY,
    JSON.stringify({
      details: partsToDraftRows(parts),
      contact,
      savedAt: new Date().toISOString(),
    }),
  );
  if (decor) {
    window.localStorage.setItem(CALCULATOR_PRESET_HANDOFF_KEY, decor.id);
  } else {
    window.localStorage.removeItem(CALCULATOR_PRESET_HANDOFF_KEY);
  }
  window.location.assign("/calculator#cut-calculator");
}

export function FurnitureConstructor({
  decors,
}: {
  decors: ConstructorDecor[];
}) {
  const [spec, setSpec] = useState<CabinetSpec>({
    kind: "wardrobe",
    ...CABINET_KINDS.wardrobe.defaults,
  });
  const defaultDecor =
    decors.find((decor) => /бел/i.test(decor.name) && decor.thickness === 16) ??
    decors.find((decor) => decor.thickness === 16) ??
    decors[0];
  const [bodyId, setBodyId] = useState(defaultDecor?.id ?? "");
  const [facadeId, setFacadeId] = useState(defaultDecor?.id ?? "");
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [error, setError] = useState("");

  const bodyDecor = decors.find((decor) => decor.id === bodyId);
  const facadeDecor =
    decors.find((decor) => decor.id === facadeId) ?? bodyDecor;
  const sameDecor = !facadeDecor || facadeDecor.id === bodyDecor?.id;
  const thickness = bodyDecor?.thickness ?? 16;

  const result = useMemo(
    () => buildCabinet(spec, thickness),
    [spec, thickness],
  );
  const boxes = useMemo(
    () =>
      buildCabinetModel(spec, thickness, result, {
        doorsOpen,
        bodyMaterial: bodyDecor?.label ?? `ЛДСП ${thickness} мм`,
        facadeMaterial: facadeDecor?.label ?? `ЛДСП ${thickness} мм`,
      }),
    [spec, thickness, result, doorsOpen, bodyDecor, facadeDecor],
  );
  const toneColors = useMemo(() => {
    const colors: number[][] = [];
    colors[TONE_BODY] = decorColor(bodyDecor);
    colors[TONE_FACADE] = decorColor(facadeDecor);
    colors[TONE_BACK] = BACK_COLOR;
    return colors;
  }, [bodyDecor, facadeDecor]);
  const fittings = useMemo(() => countCabinetFittings(result), [result]);
  const holes = result.parts.reduce(
    (sum, part) =>
      sum +
      hardwareHoles(part.hardware, part.length, part.width, thickness).length *
        part.quantity,
    0,
  );
  const partCount = result.parts.reduce((sum, part) => sum + part.quantity, 0);

  const set = (patch: Partial<CabinetSpec>) =>
    setSpec((current) => ({ ...current, ...patch }));

  const isDoor = (part: CabinetPart) => /: дверь/.test(part.title);
  const send = (which: "all" | "body" | "facade") => {
    const label = cabinetGroupLabel(spec);
    const backNote = result.back
      ? `${spec.name || "Корпус"}, задняя стенка: ХДФ ${sizeFormatter.format(result.back.length)} × ${sizeFormatter.format(result.back.width)} мм, 1 шт. (накладная, отдельный материал).`
      : "";
    const fittingsNote = fittings.length
      ? `Фурнитура: ${fittings.map((item) => `${item.label.toLowerCase()} — ${item.count} шт.`).join(", ")}.`
      : "";
    const facadeNote =
      which === "body" && facadeDecor
        ? `Фасады — отдельный декор: ${facadeDecor.label}.`
        : "";
    const group = {
      id: `constructor-${Math.random().toString(36).slice(2, 9)}`,
      label: which === "facade" ? `${label}, фасады` : label,
      note: [
        which === "facade" ? "" : backNote,
        facadeNote,
        which === "facade" ? "" : fittingsNote,
      ]
        .filter(Boolean)
        .join(" "),
    };
    const parts = result.parts
      .filter((part) =>
        which === "all"
          ? true
          : which === "facade"
            ? isDoor(part)
            : !isDoor(part),
      )
      .map((part) => ({ ...part, group }));
    try {
      sendToCalculator(parts, which === "facade" ? facadeDecor : bodyDecor);
    } catch {
      setError(
        "Браузер не дал передать детали в калькулятор. Разрешите сохранение данных сайта или откройте страницу в другом браузере.",
      );
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]">
      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[var(--surface-strong)]">
          <BazisViewer
            boxes={boxes}
            toneColors={toneColors}
            heightClassName="h-[56vh] min-h-80 lg:h-[72vh]"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDoorsOpen((current) => !current)}
            disabled={spec.doors === 0}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[color:var(--line)] px-4 text-[13px] font-medium disabled:opacity-40"
          >
            {doorsOpen ? (
              <DoorClosed className="size-4" />
            ) : (
              <DoorOpen className="size-4" />
            )}
            {doorsOpen ? "Закрыть двери" : "Открыть двери"}
          </button>
        </div>
      </div>

      <div className="grid min-w-0 content-start gap-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CABINET_KINDS) as CabinetKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setSpec({ kind, ...CABINET_KINDS[kind].defaults })}
              className={cn(
                "rounded-full border px-4 py-2 text-[14px]",
                spec.kind === kind
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
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

        {decors.length > 0 ? (
          <>
            <DecorPicker
              title="Декор корпуса"
              decors={decors}
              value={bodyId}
              onChange={(id) => {
                if (sameDecor) setFacadeId(id);
                setBodyId(id);
              }}
            />
            {spec.doors > 0 ? (
              <DecorPicker
                title="Декор фасадов (дверей)"
                decors={decors.filter((decor) => decor.thickness === thickness)}
                value={facadeDecor?.id ?? ""}
                onChange={setFacadeId}
              />
            ) : null}
          </>
        ) : null}

        {result.problems.length > 0 ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {result.problems.join(" ")}
          </p>
        ) : null}

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            {
              label: "Габариты",
              value: `${spec.width}×${spec.height}×${spec.depth}`,
            },
            { label: "Деталей", value: String(partCount) },
            { label: "Отверстий", value: String(holes) },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[color:var(--line)] p-3"
            >
              <p className="text-[11px] text-[var(--muted)]">{item.label}</p>
              <p className="mt-1 text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>

        <details
          className="rounded-xl border border-[color:var(--line)] p-3"
          open
        >
          <summary className="cursor-pointer text-sm font-semibold">
            Детали
          </summary>
          <table className="mt-2 w-full text-[13px]">
            <thead className="text-left text-[11px] text-[var(--muted)]">
              <tr>
                <th className="py-1 font-normal">Деталь</th>
                <th className="py-1 font-normal">Размер, мм</th>
                <th className="py-1 text-right font-normal">Шт.</th>
              </tr>
            </thead>
            <tbody>
              {result.parts.map((part) => (
                <tr
                  key={part.title}
                  className="border-t border-[color:var(--line)]"
                >
                  <td className="py-1.5 pr-2">
                    {part.title.replace(/^[^:]*: /, "")}
                    {isDoor(part) && !sameDecor ? (
                      <span className="text-[var(--muted)]"> · фасад</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 whitespace-nowrap tabular-nums">
                    {sizeFormatter.format(part.length)} ×{" "}
                    {sizeFormatter.format(part.width)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {part.quantity}
                  </td>
                </tr>
              ))}
              {result.back ? (
                <tr className="border-t border-[color:var(--line)] text-[var(--muted)]">
                  <td className="py-1.5 pr-2">задняя стенка, ХДФ</td>
                  <td className="py-1.5 whitespace-nowrap tabular-nums">
                    {sizeFormatter.format(result.back.length)} ×{" "}
                    {sizeFormatter.format(result.back.width)}
                  </td>
                  <td className="py-1.5 text-right">1</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
            Кромка по переднему торцу корпуса и полок, двери по кругу. Присадка
            уже стоит: минификсы, полкодержатели, петли и планки петель.
          </p>
        </details>

        {fittings.length > 0 ? (
          <div className="rounded-xl border border-[color:var(--line)] p-3">
            <p className="text-sm font-semibold">Фурнитура на этот корпус</p>
            <ul className="mt-2 grid gap-1 text-[13px]">
              {fittings.map((item) => (
                <li key={item.key} className="flex justify-between gap-3">
                  <span>{item.label}</span>
                  <span className="tabular-nums">{item.count} шт.</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
              Скоро здесь можно будет выбрать фурнитуру из каталога и сразу
              положить в корзину. Пока список уйдёт менеджеру вместе с заявкой.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="grid gap-2 rounded-2xl bg-[var(--surface-strong)] p-4">
          {sameDecor ? (
            <button
              type="button"
              disabled={result.problems.length > 0}
              onClick={() => send("all")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-[15px] font-semibold text-[var(--accent-ink)] disabled:opacity-40"
            >
              <Scissors className="size-4" />
              Отправить в распил
            </button>
          ) : (
            <>
              <p className="text-[13px] leading-5 text-[var(--muted)]">
                Корпус и фасады из разных декоров — это две заявки на распил.
                Отправьте сначала корпус, потом вернитесь сюда за фасадами.
              </p>
              <button
                type="button"
                disabled={result.problems.length > 0}
                onClick={() => send("body")}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-[15px] font-semibold text-[var(--accent-ink)] disabled:opacity-40"
              >
                <Scissors className="size-4" />
                Корпус в распил
              </button>
              <button
                type="button"
                disabled={result.problems.length > 0}
                onClick={() => send("facade")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--line-strong)] px-6 text-[14px] font-semibold disabled:opacity-40"
              >
                Фасады в распил
              </button>
            </>
          )}
          <p className="text-[12px] leading-5 text-[var(--muted)]">
            Детали откроются в калькуляторе распила: там будет карта раскроя,
            цена и кнопка заявки. Список, который был в калькуляторе, заменится.
          </p>
        </div>
      </div>
    </div>
  );
}
