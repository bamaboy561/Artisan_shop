// Конструктор корпуса: шкаф, тумба или навесной шкаф по габаритам.
// Собирает детали с кромкой и присадкой для калькулятора распила.
//
// Корпус: боковины на всю высоту, крыша и дно между боковинами на
// эксцентриках со шкантами или на конфирматах (joint), цоколь на
// евровинтах, дно над
// цоколем, полки на полкодержателях, накладные двери, задняя стенка ХДФ
// накладная (другой материал — отдельной строкой).
//
// Координаты деталей как у присадки (drilling-hardware): x — длина детали,
// y — ширина, сторона top — y = ширина. У боковины длина — высота шкафа
// (left — низ, right — верх), ширина — глубина (top — передний торец).
// У крыши, дна и полок длина — ширина шкафа, top — передний торец.
// У двери длина — высота, ширина — ширина двери, петли по нижнему или
// верхнему краю чертежа (левая и правая дверь).

import type { ImportedDetail } from "./cut-list-import";
import { createHardware, type HardwareItem } from "./drilling-hardware";
import { LED_GROOVE, type PartMilling } from "./part-milling";

export type CabinetKind = "wardrobe" | "base" | "wall" | "kupe";

// Секция шкафа-купе: своё наполнение между перегородками.
export type KupeSection = { shelves: number; rod: boolean; drawers: number };

// Как крыша и дно крепятся к боковинам.
export type CabinetJoint = "minifix" | "confirmat" | "confirmatDowel";

// Подсветка: паз под LED-профиль 10 × 10.
export type CabinetLed = "none" | "sides" | "shelves";

export const CABINET_LEDS: Record<CabinetLed, { label: string; hint: string }> =
  {
    none: { label: "Без подсветки", hint: "" },
    sides: {
      label: "В боковинах, вертикально",
      hint: "Паз 10×10 на всю высоту боковины изнутри, за планками петель.",
    },
    shelves: {
      label: "Под полками",
      hint: "Паз 10×10 вдоль переднего края каждой полки. Полку ставят пазом вниз.",
    },
  };

// Паз под профиль: от переднего торца. В боковине при дверях — за
// монтажными планками петель (они на 37 мм от края).
const LED_SIDE_INDENT = 20;
const LED_SIDE_INDENT_DOORS = 70;
const LED_SHELF_INDENT = 30;

export const CABINET_JOINTS: Record<
  CabinetJoint,
  { label: string; hint: string }
> = {
  minifix: {
    label: "Минификс + шканты",
    hint: "Стяжка не видна снаружи, корпус можно разобрать.",
  },
  confirmat: {
    label: "Конфирматы",
    hint: "Быстро и крепко, шляпки видны на боковинах — закрывают заглушками.",
  },
  confirmatDowel: {
    label: "Конфирматы + шканты",
    hint: "Шканты держат детали ровно, пока закручивают конфирматы.",
  },
};

export type CabinetSpec = {
  kind: CabinetKind;
  name: string;
  width: number;
  height: number;
  depth: number;
  plinth: number;
  shelves: number;
  doors: 0 | 1 | 2;
  // По умолчанию — минификс со шкантами.
  joint?: CabinetJoint;
  led?: CabinetLed;
  // Ящики внизу корпуса под накладными фасадами. У тумбы без дверей
  // фасады ящиков занимают всю высоту.
  drawers?: number;
  // Шкаф-купе: раздвижные двери перед корпусом, по секции на дверь.
  slidingDoors?: 2 | 3;
  sections?: KupeSection[];
};

export const CABINET_KINDS: Record<
  CabinetKind,
  { label: string; defaults: Omit<CabinetSpec, "kind"> }
> = {
  wardrobe: {
    label: "Шкаф",
    defaults: {
      name: "Шкаф",
      width: 800,
      height: 2100,
      depth: 580,
      plinth: 70,
      shelves: 4,
      doors: 2,
    },
  },
  base: {
    label: "Тумба",
    defaults: {
      name: "Тумба",
      width: 600,
      height: 820,
      depth: 560,
      plinth: 100,
      shelves: 1,
      doors: 2,
    },
  },
  wall: {
    label: "Навесной шкаф",
    defaults: {
      name: "Навесной",
      width: 600,
      height: 720,
      depth: 300,
      plinth: 0,
      shelves: 1,
      doors: 2,
    },
  },
  kupe: {
    label: "Шкаф-купе",
    defaults: {
      name: "Шкаф-купе",
      width: 1800,
      height: 2400,
      depth: 600,
      plinth: 70,
      shelves: 0,
      doors: 0,
      slidingDoors: 2,
      sections: [
        { shelves: 4, rod: false, drawers: 2 },
        { shelves: 0, rod: true, drawers: 0 },
      ],
    },
  },
};

