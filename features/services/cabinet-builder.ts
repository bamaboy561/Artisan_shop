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

// Зона секции купе: участок по высоте между двумя полками. Секция
// собирается из зон сверху вниз, между соседними зонами — полка.
export type ZoneKind =
  | "antresol"
  | "shelves"
  | "rod"
  | "drawers"
  | "trays"
  | "trousers"
  | "shoes"
  | "split";

export const ZONE_KINDS: Record<
  ZoneKind,
  {
    label: string;
    count?: { label: string; min: number; max: number; default: number };
  }
> = {
  antresol: { label: "Антресоль" },
  shelves: {
    label: "Полки",
    count: { label: "Полок внутри", min: 0, max: 8, default: 2 },
  },
  rod: { label: "Штанга (вешалки)" },
  drawers: {
    label: "Ящики",
    count: { label: "Ящиков", min: 1, max: 6, default: 2 },
  },
  trays: {
    label: "Выдвижные полки (рубашки)",
    count: { label: "Полок", min: 1, max: 6, default: 2 },
  },
  trousers: { label: "Брючница" },
  shoes: {
    label: "Обувь",
    count: { label: "Полок для обуви", min: 0, max: 4, default: 1 },
  },
  split: {
    label: "Полки в две колонки",
    count: { label: "Полок в колонке", min: 0, max: 6, default: 2 },
  },
};

// height — высота зоны в свету, мм; 0 или пусто — поровну с другими
// такими зонами. Ящики и выдвижные полки берут высоту по своему числу.
export type KupeZone = { kind: ZoneKind; count?: number; height?: number };

// Готовое наполнение секции: зоны сверху вниз.
const A: KupeZone = { kind: "antresol", height: 400 };
export const KUPE_SECTION_TEMPLATES: Array<{
  label: string;
  zones: KupeZone[];
}> = [
  { label: "Полки", zones: [A, { kind: "shelves", count: 4 }] },
  { label: "Длинная штанга", zones: [A, { kind: "rod" }] },
  { label: "Две штанги", zones: [A, { kind: "rod" }, { kind: "rod" }] },
  {
    label: "Штанга и полки",
    zones: [A, { kind: "rod", height: 1000 }, { kind: "shelves", count: 2 }],
  },
  {
    label: "Длинная штанга и 2 ящика",
    zones: [A, { kind: "rod" }, { kind: "drawers", count: 2 }],
  },
  {
    label: "Штанга и 4 ящика",
    zones: [A, { kind: "rod" }, { kind: "drawers", count: 4 }],
  },
  {
    label: "Полки и 3 ящика",
    zones: [A, { kind: "shelves", count: 3 }, { kind: "drawers", count: 3 }],
  },
  {
    label: "Полки, выдвижные полки и ящики",
    zones: [
      A,
      { kind: "shelves", count: 1 },
      { kind: "trays", count: 2 },
      { kind: "shelves", count: 0, height: 360 },
      { kind: "drawers", count: 2 },
    ],
  },
  {
    label: "Полки и 3 выдвижные полки",
    zones: [
      A,
      { kind: "shelves", count: 2 },
      { kind: "trays", count: 3 },
      { kind: "shelves", count: 0, height: 330 },
    ],
  },
  {
    label: "Полки и брючница",
    zones: [
      A,
      { kind: "shelves", count: 1 },
      { kind: "trousers", height: 920 },
    ],
  },
  {
    label: "Полки, ящик и брючница",
    zones: [
      A,
      { kind: "shelves", count: 1 },
      { kind: "drawers", count: 1 },
      { kind: "trousers", height: 920 },
    ],
  },
  {
    label: "Штанга и брючница",
    zones: [A, { kind: "rod" }, { kind: "trousers", height: 800 }],
  },
  {
    label: "Длинная штанга и обувь",
    zones: [A, { kind: "rod" }, { kind: "shoes", count: 1 }],
  },
  {
    label: "Штанга и полки в две колонки",
    zones: [A, { kind: "rod" }, { kind: "split", count: 2, height: 900 }],
  },
];

