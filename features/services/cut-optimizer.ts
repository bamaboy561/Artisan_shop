// Раскрой листа так, как его режет форматно-раскроечный станок и считают
// программы раскроя (GibLab, Базис-Раскрой): гильотинные резы в 4 уровня.
//   1. Лист делится резами во всю длину на полосы.
//   2. Полоса делится поперёк на ряды.
//   3. Ряд делится на столбики деталей.
//   4. В столбике детали стоят друг над другом.
// Лист заполняется целиком, прежде чем начать следующий: для каждой полосы
// перебираются возможные ширины и берётся та, что заполнится плотнее, а для
// каждого листа — направление первого реза, при котором лист плотнее.
// Несколько порядков деталей считаются отдельно, побеждает раскрой
// с меньшим числом листов.

export type CutDirection = "vertical" | "horizontal";
export type PieceOrientationMode = "free" | "fixed" | "rotated";

export type OptimizerPiece = {
  id: string;
  width: number;
  height: number;
  orientationMode: PieceOrientationMode;
};

export type OptimizerPlacement = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  level: number;
};

export type OptimizerCut = {
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: CutDirection;
  level: number;
  length: number;
};

export type OptimizerRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OptimizerSheet = {
  direction: CutDirection;
  placements: OptimizerPlacement[];
  cuts: OptimizerCut[];
  offcuts: OptimizerRect[];
  usedArea: number;
};

export type OptimizerResult = {
  sheets: OptimizerSheet[];
  unplacedIds: string[];
};

type Option = { w: number; h: number; rotated: boolean };

// Одинаковые детали считаются одним типом с количеством: так перебор
// идёт по типам, а не по каждой детали.
type PieceType = {
  ids: string[];
  width: number;
  height: number;
  area: number;
  // Варианты установки для вертикальных полос и для горизонтальных
  // (тогда лист считается повёрнутым).
  options: Record<CutDirection, Option[]>;
};

type Placed = {
  type: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  level: number;
};

type Layout = {
  placed: Placed[];
  cuts: OptimizerCut[];
  offcuts: OptimizerRect[];
  used: number;
};

const MAX_STRIP_CANDIDATES = 16;

function orientations(
  width: number,
  height: number,
  mode: PieceOrientationMode,
  transpose: boolean,
): Option[] {
  const base = transpose ? { w: height, h: width } : { w: width, h: height };
  const turned = { w: base.h, h: base.w };

  if (mode === "rotated") return [{ ...turned, rotated: true }];
  if (mode === "fixed" || base.w === base.h)
    return [{ ...base, rotated: false }];
  return [
    { ...base, rotated: false },
    { ...turned, rotated: true },
  ];
}

