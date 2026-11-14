// Кухня целиком: прямая, угловая или П-образная. Вдоль каждой стены ряд
// нижних модулей (тумбы и пеналы) и ряд верхних (навесные шкафы). Каждый
// модуль с корпусом собирается конструктором корпуса (buildCabinet), так
// что детали, кромка и присадка те же, что у отдельного шкафа. Сверху
// общая столешница, снизу ножки и общий цоколь.
//
// Стены: 0 — задняя (слева направо, спина модулей к стене), 1 — левая
// (от угла к выходу), 2 — правая (от угла к выходу). Угловая кухня —
// стены 0 и 1, П-образная — 0, 1 и 2. Ряды боковых стен начинаются за
// глубиной столешницы (верхние — за глубиной навесных), поэтому первый
// нижний модуль задней стены у угла закрыт соседним рядом: туда ставят
// угловой модуль с глухой частью.

import {
  buildCabinet,
  type CabinetKind,
  type CabinetPart,
  type CabinetResult,
  type CabinetSpec,
} from "./cabinet-builder";

export type KitchenLayout = "line" | "corner" | "u";

export type KitchenBaseType =
  | "doors"
  | "drawers"
  | "sink"
  | "hob"
  | "oven"
  | "dishwasher"
  | "bottle"
  | "appliance"
  | "corner"
  | "tallPantry"
  | "tallOven"
  | "fridge";

export type KitchenTopType =
  | "doors"
  | "lift"
  | "dryer"
  | "hood"
  | "open"
  | "corner"
  | "none";

export const KITCHEN_LAYOUTS: Record<KitchenLayout, string> = {
  line: "Прямая",
  corner: "Угловая",
  u: "П-образная",
};

export const KITCHEN_BASE_TYPES: Record<
  KitchenBaseType,
  { label: string; width: number; hint: string }
> = {
  doors: { label: "Тумба с дверями", width: 600, hint: "Полка внутри." },
  drawers: { label: "Тумба с 3 ящиками", width: 400, hint: "" },
  sink: {
    label: "Под мойку",
    width: 800,
    hint: "Без крыши: две царги, мойка врезается в столешницу.",
  },
  hob: {
    label: "Под варочную панель",
    width: 600,
    hint: "3 ящика под панелью.",
  },
  oven: {
    label: "Под духовку",
    width: 600,
    hint: "Ящик снизу, над ним ниша 600 мм под встраиваемую духовку.",
  },
  dishwasher: {
    label: "Посудомойка",
    width: 600,
    hint: "Без корпуса: фасад на встраиваемую машину 450 или 600.",
  },
  bottle: {
    label: "Бутылочница",
    width: 200,
    hint: "Узкая тумба под выдвижное карго.",
  },
  appliance: {
    label: "Место под технику",
    width: 600,
    hint: "Без корпуса: плита, стиральная машина. Столешница сверху.",
  },
  corner: {
    label: "Угловая (глухая часть у угла)",
    width: 1000,
    hint: "Ставится первым у угла: часть закрыта соседним рядом.",
  },
  tallPantry: {
    label: "Пенал с полками",
    width: 600,
    hint: "До верха навесных, 2 двери.",
  },
  tallOven: {
    label: "Пенал под духовку",
    width: 600,
    hint: "Ящики снизу, ниша под духовку и микроволновку.",
  },
  fridge: {
    label: "Место под холодильник",
    width: 600,
    hint: "Без корпуса и без столешницы.",
  },
};

export const KITCHEN_TOP_TYPES: Record<
  KitchenTopType,
  { label: string; width: number; hint: string }
> = {
  doors: { label: "Шкаф с дверями", width: 600, hint: "Полка внутри." },
  lift: {
    label: "С подъёмной дверью",
    width: 600,
    hint: "Дверь на подъёмном механизме.",
  },
  dryer: {
    label: "С сушкой для посуды",
    width: 800,
    hint: "Над мойкой, без полки.",
  },
  hood: {
    label: "Над вытяжкой",
    width: 600,
    hint: "Короче остальных: под ним вытяжка.",
  },
  open: { label: "Открытые полки", width: 400, hint: "Без дверей." },
  corner: {
    label: "Угловой (глухая часть у угла)",
    width: 600,
    hint: "Ставится первым у угла.",
  },
  none: { label: "Пусто", width: 600, hint: "Окно, вытяжка, свободная стена." },
};