// Двери-купе Hettich TopLine L перед корпусом. Стандартные значения —
// их сверяет мастер: перехлёст соседних дверей, вычет из высоты проёма
// (место под верхний и нижний профиль), зазор двери над дном.
export const KUPE_OVERLAP = 25;
export const KUPE_HEIGHT_DEDUCTION = 40;
const KUPE_DOOR_LIFT = 15;
// Двери на двух дорожках: задняя у корпуса, передняя перед ней.
const KUPE_TRACK_GAP = 5;
const KUPE_TRACK_STEP = 12;
// Шляпная полка над штангой: от крыши, штанга под полкой.
const KUPE_HAT_SPACE = 400;
const KUPE_ROD_BELOW_SHELF = 70;
const KUPE_HANGING_MIN = 900;
const KUPE_FRONT_GAP = 2; // вкладной фасад ящика от боковин секции, мм
const KUPE_DRAWER_FRONT = 180;
const KUPE_FRONT_SETBACK = 30;
// Зазор ящика до кромки двери-купе в открытом проёме, мм.
const KUPE_DOOR_CLEARANCE = 5;

const DEFAULT_SECTION: KupeSection = { shelves: 4, rod: false, drawers: 0 };

// Секций столько же, сколько дверей.
export function kupeSections(spec: CabinetSpec): KupeSection[] {
  const count = spec.slidingDoors === 3 ? 3 : 2;
  return Array.from({ length: count }, (_, index) => {
    const section = spec.sections?.[index] ?? DEFAULT_SECTION;
    return {
      shelves: Math.max(0, Math.min(10, Math.round(section.shelves))),
      rod: Boolean(section.rod),
      drawers: Math.max(0, Math.min(4, Math.round(section.drawers))),
    };
  });
}

// Зазоры и отступы, принятые в мебельных программах по умолчанию.
const DOOR_GAP = 3; // между дверями и по краям, мм
const SHELF_SETBACK = 20; // полка короче глубины, мм
const SHELF_CLEARANCE = 1; // зазор полки с каждой стороны, мм
const PIN_BELOW_SHELF = 8; // центр полкодержателя под полкой, мм
const MINIFIX_OFFSET = 50; // от переднего и заднего торца, мм
const BACK_OVERLAP_GAP = 2; // ХДФ меньше корпуса с каждой стороны, мм
const HINGE_OFFSET = 100; // петля от верха и низа двери, мм
const DOWEL_OFFSET = 130; // шкант от переднего и заднего торца, мм
const DRAWER_FRONT = 180; // фасад ящика под дверями, мм
const DRAWER_SLIDE_GAP = 13; // зазор под шариковую направляющую с каждой стороны
const DRAWER_LIFT = 10; // короб над нижним краем проёма, мм
const DRAWER_TOP_GAP = 30; // над коробом до следующего ящика, мм
const DRAWER_CONFIRMAT_OFFSET = 30; // конфирмат короба от верха и низа
// Шариковые направляющие продаются этими длинами.
export const DRAWER_SLIDE_LENGTHS = [250, 300, 350, 400, 450, 500, 550, 600];

export type CabinetDrawers = {
  count: number;
  // Фасад ящика: ширина и высота, низы фасадов от пола.
  frontWidth: number;
  frontHeight: number;
  frontsAt: number[];
  // Короб: длина боковин (= длина направляющей), высота, ширина снаружи;
  // низы коробов от пола.
  slide: number;
  boxHeight: number;
  boxWidth: number;
  boxesAt: number[];
  // Дно ящика из ХДФ, прибивается снизу короба.
  bottom: { length: number; width: number };
  // Полка над ящиками отделяет их от отделения за дверями (мм от пола).
  shelfAt: number | null;
  // Вкладные фасады внутри секции купе: на сколько мм утоплены от
  // передней кромки, чтобы ручки не задевали двери.
  inset?: number;
  // Проставки из той же плиты у стенок секции купе, мм с каждой стороны:
  // ящик выходит в проём между дверями, не задевая их.
  spacer?: number;
};

// Секция купе: внутренний проём от left шириной width, мм.
export type CabinetSection = {
  left: number;
  width: number;
  shelvesAt: number[];
  rodAt: number | null;
  drawers: number;
  shelfAt: number | null;
};

export type KupeLayout = {
  sections: CabinetSection[];
  // Левые грани перегородок, мм от левого края шкафа.
  partitions: number[];
  doors: {
    count: number;
    width: number;
    height: number;
    bottom: number;
    overlap: number;
    // Отступ лицевой дорожки двери от передней кромки корпуса.
    tracks: number[];
  };
  rodLength: number;
};

