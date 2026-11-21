// Системы фурнитуры, которые продаёт магазин: от выбранной системы
// зависят размеры коробов ящиков, глубина корпуса, сверловка петель и
// товары в списке фурнитуры. Цифры — из каталогов производителей
// (Hettich TA 2025, Samet Smart Slide), ссылки в комментариях.

export type DrawerSystemId =
  | "ball"
  | "samet-so-class"
  | "nuomi-youth"
  | "hettich-actro-you"
  | "hettich-quadro-v6-you"
  | "hettich-quadro-25-you"
  | "samet-smart";

export type DrawerSystem = {
  id: DrawerSystemId;
  brand: string;
  label: string;
  // Коротко для клиента: что это и чем отличается.
  hint: string;
  kind: "ball" | "undermount";
  // Длины направляющих, которые есть в магазине, мм.
  lengths: number[];
  // Внутренняя глубина корпуса = длина направляющей + reserve.
  depthReserve: number;
  // Ширина короба снаружи по проёму (между боковинами корпуса) и
  // толщине боковин короба.
  boxWidth: (opening: number, t: number) => number;
  // Длина короба по длине направляющей.
  boxLength: (slide: number) => number;
  // Самая толстая боковина короба, которую держит система, мм.
  maxSide?: number;
  // Товар в каталоге: направляющие этой системы.
  search: RegExp;
  // Направляющие продаются по одной, левая и правая отдельно.
  handed?: boolean;
  // Фиксаторы (защёлки) короба к скрытым направляющим: левый и правый
  // продаются отдельно.
  catch?: { label: string; search: RegExp };
};

// Поиск левой или правой детали: и название системы, и сторона.
export function handedSearch(base: RegExp, side: "left" | "right") {
  // «L» / «R» только в конце названия: в «Actro YOU L» буква — модель.
  const hand = side === "left" ? "лев|\\bL\\s*$" : "прав|\\bR\\s*$";
  return new RegExp(`^(?=.*(?:${base.source}))(?=.*(?:${hand}))`, "i");
}

const round = (value: number) => Math.round(value * 10) / 10;

// Шариковые: зазор 13 мм с каждой стороны, короб во всю длину
// направляющей, глубина — длина + 4 мм.
const BALL_GAP = 13;
const ball = {
  kind: "ball" as const,
  depthReserve: 4,
  boxWidth: (opening: number) => round(opening - 2 * BALL_GAP),
  boxLength: (slide: number) => slide,
};

// Hettich Actro YOU / Quadro YOU для деревянных ящиков (EB 21):
// внутренняя ширина ящика = проём − 42, длина ящика = NL − 10,
// глубина корпуса от NL + 3, боковина ящика до 16 мм
// (TA 2025 с. 376; shop.hettich.com 9318177, 9256868, 9318638).
const hettichYou = {
  brand: "Hettich",
  kind: "undermount" as const,
  depthReserve: 3,
  boxWidth: (opening: number, t: number) => round(opening - 42 + 2 * t),
  boxLength: (slide: number) => slide - 10,
  maxSide: 16,
  handed: true,
  catch: {
    label: "Фиксатор Actro YOU для деревянных ящиков",
    search: /фиксатор\s+actro\s+you/i,
  },
};

