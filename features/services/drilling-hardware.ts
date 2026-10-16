// Присадка без Базиса: фурнитура, которую ставят на деталь в калькуляторе
// распила, и отверстия, которые из неё получаются.
//
// Координаты детали: x — вдоль длины (поле «Длина», в GibLab l), y — вдоль
// ширины (в GibLab w), начало в левом нижнем углу, вид на лицевую пласть.
// Стороны: bottom — y = 0, top — y = ширина, left — x = 0, right — x = длина.
// В калькуляторе «верх» и «низ» — длинные стороны, как у кромки.

import type { DrillCounts } from "@/lib/drilling-price";

export type PartSide = "top" | "right" | "bottom" | "left";

export type HardwareKind =
  | "minifix"
  | "faceRow"
  | "confirmatEdge"
  | "dowelEdge"
  | "shelfPins"
  | "hinge"
  | "handle"
  | "hole";

// Группа отверстий внутри фурнитуры: у эксцентрика их две (в пласть
// и в торец), у остальных — одна.
export type HoleSpec = { diameter: number; depth: number };

export type HardwareItem = {
  id: string;
  kind: HardwareKind;
  side: PartSide;
  // Сколько мест вдоль стороны. 1 — одно место (по центру, если offset 0).
  count: number;
  // Отступ первого и последнего места от концов стороны, мм.
  offset: number;
  // Расстояние от края стороны до центра отверстия в пласти, мм.
  indent: number;
  // Межосевое ручки или шаг полкодержателей, мм.
  spacing: number;
  // То же у противоположного края.
  mirror: boolean;
  // Только для «Отверстия»: в торец, а не в пласть.
  edge: boolean;
  holes: HoleSpec[];
};

export type PartHole =
  | { kind: "face"; x: number; y: number; diameter: number; depth: number }
  | {
      kind: "edge";
      side: PartSide;
      // Положение вдоль стороны: x для top/bottom, y для left/right.
      position: number;
      diameter: number;
      depth: number;
    };

export type HardwareField = "count" | "offset" | "indent" | "spacing";

type HardwareDefinition = {
  label: string;
  hint: string;
  // Подписи групп отверстий.
  holeLabels: string[];
  defaults: Omit<HardwareItem, "id" | "kind" | "side">;
  fields: HardwareField[];
};

export const HARDWARE: Record<HardwareKind, HardwareDefinition> = {
  minifix: {
    label: "Эксцентрик (минификс)",
    hint: "Корпус эксцентрика в пласть и канал под шток в торец.",
    holeLabels: ["Корпус в пласть", "Под шток в торец"],
    defaults: {
      count: 2,
      offset: 50,
      indent: 34,
      spacing: 0,
      mirror: false,
      edge: false,
      holes: [
        { diameter: 15, depth: 13 },
        { diameter: 8, depth: 34 },
      ],
    },
    fields: ["count", "offset", "indent"],
  },
  faceRow: {
    label: "Шток, конфирмат, шкант в пласть",
    hint: "Ряд отверстий в пласти на расстоянии от края — там, где встаёт соседняя деталь.",
    holeLabels: ["Отверстие в пласть"],
    defaults: {
      count: 2,
      offset: 50,
      indent: 8,
      spacing: 0,
      mirror: false,
      edge: false,
      holes: [{ diameter: 7, depth: 16 }],
    },
    fields: ["count", "offset", "indent"],
  },
  confirmatEdge: {
    label: "Конфирмат в торец",
    hint: "Отверстие под конфирмат в торце детали.",
    holeLabels: ["В торец"],
    defaults: {
      count: 2,
      offset: 50,
      indent: 0,
      spacing: 0,
      mirror: false,
      edge: false,
      holes: [{ diameter: 5, depth: 50 }],
    },
    fields: ["count", "offset"],
  },
  dowelEdge: {
    label: "Шкант в торец",
    hint: "Отверстие под шкант в торце детали.",
    holeLabels: ["В торец"],
    defaults: {
      count: 2,
      offset: 32,
      indent: 0,
      spacing: 0,
      mirror: false,
      edge: false,
      holes: [{ diameter: 8, depth: 30 }],
    },
    fields: ["count", "offset"],
  },
  shelfPins: {
    label: "Полкодержатели",
    hint: "Ряд отверстий с шагом вдоль края.",
    holeLabels: ["Отверстие"],
    defaults: {
      count: 5,
      offset: 200,
      indent: 37,
      spacing: 32,
      mirror: true,
      edge: false,
      holes: [{ diameter: 5, depth: 12 }],
    },
    fields: ["count", "offset", "indent", "spacing"],
  },
  hinge: {
    label: "Петля",
    hint: "Чашка петли Ø35 у края фасада.",
    holeLabels: ["Чашка"],
    defaults: {
      count: 2,
      offset: 100,
      indent: 22.5,
      spacing: 0,
      mirror: false,
      edge: false,
      holes: [{ diameter: 35, depth: 13 }],
    },
    fields: ["count", "offset", "indent"],
  },
  handle: {
    label: "Ручка",
    hint: "Два сквозных отверстия на межосевом расстоянии.",
    holeLabels: ["Отверстие"],
    defaults: {
      count: 1,
      offset: 0,
      indent: 50,
      spacing: 128,
      mirror: false,
      edge: false,
      holes: [{ diameter: 5, depth: 0 }],
    },
    fields: ["offset", "indent", "spacing"],
  },
  hole: {
    label: "Отверстие",
    hint: "Любое отверстие: диаметр, глубина, место.",
    holeLabels: ["Отверстие"],
    defaults: {
      count: 1,
      offset: 0,
      indent: 50,
      spacing: 0,
      mirror: false,
      edge: false,
      holes: [{ diameter: 8, depth: 13 }],
    },
    fields: ["count", "offset", "indent"],
  },
};