// Заполняет полосу stripWidth × height (координаты от её угла).
function fillStrip(
  types: PieceType[],
  order: number[],
  direction: CutDirection,
  left: Int32Array,
  stripWidth: number,
  height: number,
  kerf: number,
): Layout {
  const placed: Placed[] = [];
  const cuts: OptimizerCut[] = [];
  const offcuts: OptimizerRect[] = [];
  const taken = new Int32Array(types.length);
  let used = 0;
  let y = 0;

  const free = (type: number) => left[type] - taken[type] > 0;
  const take = (
    type: number,
    option: Option,
    x: number,
    top: number,
    level: number,
  ) => {
    taken[type] += 1;
    used += option.w * option.h;
    placed.push({
      type,
      x,
      y: top,
      w: option.w,
      h: option.h,
      rotated: option.rotated,
      level,
    });
  };

  while (y < height) {
    const restHeight = height - y;
    // Ряд открывает первая по порядку деталь, которая влезает; ставим её
    // так, чтобы она шире всего заняла полосу.
    let opener = -1;
    let openerOption: Option | null = null;

    for (const type of order) {
      if (!free(type)) continue;
      for (const option of types[type].options[direction]) {
        if (
          option.w <= stripWidth &&
          option.h <= restHeight &&
          (!openerOption || option.w > openerOption.w)
        ) {
          opener = type;
          openerOption = option;
        }
      }
      if (openerOption) break;
    }

    if (!openerOption) break;

    const rowHeight = openerOption.h;
    let x = 0;
    let first = true;

    while (x < stripWidth) {
      const restWidth = stripWidth - x;
      let column = opener;
      let columnOption: Option | null = first ? openerOption : null;

      if (!first) {
        // Следующий столбик: деталь, которая лучше заполняет высоту ряда,
        // при равенстве — более широкая.
        for (const type of order) {
          if (!free(type)) continue;
          for (const option of types[type].options[direction]) {
            if (option.w > restWidth || option.h > rowHeight) continue;
            if (
              !columnOption ||
              option.h > columnOption.h ||
              (option.h === columnOption.h && option.w > columnOption.w)
            ) {
              column = type;
              columnOption = option;
            }
          }
        }
      }

      if (!columnOption) break;
      first = false;

      const columnWidth = columnOption.w;
      take(column, columnOption, x, y, 2);

      // Над первой деталью столбика — другие той же или меньшей ширины.
      let stackY = columnOption.h;
      while (rowHeight - stackY - kerf > 0) {
        const restStack = rowHeight - stackY - kerf;
        let best = -1;
        let bestOption: Option | null = null;

        for (const type of order) {
          if (!free(type)) continue;
          for (const option of types[type].options[direction]) {
            if (option.w > columnWidth || option.h > restStack) continue;
            if (
              !bestOption ||
              option.w * option.h > bestOption.w * bestOption.h
            ) {
              best = type;
              bestOption = option;
            }
          }
        }

        if (!bestOption) break;

        cuts.push({
          x,
          y: y + stackY,
          width: columnWidth,
          height: kerf,
          orientation: "horizontal",
          level: 3,
          length: columnWidth,
        });
        take(best, bestOption, x, y + stackY + kerf, 3);
        stackY += kerf + bestOption.h;
      }

      if (rowHeight - stackY > kerf) {
        cuts.push({
          x,
          y: y + stackY,
          width: columnWidth,
          height: kerf,
          orientation: "horizontal",
          level: 3,
          length: columnWidth,
        });
        offcuts.push({
          x,
          y: y + stackY + kerf,
          width: columnWidth,
          height: rowHeight - stackY - kerf,
        });
      }

      x += columnWidth;
      if (stripWidth - x > kerf) {
        cuts.push({
          x,
          y,
          width: kerf,
          height: rowHeight,
          orientation: "vertical",
          level: 2,
          length: rowHeight,
        });
      }
      x += kerf;
    }

    if (stripWidth - x > 0) {
      offcuts.push({ x, y, width: stripWidth - x, height: rowHeight });
    }

    y += rowHeight;
    if (height - y > kerf) {
      cuts.push({
        x: 0,
        y,
        width: stripWidth,
        height: kerf,
        orientation: "horizontal",
        level: 1,
        length: stripWidth,
      });
    }
    y += kerf;
  }

  if (height - y > 0) {
    offcuts.push({ x: 0, y, width: stripWidth, height: height - y });
  }

  return { placed, cuts, offcuts, used };
}

// Один лист: полосы слева направо, каждая — самой плотной ширины.
function packSheet(
  types: PieceType[],
  order: number[],
  direction: CutDirection,
  remaining: Int32Array,
  width: number,
  height: number,
  kerf: number,
): Layout {
  const left = remaining.slice();
  const sheet: Layout = { placed: [], cuts: [], offcuts: [], used: 0 };
  let x = 0;

  while (x < width) {
    const restWidth = width - x;
    const candidates = new Set<number>();

    for (const type of order) {
      if (left[type] <= 0) continue;
      for (const option of types[type].options[direction]) {
        if (option.w <= restWidth && option.h <= height)
          candidates.add(option.w);
      }
      if (candidates.size >= MAX_STRIP_CANDIDATES) break;
    }

    let best: Layout | null = null;
    let bestWidth = 0;
    let bestScore = -1;

    for (const stripWidth of candidates) {
      const strip = fillStrip(
        types,
        order,
        direction,
        left,
        stripWidth,
        height,
        kerf,
      );
      if (strip.placed.length === 0) continue;
      // Плотность полосы; при равной — та, что забрала больше площади.
      const score = strip.used / (stripWidth * height) + strip.used * 1e-12;
      if (score > bestScore) {
        best = strip;
        bestWidth = stripWidth;
        bestScore = score;
      }
    }

    if (!best) break;

    for (const item of best.placed) {
      left[item.type] -= 1;
      sheet.placed.push({ ...item, x: item.x + x });
    }
    for (const cut of best.cuts) sheet.cuts.push({ ...cut, x: cut.x + x });
    for (const offcut of best.offcuts)
      sheet.offcuts.push({ ...offcut, x: offcut.x + x });
    sheet.used += best.used;

    x += bestWidth;
    if (width - x > kerf) {
      sheet.cuts.push({
        x,
        y: 0,
        width: kerf,
        height,
        orientation: "vertical",
        level: 0,
        length: height,
      });
    }
    x += kerf;
  }

  if (width - x > 0) sheet.offcuts.push({ x, y: 0, width: width - x, height });

  return sheet;
}