export type CabinetPart = ImportedDetail & {
  hardware?: HardwareItem[];
  milling?: PartMilling;
};

// Фрезеровка детали с одним пазом под LED-профиль вдоль переднего торца
// (сторона top).
function ledMilling(indent: number): PartMilling {
  return {
    corners: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    bevels: { top: 0, right: 0, bottom: 0, left: 0 },
    grooves: [{ side: "top", indent, ...LED_GROOVE }],
  };
}

// Один шкаф — одна группа: в калькуляторе клиент видит его габариты,
// а детали — только менеджер.
export function cabinetGroupLabel(spec: CabinetSpec) {
  const name = spec.name.trim() || CABINET_KINDS[spec.kind].label;
  return `${name} ${spec.width}×${spec.height}×${spec.depth} мм`;
}

export type CabinetResult = {
  parts: CabinetPart[];
  back: { length: number; width: number } | null;
  problems: string[];
  // Для рисунка вида спереди, мм от пола.
  shelvesAt: number[];
  doorWidth: number;
  doorHeight: number;
  drawers: CabinetDrawers | null;
  kupe: KupeLayout | null;
};

export function hingeCount(doorHeight: number) {
  if (doorHeight <= 900) return 2;
  if (doorHeight <= 1600) return 3;
  if (doorHeight <= 2000) return 4;
  return 5;
}

const round = (value: number) => Math.round(value * 10) / 10;

// Крепёж корпуса: отверстия в боковинах и в торцах крыши и дна под
// выбранное соединение.
function bodyJoints(joint: CabinetJoint, t: number, D: number, plinth: number) {
  // Шканты: два на стык (между эксцентриками), в неглубоком корпусе —
  // один посередине.
  const dowelPlaces =
    D >= 400 ? { count: 2, offset: DOWEL_OFFSET } : { count: 1, offset: 0 };
  const withDowels = joint !== "confirmat";
  // Конфирматов на стык: два, в глубоком корпусе — три.
  const confirmatPlaces =
    D >= 600
      ? { count: 3, offset: MINIFIX_OFFSET }
      : { count: 2, offset: MINIFIX_OFFSET };

  // Боковины: под минификс — отверстия под шток, под конфирмат — сквозные
  // Ø7 по центру толщины крыши (у верхнего торца) и дна (над цоколем).
  const sideHardware = (): HardwareItem[] => {
    const rows = (side: "left" | "right", indent: number): HardwareItem[] => {
      const fasteners =
        joint === "minifix"
          ? {
              ...createHardware("faceRow", side),
              indent,
              offset: MINIFIX_OFFSET,
              holes: [{ diameter: 5, depth: 12 }],
            }
          : {
              ...createHardware("faceRow", side),
              ...confirmatPlaces,
              indent,
              holes: [{ diameter: 7, depth: 0 }],
            };
      // Шканты между крепежом: держат крышу и дно ровно, пока затягивают.
      const dowels = {
        ...createHardware("faceRow", side),
        ...dowelPlaces,
        indent,
        holes: [{ diameter: 8, depth: 12 }],
      };
      return withDowels ? [fasteners, dowels] : [fasteners];
    };
    // Цоколь крепится евровинтом насквозь через боковину у переднего края.
    const plinthScrew =
      plinth > 0
        ? [
            {
              ...createHardware("faceRow", "left"),
              count: 1,
              offset: round(D - t / 2),
              indent: round(plinth / 2),
              holes: [{ diameter: 7, depth: 0 }],
            },
          ]
        : [];
    return [
      ...rows("right", round(t / 2)),
      ...rows("left", round(plinth + t / 2)),
      ...plinthScrew,
    ];
  };

  // Крыша и дно: эксцентрики или конфирматы в торец к обеим боковинам.
  const fasteners = (): HardwareItem =>
    joint === "minifix"
      ? {
          ...createHardware("minifix", "left"),
          mirror: true,
          offset: MINIFIX_OFFSET,
        }
      : {
          ...createHardware("confirmatEdge", "left"),
          ...confirmatPlaces,
          mirror: true,
        };
  const dowels = (): HardwareItem => ({
    ...createHardware("dowelEdge", "left"),
    ...dowelPlaces,
    mirror: true,
    holes: [{ diameter: 8, depth: 20 }],
  });
  const roofHardware = () =>
    withDowels ? [fasteners(), dowels()] : [fasteners()];
  return { sideHardware, roofHardware, confirmatPlaces };
}

