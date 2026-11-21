// Типовая присадка по виду детали: клиент выбирает «Боковина», «Крыша /
// дно», «Дверь»… и получает обычный набор отверстий, как в конструкторе
// шкафа. Дальше всё можно поправить вручную.
//
// Ориентация как в конструкторе шкафа: «Длина» детали — по x, «Ширина» —
// глубина корпуса по y. У боковины длина — высота (левый край к дну,
// правый к крыше), у крыши и дна длина — ширина шкафа (левый и правый
// края к боковинам). Верхний край — передний, нижний — задний.

import {
  createHardware,
  type HardwareItem,
  type PartSide,
} from "./drilling-hardware";

export type PartRole =
  | "side"
  | "roof"
  | "shelf"
  | "door"
  | "drawerFront"
  | "other";

export const PART_ROLES: PartRole[] = [
  "side",
  "roof",
  "shelf",
  "door",
  "drawerFront",
  "other",
];

export const PART_ROLE_LABELS: Record<PartRole, string> = {
  side: "Боковина",
  roof: "Крыша / дно",
  shelf: "Полка",
  door: "Дверь",
  drawerFront: "Фасад ящика",
  other: "Другая",
};

// Названия краёв детали на чертеже и в списках.
export const PART_ROLE_EDGES: Record<
  PartRole,
  Partial<Record<PartSide, string>>
> = {
  side: { left: "к дну", right: "к крыше", top: "перед", bottom: "зад" },
  roof: {
    left: "к боковине",
    right: "к боковине",
    top: "перед",
    bottom: "зад",
  },
  shelf: {
    left: "к боковине",
    right: "к боковине",
    top: "перед",
    bottom: "зад",
  },
  door: { bottom: "петли" },
  drawerFront: { top: "верх" },
  other: {},
};

// Что поставили: строка под выбором детали.
export const PART_ROLE_HINTS: Record<PartRole, string> = {
  side: "Поставили отверстия под штоки эксцентриков и шканты к крыше и дну и ряд полкодержателей посередине.",
  roof: "Поставили эксцентрики и шканты к обеим боковинам.",
  shelf:
    "Съёмную полку сверлить не нужно: она лежит на полкодержателях в боковинах. Если полка неподвижная, выберите «Крыша / дно».",
  door: "Поставили чашки петель Ø35 у края «петли». Если петли с другой стороны, поменяйте край у петли.",
  drawerFront: "Поставили два отверстия под ручку 128 мм по центру фасада.",
  other: "Добавьте фурнитуру сами кнопками ниже.",
};

export function isPartRole(value: unknown): value is PartRole {
  return typeof value === "string" && value in PART_ROLE_LABELS;
}

// Название края: по виду детали («к дну») или общее («левый край»).
export function edgeName(
  side: PartSide,
  role: PartRole | undefined,
  fallback: Record<PartSide, string>,
) {
  return (role && PART_ROLE_EDGES[role][side]) || fallback[side];
}

const MINIFIX_OFFSET = 50;
const DOWEL_OFFSET = 130;
const HINGE_OFFSET = 100;

function hingeCount(doorHeight: number) {
  if (doorHeight <= 900) return 2;
  if (doorHeight <= 1600) return 3;
  if (doorHeight <= 2000) return 4;
  return 5;
}

const round = (value: number) => Math.round(value * 10) / 10;

// Места крепежа вдоль края длиной edge мм. На коротком крае два отверстия
// с отступом 130 (или 50) от углов совпали бы или вышли за деталь, поэтому
// там одно посередине.
export function dowelPlaces(edge: number) {
  return edge >= 400
    ? { count: 2, offset: DOWEL_OFFSET }
    : { count: 1, offset: 0 };
}

export function minifixPlaces(edge: number) {
  return edge >= 150
    ? { count: 2, offset: MINIFIX_OFFSET }
    : { count: 1, offset: 0 };
}

export function partTemplate(
  role: PartRole,
  length: number,
  width: number,
  thickness: number,
): HardwareItem[] {
  const t = thickness > 0 ? thickness : 16;
  // Крепёж идёт вдоль глубины корпуса («Ширина»).
  const dowels = dowelPlaces(width);
  const minifixes = minifixPlaces(width);

  switch (role) {
    case "side": {
      const joints = (side: PartSide): HardwareItem[] => [
        {
          ...createHardware("faceRow", side),
          ...minifixes,
          indent: round(t / 2),
          holes: [{ diameter: 5, depth: 12 }],
        },
        {
          ...createHardware("faceRow", side),
          ...dowels,
          indent: round(t / 2),
          holes: [{ diameter: 8, depth: 12 }],
        },
      ];
      const pins = createHardware("shelfPins", "top");
      return [
        ...joints("left"),
        ...joints("right"),
        {
          ...pins,
          mirror: true,
          offset: Math.max(
            0,
            round(length / 2 - ((pins.count - 1) * pins.spacing) / 2),
          ),
        },
      ];
    }
    case "roof":
      return [
        {
          ...createHardware("minifix", "left"),
          ...minifixes,
          mirror: true,
        },
        {
          ...createHardware("dowelEdge", "left"),
          ...dowels,
          mirror: true,
          holes: [{ diameter: 8, depth: 20 }],
        },
      ];
    case "door":
      return [
        {
          ...createHardware("hinge", "bottom"),
          count: hingeCount(length),
          offset: HINGE_OFFSET,
        },
      ];
    case "drawerFront":
      return [
        {
          ...createHardware("handle", "top"),
          count: 1,
          offset: 0,
          indent: round(width / 2),
          spacing: length >= 250 ? 128 : 96,
        },
      ];
    case "shelf":
    case "other":
      return [];
  }
}
