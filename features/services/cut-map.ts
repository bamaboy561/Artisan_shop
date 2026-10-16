// Карта раскроя для калькулятора распила: раскладка деталей по листам
// гильотинными резами (каждый рез проходит прямо от края до края куска, как
// на форматно-раскроечном станке).
//
// Один проход «жадной» раскладки сильно зависит от порядка деталей и правил
// выбора места, поэтому, как программы раскроя (GibLab и подобные), пробуем
// много вариантов и оставляем лучший: меньше листов, затем плотнее
// заполненные первые листы (последний лист остаётся почти пустым, его
// остаток пригоден в дело), затем меньше резов.

export type EdgeSide = "top" | "right" | "bottom" | "left";
export type BasisFirstCutDirection = "auto" | "vertical" | "horizontal";
export type CutStageDirection = Exclude<BasisFirstCutDirection, "auto">;
export type OrientationMode = "free" | "fixed" | "rotated";

export type CutMapRow = {
  id: string;
  title: string;
  width: number;
  height: number;
  quantity: number;
  edgedSides: EdgeSide[];
  orientationMode: OrientationMode;
};

export type CutMapPiece = {
  id: string;
  title: string;
  width: number;
  height: number;
  edgedSides: EdgeSide[];
  orientationMode: OrientationMode;
};

export type PlacedCutMapPiece = CutMapPiece & {
  x: number;
  y: number;
  rotated: boolean;
  sheetIndex: number;
  level: number;
};

export type CutMapCut = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: CutStageDirection;
  level: number;
};

