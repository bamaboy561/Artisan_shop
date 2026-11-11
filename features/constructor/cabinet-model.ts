// Объёмная модель корпуса из конструктора: те же детали, что уходят в
// раскрой (features/services/cabinet-builder.ts), разложенные в
// пространстве для просмотра в BazisViewer.
//
// Оси модели: X — ширина шкафа слева направо, Y — высота от пола,
// Z — глубина от задней стенки (0) к фасаду (D). Каждая деталь — брусок
// без поворота, кроме открытых дверей: они повёрнуты на петлях.

import type { BazisViewerBox } from "@/components/bazis/bazis-viewer";
import type {
  CabinetPart,
  CabinetResult,
  CabinetSpec,
} from "@/features/services/cabinet-builder";
import { hardwareHoles } from "../services/drilling-hardware";

// Номера материалов для цвета на макете.
export const TONE_BODY = 0;
export const TONE_FACADE = 1;
export const TONE_BACK = 2;

export const BACK_THICKNESS = 3;
const BACK_GAP = 2;
const DOOR_GAP = 3;
const SHELF_CLEARANCE = 1;
// Насколько открыта дверь, градусов.
const OPEN_DOOR_ANGLE = 100;

export type CabinetModelOptions = {
  // Насколько открыты двери: 0 — закрыты, 1 — открыты полностью.
  doorOpen: number;
  bodyMaterial: string;
  facadeMaterial: string;
};

const round = (value: number) => Math.round(value * 10) / 10;

// Кромка словами для таблицы деталей и инструкции. У деталей корпуса
// сторона top — передний (лицевой) торец.
export function edgeDescription(sides: CabinetPart["edgedSides"]) {
  if (sides.length === 0) return "без кромки";
  if (sides.length === 4) return "по кругу";
  const alongLength = sides.filter((s) => s === "top" || s === "bottom").length;
  const alongWidth = sides.filter((s) => s === "left" || s === "right").length;
  if (alongLength === 1 && alongWidth === 0 && sides[0] === "top") {
    return "по длине 1 (лицевой торец)";
  }
  return [
    alongLength ? `по длине ${alongLength}` : "",
    alongWidth ? `по ширине ${alongWidth}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

function translate(x: number, y: number, z: number) {
  return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
}

// Брусок от (x, y, z) размером sx × sy × sz.
function brick(
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
    matrix: translate(x, y, z),
    tone,
    info,
  };
}

export function buildCabinetModel(
  spec: CabinetSpec,
  thickness: number,
  result: CabinetResult,
  options: CabinetModelOptions,
): BazisViewerBox[] {
  const t = thickness > 0 ? thickness : 16;
  const W = spec.width;
  const H = spec.height;
  const D = spec.depth;
  const plinth = Math.max(0, spec.plinth);
  const boxes: BazisViewerBox[] = [];
  const byTitle = (suffix: string) =>
    result.parts.find((part) => part.title.endsWith(`: ${suffix}`));

  const info = (
    part: CabinetPart | undefined,
    fallbackName: string,
    material: string,
  ): BazisViewerBox["info"] => {
    if (!part) {
      return { name: fallbackName, length: 0, width: 0, thickness: t };
    }
    return {
      name: part.title,
      material,
      length: part.length,
      width: part.width,
      thickness: t,
      edges: edgeDescription(part.edgedSides),
      textured: part.fixedGrain,
      holes:
        hardwareHoles(part.hardware, part.length, part.width, t).length ||
        undefined,
    };
  };

  const body = options.bodyMaterial;
  const facade = options.facadeMaterial;

  // Боковины на всю высоту.
  boxes.push(
    brick(
      0,
      0,
      0,
      t,
      H,
      D,
      TONE_BODY,
      info(byTitle("боковина левая"), "Боковина", body),
    ),
    brick(
      W - t,
      0,
      0,
      t,
      H,
      D,
      TONE_BODY,
      info(byTitle("боковина правая"), "Боковина", body),
    ),
  );
  // Дно над цоколем и крыша между боковинами.
  boxes.push(
    brick(
      t,
      plinth,
      0,
      W - 2 * t,
      t,
      D,
      TONE_BODY,
      info(byTitle("дно"), "Дно", body),
    ),
    brick(
      t,
      H - t,
      0,
      W - 2 * t,
      t,
      D,
      TONE_BODY,
      info(byTitle("крыша"), "Крыша", body),
    ),
  );
  // Полки короче глубины: стоят от задней стенки.
  const shelf = byTitle("полка");
  if (shelf) {
    for (const at of result.shelvesAt) {
      boxes.push(
        brick(
          t + SHELF_CLEARANCE,
          at,
          0,
          shelf.length,
          t,
          shelf.width,
          TONE_BODY,
          info(shelf, "Полка", body),
        ),
      );
    }
  }
  // Цоколь спереди под дном.
  const plinthPart = byTitle("цоколь");
  if (plinthPart && plinth > 0) {
    boxes.push(
      brick(
        t,
        0,
        D - t,
        W - 2 * t,
        plinth,
        t,
        TONE_BODY,
        info(plinthPart, "Цоколь", body),
      ),
    );
  }
  // Задняя стенка ХДФ накладная, за корпусом.
  if (result.back) {
    boxes.push(
      brick(
        BACK_GAP,
        plinth + BACK_GAP,
        -BACK_THICKNESS,
        result.back.width,
        result.back.length,
        BACK_THICKNESS,
        TONE_BACK,
        {
          name: `${spec.name || "Корпус"}: задняя стенка`,
          material: "ХДФ (считает менеджер)",
          length: result.back.length,
          width: result.back.width,
          thickness: BACK_THICKNESS,
        },
      ),
    );
  }

  // Двери накладные, на петлях с краю. Открытая дверь повёрнута вокруг
  // вертикальной оси петель наружу.
  const doors = result.parts.filter((part) => /: дверь/.test(part.title));
  const doorBottom = round(H - result.doorHeight);
  const angle =
    (Math.max(0, Math.min(1, options.doorOpen)) * OPEN_DOOR_ANGLE * Math.PI) /
    180;
  doors.forEach((door, index) => {
    const left = DOOR_GAP + index * (result.doorWidth + DOOR_GAP);
    const hingeOnRight = doors.length === 2 && index === 1;
    const a = hingeOnRight ? angle : -angle;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const hingeX = hingeOnRight ? left + result.doorWidth : left;
    boxes.push({
      x: hingeOnRight ? -result.doorWidth : 0,
      y: 0,
      sizeX: result.doorWidth,
      sizeY: result.doorHeight,
      thickness: t,
      matrix: [cos, 0, sin, hingeX, 0, 1, 0, doorBottom, -sin, 0, cos, D],
      tone: TONE_FACADE,
      info: info(door, "Дверь", facade),
    });
  });

  return boxes;
}
