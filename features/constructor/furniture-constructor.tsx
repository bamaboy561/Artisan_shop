"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  DoorOpen,
  DoorClosed,
  ListOrdered,
  Scissors,
  Search,
  Tag,
} from "lucide-react";

import { guessDecorColor } from "@/features/bazis/decor-color";
import {
  CALCULATOR_DRAFT_KEY,
  CALCULATOR_PRESET_HANDOFF_KEY,
} from "@/features/bazis/project-view";
import {
  CABINET_JOINTS,
  CABINET_KINDS,
  CABINET_LEDS,
  buildCabinet,
  cabinetGroupLabel,
  type CabinetJoint,
  type CabinetKind,
  type CabinetLed,
  type CabinetPart,
  type CabinetSpec,
} from "@/features/services/cabinet-builder";
import { Field, inputClass } from "@/features/services/cabinet-builder-dialog";

import { hardwareHoles } from "@/features/services/drilling-hardware";
import { cn } from "@/lib/utils";
import type {
  ConstructorDecor,
  ConstructorFittingProduct,
} from "@/lib/server/constructor-decors";

import { cabinetAssembly, cabinetFittings, partKind } from "./assembly";
import {
  AssemblyStepCard,
  FittingsPanel,
  instructionHtml,
} from "./assembly-panel";
import {
  buildCabinetModel,
  edgeDescription,
  TONE_BACK,
  TONE_BODY,
  TONE_FACADE,
  TONE_LED,
} from "./cabinet-model";
import type { FurnitureSceneApi, SceneTone } from "./furniture-scene";

// three.js тяжёлый: грузим только на странице конструктора и без SSR.
const FurnitureScene = dynamic(
  () => import("./furniture-scene").then((module) => module.FurnitureScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
        Загружаем 3D…
      </div>
    ),
  },
);

const DOOR_ANIMATION_MS = 700;
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

// Пазы деталей конструктора всегда вдоль переднего (лицевого) торца.
function grooveNote(part: CabinetPart) {
  return (part.milling?.grooves ?? [])
    .map(
      (groove) =>
        `паз ${groove.width}×${groove.depth} в ${groove.indent} мм от лицевого торца`,
    )
    .join(", ");
}

