// Фрезеровка детали из калькулятора: скругления углов и скосы торцов.
// Координаты как у присадки: x — вдоль длины, y — вдоль ширины, начало
// в левом нижнем углу, вид на лицевую пласть.

import type { GibLabContourElement } from "@/lib/bazis-b3d";
import { buildGibLabProject } from "@/lib/bazis-giblab";
import type { PartSide } from "./drilling-hardware";

export type PartCorner = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";

// Паз в лицевой пласти на всю длину стороны side: под LED-профиль,
// заднюю стенку и т. п. indent — от края side до ближней стенки паза.
export type PartGroove = {
  side: PartSide;
  indent: number;
  width: number;
  depth: number;
};

export type PartMilling = {
  // Радиус скругления угла, мм; 0 — угол прямой.
  corners: Record<PartCorner, number>;
  // Скос торца, градусы; 0 — без скоса.
  bevels: Record<PartSide, number>;
  grooves?: PartGroove[];
};

// Паз под LED-профиль 10 × 10 мм.
export const LED_GROOVE = { width: 10, depth: 10 };

export const CORNERS: PartCorner[] = [
  "topLeft",
  "topRight",
  "bottomRight",
  "bottomLeft",
];

export const CORNER_LABELS: Record<PartCorner, string> = {
  topLeft: "Левый верхний",
  topRight: "Правый верхний",
  bottomRight: "Правый нижний",
  bottomLeft: "Левый нижний",
};

export const BEVEL_ANGLES = [0, 15, 22.5, 30, 45];

export function emptyMilling(): PartMilling {
  return {
    corners: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    bevels: { top: 0, right: 0, bottom: 0, left: 0 },
  };
}

export function hasMilling(milling: PartMilling | undefined) {
  return Boolean(
    milling &&
    (Object.values(milling.corners).some((radius) => radius > 0) ||
      Object.values(milling.bevels).some((angle) => angle > 0) ||
      (milling.grooves?.length ?? 0) > 0),
  );
}

// Радиус не больше половины меньшей стороны, иначе угол не построить.
export function cornerRadius(
  milling: PartMilling | undefined,
  corner: PartCorner,
  length: number,
  width: number,
) {
  const radius = milling?.corners[corner] ?? 0;
  return Math.max(0, Math.min(radius, Math.min(length, width) / 2));
}

// Черновик калькулятора хранится в браузере: проверяем, что прочитали.
export function sanitizeMilling(value: unknown): PartMilling | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as {
    corners?: Record<string, unknown>;
    bevels?: Record<string, unknown>;
  };
  const milling = emptyMilling();
  const number = (input: unknown) =>
    typeof input === "number" && Number.isFinite(input) && input > 0
      ? input
      : 0;
  for (const corner of CORNERS) {
    milling.corners[corner] = Math.min(number(raw.corners?.[corner]), 5000);
  }
  for (const side of ["top", "right", "bottom", "left"] as PartSide[]) {
    const angle = number(raw.bevels?.[side]);
    milling.bevels[side] = BEVEL_ANGLES.includes(angle) ? angle : 0;
  }
  const rawGrooves = (value as { grooves?: unknown }).grooves;
  const grooves = Array.isArray(rawGrooves)
    ? rawGrooves.slice(0, 20).flatMap((item): PartGroove[] => {
        if (!item || typeof item !== "object") return [];
        const raw = item as Record<string, unknown>;
        const side = raw.side as PartSide;
        if (!["top", "right", "bottom", "left"].includes(side)) return [];
        const width = Math.min(number(raw.width), 100);
        const depth = Math.min(number(raw.depth), 50);
        if (!(width > 0 && depth > 0)) return [];
        const indent =
          typeof raw.indent === "number" &&
          Number.isFinite(raw.indent) &&
          raw.indent >= 0
            ? Math.min(raw.indent, 5000)
            : 0;
        return [{ side, indent, width, depth }];
      })
    : [];
  if (grooves.length > 0) milling.grooves = grooves;
  return hasMilling(milling) ? milling : undefined;
}

// Поворот детали на 90° при раскрое: углы и торцы переходят так же,
// как кромка (верх → право).
const ROTATED_CORNER: Record<PartCorner, PartCorner> = {
  topLeft: "topRight",
  topRight: "bottomRight",
  bottomRight: "bottomLeft",
  bottomLeft: "topLeft",
};
const ROTATED_SIDE: Record<PartSide, PartSide> = {
  top: "right",
  right: "bottom",
  bottom: "left",
  left: "top",
};

