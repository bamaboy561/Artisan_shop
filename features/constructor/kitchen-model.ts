// 3D-макет кухни: модули из конструктора корпуса, повёрнутые к своей
// стене, столешница, цоколь и места под технику.

import type { BazisViewerBox } from "@/components/bazis/bazis-viewer";
import {
  KITCHEN_BACK,
  PLINTH_SETBACK,
  kitchenWalls,
  type KitchenResult,
  type KitchenSpec,
} from "@/features/services/kitchen-builder";
import {
  TONE_BODY,
  TONE_FACADE,
  TONE_PLAIN,
  BACK_THICKNESS,
  buildCabinetModel,
} from "./cabinet-model";

// Свои цвета кухни: столешница и техника.
export const TONE_COUNTERTOP = 6;
export const TONE_APPLIANCE = 7;
// Стены комнаты (TONE_PLAIN = 8 занят).
export const TONE_WALL = 9;
// Нержавейка мойки, стекло варочной панели и конфорки.
export const TONE_STEEL = 10;
export const TONE_GLASS = 11;
export const TONE_BURNER = 12;
const WALL_THICKNESS = 20;

// Корпус стоит задней стенкой ХДФ к стене.
const offWall: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, BACK_THICKNESS];
const DOOR_GAP = 3;

type Matrix = number[];

// Поворот и сдвиг ряда стены: локальные x (вдоль ряда), y (вверх),
// z (от стены к фасаду) в координаты кухни.
function wallTransform(
  wall: number,
  at: number,
  width: number,
  bottom: number,
  backLength: number,
): Matrix {
  if (wall === 1) {
    // Левая стена: спина к x = 0, ряд идёт от угла по +z.
    return [0, 0, 1, 0, 0, 1, 0, bottom, -1, 0, 0, at + width];
  }
  if (wall === 2) {
    // Правая стена: спина к x = длине задней стены.
    return [0, 0, -1, backLength, 0, 1, 0, bottom, 1, 0, 0, at];
  }
  return [1, 0, 0, at, 0, 1, 0, bottom, 0, 0, 1, 0];
}

function compose(outer: Matrix, inner: Matrix): Matrix {
  const result: Matrix = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      let value =
        outer[row * 4] * inner[col] +
        outer[row * 4 + 1] * inner[4 + col] +
        outer[row * 4 + 2] * inner[8 + col];
      if (col === 3) value += outer[row * 4 + 3];
      result.push(value);
    }
  }
  return result;
}

function block(
  transform: Matrix,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  tone: number,
  info: BazisViewerBox["info"],
): BazisViewerBox {
  return {
    x: 0,
    y: 0,
    sizeX: sx,
    sizeY: sy,
    thickness: sz,
    matrix: compose(transform, [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z]),
    tone,
    info,
  };
}