const TALL: KitchenBaseType[] = ["tallPantry", "tallOven", "fridge"];
const NO_BODY: KitchenBaseType[] = ["dishwasher", "appliance", "fridge"];
export const isTallModule = (type: KitchenBaseType) => TALL.includes(type);

export type KitchenModule<T> = { type: T; width: number };

export type KitchenWall = {
  length: number;
  base: Array<KitchenModule<KitchenBaseType>>;
  top: Array<KitchenModule<KitchenTopType>>;
};

export type KitchenSpec = {
  name: string;
  layout: KitchenLayout;
  walls: KitchenWall[];
  // Ножки нижних модулей и пеналов, мм.
  legs: number;
  // Корпус тумбы: высота и глубина.
  baseHeight: number;
  baseDepth: number;
  // Столешница: толщина и глубина.
  countertop: number;
  countertopDepth: number;
  // Навесные: высота, глубина, низ от пола.
  topHeight: number;
  topDepth: number;
  topBottom: number;
  // Шкаф над вытяжкой, мм.
  hoodHeight: number;
};

export const KITCHEN_DEFAULTS: KitchenSpec = {
  name: "Кухня",
  layout: "line",
  walls: [
    {
      length: 3000,
      base: [
        { type: "drawers", width: 400 },
        { type: "sink", width: 800 },
        { type: "dishwasher", width: 600 },
        { type: "hob", width: 600 },
        { type: "doors", width: 600 },
      ],
      top: [
        { type: "doors", width: 400 },
        { type: "dryer", width: 800 },
        { type: "doors", width: 600 },
        { type: "hood", width: 600 },
        { type: "lift", width: 600 },
      ],
    },
  ],
  legs: 100,
  baseHeight: 720,
  baseDepth: 560,
  countertop: 38,
  countertopDepth: 600,
  topHeight: 720,
  topDepth: 300,
  topBottom: 1500,
  hoodHeight: 360,
};

// Стены угловой и П-образной кухни, когда их ещё нет.
export const KITCHEN_SIDE_WALL: KitchenWall = {
  length: 2000,
  base: [
    { type: "doors", width: 600 },
    { type: "drawers", width: 600 },
  ],
  top: [
    { type: "doors", width: 600 },
    { type: "doors", width: 600 },
  ],
};

// Готовые раскладки: с угловыми модулями у углов, ряды боковых стен
// начинаются за рядами задней.
function presetWalls(layout: KitchenLayout): KitchenWall[] {
  if (layout === "corner") {
    return [
      {
        length: 3000,
        base: [
          { type: "corner", width: 1000 },
          { type: "sink", width: 800 },
          { type: "dishwasher", width: 600 },
          { type: "drawers", width: 600 },
        ],
        top: [
          { type: "corner", width: 600 },
          { type: "dryer", width: 800 },
          { type: "doors", width: 600 },
          { type: "doors", width: 600 },
        ],
      },
      {
        length: 2400,
        base: [
          { type: "hob", width: 600 },
          { type: "doors", width: 600 },
          { type: "tallPantry", width: 600 },
        ],
        top: [
          { type: "hood", width: 600 },
          { type: "lift", width: 600 },
        ],
      },
    ];
  }
  if (layout === "u") {
    return [
      {
        length: 3000,
        base: [
          { type: "corner", width: 1000 },
          { type: "sink", width: 1000 },
          { type: "corner", width: 1000 },
        ],
        top: [
          { type: "corner", width: 600 },
          { type: "doors", width: 600 },
          { type: "dryer", width: 800 },
          { type: "doors", width: 400 },
          { type: "corner", width: 600 },
        ],
      },
      {
        length: 2000,
        base: [
          { type: "hob", width: 600 },
          { type: "drawers", width: 600 },
        ],
        top: [
          { type: "hood", width: 600 },
          { type: "doors", width: 600 },
        ],
      },
      {
        length: 2000,
        base: [
          { type: "dishwasher", width: 600 },
          { type: "doors", width: 600 },
        ],
        top: [
          { type: "doors", width: 600 },
          { type: "doors", width: 600 },
        ],
      },
    ];
  }
  return KITCHEN_DEFAULTS.walls;
}

const copyWalls = (walls: KitchenWall[]) =>
  walls.map((wall) => ({
    ...wall,
    base: wall.base.map((item) => ({ ...item })),
    top: wall.top.map((item) => ({ ...item })),
  }));

export const kitchenPreset = (layout: KitchenLayout) =>
  copyWalls(presetWalls(layout));

