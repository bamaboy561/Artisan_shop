"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  DoorOpen,
  DoorClosed,
  Plus,
  X,
  ListOrdered,
  Scissors,
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
  KUPE_DOOR_FLOOR_GAP,
  KUPE_DOOR_OVER_ROOF,
  KUPE_PLINTH_SETBACK,
  KUPE_OVERLAP,
  buildCabinet,
  kupeDoorCount,
  kupeSchemeSections,
  kupeSections,
  slideKupeDoor,
  KUPE_SCHEMES,
  KUPE_SECTION_TEMPLATES,
  ZONE_KINDS,
  cabinetGroupLabel,
  type CabinetJoint,
  type CabinetKind,
  type CabinetLed,
  type CabinetPart,
  type CabinetSpec,
  type KupeSection,
  type KupeZone,
  type ZoneKind,
} from "@/features/services/cabinet-builder";
import { Field, inputClass } from "@/features/services/number-field";
import type {
  ConstructorDecor,
  ConstructorFittingProduct,
} from "@/lib/server/constructor-decors";

import { cabinetAssembly, cabinetFittings, partKind } from "./assembly";
import {
  EstimateRows,
  More,
  OptionList,
  PriceBar,
  QuickSizes,
  Segmented,
  SizeField,
  StepHead,
  StepNav,
  Stepper,
  plural,
  primaryButton,
  secondaryButton,
} from "./constructor-shell";
import styles from "./constructor.module.css";
import { DecorStep } from "./decor-grid";
import { formatSom } from "./estimate";
import { useEstimate } from "./use-estimate";
import { HardwarePicker } from "./hardware-picker";
import {
  AssemblyStepCard,
  FittingsPanel,
  instructionHtml,
  matchFittings,
} from "./assembly-panel";
import {
  buildCabinetModel,
  edgeDescription,
  TONE_BACK,
  TONE_BODY,
  TONE_FACADE,
  TONE_LED,
  TONE_PLAIN,
  TONE_ROD,
  TONE_SLIDING,
} from "./cabinet-model";
import type { FurnitureSceneApi, SceneTone } from "./furniture-scene";

// three.js тяжёлый: грузим только на странице конструктора и без SSR.
export const FurnitureScene = dynamic(
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

export const DOOR_ANIMATION_MS = 700;
const FALLBACK_COLOR = [214, 206, 192];
export const BACK_COLOR = [198, 170, 132];
export const sizeFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 1,
});

export function decorColor(decor: ConstructorDecor | undefined) {
  return (decor && guessDecorColor(decor.name)) ?? FALLBACK_COLOR;
}