// Горизонтальный первый рез считается как вертикальный на повёрнутом
// листе; здесь координаты возвращаются обратно.
function untranspose<T extends OptimizerRect>(rect: T): T {
  return {
    ...rect,
    x: rect.y,
    y: rect.x,
    width: rect.height,
    height: rect.width,
  };
}

const ORDERS: Array<(left: PieceType, right: PieceType) => number> = [
  (left, right) => right.area - left.area,
  (left, right) =>
    Math.max(right.width, right.height) - Math.max(left.width, left.height),
  (left, right) => right.height - left.height || right.width - left.width,
  (left, right) => right.width - left.width || right.height - left.height,
];

// orders: порядки деталей; для каждого листа берётся самый плотный из них.
function packAll(
  types: PieceType[],
  orders: number[][],
  directions: CutDirection[],
  width: number,
  height: number,
  kerf: number,
) {
  const remaining = new Int32Array(types.map((type) => type.ids.length));
  const nextId = new Int32Array(types.length);
  const sheets: OptimizerSheet[] = [];

  while (remaining.some((count) => count > 0)) {
    let best: { layout: Layout; direction: CutDirection } | null = null;

    for (const order of orders) {
      for (const direction of directions) {
        const layout =
          direction === "vertical"
            ? packSheet(types, order, direction, remaining, width, height, kerf)
            : packSheet(
                types,
                order,
                direction,
                remaining,
                height,
                width,
                kerf,
              );
        if (!best || layout.used > best.layout.used)
          best = { layout, direction };
      }
    }

    if (!best || best.layout.placed.length === 0) break;

    const { layout, direction } = best;
    const back =
      direction === "vertical"
        ? <T extends OptimizerRect>(rect: T) => rect
        : untranspose;

    sheets.push({
      direction,
      placements: layout.placed.map((item) => {
        remaining[item.type] -= 1;
        const id = types[item.type].ids[nextId[item.type]];
        nextId[item.type] += 1;
        return {
          id,
          ...back({ x: item.x, y: item.y, width: item.w, height: item.h }),
          rotated: item.rotated,
          level: item.level,
        };
      }),
      cuts: layout.cuts.map((cut) =>
        direction === "vertical"
          ? cut
          : {
              ...untranspose(cut),
              orientation:
                cut.orientation === "vertical" ? "horizontal" : "vertical",
            },
      ),
      offcuts: layout.offcuts.map(back),
      usedArea: layout.used,
    });
  }

  const unplacedIds = types.flatMap((type, index) =>
    type.ids.slice(nextId[index]),
  );

  return { sheets, unplacedIds } satisfies OptimizerResult;
}

// Второй способ — «сложные полосы» GibLab: свободные куски листа делятся
// гильотинными резами на любую глубину. Деталь ставится в кусок, где она
// подходит лучше всего, остаток режется на два новых куска.
type FreeRect = { x: number; y: number; w: number; h: number; level: number };
type Choice = (rect: FreeRect, w: number, h: number) => number;
type Split = (rect: FreeRect, w: number, h: number) => boolean;

const CHOICES: Choice[] = [
  // Меньше всего остаётся площади.
  (rect, w, h) => rect.w * rect.h - w * h,
  // Короткая сторона остатка меньше.
  (rect, w, h) => Math.min(rect.w - w, rect.h - h),
  // Длинная сторона остатка меньше.
  (rect, w, h) => Math.max(rect.w - w, rect.h - h),
];

// true — сначала поперечный рез во всю ширину куска.
const SPLITS: Split[] = [
  (rect, w, h) => rect.w - w <= rect.h - h,
  (rect, w, h) => rect.w - w > rect.h - h,
  (rect, w, h) => w * (rect.h - h) > (rect.w - w) * h,
  (rect, w, h) => w * (rect.h - h) <= (rect.w - w) * h,
];

type GuillotineConfig = { order: number[]; choice: Choice; split: Split };