export const DRAWER_SYSTEMS: Record<DrawerSystemId, DrawerSystem> = {
  ball: {
    id: "ball",
    brand: "",
    label: "Шариковые, любой бренд",
    hint: "Направляющие сбоку короба, по 13 мм с каждой стороны.",
    ...ball,
    lengths: [250, 300, 350, 400, 450, 500, 550, 600],
    search: /направляющ.*шарик|шарик.*направляющ|направляющ/i,
  },
  "samet-so-class": {
    id: "samet-so-class",
    brand: "Samet",
    label: "Samet SO-CLASS, шариковые с доводчиком",
    hint: "Шариковые 46 мм, сбоку короба, по 13 мм с каждой стороны.",
    ...ball,
    lengths: [350, 400, 450, 500],
    search: /so-?class/i,
  },
  "nuomi-youth": {
    id: "nuomi-youth",
    brand: "Nuomi",
    label: "Nuomi YOUTH, шариковые 35 кг",
    hint: "Шариковые с доводчиком, сбоку короба, по 13 мм с каждой стороны.",
    ...ball,
    lengths: [350, 400, 450, 500],
    search: /nuomi.*youth|youth.*nuomi/i,
  },
  "hettich-actro-you": {
    id: "hettich-actro-you",
    label: "Hettich Actro YOU L, скрытые 40 кг",
    hint: "Под дном, не видно сбоку. Короб уже проёма на 42 мм внутри, короче направляющей на 10 мм.",
    ...hettichYou,
    lengths: [400, 450, 500],
    search: /направляющ.*actro\s+you|actro\s+you.*направляющ/i,
  },
  "hettich-quadro-v6-you": {
    id: "hettich-quadro-v6-you",
    label: "Hettich Quadro V6 YOU M, скрытые 30 кг",
    hint: "Под дном, не видно сбоку. Короб уже проёма на 42 мм внутри, короче направляющей на 10 мм.",
    ...hettichYou,
    lengths: [250, 300, 350, 400, 450, 500],
    search: /quadro\s+v6\s+you/i,
  },
  "hettich-quadro-25-you": {
    id: "hettich-quadro-25-you",
    label: "Hettich Quadro 25 YOU S, скрытые 25 кг",
    hint: "Под дном, с доводчиком, нагрузка до 25 кг. Короб уже проёма на 42 мм внутри.",
    ...hettichYou,
    lengths: [400, 450, 500],
    search: /quadro\s+25\s+you/i,
  },
  // Samet Smart Slide: внутренняя ширина ящика = проём − 45, при плите
  // 19 мм − 46 (брошюра Smart Full 84312140). Длина короба NL − 10 —
  // как у других скрытых направляющих; в тексте брошюры её нет.
  "samet-smart": {
    id: "samet-smart",
    brand: "Samet",
    label: "Samet SMART, скрытые полного выдвижения",
    hint: "Под дном, не видно сбоку. Короб уже проёма на 45 мм внутри.",
    kind: "undermount",
    depthReserve: 3,
    boxWidth: (opening, t) => round(opening - (t >= 19 ? 46 : 45) + 2 * t),
    boxLength: (slide) => slide - 10,
    maxSide: 19,
    lengths: [300, 350, 400, 450, 500, 550],
    search: /samet.*smart|smart.*полного/i,
    catch: {
      label: "Крепление ящика к направляющей Samet",
      search: /samet.*креплени.*ящик|креплени.*для\s+ящик/i,
    },
  },
};

export const DRAWER_SYSTEM_ORDER: DrawerSystemId[] = [
  "ball",
  "samet-so-class",
  "nuomi-youth",
  "hettich-actro-you",
  "hettich-quadro-v6-you",
  "hettich-quadro-25-you",
  "samet-smart",
];

export function drawerSystem(id?: DrawerSystemId) {
  return DRAWER_SYSTEMS[id ?? "ball"] ?? DRAWER_SYSTEMS.ball;
}

// Самая длинная направляющая системы, которая входит в глубину.
export function drawerSlide(system: DrawerSystem, depth: number) {
  return (
    [...system.lengths]
      .reverse()
      .find((length) => length + system.depthReserve <= depth) ?? 0
  );
}

// Почему короб не собрать на этой системе (толщина боковин).
export function drawerSystemProblem(system: DrawerSystem, t: number) {
  if (system.maxSide && t > system.maxSide) {
    return `${system.label}: боковина ящика до ${system.maxSide} мм, а плита ${t} мм — выберите плиту тоньше или шариковые направляющие.`;
  }
  return null;
}

// Петли. Чашка Ø35 у всех; глубина чашки по каталогу производителя.
export type HingeSystemId =
  | "standard"
  | "hettich-sensys"
  | "hettich-intermat"
  | "samet-master"
  | "samet-star"
  | "nuomi";

export type HingeSystem = {
  id: HingeSystemId;
  brand: string;
  label: string;
  hint: string;
  // Глубина сверления чашки, мм.
  cupDepth: number;
  // Толщина двери, мм.
  door?: [number, number];
  search: RegExp;
  plate?: { label: string; search: RegExp };
};

export const HINGE_SYSTEMS: Record<HingeSystemId, HingeSystem> = {
  standard: {
    id: "standard",
    brand: "",
    label: "Накладная Ø35, любой бренд",
    hint: "Чашка Ø35 глубиной 13 мм.",
    cupDepth: 13,
    search: /петл/i,
  },
  // Sensys 8645i / 8675: чашка 35 × 12,8, двери 15–24 мм (TA 2025 с. 23–24).
  "hettich-sensys": {
    id: "hettich-sensys",
    brand: "Hettich",
    label: "Hettich Sensys 110° с доводчиком",
    hint: "Чашка Ø35 × 12,8 мм, двери 15–24 мм.",
    cupDepth: 13,
    door: [15, 24],
    search: /sensys\s*86(45|75)/i,
    plate: {
      label: "Монтажная планка Hettich 8099",
      search: /планк.*hettich|hettich.*планк|монтажн.*8099/i,
    },
  },
  "hettich-intermat": {
    id: "hettich-intermat",
    brand: "Hettich",
    label: "Hettich Intermat 9973 110°",
    hint: "Чашка Ø35, без доводчика.",
    cupDepth: 13,
    search: /intermat/i,
    plate: {
      label: "Монтажная планка Hettich 8099",
      search: /планк.*hettich|hettich.*планк|монтажн.*8099/i,
    },
  },
  // Samet Master: чашка 35 × 12,5; Star: 35 × 11,2 (Samet CATALOGUE/1 с. 12).
  "samet-master": {
    id: "samet-master",
    brand: "Samet",
    label: "Samet MASTER с доводчиком",
    hint: "Чашка Ø35 × 12,5 мм.",
    cupDepth: 12.5,
    search: /samet.*master.*soft|master.*48ax.*soft/i,
    plate: {
      label: "Монтажная планка Samet 3D",
      search: /samet.*планк|планк.*master/i,
    },
  },
  "samet-star": {
    id: "samet-star",
    brand: "Samet",
    label: "Samet STAR, без доводчика",
    hint: "Чашка Ø35 × 11,2 мм — сверлим мельче.",
    cupDepth: 11.5,
    search: /samet.*star|star\s+48ax/i,
    plate: {
      label: "Монтажная планка Samet STAR",
      search: /планк.*star/i,
    },
  },
  nuomi: {
    id: "nuomi",
    brand: "Nuomi",
    label: "Nuomi 105° с доводчиком",
    hint: "Чашка Ø35 глубиной 13 мм.",
    cupDepth: 13,
    search: /nuomi.*петл|петл.*nuomi/i,
  },
};