// Схемы шкафа с фото Султана: секции слева направо, ширина — доля от
// ширины внутри (последняя секция — остаток).
export const KUPE_SCHEMES: Array<{
  label: string;
  sections: Array<{ share?: number; zones: KupeZone[] }>;
}> = (() => {
  const twoRods: KupeZone[] = [A, { kind: "rod" }, { kind: "rod" }];
  const narrow = 564 / 1328;
  const left = (label: string, zones: KupeZone[]) => ({
    label,
    sections: [{ share: narrow, zones }, { zones: twoRods }],
  });
  const four = [564, 764, 818].map((width) => width / 2710);
  return [
    left("2 секции: длинная штанга и две штанги", [
      A,
      { kind: "rod", height: 1436 },
      { kind: "shelves", count: 0 },
    ]),
    left("2 секции: полки, 3 выдвижные полки и две штанги", [
      A,
      { kind: "shelves", count: 2 },
      { kind: "trays", count: 3 },
      { kind: "shelves", count: 0, height: 330 },
    ]),
    {
      label: "2 секции: штанга с брючницей и длинная штанга",
      sections: [
        {
          share: narrow,
          zones: [A, { kind: "rod", height: 1000 }, { kind: "trousers" }],
        },
        {
          zones: [
            A,
            { kind: "rod", height: 1464 },
            { kind: "shelves", count: 0 },
          ],
        },
      ],
    },
    left("2 секции: полки, выдвижные полки, ящики и две штанги", [
      A,
      { kind: "shelves", count: 1 },
      { kind: "trays", count: 2 },
      { kind: "shelves", count: 0, height: 360 },
      { kind: "drawers", count: 2 },
    ]),
    left("2 секции: полки с брючницей и две штанги", [
      A,
      { kind: "shelves", count: 1 },
      { kind: "trousers", height: 920 },
    ]),
    left("2 секции: штанга, 4 ящика и две штанги", [
      A,
      { kind: "rod", height: 914 },
      { kind: "drawers", count: 4 },
    ]),
    left("2 секции: длинная штанга, 2 ящика и две штанги", [
      A,
      { kind: "rod" },
      { kind: "drawers", count: 2 },
    ]),
    left("2 секции: полки, ящик, брючница и две штанги", [
      A,
      { kind: "shelves", count: 1 },
      { kind: "drawers", count: 1 },
      { kind: "trousers", height: 920 },
    ]),
    left("2 секции: полки и две штанги", [A, { kind: "shelves", count: 4 }]),
    {
      label:
        "4 секции: штанга с брючницей, две штанги, длинная, полки с брючницей",
      sections: [
        {
          share: four[0],
          zones: [A, { kind: "rod" }, { kind: "trousers", height: 772 }],
        },
        { share: four[1], zones: twoRods },
        {
          share: four[2],
          zones: [
            A,
            { kind: "rod", height: 1300 },
            { kind: "shelves", count: 0 },
          ],
        },
        {
          zones: [
            A,
            { kind: "shelves", count: 2 },
            { kind: "trousers", height: 772 },
          ],
        },
      ],
    },
    {
      label:
        "4 секции: полки с ящиками, две штанги, длинная, штанга с брючницей",
      sections: [
        {
          share: four[0],
          zones: [
            A,
            { kind: "shelves", count: 3 },
            { kind: "drawers", count: 4 },
          ],
        },
        { share: four[1], zones: twoRods },
        {
          share: four[2],
          zones: [
            A,
            { kind: "rod", height: 1300 },
            { kind: "shelves", count: 0 },
          ],
        },
        {
          zones: [A, { kind: "rod" }, { kind: "trousers", height: 772 }],
        },
      ],
    },
    {
      label: "3 секции: штанга с брючницей, штанга с ящиками, длинная штанга",
      sections: [
        {
          share: 1 / 3,
          zones: [A, { kind: "rod" }, { kind: "trousers", height: 800 }],
        },
        {
          share: 1 / 3,
          zones: [A, { kind: "rod" }, { kind: "drawers", count: 3 }],
        },
        {
          zones: [
            A,
            { kind: "rod", height: 1414 },
            { kind: "shelves", count: 0 },
          ],
        },
      ],
    },
  ];
})();

// Секции шкафа по схеме для ширины width и плиты t.
export function kupeSchemeSections(
  scheme: (typeof KUPE_SCHEMES)[number],
  width: number,
  t: number,
): KupeSection[] {
  const k = scheme.sections.length;
  const span = width - 2 * t - (k - 1) * t;
  return scheme.sections.map((section) => ({
    width: section.share ? Math.round(span * section.share) : 0,
    zones: section.zones.map((zone) => ({ ...zone })),
  }));
}