type GuillotineSheet = {
  direction: CutDirection;
  placed: Array<{
    type: number;
    x: number;
    y: number;
    w: number;
    h: number;
    rotated: boolean;
    level: number;
  }>;
  cuts: OptimizerCut[];
  free: FreeRect[];
  used: number;
};

// Раскладывает детали сразу по count листам: каждая деталь идёт в лучший
// свободный кусок любого из них. left — что не поместилось.
function fillGuillotineSheets(
  types: PieceType[],
  remaining: Int32Array,
  config: GuillotineConfig,
  count: number,
  width: number,
  height: number,
  kerf: number,
) {
  const left = remaining.slice();
  const sheets: GuillotineSheet[] = Array.from({ length: count }, () => ({
    direction: "vertical" as CutDirection,
    placed: [],
    cuts: [],
    free: [{ x: 0, y: 0, w: width, h: height, level: 0 }],
    used: 0,
  }));
  let unplacedArea = 0;

  for (const type of config.order) {
    if (left[type] <= 0) continue;
    {
      let bestSheet = -1;
      let bestRect = -1;
      let bestOption: Option | null = null;
      let bestScore = Infinity;

      for (let sheetIndex = 0; sheetIndex < count; sheetIndex += 1) {
        const free = sheets[sheetIndex].free;
        for (let index = 0; index < free.length; index += 1) {
          const rect = free[index];
          for (const option of types[type].options.vertical) {
            if (option.w > rect.w || option.h > rect.h) continue;
            const score = config.choice(rect, option.w, option.h);
            if (score < bestScore) {
              bestScore = score;
              bestSheet = sheetIndex;
              bestRect = index;
              bestOption = option;
            }
          }
        }
      }

      if (!bestOption) {
        unplacedArea += types[type].area;
        continue;
      }

      const sheet = sheets[bestSheet];
      const free = sheet.free;
      const cut = (
        x: number,
        y: number,
        length: number,
        orientation: CutDirection,
        level: number,
      ) => {
        if (sheet.cuts.length === 0) sheet.direction = orientation;
        sheet.cuts.push({
          x,
          y,
          width: orientation === "vertical" ? kerf : length,
          height: orientation === "vertical" ? length : kerf,
          orientation,
          level,
          length,
        });
      };
      const rect = free.splice(bestRect, 1)[0];
      const { w, h } = bestOption;
      const restW = rect.w - w - kerf;
      const restH = rect.h - h - kerf;

      if (config.split(rect, w, h)) {
        if (restH > 0) {
          cut(rect.x, rect.y + h, rect.w, "horizontal", rect.level);
          free.push({
            x: rect.x,
            y: rect.y + h + kerf,
            w: rect.w,
            h: restH,
            level: rect.level + 1,
          });
        }
        if (restW > 0) {
          cut(rect.x + w, rect.y, h, "vertical", rect.level + 1);
          free.push({
            x: rect.x + w + kerf,
            y: rect.y,
            w: restW,
            h,
            level: rect.level + 2,
          });
        }
      } else {
        if (restW > 0) {
          cut(rect.x + w, rect.y, rect.h, "vertical", rect.level);
          free.push({
            x: rect.x + w + kerf,
            y: rect.y,
            w: restW,
            h: rect.h,
            level: rect.level + 1,
          });
        }
        if (restH > 0) {
          cut(rect.x, rect.y + h, w, "horizontal", rect.level + 1);
          free.push({
            x: rect.x,
            y: rect.y + h + kerf,
            w,
            h: restH,
            level: rect.level + 2,
          });
        }
      }

      left[type] -= 1;
      sheet.used += w * h;
      sheet.placed.push({
        type,
        x: rect.x,
        y: rect.y,
        w,
        h,
        rotated: bestOption.rotated,
        level: Math.min(rect.level + 1, 3),
      });
    }
  }

  return { sheets, left, unplacedArea };
}

