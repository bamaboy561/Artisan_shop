// Объёмная модель корпуса из конструктора: те же детали, что уходят в
// раскрой (features/services/cabinet-builder.ts), разложенные в
// пространстве для просмотра в BazisViewer.
//
// Оси модели: X — ширина шкафа слева направо, Y — высота от пола,
// Z — глубина от задней стенки (0) к фасаду (D). Каждая деталь — брусок
// без поворота, кроме открытых дверей: они повёрнуты на петлях.

import type { BazisViewerBox } from "@/components/bazis/bazis-viewer";
import {
  KUPE_TRAY_BOX,
  sectionSuffix,
  type CabinetPart,
  type CabinetResult,
  type CabinetSpec,
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
// Фасад без ручки: заглушка углового модуля, цоколь кухни.
export const TONE_PLAIN = 8;
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
  // Шкаф-купе: насколько сдвинута каждая дверь, мм (минус — влево).
  // Без него при doorOpen передние двери уезжают влево.
  kupeShift?: number[];
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
  );
  const rail = byTitle("царга");
  if (rail) {
    // Тумба под мойку: царги сзади и спереди вместо крыши.
    for (const z of [0, D - rail.width]) {
      boxes.push(
        brick(
          t,
          H - t,
          z,
          W - 2 * t,
          t,
          rail.width,
          TONE_BODY,
          info(rail, "Царга", body),
        ),
      );
    }
  } else {
    boxes.push(
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
  }
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
  const singleRight =
    doors.length === 1 &&
    (spec.blind ? spec.blind.side === "left" : spec.hinge === "right");
  doors.forEach((door, index) => {
    const left =
      (result.doorLeft ?? DOOR_GAP) + index * (result.doorWidth + DOOR_GAP);
    const hingeOnRight = (doors.length === 2 && index === 1) || singleRight;
    const a = hingeOnRight ? angle : -angle;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const hingeX = hingeOnRight ? left + result.doorWidth : left;
    // Выдвижной фасад карго уезжает вперёд вместе с корзиной.
    if (spec.pullOut && doors.length === 1) {
      boxes.push({
        x: 0,
        y: 0,
        sizeX: result.doorWidth,
        sizeY: result.doorHeight,
        thickness: t,
        matrix: [
          1,
          0,
          0,
          left,
          0,
          1,
          0,
          doorBottom,
          0,
          0,
          1,
          D + Math.max(0, Math.min(1, options.doorOpen)) * (D - 60),
        ],
        tone: TONE_FACADE,
        info: info(door, "Дверь", facade),
      });
      return;
    }
    // Подъёмная дверь поворачивается вверх вокруг верхнего края.
    if (spec.lift) {
      const up = Math.min(angle, (85 * Math.PI) / 180);
      const c = Math.cos(up);
      const s = Math.sin(up);
      boxes.push({
        x: 0,
        y: -result.doorHeight,
        sizeX: result.doorWidth,
        sizeY: result.doorHeight,
        thickness: t,
        matrix: [1, 0, 0, left, 0, c, s, H, 0, -s, c, D],
        tone: TONE_FACADE,
        info: info(door, "Дверь", facade),
      });
      return;
    }
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
  const blindPart = byTitle("заглушка");
  if (blindPart && result.blindPanel) {
    boxes.push(
      brick(
        result.blindPanel.left,
        doorBottom,
        D,
        result.blindPanel.width,
        result.doorHeight,
        t,
        TONE_PLAIN,
        info(blindPart, "Заглушка", facade),
      ),
    );
  }

  return boxes;
}

type PartInfo = (
  part: CabinetPart | undefined,
  fallbackName: string,
  material: string,
) => BazisViewerBox["info"];

// Начинка шкафа-купе: перегородки, полки, штанги, брючницы, ящики с
// вкладными фасадами между проставками и двери-купе на двух дорожках.
// Каждая дверь сдвигается по своей дорожке (slideKupeDoor), ящики
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
  const name = spec.name || "Шкаф-купе";
  const { doors } = kupe;
  const step = doors.width - doors.overlap;
  const shifts =
    options.kupeShift ??
    Array.from({ length: doors.count }, (_, index) =>
      index % 2 === 1 ? -open * step : 0,
    );
  // Ящики выдвигаются вслед за дверью: насколько уехала самая
  // сдвинутая дверь.
  const moved = Math.min(
    1,
    Math.max(0, ...shifts.map((shift) => Math.abs(shift ?? 0))) / step,
  );

  kupe.partitions.forEach((left, index) => {
    boxes.push(
      brick(
        left,
        bottomTop,
        0,
        t,
        spec.height - t - bottomTop,
        D,
        TONE_BODY,
        info(byTitle(`перегородка ${index + 1}`), "Перегородка", body),
      ),
    );
  });

  // Какие участки по ширине открыты: там, где сейчас нет ни одной двери.
  const doorSpans = Array.from({ length: doors.count }, (_, index) => {
    const x = index * step + (shifts[index] ?? 0);
    return [x, x + doors.width];
  });
  const isOpen = (from: number, to: number) =>
    doorSpans.every(([x0, x1]) => x1 <= from + 1 || x0 >= to - 1);

  const drawers = result.drawers;
  for (const section of kupe.sections) {
    const suffix = sectionSuffix(section.index);
    for (const shelf of section.shelves) {
      const part = byTitle(`${shelf.kind}${suffix}`);
      if (!part) continue;
      boxes.push(
        brick(
          shelf.left ?? section.left + SHELF_CLEARANCE,
          shelf.at,
          0,
          part.length,
          t,
          part.width,
          TONE_BODY,
          info(part, "Полка", body),
        ),
      );
    }
    for (const stand of section.stands) {
      const part = byTitle(`${stand.kind ?? "стойка"}${suffix}`);
      boxes.push(
        brick(
          stand.left,
          stand.at,
          0,
          t,
          stand.height,
          part?.width ?? D - 20,
          TONE_BODY,
          info(part, "Стойка", body),
        ),
      );
    }
    const rodLength = section.width - 4;
    for (const at of section.rods) {
      boxes.push(
        brick(
          section.left + 2,
          at - 12,
          D / 2 - 12,
          rodLength,
          24,
          24,
          TONE_ROD,
          {
            name: `${name}: штанга${suffix}`,
            material: "Фурнитура",
            length: Math.round(rodLength),
            width: 25,
            thickness: 25,
          },
        ),
      );
    }
    for (const at of section.trousers) {
      // Брючница: рамка с перекладинами под полкой.
      const frame = Math.min(section.width - 20, 560);
      const x = section.left + (section.width - frame) / 2;
      boxes.push(
        brick(x, at - 40, 40, frame, 30, D - 120, TONE_ROD, {
          name: `${name}: брючница${suffix}`,
          material: "Фурнитура",
          length: Math.round(D - 120),
          width: Math.round(frame),
          thickness: 30,
        }),
      );
    }

    const box = section.drawer;
    if (!drawers || !box) continue;
    const out = isOpen(box.frontLeft, box.frontLeft + box.frontWidth)
      ? moved * drawers.slide * 0.75
      : 0;
    const spacerZ = D - (drawers.inset ?? 0) - drawers.slide;
    for (const [kind, block] of [
      ["проставка ящиков", box.drawerBlock],
      ["проставка выдвижных полок", box.trayBlock],
    ] as const) {
      const spacerPart = byTitle(`${kind}${suffix}`);
      if (!block || !spacerPart) continue;
      for (const [x, width] of [
        [section.left, box.spacerLeft],
        [section.left + section.width - box.spacerRight, box.spacerRight],
      ]) {
        if (width <= 0) continue;
        boxes.push(
          brick(
            x,
            block.at,
            spacerZ,
            width,
            block.height,
            drawers.slide,
            TONE_BODY,
            info(spacerPart, "Проставка", body),
          ),
        );
      }
    }
    // Короб ящика или выдвижной полки: боковины, стенки, дно ХДФ.
    const boxAt = (
      y: number,
      h: number,
      z: number,
      kind: "ящик" | "выдвижная полка",
    ) => {
      const boxSide = byTitle(`${kind} боковина${suffix}`);
      const boxWall = byTitle(`${kind} стенка${suffix}`);
      if (!boxSide || !boxWall) return;
      const back = z - drawers.slide;
      const left = box.boxLeft;
      const label = kind === "ящик" ? "Ящик" : "Выдвижная полка";
      boxes.push(
        brick(
          left,
          y,
          back,
          t,
          h,
          drawers.slide,
          TONE_BODY,
          info(boxSide, label, body),
        ),
        brick(
          left + box.boxWidth - t,
          y,
          back,
          t,
          h,
          drawers.slide,
          TONE_BODY,
          info(boxSide, label, body),
        ),
        brick(
          left + t,
          y,
          z - t,
          box.boxWidth - 2 * t,
          h,
          t,
          TONE_BODY,
          info(boxWall, label, body),
        ),
        brick(
          left + t,
          y,
          back,
          box.boxWidth - 2 * t,
          h,
          t,
          TONE_BODY,
          info(boxWall, label, body),
        ),
        brick(
          left,
          y - BACK_THICKNESS,
          back,
          box.boxWidth,
          BACK_THICKNESS,
          drawers.slide,
          TONE_BACK,
          {
            name: `${name}: ${kind === "ящик" ? "дно ящика" : "дно выдвижной полки"}${suffix}`,
            material: "ХДФ (считает менеджер)",
            length: drawers.slide,
            width: box.boxWidth,
            thickness: BACK_THICKNESS,
          },
        ),
      );
    };
    const z = D - t - (drawers.inset ?? 0) + out;
    const front = byTitle(`фасад ящика${suffix}`);
    box.frontsAt.forEach((at, index) => {
      if (front) {
        boxes.push(
          brick(
            box.frontLeft,
            at,
            z,
            box.frontWidth,
            drawers.frontHeight,
            t,
            TONE_FACADE,
            info(front, "Фасад ящика", facade),
          ),
        );
      }
      boxAt(box.boxesAt[index], drawers.boxHeight, z, "ящик");
    });
    for (const at of box.traysAt) {
      boxAt(at, KUPE_TRAY_BOX, z + t, "выдвижная полка");
    }
  }

  // Двери-купе: чётные на задней дорожке, нечётные — на передней.
  const door = byTitle("дверь купе");
  doorSpans.forEach(([x], index) => {
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
  });
  return boxes;
}