// Короба ящиков: боковины по длине направляющей и две стенки между ними
// на конфирматах (сквозные Ø7 в боковинах, в торец стенок).
function drawerBoxParts(
  name: string,
  slide: number,
  boxHeight: number,
  boxWidth: number,
  t: number,
  count: number,
): CabinetPart[] {
  const boxScrews = (side: "left" | "right") => ({
    ...createHardware("faceRow", side),
    count: 2,
    offset: DRAWER_CONFIRMAT_OFFSET,
    indent: round(t / 2),
    holes: [{ diameter: 7, depth: 0 }],
  });
  return [
    {
      title: `${name}: ящик боковина`,
      length: slide,
      width: boxHeight,
      quantity: 2 * count,
      edgedSides: ["top"],
      fixedGrain: true,
      hardware: [boxScrews("left"), boxScrews("right")],
    },
    {
      title: `${name}: ящик стенка`,
      length: round(boxWidth - 2 * t),
      width: boxHeight,
      quantity: 2 * count,
      edgedSides: ["top"],
      fixedGrain: true,
      hardware: [
        {
          ...createHardware("confirmatEdge", "left"),
          count: 2,
          offset: DRAWER_CONFIRMAT_OFFSET,
          mirror: true,
        },
      ],
    },
  ];
}