export const HINGE_SYSTEM_ORDER: HingeSystemId[] = [
  "standard",
  "hettich-sensys",
  "hettich-intermat",
  "samet-master",
  "samet-star",
  "nuomi",
];

export function hingeSystem(id?: HingeSystemId) {
  return HINGE_SYSTEMS[id ?? "standard"] ?? HINGE_SYSTEMS.standard;
}

export function hingeSystemProblem(system: HingeSystem, t: number) {
  if (system.door && (t < system.door[0] || t > system.door[1])) {
    return `${system.label}: двери ${system.door[0]}–${system.door[1]} мм, а плита ${t} мм.`;
  }
  return null;
}

// Полкодержатели: все под отверстие Ø5, меняется только товар.
export type ShelfSupportId = "pin" | "if-flipper" | "if-k-line";

export const SHELF_SUPPORTS: Record<
  ShelfSupportId,
  { label: string; note: string; search: RegExp }
> = {
  pin: {
    label: "Полкодержатель Ø5, любой",
    note: "Ø5 мм",
    search: /полкодерж/i,
  },
  "if-flipper": {
    label: "Italiana Ferramenta FLIPPER",
    note: "14 мм, штифт Ø5",
    search: /flipper/i,
  },
  "if-k-line": {
    label: "Italiana Ferramenta K-LINE",
    note: "штифт Ø5",
    search: /k-?line/i,
  },
};

export const SHELF_SUPPORT_ORDER: ShelfSupportId[] = [
  "pin",
  "if-flipper",
  "if-k-line",
];

// Подъёмники для навесных шкафов кухни.
export type LiftSystemId = "any" | "samet-multi-mech" | "if-kiaro-easy";

export type LiftSystem = {
  label: string;
  hint: string;
  // Высота корпуса, мм, для которой подходит механизм.
  height?: [number, number];
  search: RegExp;
  // Типоразмер по высоте корпуса.
  size?: (height: number) => string;
};

export const LIFT_SYSTEMS: Record<LiftSystemId, LiftSystem> = {
  any: {
    label: "Подъёмник, любой бренд",
    hint: "Подберём по каталогу.",
    search: /подъ[её]м|lift|mech|kiaro/i,
  },
  // Samet Multi Mech: корпус 480–1040 мм, до 30 кг (sametglobal.com).
  "samet-multi-mech": {
    label: "Samet MULTI MECH",
    hint: "Корпус высотой 480–1040 мм, фасад до 30 кг.",
    height: [480, 1040],
    search: /multi\s*mech/i,
    size: (height) =>
      height < 600
        ? "145"
        : height < 700
          ? "195"
          : height < 860
            ? "237"
            : "345",
  },
  "if-kiaro-easy": {
    label: "Italiana Ferramenta KIARO EASY",
    hint: "Ставится на любую боковину, усилие Soft или Strong.",
    search: /kiaro/i,
  },
};

export const LIFT_SYSTEM_ORDER: LiftSystemId[] = [
  "any",
  "samet-multi-mech",
  "if-kiaro-easy",
];

export function liftSystemProblem(id: LiftSystemId, height: number) {
  const system = LIFT_SYSTEMS[id];
  if (
    system?.height &&
    (height < system.height[0] || height > system.height[1])
  ) {
    return `${system.label}: корпус ${system.height[0]}–${system.height[1]} мм, а навесной шкаф ${height} мм.`;
  }
  return null;
}

// Выбор фурнитуры для корпуса или всей кухни.
export type CabinetHardware = {
  drawers?: DrawerSystemId;
  hinges?: HingeSystemId;
  shelves?: ShelfSupportId;
  lift?: LiftSystemId;
};
