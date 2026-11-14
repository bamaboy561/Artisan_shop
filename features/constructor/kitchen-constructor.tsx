"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  DoorClosed,
  DoorOpen,
  Plus,
  Scissors,
  X,
} from "lucide-react";

import {
  KITCHEN_BASE_TYPES,
  KITCHEN_DEFAULTS,
  KITCHEN_LAYOUTS,
  KITCHEN_TOP_TYPES,
  buildKitchen,
  kitchenPreset,
  kitchenWalls,
  type KitchenBaseType,
  type KitchenLayout,
  type KitchenSpec,
  type KitchenTopType,
  type KitchenWall,
} from "@/features/services/kitchen-builder";
import type { CabinetPart } from "@/features/services/cabinet-builder";
import { Field, inputClass } from "@/features/services/cabinet-builder-dialog";
import { cn } from "@/lib/utils";
import type {
  ConstructorDecor,
  ConstructorFittingProduct,
} from "@/lib/server/constructor-decors";

import { kitchenFittings } from "./assembly";
import { FittingsPanel } from "./assembly-panel";
import {
  TONE_BACK,
  TONE_LED,
  TONE_PLAIN,
  TONE_ROD,
  TONE_SLIDING,
  edgeDescription,
} from "./cabinet-model";
import {
  BACK_COLOR,
  DOOR_ANIMATION_MS,
  DecorPicker,
  FurnitureScene,
  decorColor,
  grooveNote,
  partLabel,
  sendToCalculator,
  sizeFormatter,
} from "./furniture-constructor";
import type { SceneTone } from "./furniture-scene";
import {
  TONE_APPLIANCE,
  TONE_BODY,
  TONE_COUNTERTOP,
  TONE_FACADE,
  buildKitchenModel,
  kitchenHandlePlacement,
} from "./kitchen-model";

const COUNTERTOP_COLOR = [92, 84, 78];
const APPLIANCE_COLOR = [196, 199, 204];
// Камера: П-образную видно сверху спереди, иначе правый ряд стоит
// спиной к зрителю.
const KITCHEN_VIEWS: Record<KitchenLayout, [number, number, number]> = {
  line: [0.45, 0.3, 1],
  corner: [0.6, 0.45, 1],
  u: [0, 0.75, 1],
};
const WALL_NAMES = ["Задняя стена", "Левая стена", "Правая стена"];