export function buildKitchenModel(
  spec: KitchenSpec,
  thickness: number,
  result: KitchenResult,
  options: {
    doorOpen: number;
    bodyMaterial: string;
    facadeMaterial: string;
    // Показать стены комнаты: блоки ставят к ним.
    walls?: boolean;
  },
): BazisViewerBox[] {
  const t = thickness > 0 ? thickness : 16;
  const boxes: BazisViewerBox[] = [];
  const backLength = spec.walls[0]?.length ?? 0;
  const name = spec.name.trim() || "Кухня";

  if (options.walls) {
    const height = spec.topBottom + spec.topHeight + 200;
    const walls = kitchenWalls(spec);
    walls.forEach((wall, w) => {
      const length = wall.length;
      if (length <= 0) return;
      // Задняя стена закрывает углы с боковыми.
      const from = w === 0 && walls.length > 1 ? -WALL_THICKNESS : 0;
      const to = w === 0 && walls.length > 2 ? WALL_THICKNESS : 0;
      boxes.push(
        block(
          wallTransform(w, 0, length, 0, backLength),
          from,
          0,
          -WALL_THICKNESS,
          length - from + to,
          height,
          WALL_THICKNESS,
          TONE_WALL,
          {
            name:
              w === 0
                ? "Задняя стена"
                : w === 1
                  ? "Левая стена"
                  : "Правая стена",
            material: "Стена",
            length,
            width: height,
            thickness: WALL_THICKNESS,
          },
        ),
      );
    });
  }

  for (const item of result.modules) {
    const transform = wallTransform(
      item.wall,
      item.at,
      item.width,
      item.bottom,
      backLength,
    );
    if (item.spec && item.result) {
      for (const box of buildCabinetModel(item.spec, t, item.result, options)) {
        boxes.push({
          ...box,
          matrix: compose(compose(transform, offWall), box.matrix),
        });
      }
    }
    if (item.type === "dishwasher" && item.facade) {
      boxes.push(
        block(
          transform,
          DOOR_GAP / 2,
          0,
          10,
          item.width - DOOR_GAP,
          item.height - 10,
          item.depth - 10,
          TONE_APPLIANCE,
          {
            name: `${name}, ${item.code}: посудомоечная машина`,
            material: "Техника",
            length: item.width,
            width: item.height,
            thickness: item.depth,
          },
        ),
        block(
          transform,
          DOOR_GAP / 2,
          DOOR_GAP,
          item.depth,
          item.facade.width,
          item.facade.height,
          t,
          TONE_FACADE,
          {
            name: `${name}, ${item.code}: фасад посудомойки`,
            material: options.facadeMaterial,
            length: item.facade.height,
            width: item.facade.width,
            thickness: t,
          },
        ),
      );
    }
    if (item.type === "appliance" || item.type === "fridge") {
      const fridge = item.type === "fridge";
      const height = fridge
        ? item.height + item.bottom - 20
        : item.height + item.bottom - 20;
      const fromFloor = wallTransform(
        item.wall,
        item.at,
        item.width,
        0,
        backLength,
      );
      boxes.push(
        block(
          fromFloor,
          10,
          0,
          20,
          item.width - 20,
          height,
          item.depth + (fridge ? 60 : t),
          TONE_APPLIANCE,
          {
            name: `${name}, ${item.code}: ${fridge ? "холодильник" : "техника"}`,
            material: "Техника",
            length: item.width,
            width: Math.round(height),
            thickness: item.depth,
          },
        ),
      );
    }
  }

  // Столешница: от стены, над тумбами. Вокруг вырезов под мойку и
  // варочную панель кусок собран из полос, чтобы вырез был виден.
  for (const piece of result.countertops) {
    const length = piece.to - piece.from;
    const transform = wallTransform(
      piece.wall,
      piece.from,
      length,
      result.worktop - spec.countertop,
      backLength,
    );
    const info = {
      name: `${name}: столешница`,
      material: `Столешница ${spec.countertop} мм (покупная)`,
      length: Math.round(length),
      width: spec.countertopDepth,
      thickness: spec.countertop,
    };
    const slab = (x: number, z: number, sx: number, sz: number) => {
      if (sx > 0.5 && sz > 0.5) {
        boxes.push(
          block(
            transform,
            x,
            0,
            z,
            sx,
            spec.countertop,
            sz,
            TONE_COUNTERTOP,
            info,
          ),
        );
      }
    };
    const cuts = (result.cutouts ?? [])
      .filter(
        (cut) =>
          cut.wall === piece.wall &&
          cut.at >= piece.from - 0.5 &&
          cut.at + cut.width <= piece.to + 0.5,
      )
      .sort((a, b) => a.at - b.at);
    let x = 0;
    for (const cut of cuts) {
      const left = cut.at - piece.from;
      slab(x, 0, left - x, spec.countertopDepth);
      slab(left, 0, cut.width, cut.back);
      const front = cut.back + cut.depth;
      slab(left, front, cut.width, spec.countertopDepth - front);
      x = left + cut.width;
    }
    slab(x, 0, length - x, spec.countertopDepth);
  }

  // Мойка и варочная панель над вырезами.
  for (const cut of result.cutouts ?? []) {
    const transform = wallTransform(cut.wall, cut.at, cut.width, 0, backLength);
    const top = result.worktop;
    const sideX = (cut.outer.width - cut.width) / 2;
    const sideZ = (cut.outer.depth - cut.depth) / 2;
    const put = (
      what: string,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      tone: number,
    ) =>
      boxes.push(
        block(transform, x, y, z, sx, sy, sz, tone, {
          name: `${name}, ${cut.code}: ${what}`,
          material: "Техника",
          length: cut.outer.width,
          width: cut.outer.depth,
          thickness: Math.round(sy),
        }),
      );
    if (cut.kind === "sink") {
      const what = "мойка";
      const bowl = 180;
      const wall = 1;
      // Чаша: дно и стенки внутри выреза.
      put(
        what,
        0,
        top - bowl,
        cut.back,
        cut.width,
        wall,
        cut.depth,
        TONE_STEEL,
      );
      put(what, 0, top - bowl, cut.back, wall, bowl, cut.depth, TONE_STEEL);
      put(
        what,
        cut.width - wall,
        top - bowl,
        cut.back,
        wall,
        bowl,
        cut.depth,
        TONE_STEEL,
      );
      put(what, 0, top - bowl, cut.back, cut.width, bowl, wall, TONE_STEEL);
      put(
        what,
        0,
        top - bowl,
        cut.back + cut.depth - wall,
        cut.width,
        bowl,
        wall,
        TONE_STEEL,
      );
      // Борт поверх столешницы.
      const rim = 2;
      put(
        what,
        -sideX,
        top,
        cut.back - sideZ,
        cut.outer.width,
        rim,
        sideZ,
        TONE_STEEL,
      );
      put(
        what,
        -sideX,
        top,
        cut.back + cut.depth,
        cut.outer.width,
        rim,
        sideZ,
        TONE_STEEL,
      );
      put(what, -sideX, top, cut.back, sideX, rim, cut.depth, TONE_STEEL);
      put(what, cut.width, top, cut.back, sideX, rim, cut.depth, TONE_STEEL);
      // Смеситель за чашей: стойка и излив над чашей.
      const tap = "смеситель";
      const mid = cut.width / 2 - 15;
      const behind = Math.max(10, cut.back - sideZ / 2 - 30);
      put(tap, mid, top, behind, 30, 260, 30, TONE_STEEL);
      put(tap, mid, top + 230, behind + 30, 30, 25, 170, TONE_STEEL);
    } else {
      const what = "варочная панель";
      const glass = 6;
      put(
        what,
        -sideX,
        top,
        cut.back - sideZ,
        cut.outer.width,
        glass,
        cut.outer.depth,
        TONE_GLASS,
      );
      // Конфорки: 2 × 2, задние больше.
      const cellX = cut.outer.width / 2;
      const cellZ = cut.outer.depth / 2;
      for (const [col, row] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        const size = Math.min(cellX, cellZ) * (row === 0 ? 0.72 : 0.58);
        put(
          "конфорка",
          -sideX + cellX * col + (cellX - size) / 2,
          top + glass,
          cut.back - sideZ + cellZ * row + (cellZ - size) / 2,
          size,
          1,
          size,
          TONE_BURNER,
        );
      }
    }
  }

  // Цоколь: под фасадами с отступом внутрь.
  if (result.legs > 0) {
    for (const piece of result.plinths) {
      const transform = wallTransform(
        piece.wall,
        piece.from,
        piece.to - piece.from,
        0,
        backLength,
      );
      boxes.push(
        block(
          transform,
          0,
          0,
          KITCHEN_BACK + spec.baseDepth - PLINTH_SETBACK,
          piece.to - piece.from,
          result.legs - 3,
          t,
          TONE_PLAIN,
          {
            name: `${name}: цоколь`,
            material: options.facadeMaterial,
            length: Math.round(piece.to - piece.from),
            width: result.legs - 3,
            thickness: t,
          },
        ),
      );
    }
  }
  // Фальшпанели у внутреннего угла: в плоскости фасадов боковой стены.
  for (const piece of result.fillers ?? []) {
    const transform = wallTransform(
      piece.wall,
      piece.from,
      piece.to - piece.from,
      result.legs + DOOR_GAP,
      backLength,
    );
    boxes.push(
      block(
        transform,
        0,
        0,
        KITCHEN_BACK + spec.baseDepth,
        piece.to - piece.from,
        spec.baseHeight - DOOR_GAP,
        t,
        TONE_PLAIN,
        {
          name: `${name}: фальшпанель угла`,
          material: options.facadeMaterial,
          length: spec.baseHeight - DOOR_GAP,
          width: Math.round(piece.to - piece.from),
          thickness: t,
        },
      ),
    );
  }
  return boxes;
}

// Ручки: у тумб сверху фасада, у навесных — снизу, у пеналов — посередине.
export function kitchenHandlePlacement(box: BazisViewerBox) {
  if (box.matrix[7] + box.y > 1200) return "bottom" as const;
  return box.sizeY > 1000 ? ("middle" as const) : ("top" as const);
}

export { TONE_BODY, TONE_FACADE };
