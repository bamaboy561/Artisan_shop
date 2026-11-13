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

export type CabinetKind = "wardrobe" | "base" | "wall";

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
};

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
};

export function hingeCount(doorHeight: number) {
  if (doorHeight <= 900) return 2;
  if (doorHeight <= 1600) return 3;
  if (doorHeight <= 2000) return 4;
  return 5;
}

const round = (value: number) => Math.round(value * 10) / 10;

export function buildCabinet(
  spec: CabinetSpec,
  thickness: number,
): CabinetResult {
  const t = thickness > 0 ? thickness : 16;
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

  // Шканты: два на стык (между эксцентриками), в неглубоком корпусе —
  // один посередине.
  const dowelPlaces =
    D >= 400 ? { count: 2, offset: DOWEL_OFFSET } : { count: 1, offset: 0 };

  const joint: CabinetJoint = spec.joint ?? "minifix";
  // Паз 10 мм глубиной режем в плите от 14 мм: под пазом остаётся 4 мм.
  const ledFits = t >= LED_GROOVE.depth + 4;
  const led: CabinetLed = ledFits ? (spec.led ?? "none") : "none";
  if (!ledFits && (spec.led ?? "none") !== "none") {
    problems.push(
      `Паз ${LED_GROOVE.width}×${LED_GROOVE.depth} под подсветку не сделать в плите ${t} мм: нужна толщина от ${LED_GROOVE.depth + 4} мм.`,
    );
  }
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
      // Боковина короба: длина — направляющая, ширина — высота короба.
      // Конфирматы насквозь у обоих концов, в стенки — в торец.
      const boxScrews = (side: "left" | "right") => ({
        ...createHardware("faceRow", side),
        count: 2,
        offset: DRAWER_CONFIRMAT_OFFSET,
        indent: round(t / 2),
        holes: [{ diameter: 7, depth: 0 }],
      });
      parts.push({
        title: `${name}: ящик боковина`,
        length: slide,
        width: boxHeight,
        quantity: 2 * drawerCount,
        edgedSides: ["top"],
        fixedGrain: true,
        hardware: [boxScrews("left"), boxScrews("right")],
      });
      parts.push({
        title: `${name}: ящик стенка`,
        length: round(boxWidth - 2 * t),
        width: boxHeight,
        quantity: 2 * drawerCount,
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
      });
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
  };
}