export function kitchenWallCount(layout: KitchenLayout) {
  return layout === "line" ? 1 : layout === "corner" ? 2 : 3;
}

// Модуль на своём месте: стена, ряд, номер, отступ от начала ряда.
export type KitchenPlaced = {
  wall: number;
  row: "base" | "top";
  index: number;
  // Подпись модуля в деталях: «Н3» — нижний третий, «В2» — верхний второй.
  code: string;
  type: KitchenBaseType | KitchenTopType;
  label: string;
  // Отступ от начала ряда вдоль стены, мм.
  at: number;
  width: number;
  // Низ корпуса от пола, высота и глубина.
  bottom: number;
  height: number;
  depth: number;
  spec: CabinetSpec | null;
  result: CabinetResult | null;
  // Фасад модуля без корпуса (посудомойка).
  facade: { width: number; height: number } | null;
};

export type KitchenResult = {
  modules: KitchenPlaced[];
  parts: CabinetPart[];
  problems: string[];
  // Начало ряда вдоль каждой стены: нижнего и верхнего, мм.
  starts: Array<{ base: number; top: number }>;
  // Куски столешницы: стена, от и до вдоль стены.
  countertops: Array<{ wall: number; from: number; to: number }>;
  // Цоколь: куски вдоль стены.
  plinths: Array<{ wall: number; from: number; to: number }>;
  // Высота столешницы над полом.
  worktop: number;
  legs: number;
};

const round = (value: number) => Math.round(value * 10) / 10;
const SHEET = 2750; // длинная сторона листа, мм

export function kitchenWalls(spec: KitchenSpec): KitchenWall[] {
  const count = kitchenWallCount(spec.layout);
  return Array.from(
    { length: count },
    (_, index) =>
      spec.walls[index] ?? {
        ...KITCHEN_SIDE_WALL,
        base: KITCHEN_SIDE_WALL.base.map((item) => ({ ...item })),
        top: KITCHEN_SIDE_WALL.top.map((item) => ({ ...item })),
      },
  );
}