export const HARDWARE_KINDS = Object.keys(HARDWARE) as HardwareKind[];

export const FIELD_LABELS: Record<HardwareField, string> = {
  count: "Сколько, шт.",
  offset: "Отступ от концов, мм",
  indent: "От края, мм",
  spacing: "Шаг / межосевое, мм",
};

export const SIDE_LABELS: Record<PartSide, string> = {
  top: "верхний край",
  bottom: "нижний край",
  left: "левый край",
  right: "правый край",
};

const OPPOSITE: Record<PartSide, PartSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

export function createHardware(
  kind: HardwareKind,
  side: PartSide,
): HardwareItem {
  const { defaults } = HARDWARE[kind];
  return {
    id: `hw-${Math.random().toString(36).slice(2, 9)}`,
    kind,
    side,
    ...defaults,
    holes: defaults.holes.map((hole) => ({ ...hole })),
  };
}

function sideLength(side: PartSide, length: number, width: number) {
  return side === "top" || side === "bottom" ? length : width;
}

// Места вдоль стороны: одно — по центру (или на отступе), несколько —
// равномерно от отступа до отступа; у полкодержателей — с шагом.
function positionsAlong(item: HardwareItem, available: number) {
  const count = Math.max(1, Math.min(200, Math.round(item.count)));

  if (item.kind === "shelfPins") {
    return Array.from(
      { length: count },
      (_, index) => item.offset + index * item.spacing,
    );
  }
  if (count === 1) return [item.offset > 0 ? item.offset : available / 2];
  const first = item.offset;
  const last = available - item.offset;
  return Array.from(
    { length: count },
    (_, index) => first + ((last - first) * index) / (count - 1),
  );
}

function facePoint(
  side: PartSide,
  along: number,
  indent: number,
  length: number,
  width: number,
) {
  switch (side) {
    case "bottom":
      return { x: along, y: indent };
    case "top":
      return { x: along, y: width - indent };
    case "left":
      return { x: indent, y: along };
    case "right":
      return { x: length - indent, y: along };
  }
}

function holesForSide(
  item: HardwareItem,
  side: PartSide,
  length: number,
  width: number,
  thickness: number,
): PartHole[] {
  const available = sideLength(side, length, width);
  const along = positionsAlong(item, available);
  const [first, second] = item.holes;
  const holes: PartHole[] = [];
  const face = (position: number, spec: HoleSpec, indent = item.indent) => {
    const point = facePoint(side, position, indent, length, width);
    holes.push({
      kind: "face",
      ...point,
      diameter: spec.diameter,
      // Глубина 0 или больше толщины — сквозное.
      depth: spec.depth > 0 ? Math.min(spec.depth, thickness) : thickness,
    });
  };
  const edge = (position: number, spec: HoleSpec) => {
    holes.push({
      kind: "edge",
      side,
      position,
      diameter: spec.diameter,
      depth: spec.depth,
    });
  };

  for (const position of along) {
    switch (item.kind) {
      case "minifix":
        face(position, first);
        if (second) edge(position, second);
        break;
      case "confirmatEdge":
      case "dowelEdge":
        edge(position, first);
        break;
      case "handle":
        face(position - item.spacing / 2, first);
        face(position + item.spacing / 2, first);
        break;
      case "hole":
        if (item.edge) edge(position, first);
        else face(position, first);
        break;
      default:
        face(position, first);
    }
  }

  return holes;
}

function isInside(hole: PartHole, length: number, width: number) {
  if (!(hole.diameter > 0 && hole.depth > 0)) return false;
  if (hole.kind === "face") {
    const radius = hole.diameter / 2;
    return (
      hole.x - radius >= -0.01 &&
      hole.y - radius >= -0.01 &&
      hole.x + radius <= length + 0.01 &&
      hole.y + radius <= width + 0.01
    );
  }
  const available = sideLength(hole.side, length, width);
  return hole.position > 0 && hole.position < available;
}

// Все отверстия детали из её фурнитуры. Отверстия, которые выходят за
// деталь, отбрасываются: их не просверлить.
export function hardwareHoles(
  items: HardwareItem[] | undefined,
  length: number,
  width: number,
  thickness: number,
): PartHole[] {
  if (!items?.length || !(length > 0 && width > 0)) return [];
  const safeThickness = thickness > 0 ? thickness : 16;

  return items.flatMap((item) => {
    const sides = item.mirror ? [item.side, OPPOSITE[item.side]] : [item.side];
    return sides
      .flatMap((side) => holesForSide(item, side, length, width, safeThickness))
      .filter((hole) => isInside(hole, length, width));
  });
}