// Раскрой лист за листом: для каждого листа берётся самый плотный
// из вариантов.
function packGuillotine(
  types: PieceType[],
  configs: GuillotineConfig[],
  width: number,
  height: number,
  kerf: number,
): OptimizerResult {
  let remaining = new Int32Array(types.map((type) => type.ids.length));
  const nextId = new Int32Array(types.length);
  const sheets: OptimizerSheet[] = [];
  const take = (sheet: GuillotineSheet) => {
    sheets.push({
      direction: sheet.direction,
      placements: sheet.placed.map((item) => {
        const id = types[item.type].ids[nextId[item.type]];
        nextId[item.type] += 1;
        return {
          id,
          x: item.x,
          y: item.y,
          width: item.w,
          height: item.h,
          rotated: item.rotated,
          level: item.level,
        };
      }),
      cuts: sheet.cuts,
      offcuts: sheet.free.map(({ x, y, w, h }) => ({
        x,
        y,
        width: w,
        height: h,
      })),
      usedArea: sheet.used,
    });
  };

  while (remaining.some((count) => count > 0)) {
    let best: ReturnType<typeof fillGuillotineSheets> | null = null;
    for (const config of configs) {
      const filled = fillGuillotineSheets(
        types,
        remaining,
        config,
        1,
        width,
        height,
        kerf,
      );
      if (!best || filled.sheets[0].used > best.sheets[0].used) best = filled;
    }
    if (!best || best.sheets[0].placed.length === 0) break;
    take(best.sheets[0]);
    remaining = best.left;
  }

  return {
    sheets,
    unplacedIds: types.flatMap((type, index) => type.ids.slice(nextId[index])),
  };
}

function isBetter(candidate: OptimizerResult, best: OptimizerResult) {
  if (candidate.unplacedIds.length !== best.unplacedIds.length)
    return candidate.unplacedIds.length < best.unplacedIds.length;
  if (candidate.sheets.length !== best.sheets.length)
    return candidate.sheets.length < best.sheets.length;
  // При равном числе листов лучше тот, где последний лист занят меньше:
  // остальные заполнены плотнее, а остаток удобнее сохранить.
  return (
    (candidate.sheets.at(-1)?.usedArea ?? 0) <
    (best.sheets.at(-1)?.usedArea ?? 0)
  );
}

function buildTypes(pieces: OptimizerPiece[]) {
  const byKey = new Map<string, PieceType>();

  for (const piece of pieces) {
    if (!(piece.width > 0 && piece.height > 0)) continue;
    const key = `${piece.width}|${piece.height}|${piece.orientationMode}`;
    const type = byKey.get(key);
    if (type) {
      type.ids.push(piece.id);
      continue;
    }
    byKey.set(key, {
      ids: [piece.id],
      width: piece.width,
      height: piece.height,
      area: piece.width * piece.height,
      options: {
        vertical: orientations(
          piece.width,
          piece.height,
          piece.orientationMode,
          false,
        ),
        horizontal: orientations(
          piece.width,
          piece.height,
          piece.orientationMode,
          true,
        ),
      },
    });
  }

  return [...byKey.values()];
}

function typeOrders(types: PieceType[]) {
  return ORDERS.map((compare) =>
    types
      .map((_, index) => index)
      .sort((left, right) => compare(types[left], types[right])),
  );
}

// Очередь по деталям: одинаковые детали могут уйти на разные листы.
function guillotineConfigs(types: PieceType[]) {
  return typeOrders(types).flatMap((typeOrder) => {
    const order = typeOrder.flatMap((type) => types[type].ids.map(() => type));
    return CHOICES.flatMap((choice) =>
      SPLITS.map((split) => ({ order, choice, split })),
    );
  });
}

export function optimizeCutting(
  pieces: OptimizerPiece[],
  width: number,
  height: number,
  kerf: number,
  directions: CutDirection[] = ["vertical", "horizontal"],
): OptimizerResult {
  const types = buildTypes(pieces);
  let best: OptimizerResult | null = null;

  for (const order of typeOrders(types)) {
    const result = packAll(types, [order], directions, width, height, kerf);
    if (!best || isBetter(result, best)) best = result;
  }

  // Сложные полосы — только если первый рез не задан жёстко.
  if (directions.length > 1 && types.length > 0) {
    const configs = guillotineConfigs(types);
    for (const config of configs) {
      const result = packGuillotine(types, [config], width, height, kerf);
      if (!best || isBetter(result, best)) best = result;
    }
    // Самый плотный лист из всех вариантов сразу — дорого на больших
    // проектах, поэтому только до 150 деталей.
    if (pieces.length <= 150) {
      const mixed = packGuillotine(types, configs, width, height, kerf);
      if (!best || isBetter(mixed, best)) best = mixed;
    }
  }

  return best ?? { sheets: [], unplacedIds: pieces.map((piece) => piece.id) };
}