export function buildKitchen(
  spec: KitchenSpec,
  thickness: number,
): KitchenResult {
  const t = thickness > 0 ? thickness : 16;
  const walls = kitchenWalls(spec);
  const problems: string[] = [];
  const modules: KitchenPlaced[] = [];
  const parts: CabinetPart[] = [];
  const legs = Math.max(0, spec.legs);
  const worktop = legs + spec.baseHeight + spec.countertop;
  const tallHeight = spec.topBottom + spec.topHeight - legs;
  if (spec.topBottom < worktop + 450) {
    problems.push(
      `Навесные ниже ${Math.round(worktop + 450)} мм от пола: над столешницей меньше 450 мм.`,
    );
  }
  if (spec.countertopDepth < spec.baseDepth + t + 3) {
    problems.push("Столешница мельче тумб с фасадами — увеличьте её глубину.");
  }

  // Ряды боковых стен начинаются за соседним рядом задней стены: нижние —
  // за столешницей, навесные — за фасадами навесных (ХДФ 3 мм + корпус +
  // дверь + зазор).
  const topStart = spec.topDepth + t + 4;
  const starts = walls.map((_, index) =>
    index === 0
      ? { base: 0, top: 0 }
      : { base: spec.countertopDepth, top: topStart },
  );

  const cabinet = (
    code: string,
    kind: CabinetKind,
    width: number,
    height: number,
    depth: number,
    extra: Partial<CabinetSpec>,
  ): CabinetSpec => ({
    kind,
    name: `${spec.name.trim() || "Кухня"}, ${code}`,
    width,
    height,
    depth,
    plinth: 0,
    shelves: 1,
    doors: width >= 500 ? 2 : 1,
    joint: "confirmat",
    ...extra,
  });

  walls.forEach((wall, w) => {
    // Нижний ряд.
    let at = starts[w].base;
    wall.base.forEach((item, index) => {
      const code = `${w > 0 ? `${w + 1}-` : ""}Н${index + 1}`;
      const width = Math.max(100, Math.round(item.width));
      const tall = isTallModule(item.type);
      const height = tall ? tallHeight : spec.baseHeight;
      const depth = spec.baseDepth;
      // Угловой модуль на задней стене: глухая часть слева у левого угла,
      // справа — у правого (последний модуль ряда).
      const blindSide: "left" | "right" =
        w === 0 &&
        walls.length > 2 &&
        index > 0 &&
        index === wall.base.length - 1
          ? "right"
          : "left";
      let cabinetSpec: CabinetSpec | null = null;
      let facade: KitchenPlaced["facade"] = null;
      switch (item.type) {
        case "doors":
          cabinetSpec = cabinet(code, "base", width, height, depth, {});
          break;
        case "drawers":
        case "hob":
          cabinetSpec = cabinet(code, "base", width, height, depth, {
            doors: 0,
            drawers: 3,
            shelves: 0,
          });
          break;
        case "sink":
          cabinetSpec = cabinet(code, "base", width, height, depth, {
            shelves: 0,
            rails: true,
          });
          break;
        case "oven":
          cabinetSpec = cabinet(code, "base", width, height, depth, {
            doors: 0,
            drawers: 1,
            shelves: 0,
            openAbove: true,
          });
          break;
        case "bottle":
          cabinetSpec = cabinet(code, "base", width, height, depth, {
            doors: 1,
            shelves: 0,
          });
          break;
        case "corner":
          cabinetSpec = cabinet(code, "base", width, height, depth, {
            doors: 1,
            shelves: 1,
            blind: {
              side: blindSide,
              width: spec.countertopDepth + 20,
            },
          });
          break;
        case "tallPantry":
          cabinetSpec = cabinet(code, "wardrobe", width, height, depth, {
            shelves: 5,
          });
          break;
        case "tallOven":
          cabinetSpec = cabinet(code, "base", width, height, depth, {
            doors: 0,
            drawers: 2,
            shelves: 1,
            openAbove: true,
          });
          break;
        case "dishwasher":
          facade = {
            width: round(width - 3),
            height: round(spec.baseHeight - 3),
          };
          break;
        default:
          break;
      }
      const result = cabinetSpec ? buildCabinet(cabinetSpec, t) : null;
      if (result) {
        for (const problem of result.problems)
          problems.push(`${code}: ${problem}`);
        parts.push(...result.parts);
      }
      if (facade) {
        parts.push({
          title: `${spec.name.trim() || "Кухня"}, ${code}: фасад посудомойки`,
          length: facade.height,
          width: facade.width,
          quantity: 1,
          edgedSides: ["top", "right", "bottom", "left"],
          fixedGrain: true,
        });
      }
      if (item.type === "corner" && w > 0) {
        problems.push(
          `${code}: угловой модуль ставьте на задней стене у угла — ряды боковых стен начинаются за ней.`,
        );
      }
      modules.push({
        wall: w,
        row: "base",
        index,
        code,
        type: item.type,
        label: KITCHEN_BASE_TYPES[item.type]?.label ?? item.type,
        at,
        width,
        bottom: legs,
        height,
        depth,
        spec: cabinetSpec,
        result,
        facade,
      });
      at += width;
    });
    if (at > wall.length + 0.5) {
      problems.push(
        `Стена ${w + 1}: нижние модули ${Math.round(at)} мм, а стена ${wall.length} мм.`,
      );
    }
    // Угол без углового модуля: первый модуль задней стены закрыт.
    if (w === 0 && walls.length > 1) {
      const first = wall.base[0];
      if (first && first.type !== "corner" && !NO_BODY.includes(first.type)) {
        problems.push(
          "Нижний модуль у левого угла закрыт соседним рядом — поставьте первым «Угловую (глухая часть у угла)».",
        );
      }
    }
    if (w === 0 && walls.length > 2) {
      const last = wall.base[wall.base.length - 1];
      if (
        last &&
        last.type !== "corner" &&
        !NO_BODY.includes(last.type) &&
        at > wall.length - spec.countertopDepth
      ) {
        problems.push(
          "Нижний модуль у правого угла закрыт соседним рядом — поставьте последним «Угловую (глухая часть у угла)».",
        );
      }
    }

    // Верхний ряд.
    let topAt = starts[w].top;
    wall.top.forEach((item, index) => {
      const code = `${w > 0 ? `${w + 1}-` : ""}В${index + 1}`;
      const width = Math.max(100, Math.round(item.width));
      const height = item.type === "hood" ? spec.hoodHeight : spec.topHeight;
      const bottom = spec.topBottom + spec.topHeight - height;
      const blindSide: "left" | "right" =
        w === 0 &&
        walls.length > 2 &&
        index > 0 &&
        index === wall.top.length - 1
          ? "right"
          : "left";
      let cabinetSpec: CabinetSpec | null = null;
      switch (item.type) {
        case "doors":
          cabinetSpec = cabinet(code, "wall", width, height, spec.topDepth, {});
          break;
        case "lift":
          cabinetSpec = cabinet(code, "wall", width, height, spec.topDepth, {
            doors: 1,
            lift: true,
          });
          break;
        case "dryer":
          cabinetSpec = cabinet(code, "wall", width, height, spec.topDepth, {
            shelves: 0,
          });
          break;
        case "hood":
          cabinetSpec = cabinet(code, "wall", width, height, spec.topDepth, {
            shelves: 0,
          });
          break;
        case "open":
          cabinetSpec = cabinet(code, "wall", width, height, spec.topDepth, {
            doors: 0,
            shelves: 2,
          });
          break;
        case "corner":
          cabinetSpec = cabinet(code, "wall", width, height, spec.topDepth, {
            doors: 1,
            blind: { side: blindSide, width: topStart + 20 },
          });
          break;
        default:
          break;
      }
      const result = cabinetSpec ? buildCabinet(cabinetSpec, t) : null;
      if (result) {
        for (const problem of result.problems)
          problems.push(`${code}: ${problem}`);
        parts.push(...result.parts);
      }
      modules.push({
        wall: w,
        row: "top",
        index,
        code,
        type: item.type,
        label: KITCHEN_TOP_TYPES[item.type]?.label ?? item.type,
        at: topAt,
        width,
        bottom,
        height,
        depth: spec.topDepth,
        spec: cabinetSpec,
        result,
        facade: null,
      });
      topAt += width;
    });
    if (topAt > wall.length + 0.5) {
      problems.push(
        `Стена ${w + 1}: навесные ${Math.round(topAt)} мм, а стена ${wall.length} мм.`,
      );
    }
  });

  // Столешница — над подряд идущими нижними модулями без пеналов и
  // холодильника. Цоколь — под всеми модулями, кроме мест под отдельно
  // стоящую технику.
  const countertops: KitchenResult["countertops"] = [];
  const plinths: KitchenResult["plinths"] = [];
  const segments = (
    w: number,
    test: (type: KitchenBaseType) => boolean,
    into: Array<{ wall: number; from: number; to: number }>,
  ) => {
    let from: number | null = null;
    let to = 0;
    for (const item of modules) {
      if (item.wall !== w || item.row !== "base") continue;
      if (test(item.type as KitchenBaseType)) {
        if (from === null) from = item.at;
        to = item.at + item.width;
      } else if (from !== null) {
        into.push({ wall: w, from, to });
        from = null;
      }
    }
    if (from !== null) into.push({ wall: w, from, to });
  };
  walls.forEach((_, w) => {
    segments(w, (type) => !TALL.includes(type), countertops);
    segments(w, (type) => type !== "fridge" && type !== "appliance", plinths);
  });

  // Цоколь — полосы ЛДСП высотой с ножки, куски не длиннее листа.
  const name = spec.name.trim() || "Кухня";
  const plinthPieces = new Map<number, number>();
  for (const piece of plinths) {
    let rest = piece.to - piece.from;
    while (rest > 0.5) {
      const length = Math.min(rest, SHEET - 50);
      plinthPieces.set(
        round(length),
        (plinthPieces.get(round(length)) ?? 0) + 1,
      );
      rest -= length;
    }
  }
  if (legs > 0) {
    for (const [length, quantity] of plinthPieces) {
      parts.push({
        title: `${name}: цоколь`,
        length,
        width: round(legs - 3),
        quantity,
        edgedSides: ["top", "bottom"],
        fixedGrain: true,
      });
    }
  }

  return {
    modules,
    parts: mergeParts(parts),
    problems,
    starts,
    countertops,
    plinths,
    worktop,
    legs,
  };
}

// Одинаковые детали с одинаковым названием — одной строкой.
function mergeParts(parts: CabinetPart[]) {
  const merged: CabinetPart[] = [];
  for (const part of parts) {
    const same = merged.find(
      (entry) =>
        entry.title === part.title &&
        entry.length === part.length &&
        entry.width === part.width,
    );
    if (same) same.quantity += part.quantity;
    else merged.push({ ...part });
  }
  return merged;
}

// Сколько ножек и клипс цоколя: по 4 ножки на модуль с корпусом снизу,
// по 2 клипсы на лицевые ножки.
export function kitchenLegs(result: KitchenResult) {
  const bodies = result.modules.filter(
    (item) => item.row === "base" && item.spec,
  ).length;
  return { legs: bodies * 4, clips: bodies * 2 };
}