export function buildCabinet(
  spec: CabinetSpec,
  thickness: number,
): CabinetResult {
  const t = thickness > 0 ? thickness : 16;
  if (spec.kind === "kupe") return buildKupe(spec, t);
  const W = spec.width;
  const H = spec.height;
  const D = spec.depth;
  const plinth = Math.max(0, spec.plinth);
  const shelves = Math.max(0, Math.min(12, Math.round(spec.shelves)));
  const doors = spec.doors;
  const problems: string[] = [];
  const name = spec.name.trim() || CABINET_KINDS[spec.kind].label;

  if (!(W >= 2 * t + 100 && H >= 2 * t + plinth + 100 && D >= 100)) {
    problems.push("Слишком маленький корпус для такой толщины плиты.");
  }
  if (W > 2750 || H > 2750 || D > 1830) {
    problems.push("Деталь больше листа 2750 × 1830 мм — проверьте размеры.");
  }

  const innerWidth = W - 2 * t;
  const parts: CabinetPart[] = [];

  const joint: CabinetJoint = spec.joint ?? "minifix";
  // Паз 10 мм глубиной режем в плите от 14 мм: под пазом остаётся 4 мм.
  const ledFits = t >= LED_GROOVE.depth + 4;
  const led: CabinetLed = ledFits ? (spec.led ?? "none") : "none";
  if (!ledFits && (spec.led ?? "none") !== "none") {
    problems.push(
      `Паз ${LED_GROOVE.width}×${LED_GROOVE.depth} под подсветку не сделать в плите ${t} мм: нужна толщина от ${LED_GROOVE.depth + 4} мм.`,
    );
  }
  const { sideHardware, roofHardware } = bodyJoints(joint, t, D, plinth);

  // Ящики: накладные фасады снизу вверх от цоколя с зазором DOOR_GAP.
  // У тумбы без дверей фасады делят всю высоту, иначе — по DRAWER_FRONT,
  // а над ними полка и двери.
  const drawerCount =
    spec.kind === "wall"
      ? 0
      : Math.max(0, Math.min(6, Math.round(spec.drawers ?? 0)));
  const fill = drawerCount > 0 && doors === 0 && spec.kind === "base";
  const frontHeight =
    drawerCount === 0
      ? 0
      : fill
        ? round((H - plinth) / drawerCount - DOOR_GAP)
        : DRAWER_FRONT;
  const drawerBlock = drawerCount * (frontHeight + DOOR_GAP);
  const bottomTop = plinth + t;
  const roofBottom = H - t;
  const fixedShelfAt =
    drawerCount > 0 && !fill
      ? round(plinth + DOOR_GAP + drawerBlock - t)
      : null;
  if (drawerCount > 0 && !fill && H - plinth - drawerBlock < 300) {
    problems.push("Ящики занимают почти всю высоту: уменьшите число ящиков.");
  }
  if (drawerCount > 0 && led === "sides") {
    problems.push(
      "Направляющие ящиков закроют паз подсветки в боковинах: выберите подсветку под полками.",
    );
  }
  if (drawerCount > 0 && frontHeight < 100) {
    problems.push("Фасад ящика ниже 100 мм: уменьшите число ящиков.");
  }

  // Полки ровно делят пространство между дном (или полкой над ящиками) и
  // крышей. В тумбе, где ящики на всю высоту, полок нет.
  const shelfCount = fill ? 0 : shelves;
  const shelvesFrom = fixedShelfAt !== null ? fixedShelfAt + t : bottomTop;
  const step = (roofBottom - shelvesFrom - shelfCount * t) / (shelfCount + 1);
  const shelvesAt = Array.from({ length: shelfCount }, (_, index) =>
    round(shelvesFrom + step * (index + 1) + t * index),
  );
  const pins = [
    ...(fixedShelfAt !== null ? [fixedShelfAt] : []),
    ...shelvesAt,
  ].map((shelf) => ({
    ...createHardware("shelfPins", "top"),
    count: 1,
    offset: round(shelf - PIN_BELOW_SHELF),
  }));

  // Двери накладные: от верха ящиков (или цоколя) до верха корпуса с
  // зазором. Петли на фасаде стоят на отступе HINGE_OFFSET от концов двери,
  // ответные планки — на тех же высотах на боковине, к которой навешена
  // дверь.
  const doorBottom = round(plinth + DOOR_GAP + drawerBlock);
  const doorHeight = round(H - doorBottom);
  const doorWidth = doors > 0 ? round((W - DOOR_GAP * (doors + 1)) / doors) : 0;
  const hinges = hingeCount(doorHeight);
  const hingeHeights = Array.from({ length: hinges }, (_, index) =>
    round(
      doorBottom +
        HINGE_OFFSET +
        ((doorHeight - 2 * HINGE_OFFSET) * index) / (hinges - 1),
    ),
  );
  const plates = (): HardwareItem[] =>
    hingeHeights.map((height) => ({
      ...createHardware("hingePlate", "top"),
      count: 1,
      offset: height,
    }));
  // Одна дверь навешена на левую боковину, две — каждая на свою.
  const platesOn = (label: string) =>
    doors === 2 || (doors === 1 && label === "левая") ? plates() : [];

  for (const label of ["левая", "правая"]) {
    parts.push({
      title: `${name}: боковина ${label}`,
      length: H,
      width: D,
      quantity: 1,
      edgedSides: ["top"],
      fixedGrain: true,
      hardware: [...sideHardware(), ...pins, ...platesOn(label)],
      ...(led === "sides"
        ? {
            milling: ledMilling(
              doors > 0 ? LED_SIDE_INDENT_DOORS : LED_SIDE_INDENT,
            ),
          }
        : {}),
    });
  }

  parts.push({
    title: `${name}: крыша`,
    length: innerWidth,
    width: D,
    quantity: 1,
    edgedSides: ["top"],
    fixedGrain: true,
    hardware: roofHardware(),
  });
  parts.push({
    title: `${name}: дно`,
    length: innerWidth,
    width: D,
    quantity: 1,
    edgedSides: ["top"],
    fixedGrain: true,
    hardware: roofHardware(),
  });

  if (fixedShelfAt !== null) {
    parts.push({
      title: `${name}: полка над ящиками`,
      length: innerWidth - 2 * SHELF_CLEARANCE,
      width: D - SHELF_SETBACK,
      quantity: 1,
      edgedSides: ["top"],
      fixedGrain: true,
    });
  }

  if (shelfCount > 0) {
    parts.push({
      title: `${name}: полка`,
      length: innerWidth - 2 * SHELF_CLEARANCE,
      width: D - SHELF_SETBACK,
      quantity: shelfCount,
      edgedSides: ["top"],
      fixedGrain: true,
      ...(led === "shelves" ? { milling: ledMilling(LED_SHELF_INDENT) } : {}),
    });
  }

  if (plinth > 0) {
    parts.push({
      title: `${name}: цоколь`,
      length: innerWidth,
      width: plinth,
      quantity: 1,
      edgedSides: ["top"],
      fixedGrain: true,
      hardware: [
        {
          ...createHardware("confirmatEdge", "left"),
          count: 1,
          offset: 0,
          mirror: true,
        },
      ],
    });
  }

  if (doors > 0) {
    const door = (label: string, hingeSide: "top" | "bottom") => ({
      title: `${name}: дверь${label}`,
      length: doorHeight,
      width: doorWidth,
      quantity: 1,
      edgedSides: [
        "top",
        "right",
        "bottom",
        "left",
      ] as CabinetPart["edgedSides"],
      fixedGrain: true,
      hardware: [
        {
          ...createHardware("hinge", hingeSide),
          count: hinges,
          offset: HINGE_OFFSET,
        },
      ],
    });
    if (doors === 1) parts.push(door("", "bottom"));
    else {
      parts.push(door(" левая", "bottom"));
      parts.push(door(" правая", "top"));
    }
  }

  // Ящики: короб из боковин и двух стенок между ними на конфирматах,
  // дно ХДФ снизу, фасад накладной на саморезах изнутри.
  let drawers: CabinetDrawers | null = null;
  if (drawerCount > 0) {
    const slide =
      [...DRAWER_SLIDE_LENGTHS].reverse().find((length) => length <= D - 30) ??
      0;
    const boxHeight = Math.floor((frontHeight - t - DRAWER_TOP_GAP) / 10) * 10;
    const boxWidth = round(innerWidth - 2 * DRAWER_SLIDE_GAP);
    if (slide === 0) problems.push("Корпус слишком мелкий для ящиков.");
    if (boxHeight < 60) problems.push("Фасад ящика слишком низкий для короба.");
    const frontsAt = Array.from({ length: drawerCount }, (_, index) =>
      round(plinth + DOOR_GAP + index * (frontHeight + DOOR_GAP)),
    );
    const boxesAt = frontsAt.map((at, index) =>
      round(Math.max(at, index === 0 ? bottomTop : at) + DRAWER_LIFT),
    );
    drawers = {
      count: drawerCount,
      frontWidth: round(W - 2 * DOOR_GAP),
      frontHeight,
      frontsAt,
      slide,
      boxHeight,
      boxWidth,
      boxesAt,
      bottom: { length: slide, width: boxWidth },
      shelfAt: fixedShelfAt,
    };
    if (slide > 0 && boxHeight >= 60) {
      parts.push(
        ...drawerBoxParts(name, slide, boxHeight, boxWidth, t, drawerCount),
      );
    }
    parts.push({
      title: `${name}: фасад ящика`,
      length: frontHeight,
      width: drawers.frontWidth,
      quantity: drawerCount,
      edgedSides: ["top", "right", "bottom", "left"],
      fixedGrain: true,
    });
  }

  const back = {
    length: round(H - plinth - 2 * BACK_OVERLAP_GAP),
    width: round(W - 2 * BACK_OVERLAP_GAP),
  };

  return {
    parts,
    back,
    problems,
    shelvesAt,
    doorWidth,
    doorHeight,
    drawers,
    kupe: null,
  };
}

