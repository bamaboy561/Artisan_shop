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

// Наполнение секции шкафа-купе (над ящиками или полкой для обуви).
export type KupeFill =
  | "shelves"
  | "rod"
  | "twoRods"
  | "rodShelves"
  | "rodTrousers";

export const KUPE_FILLS: Record<KupeFill, string> = {
  shelves: "Полки",
  rod: "Штанга (длинные вещи)",
  twoRods: "Две штанги",
  rodShelves: "Штанга и полки",
  rodTrousers: "Штанга и брючница",
};

// Секция шкафа-купе: ширина (0 — поровну с другими), наполнение, ящики
// или полка для обуви внизу.
export type KupeSection = {
  width?: number;
  fill?: KupeFill;
  shelves: number;
  drawers: number;
  shoes?: boolean;
  // Старое поле: штанга вместо полок.
  rod?: boolean;
};

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
  slidingDoors?: 2 | 3 | 4;
  sections?: KupeSection[];
  // Антресоль: полка на 400 мм ниже крыши во всех секциях.
  antresol?: boolean;
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
      antresol: true,
      sections: [
        { fill: "shelves", shelves: 3, drawers: 2 },
        { fill: "twoRods", shelves: 0, drawers: 0 },
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
// Антресоль и шляпная полка над штангой: на столько ниже крыши.
const KUPE_HAT_SPACE = 400;
const KUPE_ROD_BELOW_SHELF = 70;
// Висят: длинные вещи от 1300 мм, короткие от 800 мм (две штанги).
const KUPE_HANGING_LONG = 1300;
const KUPE_HANGING_SHORT = 800;
// Штанга и полки: под штангой 1000 мм, ниже полки.
const KUPE_ROD_ZONE = 1000;
// Полка для обуви над дном, мм.
const KUPE_SHOE_HEIGHT = 300;
const KUPE_MIN_SECTION = 250;
const KUPE_FRONT_GAP = 2; // вкладной фасад ящика от боковин секции, мм
const KUPE_DRAWER_FRONT = 180;
const KUPE_FRONT_SETBACK = 30;
// Зазор ящика до кромки двери-купе в открытом проёме, мм.
const KUPE_DOOR_CLEARANCE = 5;

const DEFAULT_SECTION: KupeSection = {
  fill: "shelves",
  shelves: 4,
  drawers: 0,
};

export function kupeDoorCount(spec: CabinetSpec): 2 | 3 | 4 {
  return spec.slidingDoors === 3 || spec.slidingDoors === 4
    ? spec.slidingDoors
    : 2;
}

// Секции купе: по умолчанию по одной на дверь, можно от 1 до 5.
export function kupeSections(spec: CabinetSpec): KupeSection[] {
  const list = spec.sections?.length
    ? spec.sections.slice(0, 5)
    : Array.from({ length: kupeDoorCount(spec) }, () => DEFAULT_SECTION);
  return list.map((section) => {
    const drawers = Math.max(0, Math.min(5, Math.round(section.drawers || 0)));
    return {
      width: Math.max(0, Math.round(section.width || 0)),
      fill: section.fill ?? (section.rod ? "rod" : "shelves"),
      shelves: Math.max(0, Math.min(10, Math.round(section.shelves || 0))),
      drawers,
      shoes: drawers === 0 && Boolean(section.shoes),
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
  // Купе: днища ящиков разных секций (ширина секций может различаться).
  bottoms?: Array<{ length: number; width: number; count: number }>;
};

// Секция купе: внутренний проём от left шириной width, мм. Высоты — низ
// детали от пола.
export type CabinetSection = {
  index: number;
  left: number;
  width: number;
  fill: KupeFill;
  // Съёмные полки на полкодержателях: высота и вид полки.
  shelves: Array<{ at: number; kind: string }>;
  rods: number[];
  trousersAt: number | null;
  drawers: number;
  // Ящики секции: фасад и короб между проставками.
  drawer: {
    frontLeft: number;
    frontWidth: number;
    boxLeft: number;
    boxWidth: number;
    spacerLeft: number;
    spacerRight: number;
  } | null;
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
};

// Части названия детали купе: «полка, секция 2».
export function sectionSuffix(index: number) {
  return `, секция ${index + 1}`;
}

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
  suffix = "",
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
      title: `${name}: ящик боковина${suffix}`,
      length: slide,
      width: boxHeight,
      quantity: 2 * count,
      edgedSides: ["top"],
      fixedGrain: true,
      hardware: [boxScrews("left"), boxScrews("right")],
    },
    {
      title: `${name}: ящик стенка${suffix}`,
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

// Шкаф-купе: корпус с перегородками на конфирматах, секции своей ширины.
// В секции снизу ящики с вкладными фасадами или полка для обуви, выше
// наполнение (полки, штанги, брючница), сверху антресоль. Двери-купе
// TopLine L на двух дорожках перед корпусом.
function buildKupe(spec: CabinetSpec, t: number): CabinetResult {
  const W = spec.width;
  const H = spec.height;
  const D = spec.depth;
  const plinth = Math.max(0, spec.plinth);
  const problems: string[] = [];
  const name = spec.name.trim() || CABINET_KINDS.kupe.label;
  const config = kupeSections(spec);
  const k = config.length;
  const n = kupeDoorCount(spec);
  const antresol = spec.antresol ?? true;

  // Ширины секций: заданные как есть, остальное поровну.
  const span = W - 2 * t - (k - 1) * t;
  const fixed = config.reduce((sum, section) => sum + (section.width ?? 0), 0);
  const autoCount = config.filter((section) => !section.width).length;
  const autoWidth = autoCount > 0 ? (span - fixed) / autoCount : 0;
  const widths = config.map((section) =>
    round(section.width ? section.width : autoWidth),
  );
  const widthSum = widths.reduce((sum, width) => sum + width, 0);
  if (Math.abs(widthSum - span) > 1) {
    problems.push(
      `Сумма ширин секций ${Math.round(widthSum)} мм, а внутри шкафа ${Math.round(span)} мм: оставьте одну секцию «авто» или поправьте ширины.`,
    );
  }
  if (widths.some((width) => width < KUPE_MIN_SECTION)) {
    problems.push(
      `Секция уже ${KUPE_MIN_SECTION} мм — уменьшите число секций.`,
    );
  }
  if (H < 2 * t + plinth + 600 || D < 350) {
    problems.push("Слишком маленький шкаф-купе: высота или глубина.");
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
  const lefts: number[] = [];
  widths.reduce((x, width) => {
    lefts.push(round(x));
    return x + width + t;
  }, t);
  const partitions = lefts.slice(1).map((left) => round(left - t));

  // Двери-купе: n дверей перекрывают ширину шкафа с перехлёстом.
  const doorWidth = round((W + (n - 1) * KUPE_OVERLAP) / n);
  const doorHeight = round(H - plinth - KUPE_HEIGHT_DEDUCTION);
  // Проём двери j, когда соседние сдвинуты: дверь без перехлёстов.
  const windows = Array.from({ length: n }, (_, j) => {
    const from = j * (doorWidth - KUPE_OVERLAP);
    return {
      from: from + (j > 0 ? KUPE_OVERLAP : 0),
      to: from + doorWidth - (j < n - 1 ? KUPE_OVERLAP : 0),
    };
  });

  // Ящики: одна направляющая и одна высота фасада во всех секциях.
  const slide =
    [...DRAWER_SLIDE_LENGTHS]
      .reverse()
      .find((length) => length <= D - t - KUPE_FRONT_SETBACK - 30) ?? 0;
  const frontHeight = KUPE_DRAWER_FRONT;
  const boxHeight = Math.floor((frontHeight - 40) / 10) * 10;
  const maxDrawers = Math.max(0, ...config.map((section) => section.drawers));
  const frontsAt = Array.from({ length: maxDrawers }, (_, index) =>
    round(bottomTop + DOOR_GAP + index * (frontHeight + DOOR_GAP)),
  );

  const sections: CabinetSection[] = config.map((section, index) => {
    const left = lefts[index];
    const width = widths[index];
    const label = `Секция ${index + 1}`;
    const shelves: CabinetSection["shelves"] = [];
    const rods: number[] = [];
    let trousersAt: number | null = null;

    // Низ секции: ящики под полкой или полка для обуви.
    let from = bottomTop;
    if (section.drawers > 0) {
      const at = round(bottomTop + section.drawers * (frontHeight + DOOR_GAP));
      shelves.push({ at, kind: "полка над ящиками" });
      from = at + t;
    } else if (section.shoes) {
      const at = round(bottomTop + KUPE_SHOE_HEIGHT);
      shelves.push({ at, kind: "полка для обуви" });
      from = at + t;
    }
    // Верх секции: антресоль или (для штанги) шляпная полка.
    const hatAt = round(roofBottom - KUPE_HAT_SPACE - t);
    let top = roofBottom;
    const fill = section.fill ?? "shelves";
    if (antresol) {
      shelves.push({ at: hatAt, kind: "полка антресоли" });
      top = hatAt;
    } else if (fill !== "shelves") {
      shelves.push({ at: hatAt, kind: "полка" });
      top = hatAt;
    }
    const spread = (count: number, low: number, high: number) => {
      const step = (high - low - count * t) / (count + 1);
      if (count > 0 && step < 150) {
        problems.push(`${label}: полки чаще 150 мм — уменьшите число полок.`);
      }
      for (let shelf = 0; shelf < count; shelf += 1) {
        shelves.push({
          at: round(low + step * (shelf + 1) + t * shelf),
          kind: "полка",
        });
      }
    };
    const hang = (rodAt: number, low: number, need: number) => {
      if (rodAt - low < need) {
        problems.push(
          `${label}: под штангой ${Math.round(rodAt - low)} мм, нужно от ${need} мм.`,
        );
      }
    };

    if (fill === "shelves") {
      spread(section.shelves, from, top);
    } else if (fill === "rod") {
      rods.push(round(top - KUPE_ROD_BELOW_SHELF));
      hang(rods[0], from, KUPE_HANGING_LONG);
    } else if (fill === "twoRods" || fill === "rodTrousers") {
      const mid = round(from + (top - from - t) / 2);
      shelves.push({ at: mid, kind: "полка" });
      rods.push(round(top - KUPE_ROD_BELOW_SHELF));
      hang(rods[0], mid + t, KUPE_HANGING_SHORT);
      if (fill === "twoRods") {
        rods.push(round(mid - KUPE_ROD_BELOW_SHELF));
        hang(rods[1], from, KUPE_HANGING_SHORT);
      } else {
        // Брючница крепится под полкой, брюки висят под ней.
        trousersAt = mid;
      }
    } else {
      const shelfAt = round(top - KUPE_ROD_ZONE - t);
      rods.push(round(top - KUPE_ROD_BELOW_SHELF));
      if (shelfAt - from < 150) {
        problems.push(`${label}: под штангой не остаётся места для полок.`);
      } else {
        shelves.push({ at: shelfAt, kind: "полка" });
        spread(section.shelves, from, shelfAt);
      }
    }

    // Ящики выходят в проём двери, с которой секция больше всего
    // совпадает; где проём уже секции — проставки целыми слоями плиты.
    let drawer: CabinetSection["drawer"] = null;
    if (section.drawers > 0) {
      const right = left + width;
      const best = windows.reduce((found, win) =>
        Math.min(right, win.to) - Math.max(left, win.from) >
        Math.min(right, found.to) - Math.max(left, found.from)
          ? win
          : found,
      );
      const layers = (intrusion: number) =>
        intrusion > -KUPE_DOOR_CLEARANCE
          ? Math.ceil((intrusion + KUPE_DOOR_CLEARANCE) / t) * t
          : 0;
      const spacerLeft = layers(best.from - left);
      const spacerRight = layers(right - best.to);
      const inner = width - spacerLeft - spacerRight;
      if (spacerLeft + spacerRight > 4 * t || inner < KUPE_MIN_SECTION) {
        problems.push(
          `${label}: ящик не проходит в проём между дверями — поставьте перегородку напротив перехлёста дверей.`,
        );
      }
      drawer = {
        frontLeft: round(left + spacerLeft + KUPE_FRONT_GAP),
        frontWidth: round(inner - 2 * KUPE_FRONT_GAP),
        boxLeft: round(left + spacerLeft + DRAWER_SLIDE_GAP),
        boxWidth: round(inner - 2 * DRAWER_SLIDE_GAP),
        spacerLeft,
        spacerRight,
      };
    }

    return {
      index,
      left,
      width,
      fill,
      shelves: shelves.sort((a, b) => a.at - b.at),
      rods,
      trousersAt,
      drawers: section.drawers,
      drawer,
    };
  });

  // Полкодержатели: у боковины — от пола, у перегородки — от её низа (над
  // дном), отверстия в перегородке сквозные: держат полки с обеих сторон.
  const heightsOf = (section: CabinetSection) =>
    section.shelves.map((shelf) => shelf.at);
  const pinsAt = (heights: number[], base: number, through: boolean) =>
    [...new Set(heights)].map((height) => ({
      ...createHardware("shelfPins", "top"),
      count: 1,
      offset: round(height - PIN_BELOW_SHELF - base),
      ...(through ? { holes: [{ diameter: 5, depth: 0 }] } : {}),
    }));

  const parts: CabinetPart[] = [];
  const sidePins = [heightsOf(sections[0]), heightsOf(sections[k - 1])];
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
      length: round(W - 2 * t),
      width: D,
      quantity: 1,
      edgedSides: ["top"],
      fixedGrain: true,
      hardware: [...roofHardware(), ...partitionScrews()],
    });
  }

  partitions.forEach((_, index) => {
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
        ...pinsAt(
          [...heightsOf(sections[index]), ...heightsOf(sections[index + 1])],
          bottomTop,
          true,
        ),
      ],
    });
  });

  if (plinth > 0) {
    parts.push({
      title: `${name}: цоколь`,
      length: round(W - 2 * t),
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

  // Полки секции: по строке на вид полки.
  for (const section of sections) {
    const suffix = sectionSuffix(section.index);
    const kinds = new Map<string, number>();
    for (const shelf of section.shelves) {
      kinds.set(shelf.kind, (kinds.get(shelf.kind) ?? 0) + 1);
    }
    for (const [kind, quantity] of kinds) {
      parts.push({
        title: `${name}: ${kind}${suffix}`,
        length: round(section.width - 2 * SHELF_CLEARANCE),
        width: D - SHELF_SETBACK,
        quantity,
        edgedSides: ["top"],
        fixedGrain: true,
      });
    }
  }

  // Ящики по секциям.
  const drawerCount = sections.reduce(
    (sum, section) => sum + section.drawers,
    0,
  );
  let drawers: CabinetDrawers | null = null;
  if (drawerCount > 0) {
    if (slide === 0) problems.push("Корпус слишком мелкий для ящиков.");
    const withDrawers = sections.filter((section) => section.drawer);
    const first = withDrawers[0].drawer!;
    drawers = {
      count: drawerCount,
      frontWidth: first.frontWidth,
      frontHeight,
      frontsAt,
      slide,
      boxHeight,
      boxWidth: first.boxWidth,
      boxesAt: frontsAt.map((at) => round(at + DRAWER_LIFT)),
      bottom: { length: slide, width: first.boxWidth },
      shelfAt: null,
      inset: KUPE_FRONT_SETBACK,
      spacer: first.spacerLeft,
      bottoms: withDrawers.map((section) => ({
        length: slide,
        width: section.drawer!.boxWidth,
        count: section.drawers,
      })),
    };
    for (const section of withDrawers) {
      const suffix = sectionSuffix(section.index);
      const box = section.drawer!;
      if (slide > 0) {
        parts.push(
          ...drawerBoxParts(
            name,
            slide,
            boxHeight,
            box.boxWidth,
            t,
            section.drawers,
            suffix,
          ),
        );
      }
      parts.push({
        title: `${name}: фасад ящика${suffix}`,
        length: frontHeight,
        width: box.frontWidth,
        quantity: section.drawers,
        edgedSides: ["top", "right", "bottom", "left"],
        fixedGrain: true,
      });
      // Проставки: по высоте блока ящиков, на глубину направляющей.
      const layers = (box.spacerLeft + box.spacerRight) / t;
      if (layers > 0) {
        parts.push({
          title: `${name}: проставка ящиков${suffix}`,
          length: slide,
          width: round(section.drawers * (frontHeight + DOOR_GAP) - DOOR_GAP),
          quantity: layers,
          edgedSides: ["left"],
          fixedGrain: true,
        });
      }
    }
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
    shelvesAt: sections.flatMap(heightsOf),
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
    },
  };
}