// Пазы деталей конструктора всегда вдоль переднего (лицевого) торца.
export function grooveNote(part: CabinetPart) {
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
export function sendToCalculator(
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

// Фасады: двери и фасады ящиков — из декора фасадов.
const isDoor = (part: CabinetPart) => /: (дверь|фасад ящика)/.test(part.title);

const WIZARD_STEPS = [
  "size",
  "inside",
  "decor",
  "hardware",
  "summary",
] as const;
type WizardStep = (typeof WIZARD_STEPS)[number];
const WIZARD_LABELS: Record<WizardStep, string> = {
  size: "Размер",
  inside: "Внутри",
  decor: "Цвет",
  hardware: "Фурнитура",
  summary: "Итог",
};

// Ходовые размеры кнопками: чаще всего человек выбирает из них.
const QUICK_SIZES: Record<
  CabinetKind,
  { width: number[]; height: number[]; depth: number[] }
> = {
  wardrobe: {
    width: [400, 600, 800, 1000, 1200],
    height: [1800, 2000, 2100, 2400],
    depth: [450, 580, 600],
  },
  kupe: {
    width: [1200, 1500, 1800, 2000, 2400],
    height: [2200, 2400, 2600],
    depth: [450, 600],
  },
  base: {
    width: [300, 400, 450, 600, 800],
    height: [720, 820, 900],
    depth: [450, 560],
  },
  wall: {
    width: [300, 400, 600, 800],
    height: [360, 720, 900],
    depth: [300, 350],
  },
};

export function FurnitureConstructor({
  decors,
  fittingProducts,
  kind,
  onKindChange,
}: {
  decors: ConstructorDecor[];
  fittingProducts: ConstructorFittingProduct[];
  // С чего начинаем: шкаф с распашными дверями или купе. Дальше человек
  // меняет это на первом шаге.
  kind: CabinetKind;
  onKindChange?: (kind: CabinetKind) => void;
}) {
  const [spec, setSpec] = useState<CabinetSpec>({
    kind,
    ...CABINET_KINDS[kind].defaults,
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
  // Без дверей и ящиков фасадов нет: всё уходит одной заявкой.
  const isKupe = spec.kind === "kupe";
  const hasFronts =
    isKupe ||
    spec.doors > 0 ||
    (spec.kind !== "wall" && (spec.drawers ?? 0) > 0);
  const sameDecor =
    !hasFronts || !facadeDecor || facadeDecor.id === bodyDecor?.id;
  const thickness = bodyDecor?.thickness ?? 16;

  const result = useMemo(
    () => buildCabinet(spec, thickness),
    [spec, thickness],
  );

  // Открытый шаг инструкции по сборке.
  const [step, setStep] = useState<number | null>(null);

  // Двери-купе: каждая сдвигается по нажатию на неё, кнопка «Открыть
  // двери» сдвигает передние. Сдвиги сбрасываются, если поменялись
  // число или ширина дверей.
  const kupeDoors = result.kupe?.doors;
  const kupeKey = kupeDoors ? `${kupeDoors.count}:${kupeDoors.width}` : "";
  const [kupeState, setKupeState] = useState({
    key: "",
    shifts: [] as number[],
  });
  const kupeTarget = useMemo(
    () =>
      kupeState.key === kupeKey
        ? kupeState.shifts
        : Array.from({ length: kupeDoors?.count ?? 0 }, () => 0),
    [kupeState, kupeKey, kupeDoors?.count],
  );
  const [kupeShown, setKupeShown] = useState<number[]>([]);
  const kupeShownNow = useRef<{ key: string; shifts: number[] }>({
    key: "",
    shifts: [],
  });
  const kupeFrame = useRef(0);
  useEffect(() => {
    const from =
      kupeShownNow.current.key === kupeKey
        ? kupeShownNow.current.shifts
        : kupeTarget;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / DOOR_ANIMATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      const shifts = kupeTarget.map(
        (target, index) =>
          (from[index] ?? 0) + (target - (from[index] ?? 0)) * eased,
      );
      kupeShownNow.current = { key: kupeKey, shifts };
      setKupeShown(shifts);
      if (progress < 1) kupeFrame.current = requestAnimationFrame(tick);
    };
    kupeFrame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(kupeFrame.current);
  }, [kupeTarget, kupeKey]);
  const kupeOpen = kupeTarget.some((shift) => shift !== 0);
  const slideDoor = (index: number) => {
    if (!kupeDoors) return;
    setKupeState({
      key: kupeKey,
      shifts: slideKupeDoor(kupeDoors, kupeTarget, index),
    });
  };
  const toggleKupeDoors = () => {
    if (!kupeDoors) return;
    let shifts = kupeTarget.map(() => 0);
    if (!kupeOpen) {
      for (let index = 1; index < kupeDoors.count; index += 2) {
        shifts = slideKupeDoor(kupeDoors, shifts, index);
      }
    }
    setKupeState({ key: kupeKey, shifts });
  };
  const boxes = useMemo(
    () =>
      buildCabinetModel(spec, thickness, result, {
        doorOpen,
        // В шагах сборки двери-купе открываются кнопкой шага.
        kupeShift:
          isKupe && step === null && kupeShown.length === kupeDoors?.count
            ? kupeShown
            : undefined,
        bodyMaterial: bodyDecor?.label ?? `ЛДСП ${thickness} мм`,
        facadeMaterial: facadeDecor?.label ?? `ЛДСП ${thickness} мм`,
      }),
    [
      spec,
      thickness,
      result,
      doorOpen,
      isKupe,
      step,
      kupeShown,
      kupeDoors?.count,
      bodyDecor,
      facadeDecor,
    ],
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
    list[TONE_SLIDING] = list[TONE_FACADE];
    list[TONE_ROD] = { color: [200, 202, 206], metal: true };
    list[TONE_PLAIN] = list[TONE_FACADE];
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
  const shownOpen = isKupe && step === null ? kupeOpen : doorsOpen;
  // Нажатие на дверь-купе в макете сдвигает её. Двери-купе — детали
  // TONE_SLIDING, по порядку слева направо.
  const clickBox = (index: number) => {
    const box = stepView.boxes[index];
    if (box?.tone !== TONE_SLIDING) return;
    const door = stepView.boxes
      .slice(0, index)
      .filter((item) => item.tone === TONE_SLIDING).length;
    slideDoor(door);
  };
  const goToStep = (next: number | null) => {
    setStep(next);
    const target = next !== null ? steps[next] : null;
    setDoorsOpen(Boolean(target?.doorsOpen));
  };
  const partCount = result.parts.reduce((sum, part) => sum + part.quantity, 0);
  const set = (patch: Partial<CabinetSpec>) =>
    setSpec((current) => ({ ...current, ...patch }));
  const sections = kupeSections(spec);
  const setSection = (index: number, patch: Partial<KupeSection>) =>
    set({
      sections: sections.map((section, at) =>
        at === index ? { ...section, ...patch } : section,
      ),
    });

  // Днища ящиков ХДФ: у купе — по секциям, они могут быть разной ширины.
  const drawerBottoms = result.drawers?.slide
    ? (result.drawers.bottoms ?? [
        { ...result.drawers.bottom, count: result.drawers.count },
      ])
    : [];
  const send = (which: "all" | "body" | "facade") => {
    const label = cabinetGroupLabel(spec);
    const backNote = result.back
      ? `${spec.name || "Корпус"}, задняя стенка: ХДФ ${sizeFormatter.format(result.back.length)} × ${sizeFormatter.format(result.back.width)} мм, 1 шт. (накладная, отдельный материал).`
      : "";
    const drawerNote = drawerBottoms.length
      ? `Дно ящиков: ХДФ ${drawerBottoms.map((bottom) => `${sizeFormatter.format(bottom.length)} × ${sizeFormatter.format(bottom.width)} мм, ${bottom.count} шт.`).join("; ")}`
      : "";
    const fittingsNote = fittings.length
      ? `Фурнитура: ${fittings.map((item) => `${item.label.toLowerCase()} ${item.note} — ${item.count} ${item.unit ?? "шт."}`).join(", ")}.`
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
        which === "facade" ? "" : drawerNote,
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
        hasFronts && facadeDecor && !sameDecor
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
        ...drawerBottoms.map((bottom) => ({
          name: "Дно ящика (ХДФ)",
          size: `${sizeFormatter.format(bottom.length)} × ${sizeFormatter.format(bottom.width)} мм`,
          count: bottom.count,
        })),
      ],
    });
    tab.document.open();
    tab.document.write(html);
    tab.document.close();
  };

  // Шаги для человека: один на экране, цена всегда внизу.
  const wizard = WIZARD_STEPS.filter((id) => id !== "decor" || decors.length);
  const [view, setView] = useState(0);
  const viewId = wizard[Math.min(view, wizard.length - 1)];
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const go = (index: number) => {
    const next = Math.max(0, Math.min(wizard.length - 1, index));
    const nextId = wizard[next];
    setView(next);
    if (step !== null) goToStep(null);
    // На шаге «Внутри» двери открыты: видно полки и ящики.
    if (isKupe) {
      if ((nextId === "inside") !== kupeOpen) toggleKupeDoors();
    } else {
      setDoorsOpen(nextId === "inside" && hasFronts);
    }
    bodyRef.current?.scrollTo({ top: 0 });
    // На телефоне шаг под макетом: возвращаемся к макету и началу шага.
    if (window.innerWidth < 1024) {
      layoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const estimate = useEstimate({
    parts: result.parts,
    isFacade: isDoor,
    thickness,
    bodyDecor,
    facadeDecor,
    sameDecor,
  });
  const fittingsCost = useMemo(
    () => matchFittings(fittings, fittingProducts).total,
    [fittings, fittingProducts],
  );
  const total = estimate ? estimate.total + fittingsCost : null;
  const sheetsText = estimate
    ? plural(estimate.sheets, ["лист", "листа", "листов"])
    : "";
  const partsText = plural(partCount, ["деталь", "детали", "деталей"]);

  const quick = QUICK_SIZES[spec.kind];
  const plinths = [0, 70, 100].includes(spec.plinth)
    ? [0, 70, 100]
    : [0, 70, 100, spec.plinth].sort((a, b) => a - b);
  const [scheme, setScheme] = useState<number | null>(null);
  // Распашные двери или купе: это разные шкафы, размеры и наполнение
  // берём по умолчанию для выбранного.
  const switchKind = (next: CabinetKind) => {
    if (next === spec.kind) return;
    setSpec({ kind: next, ...CABINET_KINDS[next].defaults });
    setScheme(null);
    setDoorsOpen(false);
    onKindChange?.(next);
  };
  const blocked = result.problems.length > 0;

  const sizeStep = (
    <>
      <StepHead
        title="Размер"
        hint="В миллиметрах, снаружи. Остальное посчитаем сами."
      />
      {spec.kind === "wardrobe" || spec.kind === "kupe" ? (
        <Segmented
          label="Двери"
          value={spec.kind}
          options={[
            { value: "wardrobe", label: "Распашные" },
            { value: "kupe", label: "Купе" },
          ]}
          onChange={switchKind}
        />
      ) : null}
      <div className="grid gap-5">
        {(
          [
            ["width", "Ширина"],
            ["height", "Высота"],
            ["depth", "Глубина"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="grid gap-2">
            <SizeField
              label={label}
              value={spec[key]}
              min={100}
              onChange={(value) => set({ [key]: value })}
            />
            <QuickSizes
              values={quick[key]}
              value={spec[key]}
              onChange={(value) => set({ [key]: value })}
            />
          </div>
        ))}
      </div>
      {spec.kind !== "wall" ? (
        <Segmented
          label="Цоколь снизу"
          value={spec.plinth}
          options={plinths.map((value) => ({
            value,
            label: value ? `${value} мм` : "Без цоколя",
          }))}
          onChange={(plinth) => set({ plinth })}
        />
      ) : null}
    </>
  );

  const kupeEditor = (
    <div className="grid gap-2">
      <label className="grid gap-1 text-[12px] text-[var(--muted)]">
        Секций
        <select
          className={inputClass}
          value={sections.length}
          onChange={(event) => {
            const count = Number(event.target.value);
            setScheme(null);
            set({
              sections: Array.from(
                { length: count },
                (_, index) =>
                  sections[index] ?? {
                    zones: KUPE_SECTION_TEMPLATES[0].zones.map((zone) => ({
                      ...zone,
                    })),
                  },
              ),
            });
          }}
        >
          {[1, 2, 3, 4, 5].map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </label>
      {sections.map((section, index) => {
        const built = result.kupe?.sections[index];
        const zones = section.zones ?? [];
        const template = KUPE_SECTION_TEMPLATES.findIndex(
          (entry) => JSON.stringify(entry.zones) === JSON.stringify(zones),
        );
        const setZones = (next: KupeZone[]) => {
          setScheme(null);
          setSection(index, { zones: next });
        };
        const setZone = (at: number, patch: Partial<KupeZone>) =>
          setZones(
            zones.map((zone, place) =>
              place === at ? { ...zone, ...patch } : zone,
            ),
          );
        const moveZone = (at: number, by: number) => {
          const next = [...zones];
          const [zone] = next.splice(at, 1);
          next.splice(at + by, 0, zone);
          setZones(next);
        };
        return (
          <div
            key={index}
            className="grid gap-2 rounded-xl border border-[color:var(--line)] p-2"
          >
            <div className="grid grid-cols-3 items-end gap-2">
              <label className="col-span-2 grid gap-1 text-[12px] text-[var(--muted)]">
                Секция {index + 1}
                <select
                  className={inputClass}
                  value={template}
                  onChange={(event) => {
                    const entry =
                      KUPE_SECTION_TEMPLATES[Number(event.target.value)];
                    if (entry) {
                      setZones(entry.zones.map((zone) => ({ ...zone })));
                    }
                  }}
                >
                  <option value={-1}>Своё (зоны ниже)</option>
                  {KUPE_SECTION_TEMPLATES.map((entry, at) => (
                    <option key={entry.label} value={at}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label={`Ширина${section.width ? "" : ` (${Math.round(built?.width ?? 0)})`}`}
                value={section.width ?? 0}
                onChange={(width) => {
                  setScheme(null);
                  setSection(index, { width });
                }}
              />
            </div>
            {zones.map((zone, at) => {
              const limits = ZONE_KINDS[zone.kind].count;
              const placed = built?.zones[at];
              return (
                <div
                  key={at}
                  className="grid grid-cols-[1fr_4.5rem_4.5rem_auto] items-end gap-1.5"
                >
                  <label className="grid gap-1 text-[12px] text-[var(--muted)]">
                    {at + 1}.
                    <select
                      className={inputClass}
                      value={zone.kind}
                      onChange={(event) => {
                        const kind = event.target.value as ZoneKind;
                        setZone(at, {
                          kind,
                          count: ZONE_KINDS[kind].count?.default,
                          height: kind === "antresol" ? 400 : 0,
                        });
                      }}
                    >
                      {(Object.keys(ZONE_KINDS) as ZoneKind[]).map((kind) => (
                        <option key={kind} value={kind}>
                          {ZONE_KINDS[kind].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {limits ? (
                    <label className="grid gap-1 text-[12px] text-[var(--muted)]">
                      Шт.
                      <select
                        className={inputClass}
                        value={zone.count ?? limits.default}
                        onChange={(event) =>
                          setZone(at, { count: Number(event.target.value) })
                        }
                      >
                        {Array.from(
                          { length: limits.max - limits.min + 1 },
                          (_, offset) => limits.min + offset,
                        ).map((count) => (
                          <option key={count} value={count}>
                            {count}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span />
                  )}
                  <Field
                    label={`Выс.${zone.height ? "" : ` ${Math.round(placed?.height ?? 0)}`}`}
                    value={zone.height ?? 0}
                    onChange={(height) => setZone(at, { height })}
                  />
                  <div className="flex gap-0.5 pb-1">
                    <button
                      type="button"
                      aria-label="Выше"
                      disabled={at === 0}
                      onClick={() => moveZone(at, -1)}
                      className="grid size-7 place-items-center rounded-full border border-[color:var(--line)] disabled:opacity-30"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Ниже"
                      disabled={at === zones.length - 1}
                      onClick={() => moveZone(at, 1)}
                      className="grid size-7 place-items-center rounded-full border border-[color:var(--line)] disabled:opacity-30"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Убрать зону"
                      disabled={zones.length === 1}
                      onClick={() =>
                        setZones(zones.filter((_, place) => place !== at))
                      }
                      className="grid size-7 place-items-center rounded-full border border-[color:var(--line)] disabled:opacity-30"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {zones.length < 8 ? (
              <button
                type="button"
                onClick={() =>
                  setZones([...zones, { kind: "shelves", count: 1, height: 0 }])
                }
                className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full border border-[color:var(--line)] px-3 text-[12px] font-medium"
              >
                <Plus className="size-3.5" />
                Добавить зону
              </button>
            ) : null}
          </div>
        );
      })}
      <p className="text-[11px] leading-4 text-[var(--muted)]">
        Зоны сверху вниз, между зонами полка. Высота 0 — поровну. Ширина секции
        0 — секции делят остаток поровну.
      </p>
      <p className="text-[11px] leading-4 text-[var(--muted)]">
        Двери-купе Hettich TopLine L перед корпусом:{" "}
        {result.kupe
          ? `${sizeFormatter.format(result.kupe.doors.height)} × ${sizeFormatter.format(result.kupe.doors.width)} мм`
          : ""}
        , перехлёст {KUPE_OVERLAP} мм: верх на {KUPE_DOOR_OVER_ROOF} мм выше
        крыши, низ в {KUPE_DOOR_FLOOR_GAP} мм от пола, цоколь отступает на{" "}
        {KUPE_PLINTH_SETBACK} мм под нижнюю направляющую. Ящики с вкладными
        фасадами, направляющие {result.drawers?.slide || "—"} мм.
      </p>
    </div>
  );

  const insideStep = isKupe ? (
    <>
      <StepHead
        title="Что внутри"
        hint="Выберите готовую схему — шкаф перестроится сразу."
      />
      <Segmented
        label="Двери-купе"
        value={kupeDoorCount(spec)}
        options={[2, 3, 4].map((count) => ({
          value: count,
          label: String(count),
        }))}
        onChange={(count) =>
          set({ slidingDoors: count as 2 | 3 | 4, sections })
        }
      />
      <OptionList
        label="Готовые схемы"
        value={scheme}
        options={KUPE_SCHEMES.map((item, index) => ({
          value: index,
          label: item.label,
        }))}
        onChange={(index) => {
          setScheme(index);
          set({
            sections: kupeSchemeSections(
              KUPE_SCHEMES[index],
              spec.width,
              thickness,
            ),
          });
        }}
      />
      <More title="Настроить секции вручную">{kupeEditor}</More>
    </>
  ) : (
    <>
      <StepHead
        title="Что внутри"
        hint="Двери открыты, чтобы было видно полки и ящики."
      />
      <Segmented
        label="Двери"
        value={spec.doors}
        options={[
          { value: 0, label: "Без дверей" },
          { value: 1, label: "Одна" },
          { value: 2, label: "Две" },
        ]}
        onChange={(doors) => {
          set({ doors: doors as 0 | 1 | 2 });
          setDoorsOpen(doors > 0);
        }}
      />
      <div className="divide-y divide-[color:var(--line)]">
        <Stepper
          label="Полки"
          value={spec.shelves}
          min={0}
          max={12}
          onChange={(shelves) => set({ shelves })}
        />
        {spec.kind !== "wall" ? (
          <Stepper
            label="Ящики"
            value={spec.drawers ?? 0}
            min={0}
            max={5}
            hint={
              (spec.drawers ?? 0) > 0
                ? spec.kind === "base" && spec.doors === 0
                  ? "Фасады ящиков на всю высоту тумбы"
                  : "Внизу, фасады по 180 мм, над ними двери"
                : "Выдвижные, с направляющими"
            }
            onChange={(drawers) => set({ drawers })}
          />
        ) : null}
      </div>
      <More title="Подсветка">
        <OptionList
          label="Паз под LED-профиль 10×10"
          value={spec.led ?? "none"}
          options={(Object.keys(CABINET_LEDS) as CabinetLed[]).map((led) => ({
            value: led,
            label: CABINET_LEDS[led].label,
            hint: CABINET_LEDS[led].hint || undefined,
          }))}
          onChange={(led) => set({ led })}
        />
      </More>
    </>
  );

  const decorStep = (
    <DecorStep
      decors={decors}
      bodyId={bodyId}
      facadeId={facadeDecor?.id ?? ""}
      onBody={setBodyId}
      onFacade={setFacadeId}
      hasFronts={hasFronts}
    />
  );

  const hardwareStep = (
    <>
      <StepHead
        title="Фурнитура"
        hint="Уже подобрали надёжный вариант. Меняйте, только если хотите другой."
      />
      <OptionList
        label="Чем собирать корпус"
        value={spec.joint ?? "minifix"}
        options={(Object.keys(CABINET_JOINTS) as CabinetJoint[]).map(
          (joint) => ({
            value: joint,
            label: CABINET_JOINTS[joint].label,
            hint: CABINET_JOINTS[joint].hint,
          }),
        )}
        onChange={(joint) => set({ joint })}
      />
      <div className="grid gap-3">
        <HardwarePicker
          value={spec.hardware}
          onChange={(hardware) => set({ hardware })}
          drawers={Boolean(result.drawers)}
          hinges={spec.kind !== "kupe" && spec.doors > 0}
        />
      </div>
    </>
  );

  const partsTable = (
    <>
      <table className="w-full text-[13px]">
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
          {drawerBottoms.map((bottom, index) => (
            <tr
              key={`bottom-${index}`}
              className="border-t border-[color:var(--line)] text-[var(--muted)]"
            >
              <td className="py-1.5 pr-2">Дно ящика, ХДФ</td>
              <td className="py-1.5 whitespace-nowrap tabular-nums">
                {sizeFormatter.format(bottom.length)} ×{" "}
                {sizeFormatter.format(bottom.width)}
              </td>
              <td className="py-1.5 pr-2 text-[12px]">без кромки</td>
              <td className="py-1.5 text-right">{bottom.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[12px] leading-5 text-[var(--muted)]">
        Размер: длина (вдоль текстуры) × ширина. Кромка и присадка уже в
        раскрое: крепёж корпуса и ящиков, полкодержатели, петли и их планки.
      </p>
    </>
  );

  const summaryStep = (
    <>
      <StepHead title="Итог" hint={cabinetGroupLabel(spec)} />
      {estimate ? (
        <EstimateRows estimate={estimate} fittings={fittingsCost} />
      ) : null}
      <p className="text-[12px] leading-5 text-[var(--muted)]">
        Точную сумму покажет калькулятор распила: там карта раскроя и заявка.
        ХДФ для задней стенки и дна ящиков считается отдельно.
      </p>
      {!sameDecor ? (
        <div className="grid gap-2 rounded-xl bg-[var(--surface)] p-3">
          <p className="text-[13px] leading-5">
            Корпус и фасады разного цвета — это две заявки. Сначала отправьте
            корпус кнопкой внизу, потом вернитесь за фасадами.
          </p>
          <button
            type="button"
            disabled={blocked}
            onClick={() => send("facade")}
            className={secondaryButton}
          >
            Фасады в распил
          </button>
        </div>
      ) : null}
      <div>
        {fittings.length > 0 ? (
          <More title="Фурнитура в корзину">
            <FittingsPanel lines={fittings} products={fittingProducts} />
          </More>
        ) : null}
        <More title={`Детали, ${partsText}`}>{partsTable}</More>
        <div className="border-t border-[color:var(--line)] pt-3">
          <button
            type="button"
            onClick={() => goToStep(0)}
            className={secondaryButton}
          >
            <ListOrdered className="size-4" />
            Инструкция по сборке
          </button>
        </div>
      </div>
    </>
  );

  const stepContent =
    step !== null ? (
      <AssemblyStepCard
        steps={steps}
        step={Math.min(step, steps.length - 1)}
        onStep={goToStep}
        onClose={() => goToStep(null)}
        onPrint={() => void printInstruction()}
      />
    ) : viewId === "size" ? (
      sizeStep
    ) : viewId === "inside" ? (
      insideStep
    ) : viewId === "decor" ? (
      decorStep
    ) : viewId === "hardware" ? (
      hardwareStep
    ) : (
      summaryStep
    );

  const last = view >= wizard.length - 1;
  const next = last ? (
    <button
      type="button"
      disabled={blocked}
      onClick={() => send(sameDecor ? "all" : "body")}
      className={primaryButton}
    >
      <Scissors className="size-4" />
      {sameDecor ? "В распил" : "Корпус в распил"}
    </button>
  ) : (
    <button
      type="button"
      onClick={() => go(view + 1)}
      className={primaryButton}
    >
      Далее
      <ArrowRight className="size-4" />
    </button>
  );

  return (
    <div
      ref={layoutRef}
      className={styles.layout}
      style={{ scrollMarginTop: 12 }}
    >
      <div className={styles.stage}>
        <FurnitureScene
          boxes={stepView.boxes}
          highlight={stepView.highlight}
          labels={false}
          apiRef={sceneApi}
          onBoxClick={step === null && isKupe ? clickBox : undefined}
          hint={
            printing
              ? "Готовим картинки шагов…"
              : isKupe && step === null
                ? "Нажмите на дверь, чтобы сдвинуть"
                : "Крутите пальцем или мышью"
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
          className="h-full"
        />
        {hasFronts ? (
          <button
            type="button"
            onClick={() =>
              isKupe && step === null
                ? toggleKupeDoors()
                : setDoorsOpen((current) => !current)
            }
            className="absolute top-3 right-14 inline-flex h-9 items-center gap-1.5 rounded-full bg-white/90 px-3 text-[13px] font-medium shadow-sm"
          >
            {shownOpen ? (
              <DoorClosed className="size-4" />
            ) : (
              <DoorOpen className="size-4" />
            )}
            <span className="max-sm:sr-only">
              {shownOpen ? "Закрыть" : "Открыть"}
            </span>
          </button>
        ) : null}
      </div>

      <div className={styles.panel}>
        <StepNav
          steps={wizard.map((id) => WIZARD_LABELS[id])}
          current={step !== null ? wizard.length - 1 : view}
          onStep={go}
        />
        <div ref={bodyRef} className={styles.body}>
          {blocked ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] leading-5 text-red-800">
              {result.problems.join(" ")}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] leading-5 text-red-800">
              {error}
            </p>
          ) : null}
          {stepContent}
        </div>
        <PriceBar
          price={total !== null ? `≈ ${formatSom(total)}` : "Цена в распиле"}
          meta={[sheetsText, partsText].filter(Boolean).join(" · ")}
          onBack={view > 0 ? () => go(view - 1) : undefined}
          next={next}
        />
      </div>
    </div>
  );
}