// Шкаф-купе: корпус с перегородками на конфирматах, в каждой секции своё
// наполнение (полки, штанга под шляпной полкой, ящики с вкладными
// фасадами), двери-купе TopLine L на двух дорожках перед корпусом.
function buildKupe(spec: CabinetSpec, t: number): CabinetResult {
  const W = spec.width;
  const H = spec.height;
  const D = spec.depth;
  const plinth = Math.max(0, spec.plinth);
  const problems: string[] = [];
  const name = spec.name.trim() || CABINET_KINDS.kupe.label;
  const config = kupeSections(spec);
  const n = config.length;

  const innerWidth = W - 2 * t;
  const sectionWidth = round((innerWidth - (n - 1) * t) / n);
  if (!(sectionWidth >= 250 && H >= 2 * t + plinth + 600 && D >= 350)) {
    problems.push(
      "Слишком маленький шкаф-купе: секция уже 250 мм или глубина меньше 350 мм.",
    );
  }
  if (W > 2750 || H > 2750 || D > 1830) {
    problems.push("Деталь больше листа 2750 × 1830 мм — проверьте размеры.");
  }

  const joint: CabinetJoint = spec.joint ?? "minifix";
  const { sideHardware, roofHardware, confirmatPlaces } = bodyJoints(
    joint,
    t,
    D,
    plinth,
  );
  if ((spec.led ?? "none") !== "none") {
    problems.push(
      "Подсветку в шкафу-купе пока не считаем: добавьте профиль отдельно.",
    );
  }

  const bottomTop = plinth + t;
  const roofBottom = H - t;
  const partitions = Array.from({ length: n - 1 }, (_, index) =>
    round(t + (index + 1) * sectionWidth + index * t),
  );

  // Двери-купе: n дверей перекрывают ширину шкафа с перехлёстом.
  const doorWidth = round((W + (n - 1) * KUPE_OVERLAP) / n);
  const doorHeight = round(H - plinth - KUPE_HEIGHT_DEDUCTION);

  // Проём секции k, когда соседние двери сдвинуты: дверь k без
  // перехлёстов с соседними. Если проём уже секции, ящик упрётся в дверь —
  // ставим проставки из плиты у стенок секции (одинаково во всех секциях
  // с ящиками, чтобы ящики были одного размера).
  const spacerLayers = Math.max(
    0,
    ...config.map((_, index) => {
      const left = t + index * (sectionWidth + t);
      const openFrom =
        index * (doorWidth - KUPE_OVERLAP) + (index > 0 ? KUPE_OVERLAP : 0);
      const openTo =
        index * (doorWidth - KUPE_OVERLAP) +
        doorWidth -
        (index < n - 1 ? KUPE_OVERLAP : 0);
      const intrusion = Math.max(openFrom - left, left + sectionWidth - openTo);
      return intrusion > -KUPE_DOOR_CLEARANCE
        ? Math.ceil((intrusion + KUPE_DOOR_CLEARANCE) / t)
        : 0;
    }),
  );
  const spacer = spacerLayers * t;
  const drawerWidth = sectionWidth - 2 * spacer;

  // Ящики во всех секциях одного размера: вкладной фасад между проставками.
  const slide =
    [...DRAWER_SLIDE_LENGTHS]
      .reverse()
      .find((length) => length <= D - t - KUPE_FRONT_SETBACK - 30) ?? 0;
  const frontHeight = KUPE_DRAWER_FRONT;
  const boxHeight = Math.floor((frontHeight - 40) / 10) * 10;
  const boxWidth = round(drawerWidth - 2 * DRAWER_SLIDE_GAP);
  const maxDrawers = Math.max(...config.map((section) => section.drawers));
  const frontsAt = Array.from({ length: maxDrawers }, (_, index) =>
    round(bottomTop + DOOR_GAP + index * (frontHeight + DOOR_GAP)),
  );

  const sections: CabinetSection[] = config.map((section, index) => {
    const left = round(t + index * (sectionWidth + t));
    const shelfAt =
      section.drawers > 0
        ? round(bottomTop + section.drawers * (frontHeight + DOOR_GAP))
        : null;
    const from = shelfAt !== null ? shelfAt + t : bottomTop;
    if (section.rod) {
      // Шляпная полка у крыши, штанга под ней.
      const hat = round(roofBottom - KUPE_HAT_SPACE - t);
      const rodAt = round(hat - KUPE_ROD_BELOW_SHELF);
      if (rodAt - from < KUPE_HANGING_MIN) {
        problems.push(
          `Секция ${index + 1}: под штангой меньше ${KUPE_HANGING_MIN} мм — уберите ящики или увеличьте высоту.`,
        );
      }
      return {
        left,
        width: sectionWidth,
        shelvesAt: [hat],
        rodAt,
        drawers: section.drawers,
        shelfAt,
      };
    }
    const count = section.shelves;
    const step = (roofBottom - from - count * t) / (count + 1);
    if (step < 150) {
      problems.push(
        `Секция ${index + 1}: полки чаще 150 мм — уменьшите число полок.`,
      );
    }
    return {
      left,
      width: sectionWidth,
      shelvesAt: Array.from({ length: count }, (_, shelf) =>
        round(from + step * (shelf + 1) + t * shelf),
      ),
      rodAt: null,
      drawers: section.drawers,
      shelfAt,
    };
  });
  const heightsOf = (section: CabinetSection) => [
    ...(section.shelfAt !== null ? [section.shelfAt] : []),
    ...section.shelvesAt,
  ];
  // Полкодержатели: у боковины — от пола, у перегородки — от её низа
  // (над дном). В перегородке отверстия сквозные: полкодержатели с обеих
  // сторон.
  const pinsAt = (heights: number[], base: number, through: boolean) =>
    [...new Set(heights)].map((height) => ({
      ...createHardware("shelfPins", "top"),
      count: 1,
      offset: round(height - PIN_BELOW_SHELF - base),
      ...(through ? { holes: [{ diameter: 5, depth: 0 }] } : {}),
    }));

  const parts: CabinetPart[] = [];
  const sidePins = [heightsOf(sections[0]), heightsOf(sections[n - 1])];
  ["левая", "правая"].forEach((label, index) => {
    parts.push({
      title: `${name}: боковина ${label}`,
      length: H,
      width: D,
      quantity: 1,
      edgedSides: ["top"],
      fixedGrain: true,
      hardware: [...sideHardware(), ...pinsAt(sidePins[index], 0, false)],
    });
  });

  // Крыша и дно: крепёж к боковинам и сквозные Ø7 под конфирматы
  // перегородок (по центру толщины перегородки).
  const partitionScrews = (): HardwareItem[] =>
    partitions.map((left) => ({
      ...createHardware("faceRow", "left"),
      ...confirmatPlaces,
      indent: round(left + t / 2 - t),
      holes: [{ diameter: 7, depth: 0 }],
    }));
  for (const title of ["крыша", "дно"]) {
    parts.push({
      title: `${name}: ${title}`,
      length: innerWidth,
      width: D,
      quantity: 1,
      edgedSides: ["top"],
      fixedGrain: true,
      hardware: [...roofHardware(), ...partitionScrews()],
    });
  }

  partitions.forEach((_, index) => {
    const heights = [
      ...heightsOf(sections[index]),
      ...heightsOf(sections[index + 1]),
    ];
    parts.push({
      title: `${name}: перегородка ${index + 1}`,
      length: round(roofBottom - bottomTop),
      width: D,
      quantity: 1,
      edgedSides: ["top"],
      fixedGrain: true,
      hardware: [
        {
          ...createHardware("confirmatEdge", "left"),
          ...confirmatPlaces,
          mirror: true,
        },
        ...pinsAt(heights, bottomTop, true),
      ],
    });
  });

  const shelfLength = round(sectionWidth - 2 * SHELF_CLEARANCE);
  const drawerSections = sections.filter((section) => section.shelfAt !== null);
  if (drawerSections.length > 0) {
    parts.push({
      title: `${name}: полка над ящиками`,
      length: shelfLength,
      width: D - SHELF_SETBACK,
      quantity: drawerSections.length,
      edgedSides: ["top"],
      fixedGrain: true,
    });
  }
  const shelfCount = sections.reduce(
    (sum, section) => sum + section.shelvesAt.length,
    0,
  );
  if (shelfCount > 0) {
    parts.push({
      title: `${name}: полка`,
      length: shelfLength,
      width: D - SHELF_SETBACK,
      quantity: shelfCount,
      edgedSides: ["top"],
      fixedGrain: true,
    });
  }

  if (plinth > 0) {
    parts.push({
      title: `${name}: цоколь`,
      length: innerWidth,
      width: plinth,
      quantity: 1,
      edgedSides: ["top"],
      fixedGrain: true,
      hardware: [
        {
          ...createHardware("confirmatEdge", "left"),
          count: 1,
          offset: 0,
          mirror: true,
        },
      ],
    });
  }

  const drawerCount = sections.reduce(
    (sum, section) => sum + section.drawers,
    0,
  );
  let drawers: CabinetDrawers | null = null;
  if (drawerCount > 0) {
    if (slide === 0) problems.push("Корпус слишком мелкий для ящиков.");
    drawers = {
      count: drawerCount,
      frontWidth: round(drawerWidth - 2 * KUPE_FRONT_GAP),
      frontHeight,
      frontsAt,
      slide,
      boxHeight,
      boxWidth,
      boxesAt: frontsAt.map((at) => round(at + DRAWER_LIFT)),
      bottom: { length: slide, width: boxWidth },
      shelfAt: null,
      inset: KUPE_FRONT_SETBACK,
      spacer,
    };
    // Проставки: по высоте блока ящиков, на глубину направляющей; на
    // каждую сторону секции по spacerLayers слоёв.
    if (spacer > 0) {
      const byCount = new Map<number, number>();
      for (const section of sections) {
        if (section.drawers > 0) {
          byCount.set(section.drawers, (byCount.get(section.drawers) ?? 0) + 1);
        }
      }
      for (const [count, sectionsWith] of byCount) {
        parts.push({
          title: `${name}: проставка ящиков${byCount.size > 1 ? ` (${count} ящ.)` : ""}`,
          length: slide,
          width: round(count * (frontHeight + DOOR_GAP) - DOOR_GAP),
          quantity: 2 * spacerLayers * sectionsWith,
          edgedSides: ["left"],
          fixedGrain: true,
        });
      }
    }
    if (slide > 0) {
      parts.push(
        ...drawerBoxParts(name, slide, boxHeight, boxWidth, t, drawerCount),
      );
    }
    parts.push({
      title: `${name}: фасад ящика`,
      length: frontHeight,
      width: drawers.frontWidth,
      quantity: drawerCount,
      edgedSides: ["top", "right", "bottom", "left"],
      fixedGrain: true,
    });
  }

  parts.push({
    title: `${name}: дверь купе`,
    length: doorHeight,
    width: doorWidth,
    quantity: n,
    edgedSides: ["top", "right", "bottom", "left"],
    fixedGrain: true,
  });

  return {
    parts,
    back: {
      length: round(H - plinth - 2 * BACK_OVERLAP_GAP),
      width: round(W - 2 * BACK_OVERLAP_GAP),
    },
    problems,
    shelvesAt: sections.flatMap((section) => section.shelvesAt),
    doorWidth,
    doorHeight,
    drawers,
    kupe: {
      sections,
      partitions,
      doors: {
        count: n,
        width: doorWidth,
        height: doorHeight,
        bottom: round(plinth + KUPE_DOOR_LIFT),
        overlap: KUPE_OVERLAP,
        tracks: Array.from({ length: n }, (_, index) =>
          index % 2 === 0
            ? KUPE_TRACK_GAP
            : KUPE_TRACK_GAP + t + KUPE_TRACK_STEP,
        ),
      },
      rodLength: round(sectionWidth - 4),
    },
  };
}