export function holesToDrillCounts(holes: PartHole[]): DrillCounts {
  const counts: DrillCounts = {};
  for (const hole of holes) {
    const key = String(Math.round(hole.diameter * 10) / 10);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function mergeDrillCounts(...parts: Array<DrillCounts | undefined>) {
  const merged: DrillCounts = {};
  for (const part of parts) {
    for (const [key, count] of Object.entries(part ?? {})) {
      merged[key] = (merged[key] ?? 0) + count;
    }
  }
  return merged;
}

// Черновик калькулятора хранится в браузере: проверяем, что прочитали.
export function sanitizeHardware(value: unknown): HardwareItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const number = (input: unknown, fallback: number) =>
    typeof input === "number" && Number.isFinite(input) ? input : fallback;
  const items = value.flatMap((raw): HardwareItem[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const kind = item.kind as HardwareKind;
    const side = item.side as PartSide;
    if (!HARDWARE[kind] || !(side in OPPOSITE)) return [];
    const defaults = HARDWARE[kind].defaults;
    const holes = Array.isArray(item.holes)
      ? defaults.holes.map((spec, index) => {
          const hole = (item.holes as unknown[])[index] as
            | Record<string, unknown>
            | undefined;
          return {
            diameter: number(hole?.diameter, spec.diameter),
            depth: number(hole?.depth, spec.depth),
          };
        })
      : defaults.holes.map((hole) => ({ ...hole }));
    return [
      {
        id:
          typeof item.id === "string" ? item.id : createHardware(kind, side).id,
        kind,
        side,
        count: number(item.count, defaults.count),
        offset: number(item.offset, defaults.offset),
        indent: number(item.indent, defaults.indent),
        spacing: number(item.spacing, defaults.spacing),
        mirror: item.mirror === true,
        edge: item.edge === true,
        holes,
      },
    ];
  });
  return items.length ? items : undefined;
}

// Поворот детали на 90° при раскрое («Повернуть 90°»): точка (x, y)
// детали длиной length переходит в (y, length - x), стороны — как у кромки.
const ROTATED_SIDE: Record<PartSide, PartSide> = {
  top: "right",
  right: "bottom",
  bottom: "left",
  left: "top",
};

export function rotateHoles(holes: PartHole[], length: number): PartHole[] {
  return holes.map((hole) => {
    if (hole.kind === "face") {
      return { ...hole, x: hole.y, y: length - hole.x };
    }
    const side = ROTATED_SIDE[hole.side];
    // Вдоль верхней/нижней стороны позиция — x, вдоль левой/правой — y.
    const position =
      hole.side === "top" || hole.side === "bottom"
        ? length - hole.position
        : hole.position;
    return { ...hole, side, position };
  });
}

const round = (value: number) => String(Math.round(value * 100) / 100);

// Программа станка для GibLab (XNC): присадка в пласть с лицевой стороны
// и в торцы. Формат тот же, что пишет выгрузка Базиса. У GibLab начало
// координат в левом верхнем углу и y идёт вниз (bt — верхний торец,
// y = 0), поэтому y переворачивается.
export function buildDrillingProgram(
  holes: PartHole[],
  length: number,
  width: number,
  thickness: number,
) {
  const tools = new Map<string, number>();
  let body = "";
  let through = false;

  for (const hole of holes) {
    if (hole.kind === "face") {
      const isThrough = hole.depth >= thickness - 0.05;
      const name = `Bore${isThrough ? "Th" : ""}${round(hole.diameter)}`;
      through ||= isThrough;
      tools.set(name, hole.diameter);
      body += `<bf x="${round(hole.x)}" y="${round(width - hole.y)}" dp="${isThrough ? "throughBoreDepth" : round(hole.depth)}" name="${name}"/>`;
      continue;
    }
    const name = `Bore${round(hole.diameter)}`;
    tools.set(name, hole.diameter);
    const z = round(thickness / 2);
    const tag = { top: "bt", bottom: "bb", left: "bl", right: "br" }[hole.side];
    const alongX = hole.side === "top" || hole.side === "bottom";
    const position = alongX ? hole.position : width - hole.position;
    body += `<${tag} ver="2" ${alongX ? "x" : "y"}="${round(position)}" z="${z}" dp="${round(hole.depth)}" m="true" name="${name}"/>`;
  }

  const toolsXml = [...tools.entries()]
    .map(([name, diameter]) => `<tool name="${name}" d="${round(diameter)}" />`)
    .join("");
  const vars = through
    ? `<var comment="Глубина сквозного отверстия" name="throughBoreDepth" type="double" expr="dz+2"/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?><program dx="${round(length)}" dy="${round(width)}" dz="${round(thickness)}">${toolsXml}${vars}${body}</program>`;
}