// Секция шкафа-купе: ширина (0 — поровну с другими) и зоны сверху вниз.
// Старые поля (fill, shelves, drawers, shoes, rod) читаются, если зон нет.
export type KupeSection = {
  width?: number;
  zones?: KupeZone[];
  fill?: KupeFill;
  shelves?: number;
  drawers?: number;
  shoes?: boolean;
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
  // Старое поле: антресоль во всех секциях без своих зон.
  antresol?: boolean;
  // Кухонные модули. Одна дверь — на левой или правой боковине.
  hinge?: "left" | "right";
  // Глухая часть фасада у угла: дверь уже на width мм с этой стороны,
  // там прикручена заглушка.
  blind?: { side: "left" | "right"; width: number };
  // Тумба под мойку: вместо крыши две царги спереди и сзади.
  rails?: boolean;
  // Ящики внизу без дверей, выше открытая ниша (под духовку).
  openAbove?: boolean;
  // Подъёмная дверь навесного шкафа: без петель, на подъёмнике.
  lift?: boolean;
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
        {
          zones: [
            { kind: "antresol", height: 400 },
            { kind: "shelves", count: 3 },
            { kind: "drawers", count: 2 },
          ],
        },
        {
          zones: [
            { kind: "antresol", height: 400 },
            { kind: "rod" },
            { kind: "rod" },
          ],
        },
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
const KUPE_DOOR_MIN_WIDTH = 500;
const KUPE_DOOR_MAX_WIDTH = 1500;
const KUPE_DOOR_MAX_HEIGHT = 2600;
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
// Выдвижная полка: шаг по высоте, бортик спереди, над нижней полкой.
const KUPE_TRAY_PITCH = 150;
export const KUPE_TRAY_BOX = 80;
const KUPE_TRAY_LIFT = 30;
// Зона короче этого не строится, мм.
const KUPE_MIN_ZONE = 100;
// Брючнице нужно места под полкой, мм.
const KUPE_TROUSERS_HEIGHT = 700;
const KUPE_MIN_SECTION = 250;
const KUPE_FRONT_GAP = 2; // вкладной фасад ящика от боковин секции, мм
const KUPE_DRAWER_FRONT = 180;
const KUPE_FRONT_SETBACK = 30;
// Зазор ящика до кромки двери-купе в открытом проёме, мм.
const KUPE_DOOR_CLEARANCE = 5;

const DEFAULT_SECTION: KupeSection = {
  zones: [{ kind: "shelves", count: 4 }],
};

// Зоны из старых полей секции: наполнение, ящики или обувь внизу,
// антресоль (или шляпная полка над штангой) сверху.
function legacyZones(section: KupeSection, antresol: boolean): KupeZone[] {
  const fill = section.fill ?? (section.rod ? "rod" : "shelves");
  const shelves = section.shelves ?? 0;
  const zones: KupeZone[] = [];
  if (antresol) zones.push({ kind: "antresol", height: KUPE_HAT_SPACE });
  else if (fill !== "shelves") {
    zones.push({ kind: "shelves", count: 0, height: KUPE_HAT_SPACE });
  }
  if (fill === "shelves") zones.push({ kind: "shelves", count: shelves });
  else if (fill === "rod") zones.push({ kind: "rod" });
  else if (fill === "twoRods") zones.push({ kind: "rod" }, { kind: "rod" });
  else if (fill === "rodTrousers") {
    zones.push({ kind: "rod" }, { kind: "trousers" });
  } else {
    zones.push(
      { kind: "rod", height: KUPE_ROD_ZONE },
      { kind: "shelves", count: shelves },
    );
  }
  const drawers = Math.round(section.drawers ?? 0);
  if (drawers > 0) zones.push({ kind: "drawers", count: drawers });
  else if (section.shoes) {
    zones.push({ kind: "shoes", count: 0, height: KUPE_SHOE_HEIGHT });
  }
  return zones;
}

function normalizeZone(zone: KupeZone): KupeZone {
  const kind: ZoneKind = zone.kind in ZONE_KINDS ? zone.kind : "shelves";
  const limits = ZONE_KINDS[kind].count;
  const height = Math.max(0, Math.round(zone.height || 0));
  return {
    kind,
    ...(limits
      ? {
          count: Math.max(
            limits.min,
            Math.min(limits.max, Math.round(zone.count ?? limits.default)),
          ),
        }
      : {}),
    ...(height > 0 ? { height } : {}),
  };
}

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
  const antresol = spec.antresol ?? true;
  return list.map((section) => {
    const source = section.zones?.length
      ? section.zones
      : legacyZones(section, antresol);
    const zones = source.slice(0, 8).map(normalizeZone);
    return {
      width: Math.max(0, Math.round(section.width || 0)),
      zones: zones.length > 0 ? zones : [{ kind: "shelves", count: 0 }],
    };
  });
}

// Высота зоны, которую задают ящики или выдвижные полки, мм в свету.
function zoneNaturalHeight(zone: KupeZone, t: number) {
  const count = zone.count ?? 0;
  if (zone.kind === "drawers") return count * (KUPE_DRAWER_FRONT + DOOR_GAP);
  if (zone.kind === "trays") return count * KUPE_TRAY_PITCH;
  if (zone.kind === "antresol") return KUPE_HAT_SPACE;
  if (zone.kind === "shoes") {
    return (count + 1) * KUPE_SHOE_HEIGHT + count * t;
  }
  return 0;
}

// Зазоры и отступы, принятые в мебельных программах по умолчанию.
const DOOR_GAP = 3; // между дверями и по краям, мм
const RAIL_WIDTH = 100; // царга тумбы под мойку, мм
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
  // Купе: выдвижных полок на тех же направляющих.
  trays?: number;
};

