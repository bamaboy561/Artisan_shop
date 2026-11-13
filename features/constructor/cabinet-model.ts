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
export const TONE_LED = 3;
// Двери-купе: декор фасадов, но без ручки.
export const TONE_SLIDING = 4;
export const TONE_ROD = 5;
// LED-лента в профиле выступает из паза на столько, мм.
const LED_PROUD = 3;

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
  const kupe = result.kupe;

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
  if (shelf && !kupe) {
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
  // Полка над ящиками.
  const drawerShelf = byTitle("полка над ящиками");
  if (drawerShelf && !kupe && result.drawers?.shelfAt != null) {
    boxes.push(
      brick(
        t + SHELF_CLEARANCE,
        result.drawers.shelfAt,
        0,
        drawerShelf.length,
        t,
        drawerShelf.width,
        TONE_BODY,
        info(drawerShelf, "Полка над ящиками", body),
      ),
    );
  }

  // Ящики: фасад и короб выезжают вместе, когда открыты двери.
  const drawers = kupe ? null : result.drawers;
  if (drawers) {
    const front = byTitle("фасад ящика");
    const boxSide = byTitle("ящик боковина");
    const boxWall = byTitle("ящик стенка");
    const out =
      Math.max(0, Math.min(1, options.doorOpen)) * drawers.slide * 0.75;
    const left = t + (W - 2 * t - drawers.boxWidth) / 2;
    drawers.frontsAt.forEach((at, index) => {
      const z = D + out;
      if (front) {
        boxes.push(
          brick(
            DOOR_GAP,
            at,
            z,
            drawers.frontWidth,
            drawers.frontHeight,
            t,
            TONE_FACADE,
            info(front, "Фасад ящика", facade),
          ),
        );
      }
      if (!boxSide || !boxWall) return;
      const y = drawers.boxesAt[index];
      const h = drawers.boxHeight;
      const back = z - drawers.slide;
      boxes.push(
        brick(
          left,
          y,
          back,
          t,
          h,
          drawers.slide,
          TONE_BODY,
          info(boxSide, "Ящик", body),
        ),
        brick(
          left + drawers.boxWidth - t,
          y,
          back,
          t,
          h,
          drawers.slide,
          TONE_BODY,
          info(boxSide, "Ящик", body),
        ),
        brick(
          left + t,
          y,
          z - t,
          drawers.boxWidth - 2 * t,
          h,
          t,
          TONE_BODY,
          info(boxWall, "Ящик", body),
        ),
        brick(
          left + t,
          y,
          back,
          drawers.boxWidth - 2 * t,
          h,
          t,
          TONE_BODY,
          info(boxWall, "Ящик", body),
        ),
        brick(
          left,
          y - BACK_THICKNESS,
          back,
          drawers.boxWidth,
          BACK_THICKNESS,
          drawers.slide,
          TONE_BACK,
          {
            name: `${spec.name || "Корпус"}: дно ящика`,
            material: "ХДФ (считает менеджер)",
            length: drawers.bottom.length,
            width: drawers.bottom.width,
            thickness: BACK_THICKNESS,
          },
        ),
      );
    });
  }

  if (kupe) {
    boxes.push(...kupeInterior(spec, t, result, options, info, byTitle));
  }

  // Подсветка: светящаяся полоса в пазу под LED-профиль.
  const ledInfo = (length: number): BazisViewerBox["info"] => ({
    name: `${spec.name || "Корпус"}: подсветка`,
    material: "Профиль и лента — фурнитура",
    length: Math.round(length),
    width: 10,
    thickness: 10,
  });
  const grooveOf = (part: CabinetPart | undefined) =>
    part?.milling?.grooves?.find((groove) => groove.side === "top");
  const sideGroove = grooveOf(byTitle("боковина левая"));
  if (sideGroove) {
    const z = D - sideGroove.indent - sideGroove.width;
    const y = plinth + t;
    const height = H - t - y;
    boxes.push(
      brick(
        t,
        y,
        z,
        LED_PROUD,
        height,
        sideGroove.width,
        TONE_LED,
        ledInfo(height),
      ),
      brick(
        W - t - LED_PROUD,
        y,
        z,
        LED_PROUD,
        height,
        sideGroove.width,
        TONE_LED,
        ledInfo(height),
      ),
    );
  }
  const shelfGroove = grooveOf(shelf);
  if (shelf && shelfGroove) {
    for (const at of result.shelvesAt) {
      boxes.push(
        brick(
          t + SHELF_CLEARANCE,
          at - LED_PROUD,
          shelf.width - shelfGroove.indent - shelfGroove.width,
          shelf.length,
          LED_PROUD,
          shelfGroove.width,
          TONE_LED,
          ledInfo(shelf.length),
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
  const doors = kupe
    ? []
    : result.parts.filter((part) => /: дверь/.test(part.title));
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

type PartInfo = (
  part: CabinetPart | undefined,
  fallbackName: string,
  material: string,
) => BazisViewerBox["info"];

// Начинка шкафа-купе: перегородки, полки, штанги, ящики с вкладными
// фасадами и двери-купе на двух дорожках. Открытые двери: двери передней
// дорожки съезжают влево на ширину двери без перехлёста, ящики
// открытых секций выдвигаются.
function kupeInterior(
  spec: CabinetSpec,
  t: number,
  result: CabinetResult,
  options: CabinetModelOptions,
  info: PartInfo,
  byTitle: (suffix: string) => CabinetPart | undefined,
): BazisViewerBox[] {
  const kupe = result.kupe!;
  const D = spec.depth;
  const plinth = Math.max(0, spec.plinth);
  const body = options.bodyMaterial;
  const facade = options.facadeMaterial;
  const open = Math.max(0, Math.min(1, options.doorOpen));
  const boxes: BazisViewerBox[] = [];
  const bottomTop = plinth + t;

  kupe.partitions.forEach((left, index) => {
    const part = byTitle(`перегородка ${index + 1}`);
    boxes.push(
      brick(
        left,
        bottomTop,
        0,
        t,
        spec.height - t - bottomTop,
        D,
        TONE_BODY,
        info(part, "Перегородка", body),
      ),
    );
  });

  const shelf = byTitle("полка");
  const drawerShelf = byTitle("полка над ящиками");
  const front = byTitle("фасад ящика");
  const boxSide = byTitle("ящик боковина");
  const boxWall = byTitle("ящик стенка");
  const drawers = result.drawers;
  const { doors } = kupe;
  const shift = open * (doors.width - doors.overlap);
  kupe.sections.forEach((section, sectionIndex) => {
    for (const at of section.shelvesAt) {
      if (!shelf) break;
      boxes.push(
        brick(
          section.left + SHELF_CLEARANCE,
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
    if (section.shelfAt !== null && drawerShelf) {
      boxes.push(
        brick(
          section.left + SHELF_CLEARANCE,
          section.shelfAt,
          0,
          drawerShelf.length,
          t,
          drawerShelf.width,
          TONE_BODY,
          info(drawerShelf, "Полка над ящиками", body),
        ),
      );
    }
    if (section.rodAt !== null) {
      boxes.push({
        ...brick(
          section.left + 2,
          section.rodAt - 12,
          D / 2 - 12,
          kupe.rodLength,
          24,
          24,
          TONE_ROD,
          {
            name: `${spec.name || "Шкаф-купе"}: штанга`,
            material: "Фурнитура",
            length: kupe.rodLength,
            width: 25,
            thickness: 25,
          },
        ),
      });
    }
    if (!drawers || section.drawers === 0) return;
    // Открываются секции за дверями передней дорожки: эти двери уезжают.
    const sectionOpen = sectionIndex % 2 === 1 ? open : 0;
    const out = sectionOpen * drawers.slide * 0.75;
    const left = section.left + (section.width - drawers.boxWidth) / 2;
    for (let index = 0; index < section.drawers; index += 1) {
      const at = drawers.frontsAt[index];
      const z = D - t - (drawers.inset ?? 0) + out;
      if (front) {
        boxes.push(
          brick(
            section.left + 2,
            at,
            z,
            drawers.frontWidth,
            drawers.frontHeight,
            t,
            TONE_FACADE,
            info(front, "Фасад ящика", facade),
          ),
        );
      }
      if (!boxSide || !boxWall) continue;
      const y = drawers.boxesAt[index];
      const h = drawers.boxHeight;
      const back = z - drawers.slide;
      boxes.push(
        brick(
          left,
          y,
          back,
          t,
          h,
          drawers.slide,
          TONE_BODY,
          info(boxSide, "Ящик", body),
        ),
        brick(
          left + drawers.boxWidth - t,
          y,
          back,
          t,
          h,
          drawers.slide,
          TONE_BODY,
          info(boxSide, "Ящик", body),
        ),
        brick(
          left + t,
          y,
          z - t,
          drawers.boxWidth - 2 * t,
          h,
          t,
          TONE_BODY,
          info(boxWall, "Ящик", body),
        ),
        brick(
          left + t,
          y,
          back,
          drawers.boxWidth - 2 * t,
          h,
          t,
          TONE_BODY,
          info(boxWall, "Ящик", body),
        ),
        brick(
          left,
          y - BACK_THICKNESS,
          back,
          drawers.boxWidth,
          BACK_THICKNESS,
          drawers.slide,
          TONE_BACK,
          {
            name: `${spec.name || "Шкаф-купе"}: дно ящика`,
            material: "ХДФ (считает менеджер)",
            length: drawers.bottom.length,
            width: drawers.bottom.width,
            thickness: BACK_THICKNESS,
          },
        ),
      );
    }
  });

  // Двери-купе: чётные на задней дорожке, нечётные — на передней.
  const door = byTitle("дверь купе");
  for (let index = 0; index < doors.count; index += 1) {
    const x =
      index * (doors.width - doors.overlap) - (index % 2 === 1 ? shift : 0);
    boxes.push(
      brick(
        x,
        doors.bottom,
        D + doors.tracks[index],
        doors.width,
        doors.height,
        t,
        TONE_SLIDING,
        info(door, "Дверь купе", facade),
      ),
    );
  }
  return boxes;
}