// Подпись детали с большой буквы: «Боковина левая», «Дно».
export function partLabel(title: string) {
  const kind = partKind(title);
  return kind.charAt(0).toUpperCase() + kind.slice(1);
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
    ...(part.milling ? { milling: part.milling } : {}),
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
  fittingProducts,
}: {
  decors: ConstructorDecor[];
  fittingProducts: ConstructorFittingProduct[];
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
  // Насколько открыты двери сейчас: плавно идёт к doorsOpen.
  const [doorOpen, setDoorOpen] = useState(0);
  const doorFrame = useRef(0);
  const doorOpenNow = useRef(0);
  useEffect(() => {
    const target = doorsOpen ? 1 : 0;
    const startedAt = performance.now();
    const from = doorOpenNow.current;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / DOOR_ANIMATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      doorOpenNow.current = from + (target - from) * eased;
      setDoorOpen(doorOpenNow.current);
      if (progress < 1) doorFrame.current = requestAnimationFrame(tick);
    };
    doorFrame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(doorFrame.current);
  }, [doorsOpen]);
  const [error, setError] = useState("");

  const bodyDecor = decors.find((decor) => decor.id === bodyId);
  const facadeDecor =
    decors.find((decor) => decor.id === facadeId) ?? bodyDecor;
  // Без дверей фасадов нет: всё уходит одной заявкой.
  const sameDecor =
    spec.doors === 0 || !facadeDecor || facadeDecor.id === bodyDecor?.id;
  const thickness = bodyDecor?.thickness ?? 16;

  const result = useMemo(
    () => buildCabinet(spec, thickness),
    [spec, thickness],
  );
  const boxes = useMemo(
    () =>
      buildCabinetModel(spec, thickness, result, {
        doorOpen,
        bodyMaterial: bodyDecor?.label ?? `ЛДСП ${thickness} мм`,
        facadeMaterial: facadeDecor?.label ?? `ЛДСП ${thickness} мм`,
      }),
    [spec, thickness, result, doorOpen, bodyDecor, facadeDecor],
  );
  const tones = useMemo(() => {
    const list: SceneTone[] = [];
    list[TONE_BODY] = {
      color: decorColor(bodyDecor),
      imageUrl: bodyDecor?.imageUrl,
    };
    list[TONE_FACADE] = {
      color: decorColor(facadeDecor),
      imageUrl: facadeDecor?.imageUrl,
    };
    list[TONE_BACK] = { color: BACK_COLOR };
    list[TONE_LED] = { color: [255, 190, 80], glow: true };
    return list;
  }, [bodyDecor, facadeDecor]);
  const fittings = useMemo(
    () => cabinetFittings(spec, result, thickness),
    [spec, result, thickness],
  );
  const steps = useMemo(
    () => cabinetAssembly(spec, result, fittings),
    [spec, result, fittings],
  );
  // Шаг инструкции сборки; null — обычный просмотр.
  const [step, setStep] = useState<number | null>(null);
  const [labels, setLabels] = useState(true);
  const sceneApi = useRef<FurnitureSceneApi | null>(null);
  const currentStep = step !== null ? steps[step] : null;
  const stepView = useMemo(() => {
    if (!currentStep) return { boxes, highlight: undefined };
    const shown = boxes.filter((box) =>
      currentStep.shown.includes(partKind(box.info?.name ?? "")),
    );
    return {
      boxes: shown,
      highlight: shown.map((box) =>
        currentStep.added.includes(partKind(box.info?.name ?? "")),
      ),
    };
  }, [boxes, currentStep]);
  const goToStep = (next: number | null) => {
    setStep(next);
    const target = next !== null ? steps[next] : null;
    setDoorsOpen(Boolean(target?.doorsOpen));
  };
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
      ? `Фурнитура: ${fittings.map((item) => `${item.label.toLowerCase()} ${item.note} — ${item.count} шт.`).join(", ")}.`
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
      if (parts.length === 0) return;
      sendToCalculator(parts, which === "facade" ? facadeDecor : bodyDecor);
    } catch {
      setError(
        "Браузер не дал передать детали в калькулятор. Разрешите сохранение данных сайта или откройте страницу в другом браузере.",
      );
    }
  };

  // Печатная инструкция: проходим шаги, снимаем макет и открываем
  // страницу для печати. Вкладку открываем сразу по нажатию, иначе
  // браузер её заблокирует.
  const [printing, setPrinting] = useState(false);
  const printInstruction = async () => {
    const tab = window.open("", "_blank");
    if (!tab) {
      setError("Браузер не дал открыть вкладку. Разрешите всплывающие окна.");
      return;
    }
    tab.document.write(
      "<p style='font-family:sans-serif'>Готовим инструкцию…</p>",
    );
    setPrinting(true);
    const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
    const images: Array<string | null> = [];
    const before = step;
    for (let index = 0; index < steps.length; index += 1) {
      goToStep(index);
      await wait(steps[index].doorsOpen ? 900 : 350);
      images.push(sceneApi.current?.snapshot() ?? null);
    }
    goToStep(before);
    setPrinting(false);
    const html = instructionHtml({
      title: cabinetGroupLabel(spec),
      subtitle: [
        `Корпус: ${bodyDecor?.label ?? `ЛДСП ${thickness} мм`}`,
        spec.doors > 0 && facadeDecor && !sameDecor
          ? `Фасады: ${facadeDecor.label}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      steps,
      images,
      fittings,
      parts: [
        ...result.parts.map((part) => ({
          name: partLabel(part.title),
          size: `${sizeFormatter.format(part.length)} × ${sizeFormatter.format(part.width)} мм, кромка: ${edgeDescription(part.edgedSides)}${part.milling ? `, ${grooveNote(part)}` : ""}`,
          count: part.quantity,
        })),
        ...(result.back
          ? [
              {
                name: "Задняя стенка (ХДФ)",
                size: `${sizeFormatter.format(result.back.length)} × ${sizeFormatter.format(result.back.width)} мм`,
                count: 1,
              },
            ]
          : []),
      ],
    });
    tab.document.open();
    tab.document.write(html);
    tab.document.close();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]">
      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[var(--surface-strong)]">
          <FurnitureScene
            boxes={stepView.boxes}
            highlight={stepView.highlight}
            labels={labels}
            apiRef={sceneApi}
            hint={
              printing
                ? "Готовим картинки шагов…"
                : "Крутите пальцем или мышью · нажмите на деталь"
            }
            tones={tones}
            handleTone={TONE_FACADE}
            handlePlacement={
              spec.kind === "wall"
                ? "bottom"
                : spec.kind === "base"
                  ? "top"
                  : "middle"
            }
            className="h-[56vh] min-h-80 lg:h-[72vh]"
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
          <button
            type="button"
            onClick={() => setLabels((current) => !current)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[13px] font-medium",
              labels
                ? "border-[var(--foreground)]"
                : "border-[color:var(--line)]",
            )}
          >
            <Tag className="size-4" />
            {labels ? "Скрыть подписи" : "Подписи деталей"}
          </button>
          {step === null ? (
            <button
              type="button"
              onClick={() => goToStep(0)}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--accent-ink)]"
            >
              <ListOrdered className="size-4" />
              Инструкция по сборке
            </button>
          ) : null}
        </div>
        {step !== null ? (
          <div className="mt-3">
            <AssemblyStepCard
              steps={steps}
              step={Math.min(step, steps.length - 1)}
              onStep={goToStep}
              onClose={() => goToStep(null)}
              onPrint={() => void printInstruction()}
            />
          </div>
        ) : null}
      </div>

      <div className="grid min-w-0 content-start gap-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CABINET_KINDS) as CabinetKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() =>
                setSpec((current) => ({
                  kind,
                  ...CABINET_KINDS[kind].defaults,
                  joint: current.joint,
                  led: current.led,
                }))
              }
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
        <label className="grid gap-1 text-[12px] text-[var(--muted)]">
          Соединение корпуса
          <select
            className={inputClass}
            value={spec.joint ?? "minifix"}
            onChange={(event) =>
              set({ joint: event.target.value as CabinetJoint })
            }
          >
            {(Object.keys(CABINET_JOINTS) as CabinetJoint[]).map((joint) => (
              <option key={joint} value={joint}>
                {CABINET_JOINTS[joint].label}
              </option>
            ))}
          </select>
          <span className="text-[11px] leading-4">
            {CABINET_JOINTS[spec.joint ?? "minifix"].hint}
          </span>
        </label>
        <label className="grid gap-1 text-[12px] text-[var(--muted)]">
          Подсветка (паз под LED-профиль 10×10)
          <select
            className={inputClass}
            value={spec.led ?? "none"}
            onChange={(event) => set({ led: event.target.value as CabinetLed })}
          >
            {(Object.keys(CABINET_LEDS) as CabinetLed[]).map((led) => (
              <option key={led} value={led}>
                {CABINET_LEDS[led].label}
              </option>
            ))}
          </select>
          {CABINET_LEDS[spec.led ?? "none"].hint ? (
            <span className="text-[11px] leading-4">
              {CABINET_LEDS[spec.led ?? "none"].hint}
            </span>
          ) : null}
        </label>

        {decors.length > 0 ? (
          <>
            <DecorPicker
              title="Декор корпуса"
              decors={decors}
              value={bodyId}
              onChange={(id) => {
                // Фасады режем из плиты той же толщины, что и корпус:
                // другая толщина сбрасывается на декор корпуса.
                const next = decors.find((decor) => decor.id === id);
                if (sameDecor || facadeDecor?.thickness !== next?.thickness) {
                  setFacadeId(id);
                }
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
                <th className="py-1 font-normal">Кромка</th>
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
                    {partLabel(part.title)}
                    {isDoor(part) && !sameDecor ? (
                      <span className="text-[var(--muted)]"> · фасад</span>
                    ) : null}
                    {part.milling ? (
                      <span className="block text-[11px] text-[var(--muted)]">
                        {grooveNote(part)}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 whitespace-nowrap tabular-nums">
                    {sizeFormatter.format(part.length)} ×{" "}
                    {sizeFormatter.format(part.width)}
                  </td>
                  <td className="py-1.5 pr-2 text-[12px] leading-4">
                    {edgeDescription(part.edgedSides)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {part.quantity}
                  </td>
                </tr>
              ))}
              {result.back ? (
                <tr className="border-t border-[color:var(--line)] text-[var(--muted)]">
                  <td className="py-1.5 pr-2">Задняя стенка, ХДФ</td>
                  <td className="py-1.5 whitespace-nowrap tabular-nums">
                    {sizeFormatter.format(result.back.length)} ×{" "}
                    {sizeFormatter.format(result.back.width)}
                  </td>
                  <td className="py-1.5 pr-2 text-[12px]">без кромки</td>
                  <td className="py-1.5 text-right">1</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
            Размер: длина (вдоль текстуры) × ширина. Кромка уже стоит в раскрое.
            Присадка тоже готова: крепёж корпуса, евровинты цоколя,
            полкодержатели, петли и планки петель. Пазы под подсветку уходят в
            программу станка фрезеровкой.
          </p>
        </details>

        {fittings.length > 0 ? (
          <FittingsPanel lines={fittings} products={fittingProducts} />
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