// Секция купе: внутренний проём от left шириной width, мм. Высоты — низ
// детали от пола.
export type CabinetSection = {
  index: number;
  left: number;
  width: number;
  // Зоны сверху вниз: низ зоны и высота в свету.
  zones: Array<KupeZone & { from: number; height: number }>;
  // Полки на полкодержателях: высота и вид полки. Полки колонок — со своим
  // левым краем и шириной.
  shelves: Array<{ at: number; kind: string; left?: number; width?: number }>;
  rods: number[];
  // Брючницы: низ полки, под которой висит рамка.
  trousers: number[];
  // Стойки зон «две колонки»: левая грань, низ, высота.
  stands: Array<{ left: number; at: number; height: number; kind?: string }>;
  drawers: number;
  trays: number;
  // Ящики и выдвижные полки секции: между проставками, в проёме двери.
  drawer: {
    frontLeft: number;
    frontWidth: number;
    boxLeft: number;
    boxWidth: number;
    spacerLeft: number;
    spacerRight: number;
    // Низы фасадов и коробов ящиков, низы выдвижных полок.
    frontsAt: number[];
    boxesAt: number[];
    traysAt: number[];
    // Блоки под проставки: низ и высота.
    drawerBlock: { at: number; height: number } | null;
    trayBlock: { at: number; height: number } | null;
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

// Сдвинуть или вернуть на место дверь-купе index. shifts — насколько
// каждая дверь сейчас сдвинута от своего места, мм (минус — влево).
// Дверь едет по своей дорожке: передняя проходит перед соседней задней,
// задняя — за передней. Двери одной дорожки друг через друга не проходят,
// и дверь не выходит за края шкафа. Сдвигаемая дверь закрывает соседнюю
// с перехлёстом целиком, если ей хватает места; едет туда, где места
// больше (передняя при равенстве влево, задняя вправо). Закрытая дверь
// возвращается на место и отодвигает назад двери своей дорожки, которые
// заехали на её место.
export function slideKupeDoor(
  doors: Pick<KupeLayout["doors"], "count" | "width" | "overlap">,
  shifts: number[],
  index: number,
): number[] {
  const { count, width: w, overlap: o } = doors;
  const step = w - o;
  const total = count * w - (count - 1) * o;
  const next = Array.from({ length: count }, (_, j) => shifts[j] ?? 0);
  const at = (j: number) => j * step + next[j];
  if (index < 0 || index >= count) return next;

  const close = (j: number) => {
    next[j] = 0;
    if (j >= 2 && at(j - 2) + w > at(j)) close(j - 2);
    if (j + 2 < count && at(j + 2) < at(j) + w) close(j + 2);
  };
  if (next[index] !== 0) {
    close(index);
    return next.map((shift) => round(shift));
  }

  // Соседние двери другой дорожки сначала встают на место: иначе дверь
  // уедет за них или перед ними, и проём останется закрытым.
  for (const side of [index - 1, index + 1]) {
    if (side >= 0 && side < count && next[side] !== 0) close(side);
  }
  const x = at(index);
  const leftLimit = index >= 2 ? at(index - 2) + w : 0;
  const rightLimit = index + 2 < count ? at(index + 2) : total;
  const left = index > 0 ? Math.max(0, Math.min(step, x - leftLimit)) : 0;
  const right =
    index < count - 1 ? Math.max(0, Math.min(step, rightLimit - (x + w))) : 0;
  const front = index % 2 === 1;
  if (left === 0 && right === 0) return next;
  const goLeft = left > right || (left === right && front);
  next[index] = round(goLeft ? -left : right);
  return next;
}

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
  // Левый край первой двери, если дверь сдвинута глухой частью, и
  // заглушка: левый край и ширина.
  doorLeft?: number;
  blindPanel?: { left: number; width: number } | null;
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
  kind = "ящик",
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
      title: `${name}: ${kind} боковина${suffix}`,
      length: slide,
      width: boxHeight,
      quantity: 2 * count,
      edgedSides: ["top"],
      fixedGrain: true,
      hardware: [boxScrews("left"), boxScrews("right")],
    },
    {
      title: `${name}: ${kind} стенка${suffix}`,
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
  const fill =
    drawerCount > 0 && doors === 0 && spec.kind === "base" && !spec.openAbove;
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
  const blind =
    doors === 1 && spec.blind && spec.blind.width > 0
      ? {
          side: spec.blind.side,
          width: Math.min(spec.blind.width, W - 200),
        }
      : null;
  const doorWidth =
    doors > 0
      ? blind
        ? round(W - blind.width - 2 * DOOR_GAP)
        : round((W - DOOR_GAP * (doors + 1)) / doors)
      : 0;
  // Одна дверь: петли на стороне без заглушки или по выбору.
  const hingeRight =
    doors === 1 && (blind ? blind.side === "left" : spec.hinge === "right");
  const lift = Boolean(spec.lift) && doors === 1;
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
  // Одна дверь навешена на левую (или правую) боковину, две — каждая на
  // свою. Подъёмная дверь — без петель.
  const platesOn = (label: string) =>
    lift
      ? []
      : doors === 2 ||
          (doors === 1 && label === (hingeRight ? "правая" : "левая"))
        ? plates()
        : [];
  // Тумба под мойку: боковины сверху крепятся к царгам — по одному
  // сквозному Ø7 по центру каждой царги.
  const rails = Boolean(spec.rails);
  const bodySide = (): HardwareItem[] =>
    rails
      ? [
          ...sideHardware().filter((item) => item.side !== "right"),
          {
            ...createHardware("faceRow", "right"),
            count: 2,
            offset: RAIL_WIDTH / 2,
            indent: round(t / 2),
            holes: [{ diameter: 7, depth: 0 }],
          },
        ]
      : sideHardware();

  for (const label of ["левая", "правая"]) {
    parts.push({
      title: `${name}: боковина ${label}`,
      length: H,
      width: D,
      quantity: 1,
      edgedSides: ["top"],
      fixedGrain: true,
      hardware: [...bodySide(), ...pins, ...platesOn(label)],
      ...(led === "sides"
        ? {
            milling: ledMilling(
              doors > 0 ? LED_SIDE_INDENT_DOORS : LED_SIDE_INDENT,
            ),
          }
        : {}),
    });
  }

  if (rails) {
    parts.push({
      title: `${name}: царга`,
      length: innerWidth,
      width: RAIL_WIDTH,
      quantity: 2,
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
  } else {
    parts.push({
      title: `${name}: крыша`,
      length: innerWidth,
      width: D,
      quantity: 1,
      edgedSides: ["top"],
      fixedGrain: true,
      hardware: roofHardware(),
    });
  }
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
      hardware: lift
        ? []
        : [
            {
              ...createHardware("hinge", hingeSide),
              count: hinges,
              offset: HINGE_OFFSET,
            },
          ],
    });
    if (doors === 1) {
      parts.push(door("", hingeRight ? "top" : "bottom"));
      if (blind) {
        parts.push({
          title: `${name}: заглушка`,
          length: doorHeight,
          width: round(blind.width - DOOR_GAP),
          quantity: 1,
          edgedSides: ["top", "right", "bottom", "left"],
          fixedGrain: true,
        });
      }
    } else {
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
    doorLeft: blind?.side === "left" ? blind.width + DOOR_GAP : DOOR_GAP,
    blindPanel: blind
      ? {
          left: blind.side === "left" ? DOOR_GAP : W - blind.width,
          width: round(blind.width - DOOR_GAP),
        }
      : null,
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
  // Пределы Hettich TopLine L: ширина двери 500–1500 мм, высота до 2600 мм.
  if (doorWidth < KUPE_DOOR_MIN_WIDTH || doorWidth > KUPE_DOOR_MAX_WIDTH) {
    problems.push(
      `Дверь-купе шириной ${doorWidth} мм: система Hettich TopLine L держит двери от ${KUPE_DOOR_MIN_WIDTH} до ${KUPE_DOOR_MAX_WIDTH} мм — ${doorWidth < KUPE_DOOR_MIN_WIDTH ? "уменьшите" : "увеличьте"} число дверей.`,
    );
  }
  if (doorHeight > KUPE_DOOR_MAX_HEIGHT) {
    problems.push(
      `Дверь-купе высотой ${doorHeight} мм: Hettich TopLine L — до ${KUPE_DOOR_MAX_HEIGHT} мм.`,
    );
  }
  // Проём двери j, когда соседние сдвинуты: дверь без перехлёстов.
  const windows = Array.from({ length: n }, (_, j) => {
    const from = j * (doorWidth - KUPE_OVERLAP);
    return {
      from: from + (j > 0 ? KUPE_OVERLAP : 0),
      to: from + doorWidth - (j < n - 1 ? KUPE_OVERLAP : 0),
    };
  });

  // Ящики и выдвижные полки: одна направляющая и одна высота фасада во
  // всех секциях.
  const slide =
    [...DRAWER_SLIDE_LENGTHS]
      .reverse()
      .find((length) => length <= D - t - KUPE_FRONT_SETBACK - 30) ?? 0;
  const frontHeight = KUPE_DRAWER_FRONT;
  const boxHeight = Math.floor((frontHeight - 40) / 10) * 10;

  const sections: CabinetSection[] = config.map((section, index) => {
    const left = lefts[index];
    const width = widths[index];
    const label = `Секция ${index + 1}`;
    const zones = section.zones!;
    const shelves: CabinetSection["shelves"] = [];
    const rods: number[] = [];
    const trousers: number[] = [];
    const stands: CabinetSection["stands"] = [];

    // Высоты зон: заданные, у ящиков и выдвижных полок — по их числу,
    // остальное поровну. Если «авто» зон нет, остаток берёт верхняя
    // зона без ящиков.
    const span = roofBottom - bottomTop - (zones.length - 1) * t;
    const given = zones.map((zone) => {
      const natural = zoneNaturalHeight(zone, t);
      if (zone.kind === "drawers" || zone.kind === "trays") {
        return Math.max(natural, zone.height ?? 0);
      }
      return zone.height || natural;
    });
    let auto = given.map((height) => height === 0);
    if (!auto.some(Boolean)) {
      const flexible = zones.findIndex(
        (zone) => zone.kind !== "drawers" && zone.kind !== "trays",
      );
      if (flexible >= 0) auto = auto.map((_, at) => at === flexible);
    }
    const fixedSum = given.reduce(
      (sum, height, at) => sum + (auto[at] ? 0 : height),
      0,
    );
    const autoCount = auto.filter(Boolean).length;
    const autoHeight = autoCount > 0 ? (span - fixedSum) / autoCount : 0;
    if (
      (autoCount > 0 && autoHeight < KUPE_MIN_ZONE) ||
      (autoCount === 0 && Math.abs(fixedSum - span) > 1)
    ) {
      problems.push(
        `${label}: зоны не помещаются по высоте (внутри ${Math.round(span)} мм) — уменьшите высоты или число зон.`,
      );
    }
    const heights = given.map((height, at) =>
      auto[at] ? Math.max(KUPE_MIN_ZONE, autoHeight) : height,
    );

    // Раскладка сверху вниз: между зонами полка.
    const placed: CabinetSection["zones"] = [];
    let cursor = roofBottom;
    zones.forEach((zone, at) => {
      const from = cursor - heights[at];
      placed.push({ ...zone, from: round(from), height: round(heights[at]) });
      if (at < zones.length - 1) {
        const next = zones[at + 1];
        const nearSplit = zone.kind === "split" || next.kind === "split";
        const kind = nearSplit
          ? "полка со стойкой"
          : next.kind === "drawers" || next.kind === "trays"
            ? "полка над ящиками"
            : zone.kind === "antresol"
              ? "полка антресоли"
              : next.kind === "shoes"
                ? "полка для обуви"
                : "полка";
        shelves.push({ at: round(from - t), kind });
        cursor = from - t;
      }
    });

    const spread = (
      count: number,
      low: number,
      high: number,
      kind: string,
      column?: { left: number; width: number },
    ) => {
      const step = (high - low - count * t) / (count + 1);
      if (count > 0 && step < 150) {
        problems.push(`${label}: полки чаще 150 мм — уменьшите число полок.`);
      }
      for (let shelf = 0; shelf < count; shelf += 1) {
        shelves.push({
          at: round(low + step * (shelf + 1) + t * shelf),
          kind,
          ...(column ?? {}),
        });
      }
    };

    let frontsAt: number[] = [];
    let traysAt: number[] = [];
    let drawerBlock: { at: number; height: number } | null = null;
    let trayBlock: { at: number; height: number } | null = null;
    for (const zone of placed) {
      const low = zone.from;
      const high = zone.from + zone.height;
      const count = zone.count ?? 0;
      if (zone.kind === "shelves") spread(count, low, high, "полка");
      else if (zone.kind === "shoes") {
        spread(count, low, high, "полка для обуви");
      } else if (zone.kind === "rod") {
        const rodAt = round(high - KUPE_ROD_BELOW_SHELF);
        rods.push(rodAt);
        if (rodAt - low < KUPE_HANGING_SHORT) {
          problems.push(
            `${label}: под штангой ${Math.round(rodAt - low)} мм, нужно от ${KUPE_HANGING_SHORT} мм (длинные вещи — от ${KUPE_HANGING_LONG} мм).`,
          );
        }
      } else if (zone.kind === "trousers") {
        trousers.push(round(high));
        if (zone.height < KUPE_TROUSERS_HEIGHT) {
          problems.push(
            `${label}: под брючницей ${Math.round(zone.height)} мм, нужно от ${KUPE_TROUSERS_HEIGHT} мм.`,
          );
        }
      } else if (zone.kind === "split") {
        const column = (width - t) / 2;
        const standLeft = round(left + column);
        stands.push({ left: standLeft, at: round(low), height: zone.height });
        spread(count, low, high, "полка в колонке", {
          left: round(left + SHELF_CLEARANCE),
          width: round(column - 2 * SHELF_CLEARANCE),
        });
        spread(count, low, high, "полка в колонке", {
          left: round(standLeft + t + SHELF_CLEARANCE),
          width: round(column - 2 * SHELF_CLEARANCE),
        });
        if (column < 200) {
          problems.push(`${label}: колонки уже 200 мм — секция узкая.`);
        }
      } else if (zone.kind === "drawers") {
        if (drawerBlock) {
          problems.push(`${label}: ящики — одной зоной на секцию.`);
          continue;
        }
        frontsAt = Array.from({ length: count }, (_, at) =>
          round(low + DOOR_GAP + at * (frontHeight + DOOR_GAP)),
        );
        drawerBlock = { at: round(low), height: round(zone.height) };
      } else if (zone.kind === "trays") {
        if (trayBlock) {
          problems.push(`${label}: выдвижные полки — одной зоной на секцию.`);
          continue;
        }
        traysAt = Array.from({ length: count }, (_, at) =>
          round(low + KUPE_TRAY_LIFT + at * KUPE_TRAY_PITCH),
        );
        trayBlock = { at: round(low), height: round(zone.height) };
      }
    }

    // Ящики и выдвижные полки выходят в проём двери, с которой секция
    // больше всего совпадает; где проём уже секции — проставки целыми
    // слоями плиты.
    let drawer: CabinetSection["drawer"] = null;
    if (drawerBlock || trayBlock) {
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
        frontsAt,
        boxesAt: frontsAt.map((at) => round(at + DRAWER_LIFT)),
        traysAt,
        drawerBlock,
        trayBlock,
      };
    }

    return {
      index,
      left,
      width,
      zones: placed,
      shelves: shelves.sort((a, b) => a.at - b.at),
      rods,
      trousers,
      stands,
      drawers: frontsAt.length,
      trays: traysAt.length,
      drawer,
    };
  });

  // Полкодержатели: у боковины — от пола, у перегородки — от её низа (над
  // дном), отверстия в перегородке сквозные: держат полки с обеих сторон.
  // Полки колонок держатся с одной стороны на стенке секции, с другой —
  // на стойке.
  const heightsAt = (section: CabinetSection, edge: number) =>
    section.shelves
      .filter(
        (shelf) =>
          shelf.left === undefined ||
          Math.abs(shelf.left - edge) <= SHELF_CLEARANCE + 1 ||
          Math.abs(shelf.left + (shelf.width ?? 0) - edge) <=
            SHELF_CLEARANCE + 1,
      )
      .map((shelf) => shelf.at);
  const leftHeights = (section: CabinetSection) =>
    heightsAt(section, section.left);
  const rightHeights = (section: CabinetSection) =>
    heightsAt(section, section.left + section.width);
  const pinsAt = (heights: number[], base: number, through: boolean) =>
    [...new Set(heights)].map((height) => ({
      ...createHardware("shelfPins", "top"),
      count: 1,
      offset: round(height - PIN_BELOW_SHELF - base),
      ...(through ? { holes: [{ diameter: 5, depth: 0 }] } : {}),
    }));

  const parts: CabinetPart[] = [];
  const sidePins = [leftHeights(sections[0]), rightHeights(sections[k - 1])];
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
  // перегородок (по центру толщины перегородки) и стоек у крыши или дна.
  const throughScrews = (centers: number[]): HardwareItem[] =>
    centers.map((center) => ({
      ...createHardware("faceRow", "left"),
      ...confirmatPlaces,
      indent: round(center - t),
      holes: [{ diameter: 7, depth: 0 }],
    }));
  const partitionCenters = partitions.map((left) => left + t / 2);
  // Стойка мельче крыши и дна на отступ полок и стоит у задней кромки:
  // отверстия под её конфирматы — по её глубине, от задней кромки.
  const standDepth = D - SHELF_SETBACK;
  const standPlaces =
    confirmatPlaces.count === 1
      ? [standDepth / 2]
      : Array.from(
          { length: confirmatPlaces.count },
          (_, index) =>
            confirmatPlaces.offset +
            ((standDepth - 2 * confirmatPlaces.offset) * index) /
              (confirmatPlaces.count - 1),
        );
  const standScrews = (level: number): HardwareItem[] =>
    sections.flatMap((section) =>
      section.stands
        .filter(
          (stand) =>
            Math.abs(stand.at - level) < 1 ||
            Math.abs(stand.at + stand.height - level) < 1,
        )
        .flatMap((stand) =>
          standPlaces.map((place) => ({
            ...createHardware("faceRow", "left"),
            count: 1,
            offset: round(place),
            indent: round(stand.left + t / 2 - t),
            holes: [{ diameter: 7, depth: 0 }],
          })),
        ),
    );
  for (const [title, level] of [
    ["крыша", roofBottom],
    ["дно", bottomTop],
  ] as const) {
    parts.push({
      title: `${name}: ${title}`,
      length: round(W - 2 * t),
      width: D,
      quantity: 1,
      edgedSides: ["top"],
      fixedGrain: true,
      hardware: [
        ...roofHardware(),
        ...throughScrews(partitionCenters),
        ...standScrews(level),
      ],
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
          [
            ...rightHeights(sections[index]),
            ...leftHeights(sections[index + 1]),
          ],
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

  // Полки секции: по строке на вид полки. Полка со стойкой — со сквозными
  // Ø7 под конфирматы стойки.
  for (const section of sections) {
    const suffix = sectionSuffix(section.index);
    const kinds = new Map<string, { quantity: number; width: number }>();
    for (const shelf of section.shelves) {
      const entry = kinds.get(shelf.kind);
      kinds.set(shelf.kind, {
        quantity: (entry?.quantity ?? 0) + 1,
        width: shelf.width ?? section.width - 2 * SHELF_CLEARANCE,
      });
    }
    const standX = section.stands[0]
      ? section.stands[0].left + t / 2 - section.left - SHELF_CLEARANCE
      : 0;
    for (const [kind, { quantity, width }] of kinds) {
      parts.push({
        title: `${name}: ${kind}${suffix}`,
        length: round(width),
        width: D - SHELF_SETBACK,
        quantity,
        edgedSides: ["top"],
        fixedGrain: true,
        ...(kind === "полка со стойкой"
          ? {
              hardware: [
                {
                  ...createHardware("faceRow", "left"),
                  ...confirmatPlaces,
                  indent: round(standX),
                  holes: [{ diameter: 7, depth: 0 }],
                },
              ],
            }
          : {}),
      });
    }
    // Стойки колонок: на конфирматах к полкам сверху и снизу, сквозные
    // полкодержатели под полки обеих колонок.
    // Одинаковые стойки (высота и полкодержатели) — одной строкой.
    const standGroups = new Map<
      string,
      {
        height: number;
        at: number;
        pins: number[];
        stands: typeof section.stands;
      }
    >();
    for (const stand of section.stands) {
      const pins = section.shelves
        .filter(
          (shelf) =>
            shelf.kind === "полка в колонке" &&
            shelf.at > stand.at &&
            shelf.at < stand.at + stand.height,
        )
        .map((shelf) => round(shelf.at - stand.at));
      const key = `${stand.height}|${[...new Set(pins)].join(",")}`;
      const group = standGroups.get(key) ?? {
        height: stand.height,
        at: stand.at,
        pins,
        stands: [],
      };
      group.stands.push(stand);
      standGroups.set(key, group);
    }
    [...standGroups.values()].forEach((group, place) => {
      const kind = place === 0 ? "стойка" : `стойка ${place + 1}`;
      for (const stand of group.stands) stand.kind = kind;
      const { height, at } = group;
      const own = group.pins.map((pin) => pin + at);
      parts.push({
        title: `${name}: ${kind}${suffix}`,
        length: round(height),
        width: standDepth,
        quantity: group.stands.length,
        edgedSides: ["top"],
        fixedGrain: true,
        hardware: [
          {
            ...createHardware("confirmatEdge", "left"),
            ...confirmatPlaces,
            mirror: true,
          },
          ...pinsAt(own, at, true),
        ],
      });
    });
  }

  // Ящики и выдвижные полки по секциям.
  const drawerCount = sections.reduce(
    (sum, section) => sum + section.drawers,
    0,
  );
  const trayCount = sections.reduce((sum, section) => sum + section.trays, 0);
  let drawers: CabinetDrawers | null = null;
  if (drawerCount + trayCount > 0) {
    if (slide === 0) problems.push("Корпус слишком мелкий для ящиков.");
    const withBoxes = sections.filter((section) => section.drawer);
    const withDrawers = sections.filter((section) => section.drawers > 0);
    const first = withBoxes[0].drawer!;
    const frontsAll = withDrawers.flatMap(
      (section) => section.drawer!.frontsAt,
    );
    drawers = {
      count: drawerCount,
      frontWidth: first.frontWidth,
      frontHeight,
      frontsAt: frontsAll,
      slide,
      boxHeight,
      boxWidth: first.boxWidth,
      boxesAt: frontsAll.map((at) => round(at + DRAWER_LIFT)),
      bottom: { length: slide, width: first.boxWidth },
      shelfAt: null,
      inset: KUPE_FRONT_SETBACK,
      spacer: first.spacerLeft,
      trays: trayCount,
      bottoms: withBoxes.map((section) => ({
        length: slide,
        width: section.drawer!.boxWidth,
        count: section.drawers + section.trays,
      })),
    };
    for (const section of withBoxes) {
      const suffix = sectionSuffix(section.index);
      const box = section.drawer!;
      if (section.drawers > 0) {
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
      }
      if (section.trays > 0 && slide > 0) {
        // Выдвижная полка: низкий короб без фасада на тех же
        // направляющих, передняя стенка — бортик.
        parts.push(
          ...drawerBoxParts(
            name,
            slide,
            KUPE_TRAY_BOX,
            box.boxWidth,
            t,
            section.trays,
            suffix,
            "выдвижная полка",
          ),
        );
      }
      // Проставки: по высоте блока ящиков или выдвижных полок, на
      // глубину направляющей.
      const layers = (box.spacerLeft + box.spacerRight) / t;
      for (const [kind, block] of [
        ["проставка ящиков", box.drawerBlock],
        ["проставка выдвижных полок", box.trayBlock],
      ] as const) {
        if (layers > 0 && block) {
          parts.push({
            title: `${name}: ${kind}${suffix}`,
            length: slide,
            width: block.height,
            quantity: layers,
            edgedSides: ["left"],
            fixedGrain: true,
          });
        }
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
    shelvesAt: sections.flatMap((section) =>
      section.shelves.map((shelf) => shelf.at),
    ),
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