export function rotateMilling(milling: PartMilling): PartMilling {
  const rotated = emptyMilling();
  for (const corner of CORNERS) {
    rotated.corners[ROTATED_CORNER[corner]] = milling.corners[corner];
  }
  for (const side of Object.keys(milling.bevels) as PartSide[]) {
    rotated.bevels[ROTATED_SIDE[side]] = milling.bevels[side];
  }
  if (milling.grooves?.length) {
    rotated.grooves = milling.grooves.map((groove) => ({
      ...groove,
      side: ROTATED_SIDE[groove.side],
    }));
  }
  return rotated;
}

// Контур детали со скруглёнными углами: обход против часовой стрелки от
// левого нижнего угла, как контур детали в Базисе.
export function roundedContour(
  length: number,
  width: number,
  milling: PartMilling | undefined,
): GibLabContourElement[] {
  const r = (corner: PartCorner) =>
    cornerRadius(milling, corner, length, width);
  const bl = r("bottomLeft");
  const br = r("bottomRight");
  const tr = r("topRight");
  const tl = r("topLeft");
  const elements: GibLabContourElement[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    if (Math.abs(x1 - x2) > 1e-6 || Math.abs(y1 - y2) > 1e-6) {
      elements.push({ type: 1, x1, y1, x2, y2 });
    }
  };
  const arc = (
    cx: number,
    cy: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) => elements.push({ type: 2, cx, cy, x1, y1, x2, y2, flag: 1 });

  line(bl, 0, length - br, 0);
  if (br > 0) arc(length - br, br, length - br, 0, length, br);
  line(length, br, length, width - tr);
  if (tr > 0)
    arc(length - tr, width - tr, length, width - tr, length - tr, width);
  line(length - tr, width, tl, width);
  if (tl > 0) arc(tl, width - tl, tl, width, 0, width - tl);
  line(0, width - tl, 0, bl);
  if (bl > 0) arc(bl, bl, 0, bl, bl, 0);

  return elements;
}

function decodeAttribute(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/&amp;/g, "&");
}

// Программа фрезеровки контура для GibLab — тем же кодом, которым сайт
// выгружает проекты Базиса (сверен со скриптом Базиса). null — фрезеровать
// нечего.
export function contourMillingProgram(
  length: number,
  width: number,
  thickness: number,
  milling: PartMilling | undefined,
) {
  if (
    !CORNERS.some((corner) => cornerRadius(milling, corner, length, width) > 0)
  ) {
    return null;
  }
  const project = buildGibLabProject({
    modelName: "Artisan",
    orderName: "",
    modelCode: "",
    holes: [],
    panels: [
      {
        // Пазы калькулятора идут своей программой: grooveMillingProgram.
        cuts: [],
        name: "Деталь",
        artPos: "",
        material: "",
        thickness,
        // Текстура вдоль длины: деталь не поворачивается.
        texDir: 1,
        frontFace: null,
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        elements: roundedContour(length, width, milling),
        butts: [],
      },
    ],
  });
  const match = project.match(/typeId="XNC"[^>]*?program="([^"]*)"/);
  return match ? decodeAttribute(match[1]) : null;
}

const GROOVE_EDGE: Record<PartSide, string> = {
  top: "верхнего",
  right: "правого",
  bottom: "нижнего",
  left: "левого",
};

// Паз на детали length × width: прямоугольник в координатах детали
// (x вдоль длины, y вдоль ширины) и ось, по которой идёт фреза.
export function grooveRect(groove: PartGroove, length: number, width: number) {
  const along = groove.side === "top" || groove.side === "bottom";
  const across = along ? width : length;
  const near = Math.max(0, Math.min(groove.indent, across - groove.width));
  // Отступ от стороны top/right считается от дальнего края.
  const start =
    groove.side === "top" || groove.side === "right"
      ? across - near - groove.width
      : near;
  return along
    ? { x: 0, y: start, w: length, h: groove.width, along }
    : { x: start, y: 0, w: groove.width, h: width, along };
}

const fixed = (value: number) => String(Math.round(value * 100) / 100);