// Плавно открывает и закрывает двери макета.
function useDoorOpen(open: boolean) {
  const [value, setValue] = useState(0);
  const now = useRef(0);
  const frame = useRef(0);
  useEffect(() => {
    const target = open ? 1 : 0;
    const startedAt = performance.now();
    const from = now.current;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / DOOR_ANIMATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      now.current = from + (target - from) * eased;
      setValue(now.current);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [open]);
  return value;
}

// Фасады кухни: двери, фасады ящиков, фасад посудомойки, заглушки углов
// и цоколь — из декора фасадов.
const isFacade = (part: CabinetPart) =>
  /: (дверь|фасад ящика|фасад посудомойки|заглушка|цоколь|фальшпанель)/.test(
    part.title,
  );

// Код модуля из названия детали: «Кухня, 2-Н3: боковина» → «2-Н3».
const moduleCode = (name: string) =>
  /, ((?:\d+-)?[НВ]\d+):/.exec(name)?.[1] ?? null;

function ModuleRow<T extends string>({
  code,
  types,
  type,
  width,
  selected,
  first,
  last,
  onSelect,
  onChange,
  onMove,
  onRemove,
}: {
  code: string;
  types: Record<T, { label: string; width: number; hint: string }>;
  type: T;
  width: number;
  selected: boolean;
  first: boolean;
  last: boolean;
  onSelect: () => void;
  onChange: (patch: { type?: T; width?: number }) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const iconButton =
    "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--line)] disabled:opacity-30";
  return (
    <div
      className={cn(
        "grid gap-1 rounded-xl border p-2",
        selected
          ? "border-[var(--accent)] bg-[var(--accent)]/5"
          : "border-[color:var(--line)]",
      )}
    >
      <div className="flex items-end gap-1.5">
        <button
          type="button"
          onClick={onSelect}
          className="h-9 w-11 shrink-0 rounded-lg bg-[var(--surface-strong)] text-[12px] font-semibold"
          title="Показать в макете"
        >
          {code}
        </button>
        <label className="grid min-w-0 flex-1 gap-1 text-[12px] text-[var(--muted)]">
          Модуль
          <select
            className={inputClass}
            value={type}
            onChange={(event) => {
              const next = event.target.value as T;
              onChange({ type: next, width: types[next].width });
            }}
          >
            {(Object.keys(types) as T[]).map((key) => (
              <option key={key} value={key}>
                {types[key].label}
              </option>
            ))}
          </select>
        </label>
        <div className="w-20 shrink-0">
          <Field
            label="Шир., мм"
            value={width}
            onChange={(next) => onChange({ width: next })}
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <p className="min-w-0 flex-1 text-[11px] leading-4 text-[var(--muted)]">
          {types[type].hint}
        </p>
        <button
          type="button"
          className={iconButton}
          disabled={first}
          onClick={() => onMove(-1)}
          aria-label="Левее"
        >
          <ArrowUp className="size-4 -rotate-90" />
        </button>
        <button
          type="button"
          className={iconButton}
          disabled={last}
          onClick={() => onMove(1)}
          aria-label="Правее"
        >
          <ArrowDown className="size-4 -rotate-90" />
        </button>
        <button
          type="button"
          className={iconButton}
          onClick={onRemove}
          aria-label="Убрать"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function KitchenConstructor({
  decors,
  fittingProducts,
}: {
  decors: ConstructorDecor[];
  fittingProducts: ConstructorFittingProduct[];
}) {
  const [spec, setSpec] = useState<KitchenSpec>(() => ({
    ...KITCHEN_DEFAULTS,
    walls: kitchenPreset("line"),
  }));
  const defaultDecor =
    decors.find((decor) => /бел/i.test(decor.name) && decor.thickness === 16) ??
    decors.find((decor) => decor.thickness === 16) ??
    decors[0];
  const [bodyId, setBodyId] = useState(defaultDecor?.id ?? "");
  const [facadeId, setFacadeId] = useState(defaultDecor?.id ?? "");
  const [doorsOpen, setDoorsOpen] = useState(false);
  const doorOpen = useDoorOpen(doorsOpen);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");

  const bodyDecor = decors.find((decor) => decor.id === bodyId);
  const facadeDecor =
    decors.find((decor) => decor.id === facadeId) ?? bodyDecor;
  const sameDecor = !facadeDecor || facadeDecor.id === bodyDecor?.id;
  const thickness = bodyDecor?.thickness ?? 16;

  const result = useMemo(
    () => buildKitchen(spec, thickness),
    [spec, thickness],
  );
  const walls = kitchenWalls(spec);
  const boxes = useMemo(
    () =>
      buildKitchenModel(spec, thickness, result, {
        doorOpen,
        bodyMaterial: bodyDecor?.label ?? `ЛДСП ${thickness} мм`,
        facadeMaterial: facadeDecor?.label ?? `ЛДСП ${thickness} мм`,
      }),
    [spec, thickness, result, doorOpen, bodyDecor, facadeDecor],
  );
  const highlight = useMemo(
    () =>
      selected
        ? boxes.map((box) => moduleCode(box.info?.name ?? "") === selected)
        : undefined,
    [boxes, selected],
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
    list[TONE_COUNTERTOP] = { color: COUNTERTOP_COLOR };
    list[TONE_APPLIANCE] = { color: APPLIANCE_COLOR, metal: true };
    list[TONE_PLAIN] = list[TONE_FACADE];
    return list;
  }, [bodyDecor, facadeDecor]);
  const fittings = useMemo(
    () => kitchenFittings(result, thickness),
    [result, thickness],
  );

  const set = (patch: Partial<KitchenSpec>) =>
    setSpec((current) => ({ ...current, ...patch }));
  const setWall = (index: number, patch: Partial<KitchenWall>) =>
    set({
      walls: walls.map((wall, at) =>
        at === index ? { ...wall, ...patch } : wall,
      ),
    });
  const chooseLayout = (layout: KitchenLayout) => {
    setSelected(null);
    set({ layout, walls: kitchenPreset(layout) });
  };

  // Задние стенки и дно ящиков — ХДФ, отдельным материалом.
  const hdf = useMemo(() => {
    const sheets = new Map<string, number>();
    for (const item of result.modules) {
      const cabinet = item.result;
      if (!cabinet) continue;
      const add = (length: number, width: number, count: number) => {
        const key = `${sizeFormatter.format(length)} × ${sizeFormatter.format(width)}`;
        sheets.set(key, (sheets.get(key) ?? 0) + count);
      };
      if (cabinet.back) add(cabinet.back.length, cabinet.back.width, 1);
      if (cabinet.drawers?.slide) {
        for (const bottom of cabinet.drawers.bottoms ?? [
          { ...cabinet.drawers.bottom, count: cabinet.drawers.count },
        ]) {
          add(bottom.length, bottom.width, bottom.count);
        }
      }
    }
    return [...sheets].map(([size, count]) => ({ size, count }));
  }, [result]);
  const countertopNote = result.countertops.length
    ? `Столешница ${spec.countertop} мм (покупная, в распил не входит): ${result.countertops
        .map(
          (piece) =>
            `${Math.round(piece.to - piece.from)} × ${spec.countertopDepth} мм`,
        )
        .join(", ")}.`
    : "";
  const partCount = result.parts.reduce((sum, part) => sum + part.quantity, 0);
  const bodies = result.modules.filter((item) => item.spec).length;

  const send = (which: "all" | "body" | "facade") => {
    const name = spec.name.trim() || "Кухня";
    const hdfNote = hdf.length
      ? `ХДФ (задние стенки и дно ящиков): ${hdf.map((sheet) => `${sheet.size} мм — ${sheet.count} шт`).join(", ")}.`
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
      label: which === "facade" ? `${name}, фасады` : name,
      note: [
        which === "facade" ? "" : countertopNote,
        which === "facade" ? "" : hdfNote,
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
            ? isFacade(part)
            : !isFacade(part),
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

  const clickBox = (index: number) => {
    const code = moduleCode(boxes[index]?.info?.name ?? "");
    setSelected((current) => (code && current !== code ? code : null));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]">
      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[var(--surface-strong)]">
          <FurnitureScene
            boxes={boxes}
            highlight={highlight}
            onBoxClick={clickBox}
            hint="Крутите пальцем или мышью · нажмите на модуль"
            tones={tones}
            handleTone={TONE_FACADE}
            handlePlacement={kitchenHandlePlacement}
            viewDirection={KITCHEN_VIEWS[spec.layout]}
            className="h-[56vh] min-h-80 lg:h-[72vh]"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDoorsOpen((current) => !current)}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[color:var(--line)] px-4 text-[13px] font-medium"
          >
            {doorsOpen ? (
              <DoorClosed className="size-4" />
            ) : (
              <DoorOpen className="size-4" />
            )}
            {doorsOpen ? "Закрыть двери" : "Открыть двери"}
          </button>
          {selected ? (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--accent)] px-4 text-[13px] font-medium"
            >
              <X className="size-4" />
              Модуль {selected}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 content-start gap-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KITCHEN_LAYOUTS) as KitchenLayout[]).map((layout) => (
            <button
              key={layout}
              type="button"
              onClick={() => chooseLayout(layout)}
              className={cn(
                "rounded-full border px-4 py-2 text-[14px]",
                spec.layout === layout
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                  : "border-[color:var(--line)] hover:border-[var(--foreground)]",
              )}
            >
              {KITCHEN_LAYOUTS[layout]}
            </button>
          ))}
        </div>
        <p className="-mt-2 text-[12px] leading-5 text-[var(--muted)]">
          Модули идут слева направо, если стоять лицом к стене. У угла первым
          ставьте угловой модуль: его глухая часть уходит за соседний ряд.
        </p>

        <label className="grid gap-1 text-[12px] text-[var(--muted)]">
          Название
          <input
            className={inputClass}
            value={spec.name}
            onChange={(event) => set({ name: event.target.value })}
          />
        </label>

        {walls.map((wall, w) => {
          const baseStart = result.starts[w]?.base ?? 0;
          const topStart = result.starts[w]?.top ?? 0;
          const baseUsed =
            baseStart + wall.base.reduce((sum, item) => sum + item.width, 0);
          const topUsed =
            topStart + wall.top.reduce((sum, item) => sum + item.width, 0);
          const rows = [
            {
              row: "base" as const,
              title: "Нижние модули и пеналы",
              used: baseUsed,
              start: baseStart,
            },
            {
              row: "top" as const,
              title: "Навесные",
              used: topUsed,
              start: topStart,
            },
          ];
          return (
            <details
              key={w}
              className="rounded-2xl border border-[color:var(--line)] p-3"
              open
            >
              <summary className="cursor-pointer text-sm font-semibold">
                {walls.length > 1 ? WALL_NAMES[w] : "Стена"} ·{" "}
                {sizeFormatter.format(wall.length)} мм
              </summary>
              <div className="mt-3 grid gap-3">
                <div className="w-40">
                  <Field
                    label="Длина стены, мм"
                    value={wall.length}
                    onChange={(length) => setWall(w, { length })}
                  />
                </div>
                {rows.map(({ row, title, used, start }) => {
                  const free = wall.length - used;
                  const list = row === "base" ? wall.base : wall.top;
                  const update = (next: typeof list) =>
                    setWall(
                      w,
                      row === "base"
                        ? { base: next as KitchenWall["base"] }
                        : { top: next as KitchenWall["top"] },
                    );
                  return (
                    <div key={row} className="grid gap-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[13px] font-semibold">{title}</p>
                        <p
                          className={cn(
                            "text-[12px] tabular-nums",
                            free < -0.5
                              ? "text-red-700"
                              : "text-[var(--muted)]",
                          )}
                        >
                          {free < -0.5
                            ? `Не влезает ${sizeFormatter.format(-free)} мм`
                            : `Свободно ${sizeFormatter.format(free)} мм`}
                        </p>
                      </div>
                      {start > 0 ? (
                        <p className="text-[11px] leading-4 text-[var(--muted)]">
                          Ряд начинается в {sizeFormatter.format(start)} мм от
                          угла: там стоит ряд задней стены.
                        </p>
                      ) : null}
                      {list.map((item, index) => {
                        const code = `${w > 0 ? `${w + 1}-` : ""}${row === "base" ? "Н" : "В"}${index + 1}`;
                        const common = {
                          code,
                          width: item.width,
                          selected: selected === code,
                          first: index === 0,
                          last: index === list.length - 1,
                          onSelect: () =>
                            setSelected((current) =>
                              current === code ? null : code,
                            ),
                          onMove: (by: -1 | 1) => {
                            const next = [...list];
                            const [moved] = next.splice(index, 1);
                            next.splice(index + by, 0, moved);
                            setSelected(null);
                            update(next as typeof list);
                          },
                          onRemove: () => {
                            setSelected(null);
                            update(
                              list.filter(
                                (_, at) => at !== index,
                              ) as typeof list,
                            );
                          },
                        };
                        const change = (patch: {
                          type?: string;
                          width?: number;
                        }) =>
                          update(
                            list.map((item, at) =>
                              at === index ? { ...item, ...patch } : item,
                            ) as typeof list,
                          );
                        return row === "base" ? (
                          <ModuleRow<KitchenBaseType>
                            key={`${code}-${item.type}`}
                            {...common}
                            types={KITCHEN_BASE_TYPES}
                            type={item.type as KitchenBaseType}
                            onChange={change}
                          />
                        ) : (
                          <ModuleRow<KitchenTopType>
                            key={`${code}-${item.type}`}
                            {...common}
                            types={KITCHEN_TOP_TYPES}
                            type={item.type as KitchenTopType}
                            onChange={change}
                          />
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          const width =
                            free >= 150 ? Math.min(600, Math.round(free)) : 600;
                          update([
                            ...list,
                            { type: "doors", width },
                          ] as typeof list);
                        }}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-dashed border-[color:var(--line-strong)] text-[13px] font-medium"
                      >
                        <Plus className="size-4" />
                        Добавить модуль
                      </button>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}

        <details className="rounded-2xl border border-[color:var(--line)] p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Размеры модулей
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field
              label="Ножки (цоколь), мм"
              value={spec.legs}
              onChange={(legs) => set({ legs })}
            />
            <Field
              label="Высота тумб, мм"
              value={spec.baseHeight}
              onChange={(baseHeight) => set({ baseHeight })}
            />
            <Field
              label="Глубина тумб, мм"
              value={spec.baseDepth}
              onChange={(baseDepth) => set({ baseDepth })}
            />
            <Field
              label="Столешница, мм"
              value={spec.countertop}
              onChange={(countertop) => set({ countertop })}
            />
            <Field
              label="Глубина столешницы"
              value={spec.countertopDepth}
              onChange={(countertopDepth) => set({ countertopDepth })}
            />
            <Field
              label="Навесные: высота"
              value={spec.topHeight}
              onChange={(topHeight) => set({ topHeight })}
            />
            <Field
              label="Навесные: глубина"
              value={spec.topDepth}
              onChange={(topDepth) => set({ topDepth })}
            />
            <Field
              label="Низ навесных от пола"
              value={spec.topBottom}
              onChange={(topBottom) => set({ topBottom })}
            />
            <Field
              label="Шкаф над вытяжкой"
              value={spec.hoodHeight}
              onChange={(hoodHeight) => set({ hoodHeight })}
            />
          </div>
          <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
            Рабочая поверхность на высоте {sizeFormatter.format(result.worktop)}{" "}
            мм от пола. Пеналы — от ножек до верха навесных.
          </p>
        </details>

        <DecorPicker
          title="Декор корпусов"
          decors={decors}
          value={bodyId}
          onChange={(id) => {
            // Фасады режем из плиты той же толщины, что и корпуса: присадка
            // считается по ней. Другая толщина сбрасывается на декор корпуса.
            const next = decors.find((decor) => decor.id === id);
            if (sameDecor || facadeDecor?.thickness !== next?.thickness) {
              setFacadeId(id);
            }
            setBodyId(id);
          }}
        />
        <DecorPicker
          title="Декор фасадов и цоколя"
          decors={decors.filter((decor) => decor.thickness === thickness)}
          value={facadeDecor?.id ?? ""}
          onChange={setFacadeId}
        />

        {result.problems.length > 0 ? (
          <ul className="grid gap-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] leading-5 text-amber-900">
            {result.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Модулей с корпусом", value: String(bodies) },
            { label: "Деталей ЛДСП", value: String(partCount) },
            {
              label: "Столешница",
              value: `${sizeFormatter.format(
                result.countertops.reduce(
                  (sum, piece) => sum + piece.to - piece.from,
                  0,
                ) / 1000,
              )} м`,
            },
            {
              label: "Цоколь",
              value: `${sizeFormatter.format(
                result.plinths.reduce(
                  (sum, piece) => sum + piece.to - piece.from,
                  0,
                ) / 1000,
              )} м`,
            },
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

        <details className="rounded-xl border border-[color:var(--line)] p-3">
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
              {result.parts.map((part, index) => {
                const code = moduleCode(part.title);
                return (
                  <tr
                    key={`${part.title}-${index}`}
                    className="border-t border-[color:var(--line)]"
                  >
                    <td className="py-1.5 pr-2">
                      {code ? (
                        <span className="text-[var(--muted)]">{code} · </span>
                      ) : null}
                      {partLabel(part.title)}
                      {isFacade(part) && !sameDecor ? (
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
                );
              })}
              {hdf.map((sheet) => (
                <tr
                  key={`hdf-${sheet.size}`}
                  className="border-t border-[color:var(--line)] text-[var(--muted)]"
                >
                  <td className="py-1.5 pr-2">Задняя стенка или дно, ХДФ</td>
                  <td className="py-1.5 whitespace-nowrap tabular-nums">
                    {sheet.size}
                  </td>
                  <td className="py-1.5 pr-2 text-[12px]">без кромки</td>
                  <td className="py-1.5 text-right">{sheet.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
            Размер: длина (вдоль текстуры) × ширина. Кромка и присадка уже
            стоят: конфирматы корпусов, петли, полкодержатели, направляющие
            ящиков. {countertopNote}
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
              Отправить кухню в распил
            </button>
          ) : (
            <>
              <p className="text-[13px] leading-5 text-[var(--muted)]">
                Корпуса и фасады из разных декоров — это две заявки на распил.
                Отправьте сначала корпуса, потом вернитесь сюда за фасадами.
              </p>
              <button
                type="button"
                disabled={result.problems.length > 0}
                onClick={() => send("body")}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-[15px] font-semibold text-[var(--accent-ink)] disabled:opacity-40"
              >
                <Scissors className="size-4" />
                Корпуса в распил
              </button>
              <button
                type="button"
                disabled={result.problems.length > 0}
                onClick={() => send("facade")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--line-strong)] px-6 text-[14px] font-semibold disabled:opacity-40"
              >
                Фасады и цоколь в распил
              </button>
            </>
          )}
          <p className="text-[12px] leading-5 text-[var(--muted)]">
            Детали откроются в калькуляторе распила: там будет карта раскроя,
            цена и кнопка заявки. Столешница и ХДФ — в примечании к заявке.
          </p>
        </div>
      </div>
    </div>
  );
}
