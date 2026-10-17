// Конструктор корпуса: шкаф, тумба или навесной шкаф по габаритам.
// Собирает детали с кромкой и присадкой для калькулятора распила.
//
// Корпус: боковины на всю высоту, крыша и дно между боковинами, дно над
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

export type CabinetKind = "wardrobe" | "base" | "wall";

export type CabinetSpec = {
  kind: CabinetKind;
  name: string;
  width: number;
  height: number;
  depth: number;
  plinth: number;
  shelves: number;
  doors: 0 | 1 | 2;
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

export type CabinetPart = ImportedDetail & { hardware?: HardwareItem[] };

export type CabinetResult = {
  parts: CabinetPart[];
  back: { length: number; width: number } | null;
  problems: string[];
  // Для рисунка вида спереди, мм от пола.
  shelvesAt: number[];
  doorWidth: number;
  doorHeight: number;
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

  // Боковины: болты минификса крыши (у верхнего торца) и дна (над цоколем).
  const sideHardware = (): HardwareItem[] => {
    const toTop = {
      ...createHardware("faceRow", "right"),
      indent: round(t / 2),
      offset: MINIFIX_OFFSET,
      holes: [{ diameter: 5, depth: 12 }],
    };
    const toBottom = {
      ...createHardware("faceRow", "left"),
      indent: round(plinth + t / 2),
      offset: MINIFIX_OFFSET,
      holes: [{ diameter: 5, depth: 12 }],
    };
    return [toTop, toBottom];
  };

  // Полки ровно делят пространство между дном и крышей.
  const bottomTop = plinth + t;
  const roofBottom = H - t;
  const step = (roofBottom - bottomTop - shelves * t) / (shelves + 1);
  const shelvesAt = Array.from({ length: shelves }, (_, index) =>
    round(bottomTop + step * (index + 1) + t * index),
  );
  const pins = shelvesAt.map((shelf) => ({
    ...createHardware("shelfPins", "top"),
    count: 1,
    offset: round(shelf - PIN_BELOW_SHELF),
  }));

  for (const label of ["левая", "правая"]) {
    parts.push({
      title: `${name}: боковина ${label}`,
      length: H,
      width: D,
      quantity: 1,
      edgedSides: ["top"],
      fixedGrain: true,
      hardware: [...sideHardware(), ...pins],
    });
  }

  // Крыша и дно: эксцентрики к обеим боковинам.
  const minifix = () => ({
    ...createHardware("minifix", "left"),
    mirror: true,
    offset: MINIFIX_OFFSET,
  });
  parts.push({
    title: `${name}: крыша`,
    length: innerWidth,
    width: D,
    quantity: 1,
    edgedSides: ["top"],
    fixedGrain: true,
    hardware: [minifix()],
  });
  parts.push({
    title: `${name}: дно`,
    length: innerWidth,
    width: D,
    quantity: 1,
    edgedSides: ["top"],
    fixedGrain: true,
    hardware: [minifix()],
  });

  if (shelves > 0) {
    parts.push({
      title: `${name}: полка`,
      length: innerWidth - 2 * SHELF_CLEARANCE,
      width: D - SHELF_SETBACK,
      quantity: shelves,
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
    });
  }

  const doorHeight = round(H - plinth - DOOR_GAP);
  const doorWidth = doors > 0 ? round((W - DOOR_GAP * (doors + 1)) / doors) : 0;

  if (doors > 0) {
    const hinges = hingeCount(doorHeight);
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
          offset: 100,
        },
      ],
    });
    if (doors === 1) parts.push(door("", "bottom"));
    else {
      parts.push(door(" левая", "bottom"));
      parts.push(door(" правая", "top"));
    }
  }

  const back = {
    length: round(H - plinth - 2 * BACK_OVERLAP_GAP),
    width: round(W - 2 * BACK_OVERLAP_GAP),
  };

  return { parts, back, problems, shelvesAt, doorWidth, doorHeight };
}