// Программа пазов для GibLab: фреза диаметром в ширину паза идёт по оси
// паза с края до края детали, без коррекции (c="0"). Паз шире фрезы
// Ø10 проходится несколькими проходами.
export function grooveMillingProgram(
  length: number,
  width: number,
  thickness: number,
  milling: PartMilling | undefined,
) {
  const grooves = milling?.grooves ?? [];
  if (grooves.length === 0) return null;
  const tools = new Map<string, number>();
  let body = "";
  for (const groove of grooves) {
    const rect = grooveRect(groove, length, width);
    const tool = Math.min(groove.width, 10);
    const name = `Mill${fixed(tool)}`;
    tools.set(name, tool);
    const depth = Math.min(groove.depth, thickness - 2);
    const passes = Math.max(1, Math.ceil(groove.width / tool - 1e-6));
    for (let pass = 0; pass < passes; pass += 1) {
      // Центры проходов: от края паза + радиус до другого края − радиус.
      const span = (rect.along ? rect.h : rect.w) - tool;
      const offset =
        tool / 2 + (passes === 1 ? span / 2 : (span * pass) / (passes - 1));
      if (rect.along) {
        const y = rect.y + offset;
        body += `<ms x="0" y="${fixed(y)}" dp="${fixed(depth)}" name="${name}" c="0"/><ml x="${fixed(length)}" y="${fixed(y)}"/>`;
      } else {
        const x = rect.x + offset;
        body += `<ms x="${fixed(x)}" y="0" dp="${fixed(depth)}" name="${name}" c="0"/><ml x="${fixed(x)}" y="${fixed(width)}"/>`;
      }
    }
  }
  const toolXml = [...tools.entries()]
    .map(([name, d]) => `<tool name="${name}" d="${fixed(d)}" />`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><program dx="${length.toFixed(2)}" dy="${width.toFixed(2)}" dz="${thickness.toFixed(2)}">${toolXml}${body}</program>`;
}

// Сводит присадку и фрезеровку в одну программу станка: инструменты,
// затем переменные, затем обработка — как в программах Базиса.
export function mergePrograms(first: string | null, second: string | null) {
  if (!first) return second;
  if (!second) return first;
  const head = first.match(/^[\s\S]*?<program[^>]*>/)?.[0] ?? "";
  const tools = new Map<string, string>();
  const vars = new Map<string, string>();
  let body = "";
  for (const program of [first, second]) {
    const inner = program
      .replace(/^[\s\S]*?<program[^>]*>/, "")
      .replace(/<\/program>\s*$/, "");
    for (const tool of inner.match(/<tool [^>]*\/>/g) ?? []) {
      tools.set(tool.match(/name="([^"]*)"/)?.[1] ?? tool, tool);
    }
    for (const item of inner.match(/<var [^>]*\/>/g) ?? []) {
      vars.set(item.match(/name="([^"]*)"/)?.[1] ?? item, item);
    }
    body += inner.replace(/<tool [^>]*\/>/g, "").replace(/<var [^>]*\/>/g, "");
  }
  return `${head}${[...tools.values()].join("")}${[...vars.values()].join("")}${body}</program>`;
}

// Сколько метров фрезеровать на одной детали: дуги скруглённых углов
// и длина торцов со скосом. Прайс — за погонный метр.
export function millingMeters(
  length: number,
  width: number,
  milling: PartMilling | undefined,
) {
  if (!milling || !(length > 0 && width > 0))
    return { curve: 0, bevel: 0, groove: 0 };
  const curve = CORNERS.reduce(
    (sum, corner) =>
      sum + (Math.PI * cornerRadius(milling, corner, length, width)) / 2,
    0,
  );
  const bevel = (Object.keys(milling.bevels) as PartSide[]).reduce(
    (sum, side) =>
      milling.bevels[side] > 0
        ? sum + (side === "top" || side === "bottom" ? length : width)
        : sum,
    0,
  );
  const groove = (milling.grooves ?? []).reduce(
    (sum, item) =>
      sum + (item.side === "top" || item.side === "bottom" ? length : width),
    0,
  );
  return { curve: curve / 1000, bevel: bevel / 1000, groove: groove / 1000 };
}

export function describeMilling(milling: PartMilling | undefined) {
  if (!milling) return "";
  const corners = CORNERS.filter((corner) => milling.corners[corner] > 0).map(
    (corner) =>
      `R${milling.corners[corner]} ${CORNER_LABELS[corner].toLowerCase()}`,
  );
  const sideNames: Record<PartSide, string> = {
    top: "верх",
    right: "право",
    bottom: "низ",
    left: "лево",
  };
  const bevels = (Object.keys(milling.bevels) as PartSide[])
    .filter((side) => milling.bevels[side] > 0)
    .map(
      (side) =>
        `скос ${String(milling.bevels[side]).replace(".", ",")}° ${sideNames[side]}`,
    );
  const grooves = (milling.grooves ?? []).map(
    (groove) =>
      `паз ${fixed(groove.width).replace(".", ",")}×${fixed(groove.depth).replace(".", ",")} в ${fixed(groove.indent).replace(".", ",")} мм от ${GROOVE_EDGE[groove.side]} края`,
  );
  return [...corners, ...bevels, ...grooves].join(", ");
}