export type CutMapSheet = {
  index: number;
  pieces: PlacedCutMapPiece[];
  cuts: CutMapCut[];
  offcuts: Array<{
    id: string;
    width: number;
    height: number;
    area: number;
  }>;
  offcutArea: number;
  largestOffcut: {
    width: number;
    height: number;
    area: number;
  } | null;
  usedArea: number;
  usableArea: number;
  cutLength: number;
  cutCount: number;
  workingArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type CutMapResult = {
  sheets: CutMapSheet[];
  unplacedPieces: CutMapPiece[];
  totalPieces: number;
  placedPieces: number;
  utilization: number;
  cutLength: number;
  cutCount: number;
  rotatedPieces: number;
  offcutArea: number;
  largestOffcut: {
    width: number;
    height: number;
    area: number;
  } | null;
  firstCutDirection: CutStageDirection;
};

export type BasisMapSettings = {
  kerf: number;
  edgeTrim: number;
  minStrip: number;
  firstCutDirection: BasisFirstCutDirection;
};

export type CutMapSheetSize = { width: number; height: number };

type FreeCutRect = {
  id: string;
  sheetIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  stage: CutStageDirection;
  level: number;
};

type Orientation = { width: number; height: number; rotated: boolean };

type WorkingArea = { x: number; y: number; width: number; height: number };

type SheetState = {
  index: number;
  pieces: PlacedCutMapPiece[];
  cuts: CutMapCut[];
  usedArea: number;
  cutLength: number;
  cutCount: number;
};

type PackContext = {
  pieces: CutMapPiece[];
  workingArea: WorkingArea;
  settings: BasisMapSettings;
};

// Сколько раскладок перебирать. Каждая — один быстрый проход; на сотнях
// деталей весь перебор укладывается в доли секунды.
const RANDOM_ORDERS = 24;
const MAX_WORK = 60_000_000;
// Обрезки уже этого не показываем как остаток: это опил.
const MIN_OFFCUT = 50;

function getOrientations(piece: CutMapPiece): Orientation[] {
  if (piece.orientationMode === "fixed" || piece.width === piece.height) {
    return [{ width: piece.width, height: piece.height, rotated: false }];
  }

  if (piece.orientationMode === "rotated") {
    return [{ width: piece.height, height: piece.width, rotated: true }];
  }

  return [
    { width: piece.width, height: piece.height, rotated: false },
    { width: piece.height, height: piece.width, rotated: true },
  ];
}

function emptyResult(
  pieces: CutMapPiece[],
  firstCutDirection: CutStageDirection,
): CutMapResult {
  return {
    sheets: [],
    unplacedPieces: pieces,
    totalPieces: pieces.length,
    placedPieces: 0,
    utilization: 0,
    cutLength: 0,
    cutCount: 0,
    rotatedPieces: 0,
    offcutArea: 0,
    largestOffcut: null,
    firstCutDirection,
  };
}

function finishResult(
  ctx: PackContext,
  sheetStates: SheetState[],
  freeRects: FreeCutRect[],
  unplacedPieces: CutMapPiece[],
  rotatedPieces: number,
  firstCutDirection: CutStageDirection,
): CutMapResult {
  const { workingArea } = ctx;
  const sheets: CutMapSheet[] = sheetStates
    .filter((sheetState) => sheetState.pieces.length > 0)
    .map((sheetState, position) => {
      const offcuts = freeRects
        .filter(
          (rect) =>
            rect.sheetIndex === sheetState.index &&
            rect.width >= MIN_OFFCUT &&
            rect.height >= MIN_OFFCUT,
        )
        .map((rect) => ({
          id: rect.id,
          width: rect.width,
          height: rect.height,
          area: rect.width * rect.height,
        }))
        .sort((left, right) => right.area - left.area);
      const offcutArea = offcuts.reduce((sum, item) => sum + item.area, 0);
      const index = position + 1;

      return {
        index,
        pieces: sheetState.pieces.map((piece) => ({
          ...piece,
          sheetIndex: index,
        })),
        cuts: sheetState.cuts,
        offcuts,
        offcutArea,
        largestOffcut: offcuts[0]
          ? {
              width: offcuts[0].width,
              height: offcuts[0].height,
              area: offcuts[0].area,
            }
          : null,
        usedArea: sheetState.usedArea,
        usableArea: workingArea.width * workingArea.height,
        cutLength: sheetState.cutLength,
        cutCount: sheetState.cutCount,
        workingArea: { ...workingArea },
      };
    });
  const totalUsedArea = sheets.reduce((sum, sheet) => sum + sheet.usedArea, 0);
  const totalUsableArea = sheets.length * workingArea.width * workingArea.height;
  const largestOffcut =
    sheets
      .map((sheet) => sheet.largestOffcut)
      .filter(
        (item): item is NonNullable<CutMapSheet["largestOffcut"]> =>
          item !== null,
      )
      .sort((left, right) => right.area - left.area)[0] ?? null;

  return {
    sheets,
    unplacedPieces,
    totalPieces: ctx.pieces.length,
    placedPieces: ctx.pieces.length - unplacedPieces.length,
    utilization: totalUsableArea > 0 ? totalUsedArea / totalUsableArea : 0,
    cutLength: sheets.reduce((sum, sheet) => sum + sheet.cutLength, 0),
    cutCount: sheets.reduce((sum, sheet) => sum + sheet.cutCount, 0),
    rotatedPieces,
    offcutArea: sheets.reduce((sum, sheet) => sum + sheet.offcutArea, 0),
    largestOffcut,
    firstCutDirection,
  };
}

// Раскладка полосами (прежний способ калькулятора): лист режется на полосы
// во всю длину, полосы — на детали. Веса оценки места подобраны вручную;
// при переборе пробуем несколько их наборов.
type StripWeights = {
  fill: number;
  secondary: number;
  primary: number;
  level: number;
};

const stripWeightSets: StripWeights[] = [
  { fill: 1200, secondary: 0.85, primary: 0.35, level: 18 },
  { fill: 0, secondary: 1, primary: 1, level: 0 },
  { fill: 4000, secondary: 0.4, primary: 1.2, level: 40 },
];

function packStrips(
  ctx: PackContext,
  order: CutMapPiece[],
  firstCutDirection: CutStageDirection,
  weights: StripWeights,
): CutMapResult {
  const { workingArea, settings } = ctx;
  const sheetStates: SheetState[] = [];
  const freeRects: FreeCutRect[] = [];
  const unplacedPieces: CutMapPiece[] = [];
  let rotatedPieces = 0;
  let cutLineIndex = 0;

  const isPrimaryStripAllowed = (
    stage: CutStageDirection,
    width: number,
    height: number,
  ) => (stage === "vertical" ? width : height) >= settings.minStrip;

  const canKeepRect = (rect: FreeCutRect) =>
    rect.width > 0 &&
    rect.height > 0 &&
    (rect.stage === "vertical" ? rect.width : rect.height) >= settings.minStrip;

  const canFitFreshSheet = (piece: CutMapPiece) =>
    getOrientations(piece).some(
      (orientation) =>
        orientation.width <= workingArea.width &&
        orientation.height <= workingArea.height &&
        isPrimaryStripAllowed(
          firstCutDirection,
          orientation.width,
          orientation.height,
        ),
    );

  const openSheet = () => {
    const index = sheetStates.length + 1;
    sheetStates.push({
      index,
      pieces: [],
      cuts: [],
      usedArea: 0,
      cutLength: 0,
      cutCount: 0,
    });
    freeRects.push({
      id: `sheet-${index}-root`,
      sheetIndex: index,
      ...workingArea,
      stage: firstCutDirection,
      level: 0,
    });
  };

  const addCut = (sheet: SheetState, cut: Omit<CutMapCut, "id">) => {
    cutLineIndex += 1;
    sheet.cuts.push({ id: `cut-${cutLineIndex}`, ...cut });
    sheet.cutLength += cut.orientation === "vertical" ? cut.height : cut.width;
    sheet.cutCount += 1;
  };

  openSheet();

  for (const piece of order) {
    if (!canFitFreshSheet(piece)) {
      unplacedPieces.push(piece);
      continue;
    }

    for (;;) {
      let best: {
        rectIndex: number;
        orientation: Orientation;
        score: number;
      } | null = null;

      for (const [rectIndex, rect] of freeRects.entries()) {
        for (const orientation of getOrientations(piece)) {
          if (
            orientation.width > rect.width ||
            orientation.height > rect.height ||
            !isPrimaryStripAllowed(
              rect.stage,
              orientation.width,
              orientation.height,
            )
          ) {
            continue;
          }

          const vertical = rect.stage === "vertical";
          const primaryWaste = vertical
            ? rect.width - orientation.width
            : rect.height - orientation.height;
          const secondaryWaste = vertical
            ? rect.height - orientation.height
            : rect.width - orientation.width;
          const stripFillRatio = vertical
            ? orientation.height / rect.height
            : orientation.width / rect.width;
          const score =
            rect.width * rect.height -
            orientation.width * orientation.height -
            stripFillRatio * weights.fill +
            secondaryWaste * weights.secondary +
            primaryWaste * weights.primary +
            rect.level * weights.level +
            rect.sheetIndex * 2 +
            (orientation.rotated ? 4 : 0);

          if (!best || score < best.score) {
            best = { rectIndex, orientation, score };
          }
        }
      }

      if (!best) {
        openSheet();
        continue;
      }

      const rect = freeRects.splice(best.rectIndex, 1)[0];
      const sheet = sheetStates[rect.sheetIndex - 1];
      const { width, height, rotated } = best.orientation;

      sheet.pieces.push({
        ...piece,
        x: rect.x,
        y: rect.y,
        width,
        height,
        rotated,
        sheetIndex: rect.sheetIndex,
        level: rect.level,
      });
      sheet.usedArea += width * height;
      if (rotated) rotatedPieces += 1;

      if (rect.stage === "vertical") {
        const rightRect: FreeCutRect = {
          id: `${rect.id}-r`,
          sheetIndex: rect.sheetIndex,
          x: rect.x + width + settings.kerf,
          y: rect.y,
          width: rect.width - width - settings.kerf,
          height: rect.height,
          stage: "vertical",
          level: rect.level,
        };
        const bottomRect: FreeCutRect = {
          id: `${rect.id}-b`,
          sheetIndex: rect.sheetIndex,
          x: rect.x,
          y: rect.y + height + settings.kerf,
          width,
          height: rect.height - height - settings.kerf,
          stage: "horizontal",
          level: rect.level + 1,
        };

        if (canKeepRect(rightRect)) {
          addCut(sheet, {
            x: rect.x + width,
            y: rect.y,
            width: settings.kerf,
            height: rect.height,
            orientation: "vertical",
            level: rect.level,
          });
          freeRects.push(rightRect);
        }

        if (canKeepRect(bottomRect)) {
          addCut(sheet, {
            x: rect.x,
            y: rect.y + height,
            width,
            height: settings.kerf,
            orientation: "horizontal",
            level: rect.level + 1,
          });
          freeRects.push(bottomRect);
        }
      } else {
        const bottomRect: FreeCutRect = {
          id: `${rect.id}-b`,
          sheetIndex: rect.sheetIndex,
          x: rect.x,
          y: rect.y + height + settings.kerf,
          width: rect.width,
          height: rect.height - height - settings.kerf,
          stage: "horizontal",
          level: rect.level,
        };
        const rightRect: FreeCutRect = {
          id: `${rect.id}-r`,
          sheetIndex: rect.sheetIndex,
          x: rect.x + width + settings.kerf,
          y: rect.y,
          width: rect.width - width - settings.kerf,
          height,
          stage: "vertical",
          level: rect.level + 1,
        };

        if (canKeepRect(bottomRect)) {
          addCut(sheet, {
            x: rect.x,
            y: rect.y + height,
            width: rect.width,
            height: settings.kerf,
            orientation: "horizontal",
            level: rect.level,
          });
          freeRects.push(bottomRect);
        }

        if (canKeepRect(rightRect)) {
          addCut(sheet, {
            x: rect.x + width,
            y: rect.y,
            width: settings.kerf,
            height,
            orientation: "vertical",
            level: rect.level + 1,
          });
          freeRects.push(rightRect);
        }
      }

      break;
    }
  }

  return finishResult(
    ctx,
    sheetStates,
    freeRects,
    unplacedPieces,
    rotatedPieces,
    firstCutDirection,
  );
}

// Классическая гильотинная раскладка: деталь ставится в свободный кусок,
// где она сидит плотнее всего, а остаток куска делится одним из двух резов.
// Направление реза выбирается правилом: так, чтобы больший остаток вышел
// одним цельным куском, либо чтобы короткий остаток отрезался первым.
type FitRule = "area" | "shortSide" | "longSide";
type SplitRule = "keepLarge" | "shorterLeftover" | "longerLeftover";

function packGuillotine(
  ctx: PackContext,
  order: CutMapPiece[],
  fitRule: FitRule,
  splitRule: SplitRule,
  firstCutDirection: CutStageDirection,
): CutMapResult {
  const { workingArea, settings } = ctx;
  const sheetStates: SheetState[] = [];
  const freeRects: FreeCutRect[] = [];
  const unplacedPieces: CutMapPiece[] = [];
  const kerf = settings.kerf;
  let rotatedPieces = 0;
  let cutLineIndex = 0;

  const fitsFreshSheet = (piece: CutMapPiece) =>
    getOrientations(piece).some(
      (orientation) =>
        orientation.width <= workingArea.width &&
        orientation.height <= workingArea.height,
    );

  const openSheet = () => {
    const index = sheetStates.length + 1;
    sheetStates.push({
      index,
      pieces: [],
      cuts: [],
      usedArea: 0,
      cutLength: 0,
      cutCount: 0,
    });
    freeRects.push({
      id: `sheet-${index}-root`,
      sheetIndex: index,
      ...workingArea,
      stage: firstCutDirection,
      level: 0,
    });
  };

  const addCut = (sheet: SheetState, cut: Omit<CutMapCut, "id">) => {
    cutLineIndex += 1;
    sheet.cuts.push({ id: `cut-${cutLineIndex}`, ...cut });
    sheet.cutLength += cut.orientation === "vertical" ? cut.height : cut.width;
    sheet.cutCount += 1;
  };

  openSheet();

  for (const piece of order) {
    if (!fitsFreshSheet(piece)) {
      unplacedPieces.push(piece);
      continue;
    }

    for (;;) {
      let best: {
        rectIndex: number;
        orientation: Orientation;
        primary: number;
        secondary: number;
      } | null = null;

      for (const [rectIndex, rect] of freeRects.entries()) {
        for (const orientation of getOrientations(piece)) {
          if (
            orientation.width > rect.width ||
            orientation.height > rect.height
          ) {
            continue;
          }

          const leftoverX = rect.width - orientation.width;
          const leftoverY = rect.height - orientation.height;
          const shortSide = Math.min(leftoverX, leftoverY);
          const longSide = Math.max(leftoverX, leftoverY);
          const areaLeft =
            rect.width * rect.height - orientation.width * orientation.height;
          // Сначала заполняем ранние листы: так последний лист пустеет.
          const sheetPenalty = rect.sheetIndex * 1e12;
          const primary =
            sheetPenalty +
            (fitRule === "area"
              ? areaLeft
              : fitRule === "shortSide"
                ? shortSide
                : longSide);
          const secondary = fitRule === "area" ? shortSide : areaLeft;

          if (
            !best ||
            primary < best.primary ||
            (primary === best.primary && secondary < best.secondary)
          ) {
            best = { rectIndex, orientation, primary, secondary };
          }
        }
      }

      if (!best) {
        openSheet();
        continue;
      }

      const rect = freeRects.splice(best.rectIndex, 1)[0];
      const sheet = sheetStates[rect.sheetIndex - 1];
      const { width, height, rotated } = best.orientation;

      sheet.pieces.push({
        ...piece,
        x: rect.x,
        y: rect.y,
        width,
        height,
        rotated,
        sheetIndex: rect.sheetIndex,
        level: rect.level,
      });
      sheet.usedArea += width * height;
      if (rotated) rotatedPieces += 1;

      const leftoverX = rect.width - width;
      const leftoverY = rect.height - height;
      // Рез поперёк всего куска: вертикальный (справа от детали) или
      // горизонтальный (под деталью).
      let verticalFirst: boolean;

      if (splitRule === "keepLarge") {
        // Больший из двух остатков должен выйти цельным.
        const rightFull = leftoverX * rect.height;
        const bottomFull = leftoverY * rect.width;
        verticalFirst = rightFull >= bottomFull;
      } else if (splitRule === "shorterLeftover") {
        verticalFirst = leftoverX < leftoverY;
      } else {
        verticalFirst = leftoverX >= leftoverY;
      }

      const rightWidth = leftoverX - kerf;
      const bottomHeight = leftoverY - kerf;

      if (verticalFirst) {
        if (rightWidth > 0) {
          addCut(sheet, {
            x: rect.x + width,
            y: rect.y,
            width: kerf,
            height: rect.height,
            orientation: "vertical",
            level: rect.level,
          });
          freeRects.push({
            id: `${rect.id}-r`,
            sheetIndex: rect.sheetIndex,
            x: rect.x + width + kerf,
            y: rect.y,
            width: rightWidth,
            height: rect.height,
            stage: "vertical",
            level: rect.level,
          });
        }

        if (bottomHeight > 0) {
          addCut(sheet, {
            x: rect.x,
            y: rect.y + height,
            width,
            height: kerf,
            orientation: "horizontal",
            level: rect.level + 1,
          });
          freeRects.push({
            id: `${rect.id}-b`,
            sheetIndex: rect.sheetIndex,
            x: rect.x,
            y: rect.y + height + kerf,
            width,
            height: bottomHeight,
            stage: "horizontal",
            level: rect.level + 1,
          });
        }
      } else {
        if (bottomHeight > 0) {
          addCut(sheet, {
            x: rect.x,
            y: rect.y + height,
            width: rect.width,
            height: kerf,
            orientation: "horizontal",
            level: rect.level,
          });
          freeRects.push({
            id: `${rect.id}-b`,
            sheetIndex: rect.sheetIndex,
            x: rect.x,
            y: rect.y + height + kerf,
            width: rect.width,
            height: bottomHeight,
            stage: "horizontal",
            level: rect.level,
          });
        }

        if (rightWidth > 0) {
          addCut(sheet, {
            x: rect.x + width,
            y: rect.y,
            width: kerf,
            height,
            orientation: "vertical",
            level: rect.level + 1,
          });
          freeRects.push({
            id: `${rect.id}-r`,
            sheetIndex: rect.sheetIndex,
            x: rect.x + width + kerf,
            y: rect.y,
            width: rightWidth,
            height,
            stage: "vertical",
            level: rect.level + 1,
          });
        }
      }

      break;
    }
  }

  return finishResult(
    ctx,
    sheetStates,
    freeRects,
    unplacedPieces,
    rotatedPieces,
    firstCutDirection,
  );
}

// Детерминированный генератор случайных чисел: при одних и тех же деталях
// калькулятор всегда показывает одну и ту же карту.
function createRandom(seed: number) {
  let state = seed >>> 0 || 1;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function hashPieces(pieces: CutMapPiece[]) {
  let hash = 2166136261;

  for (const piece of pieces) {
    for (const value of [piece.width, piece.height]) {
      hash ^= Math.round(value * 10);
      hash = Math.imul(hash, 16777619);
    }
  }

  return hash >>> 0;
}

function buildOrders(pieces: CutMapPiece[], randomCount: number) {
  const area = (piece: CutMapPiece) => piece.width * piece.height;
  const longSide = (piece: CutMapPiece) => Math.max(piece.width, piece.height);
  const shortSide = (piece: CutMapPiece) => Math.min(piece.width, piece.height);
  const by = (...keys: Array<(piece: CutMapPiece) => number>) =>
    [...pieces].sort((left, right) => {
      for (const key of keys) {
        const delta = key(right) - key(left);
        if (delta !== 0) return delta;
      }
      return 0;
    });
  const orders = [
    by(area, longSide),
    by(longSide, shortSide),
    by(shortSide, longSide),
    by((piece) => piece.width + piece.height, area),
    by((piece) => piece.height, (piece) => piece.width),
    by((piece) => piece.width, (piece) => piece.height),
  ];
  const random = createRandom(hashPieces(pieces));

  for (let index = 0; index < randomCount; index += 1) {
    // Порядок «почти по площади» со случайным разбросом: так перебор
    // находит сочетания, которые строгая сортировка пропускает.
    const spread = 0.15 + 0.35 * random();
    const keyed = pieces.map((piece) => ({
      piece,
      key: area(piece) * (1 + spread * (random() * 2 - 1)),
    }));
    keyed.sort((left, right) => right.key - left.key);
    orders.push(keyed.map((item) => item.piece));
  }

  return orders;
}

// Лучше та раскладка, где всё поместилось, меньше листов, а остаток
// собран на последнем листе (он пригоден в дело), затем меньше резов.
function isBetter(candidate: CutMapResult, best: CutMapResult | null) {
  if (!best) return true;

  if (candidate.unplacedPieces.length !== best.unplacedPieces.length) {
    return candidate.unplacedPieces.length < best.unplacedPieces.length;
  }

  if (candidate.sheets.length !== best.sheets.length) {
    return candidate.sheets.length < best.sheets.length;
  }

  const lastUsed = (result: CutMapResult) =>
    result.sheets.at(-1)?.usedArea ?? 0;
  const lastDelta = lastUsed(candidate) - lastUsed(best);

  if (Math.abs(lastDelta) > 1) {
    return lastDelta < 0;
  }

  if (candidate.cutCount !== best.cutCount) {
    return candidate.cutCount < best.cutCount;
  }

  return candidate.cutLength < best.cutLength - 0.5;
}

export function buildCutMap(
  rows: CutMapRow[],
  sheet: CutMapSheetSize,
  settings: BasisMapSettings,
): CutMapResult {
  const pieces: CutMapPiece[] = rows.flatMap((row) => {
    if (!row.width || !row.height || !row.quantity) {
      return [];
    }

    return Array.from({ length: row.quantity }, (_, index) => ({
      id: `${row.id}-${index + 1}`,
      title: row.quantity > 1 ? `${row.title} ${index + 1}` : row.title,
      width: row.width,
      height: row.height,
      edgedSides: row.edgedSides,
      orientationMode: row.orientationMode,
    }));
  });
  const directions: CutStageDirection[] =
    settings.firstCutDirection === "auto"
      ? ["vertical", "horizontal"]
      : [settings.firstCutDirection];
  const workingArea = {
    x: settings.edgeTrim,
    y: settings.edgeTrim,
    width: Math.max(sheet.width - settings.edgeTrim * 2, 0),
    height: Math.max(sheet.height - settings.edgeTrim * 2, 0),
  };

  if (pieces.length === 0) {
    return { ...emptyResult([], directions[0]), unplacedPieces: [] };
  }

  if (workingArea.width <= 0 || workingArea.height <= 0) {
    return emptyResult(pieces, directions[0]);
  }

  const ctx: PackContext = { pieces, workingArea, settings };
  // Каждый проход стоит примерно «деталей в квадрате»; на больших заказах
  // перебираем меньше случайных порядков, чтобы страница не подвисала.
  const passCost = Math.max(pieces.length * pieces.length * 4, 1);
  const variantsPerOrder = directions.length * (stripWeightSets.length + 9);
  const randomCount = Math.max(
    0,
    Math.min(
      RANDOM_ORDERS,
      Math.floor(MAX_WORK / passCost / variantsPerOrder) - 6,
    ),
  );
  const orders = buildOrders(pieces, randomCount);
  let best: CutMapResult | null = null;

  for (const order of orders) {
    for (const direction of directions) {
      for (const weights of stripWeightSets) {
        const candidate = packStrips(ctx, order, direction, weights);
        if (isBetter(candidate, best)) best = candidate;
      }

      // Гильотина без полос не зависит от направления первого реза, кроме
      // случая, когда пользователь задал его явно: тогда он соблюдается
      // только в раскладке полосами.
      if (settings.firstCutDirection !== "auto" || direction !== "vertical") {
        continue;
      }

      for (const fitRule of ["area", "shortSide", "longSide"] as const) {
        for (const splitRule of [
          "keepLarge",
          "shorterLeftover",
          "longerLeftover",
        ] as const) {
          const candidate = packGuillotine(
            ctx,
            order,
            fitRule,
            splitRule,
            direction,
          );
          if (isBetter(candidate, best)) best = candidate;
        }
      }
    }
  }

  return best ?? emptyResult(pieces, directions[0]);
}
