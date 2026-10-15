"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { BazisHole } from "@/lib/bazis-b3d";

// Что показать о детали, когда на неё нажали на макете.
export type BazisPartInfo = {
  name: string;
  // Номер позиции в проекте Базиса.
  position?: string;
  material?: string;
  length: number;
  width: number;
  thickness: number;
  // Кромка словами: «по длине 2, по ширине 1».
  edges?: string;
  edgeMaterial?: string;
  block?: string;
  textured?: boolean;
  complexContour?: boolean;
  holes?: number;
  // Отверстия присадки в координатах детали: рисуются на выбранной детали.
  drillHoles?: BazisHole[];
};

// Деталь для объёмного просмотра: прямоугольник контура (x, y, sizeX, sizeY)
// в плоскости детали, толщина по оси Z, матрица 3×4 в координаты модели и
// номер материала для цвета. info — подпись детали для карточки по нажатию.
export type BazisViewerBox = {
  x: number;
  y: number;
  sizeX: number;
  sizeY: number;
  thickness: number;
  matrix: number[];
  tone: number;
  info?: BazisPartInfo;
};

type Face = {
  points: number[][];
  normal: number[];
  tone: number;
  box: number;
  // Середина детали: при показе деталь «дышит», увеличиваясь от неё.
  pivot: number[];
};

// Показ детали после сканирования QR-кода: камера облетает изделие,
// деталь дважды выдвигается из своего места и возвращается, всё это время
// мигая. Потом остаётся просто выделенной.
const INTRO_MS = 1300;
const PULSE_MS = 1300;
const PULSES = 2;
const ANIMATION_MS = INTRO_MS + PULSE_MS * PULSES;
const MARK_COLOR = [201, 104, 78];
const FLASH_COLOR = [255, 176, 72];

// После показа камера остаётся приближенной к детали, а от неё несколько
// раз расходится кольцо, как от маяка: на длинном изделии деталь иначе
// теряется на экране телефона.
const BEACON_MS = 2200;
const BEACON_WAVES = 6;
const FOCUS_MAX_ZOOM = 2.6;

// Разборка: насколько далеко детали расходятся от середины изделия и как
// долго идёт переход между собранным и разобранным видом.
const EXPLODE_SPREAD = 0.85;
const EXPLODE_PUSH = 0.14;
const EXPLODE_MS = 900;
// Анимация сборки: каждая деталь подлетает на своё место за PART_FLY_MS,
// следующая стартует через PART_STEP_MS (на больших проектах чаще, чтобы
// сборка укладывалась в BUILD_MAX_MS).
const PART_FLY_MS = 650;
const PART_STEP_MS = 160;
const BUILD_MAX_MS = 9000;
const SELECT_COLOR = [64, 128, 176];
const HOLE_COLOR = "rgba(38, 28, 20, 0.85)";
// Нажатие, а не поворот: палец сдвинулся меньше чем на столько пикселей.
const TAP_SLOP = 6;
// Инерция поворота: за кадр скорость падает на столько, остановка ниже порога.
const SPIN_DECAY = 0.93;
const SPIN_STOP = 0.0004;
const DEFAULT_VIEW = { yaw: -0.5, pitch: 0.3, zoom: 1 };

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 1,
});

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;
const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

const palette = [
  [214, 190, 160],
  [236, 232, 224],
  [168, 142, 116],
  [196, 205, 208],
  [222, 170, 140],
];

const cornerIndexes = [
  [0, 1, 2, 3],
  [5, 4, 7, 6],
  [4, 0, 3, 7],
  [1, 5, 6, 2],
  [3, 2, 6, 7],
  [4, 5, 1, 0],
];

const views = [
  { label: "Общий вид", yaw: -0.5, pitch: 0.3 },
  { label: "Спереди", yaw: 0, pitch: 0 },
  { label: "Сверху", yaw: 0, pitch: Math.PI / 2 },
  { label: "Сбоку", yaw: -Math.PI / 2, pitch: 0 },
];

function toWorld(matrix: number[], x: number, y: number, z: number) {
  return [
    matrix[0] * x + matrix[1] * y + matrix[2] * z + matrix[3],
    matrix[4] * x + matrix[5] * y + matrix[6] * z + matrix[7],
    matrix[8] * x + matrix[9] * y + matrix[10] * z + matrix[11],
  ];
}

// Направление из координат детали в координаты модели (без сдвига).
function toWorldDirection(matrix: number[], x: number, y: number, z: number) {
  return [
    matrix[0] * x + matrix[1] * y + matrix[2] * z,
    matrix[4] * x + matrix[5] * y + matrix[6] * z,
    matrix[8] * x + matrix[9] * y + matrix[10] * z,
  ];
}

function buildScene(boxes: BazisViewerBox[], joints: number[][] | undefined) {
  const faces: Face[] = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const boxCorners = boxes.map((box) =>
    [0, 1].flatMap((layer) =>
      [
        [box.x, box.y],
        [box.x + box.sizeX, box.y],
        [box.x + box.sizeX, box.y + box.sizeY],
        [box.x, box.y + box.sizeY],
      ].map(([x, y]) => toWorld(box.matrix, x, y, layer * box.thickness)),
    ),
  );

  for (const corners of boxCorners) {
    for (const corner of corners) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], corner[axis]);
        max[axis] = Math.max(max[axis], corner[axis]);
      }
    }
  }

  for (const [boxIndex, box] of boxes.entries()) {
    const corners = boxCorners[boxIndex];
    const boxCenter = [0, 1, 2].map(
      (axis) =>
        corners.reduce((sum, corner) => sum + corner[axis], 0) / corners.length,
    );

    for (const indexes of cornerIndexes) {
      const points = indexes.map((index) => corners[index]);
      const a = points[0];
      const b = points[1];
      const c = points[2];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const normal = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
      const length = Math.hypot(normal[0], normal[1], normal[2]) || 1;

      faces.push({
        points,
        normal: normal.map((value) => value / length),
        tone: box.tone,
        box: boxIndex,
        pivot: boxCenter,
      });
    }
  }

  const center = min.map((value, axis) => (value + max[axis]) / 2);
  const radius =
    Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 || 1;
  const boxCenters = boxCorners.map((corners) =>
    [0, 1, 2].map(
      (axis) =>
        corners.reduce((sum, corner) => sum + corner[axis], 0) / corners.length,
    ),
  );
  // Детали одного блока (ящик, тумба) сначала расходятся вместе с блоком,
  // а внутри блока — ещё и друг от друга. Иначе стенки ящика остаются
  // кучкой посреди разобранного шкафа.
  const blockSums = new Map<string, number[]>();

  for (const [index, box] of boxes.entries()) {
    const block = box.info?.block;

    if (!block) continue;

    const sum = blockSums.get(block) ?? [0, 0, 0, 0];

    boxCenters[index].forEach((value, axis) => (sum[axis] += value));
    sum[3] += 1;
    blockSums.set(block, sum);
  }

  // Блок на всё изделие (так Базис часто называет модель целиком)
  // отдельно не разбираем.
  const innerBlocks = new Set(
    [...blockSums.entries()]
      .filter(([, sum]) => sum[3] > 1 && sum[3] < boxes.length / 2)
      .map(([name]) => name),
  );
  // Куда деталь уходит при разборке всего изделия (explodeOffsets) и при
  // разборке только своего блока (blockOffsets): от середины блока и
  // изделия и ещё немного поперёк своей пласти, чтобы стенки, полки
  // и фасады не слипались.
  const blockOffsets: number[][] = [];
  const explodeOffsets = boxes.map((box, index) => {
    const own = boxCenters[index];
    const block = box.info?.block;
    const sum = block && innerBlocks.has(block) ? blockSums.get(block) : null;
    const blockCenter = sum
      ? [0, 1, 2].map((axis) => sum[axis] / sum[3])
      : center;
    const away = own.map((value, axis) => value - center[axis]);
    const normal = [box.matrix[2], box.matrix[6], box.matrix[10]];
    const normalLength = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    const side = Math.sign(
      away[0] * normal[0] + away[1] * normal[1] + away[2] * normal[2],
    );
    const push = (axis: number) =>
      (normal[axis] / normalLength) * side * radius * EXPLODE_PUSH;

    blockOffsets.push(
      own.map((value, axis) =>
        sum ? (value - blockCenter[axis]) * 0.75 + push(axis) / 2 : 0,
      ),
    );

    return own.map(
      (value, axis) =>
        (blockCenter[axis] - center[axis]) * EXPLODE_SPREAD +
        (value - blockCenter[axis]) * EXPLODE_SPREAD * (sum ? 1.6 : 1) +
        push(axis),
    );
  });

  // Сколько места занимает полностью разобранное изделие: под него
  // подбираем масштаб, чтобы детали не уходили за край окна.
  const explodedRadius = Math.max(
    radius,
    ...boxCorners.flatMap((corners, index) =>
      corners.map((corner) =>
        Math.hypot(
          ...corner.map(
            (value, axis) => value + explodeOffsets[index][axis] - center[axis],
          ),
        ),
      ),
    ),
  );
  // С кем деталь скреплена фурнитурой.
  const neighbors = boxes.map(() => new Set<number>());

  for (const [a, b] of joints ?? []) {
    if (neighbors[a] && neighbors[b]) {
      neighbors[a].add(b);
      neighbors[b].add(a);
    }
  }

  return {
    faces,
    center,
    min,
    radius,
    explodedRadius,
    boxCorners,
    boxCenters,
    explodeOffsets,
    blockOffsets,
    innerBlocks,
    neighbors,
    buildOrder: buildOrder(boxes, boxCorners, neighbors),
  };
}

// Порядок сборки: сначала корпус снизу вверх (крупные детали раньше),
// потом задняя стенка, ящики и в конце фасады.
function buildStage(box: BazisViewerBox) {
  const name = box.info?.name.toLowerCase() ?? "";

  if (/фасад|двер/.test(name)) return 3;
  if (/ящ/.test(name)) return 2;
  if (/хдф|двп|зад/.test(name) || box.thickness <= 6) return 1;
  return 0;
}

// Если в проекте есть присадка, следующей ставится деталь, которая
// крепится к уже поставленным: так сборка идёт по связям, а не по именам.
// Детали без крепежа (задняя стенка на гвоздях) идут по общему порядку.
function buildOrder(
  boxes: BazisViewerBox[],
  boxCorners: number[][][],
  neighbors: Set<number>[],
) {
  const bottoms = boxCorners.map((corners) =>
    Math.min(...corners.map((corner) => corner[1])),
  );
  const ranked = boxes
    .map((box, index) => ({
      index,
      stage: buildStage(box),
      bottom: bottoms[index],
      area: box.sizeX * box.sizeY,
    }))
    .sort(
      (left, right) =>
        left.stage - right.stage ||
        // Детали на одной высоте (в пределах 2 см) ставим крупные первыми.
        Math.round(left.bottom / 20) - Math.round(right.bottom / 20) ||
        right.area - left.area,
    )
    .map((item) => item.index);

  if (neighbors.every((set) => set.size === 0)) {
    return ranked;
  }

  const placed = new Set<number>();
  const order: number[] = [];
  let remaining = ranked;

  while (remaining.length > 0) {
    // Внутри одной стадии ставим деталь, которая крепится к уже стоящим;
    // нет такой, берём следующую по общему порядку. Стадии не смешиваем:
    // фасады не вырываются вперёд корпуса, хотя к ним ничего не крепится.
    const head = remaining[0];
    const stage = buildStage(boxes[head]);
    const next =
      remaining.find(
        (index) =>
          buildStage(boxes[index]) === stage &&
          [...neighbors[index]].some((other) => placed.has(other)),
      ) ?? head;

    placed.add(next);
    order.push(next);
    remaining = remaining.filter((index) => index !== next);
  }

  return order;
}

// Расстояние от точки до ближайшей стороны многоугольника на экране.
function distanceToPolygon(x: number, y: number, polygon: number[][]) {
  let best = Infinity;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [ax, ay] = polygon[j];
    const [bx, by] = polygon[i];
    const lengthSquared = (bx - ax) ** 2 + (by - ay) ** 2;
    const t =
      lengthSquared > 0
        ? Math.min(
            1,
            Math.max(
              0,
              ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / lengthSquared,
            ),
          )
        : 0;

    best = Math.min(
      best,
      Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t)),
    );
  }

  return best;
}

// Точка внутри многоугольника на экране (чёт-нечет).
function insidePolygon(x: number, y: number, polygon: number[][]) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

export function BazisViewer({
  boxes,
  joints,
  highlightTone = null,
  toneColors,
  heightClassName = "h-[60vh] min-h-72",
  highlightBoxes,
  animationKey,
  defaultSelected = null,
  defaultExploded = false,
}: {
  boxes: BazisViewerBox[];
  // Пары деталей, скреплённых одной фурнитурой: по ним строится порядок
  // сборки и подпись «крепится к».
  joints?: number[][];
  // Если задан, выделенные детали показываются с анимацией. Новое значение
  // запускает показ заново.
  animationKey?: number;
  // Номера деталей в boxes, которые нужно выделить: остальные бледнеют.
  // Так показываем, где в изделии стоит конкретная деталь.
  highlightBoxes?: number[];
  // Высота окна макета: в формах оно ниже, чем на отдельной странице.
  heightClassName?: string;
  // Цвет материала по его номеру (красный, зелёный, синий). Если цвета нет,
  // берём условный из палитры.
  toneColors?: Array<number[] | null>;
  // Номер материала, который нужно выделить: остальные детали бледнеют.
  highlightTone?: number | null;
  // Деталь, карточка которой открыта сразу (страница детали из QR-кода).
  defaultSelected?: number | null;
  // Открыть макет сразу разобранным.
  defaultExploded?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const scene = useMemo(() => buildScene(boxes, joints), [boxes, joints]);
  const markedBoxes = useMemo(
    () => (highlightBoxes ? new Set(highlightBoxes) : null),
    [highlightBoxes],
  );
  // Сколько миллисекунд идёт показ; null — показа нет.
  const [elapsed, setElapsed] = useState<number | null>(null);
  const frameRef = useRef(0);
  // Камера наведена на выделенные детали; кнопки видов возвращают весь макет.
  const [focused, setFocused] = useState(true);
  // Сколько миллисекунд идёт «маяк» после показа; null — кольца нет.
  const [beacon, setBeacon] = useState<number | null>(null);
  const showing = animationKey !== undefined && (markedBoxes?.size ?? 0) > 0;
  // Насколько изделие разобрано: 0 — собрано, 1 — детали разнесены.
  const [explode, setExplode] = useState(defaultExploded ? 1 : 0);
  const explodeFrame = useRef(0);
  // Разобранный отдельно блок (ящик) и насколько он разобран.
  const [explodedBlock, setExplodedBlock] = useState<string | null>(null);
  const [blockAmount, setBlockAmount] = useState(0);
  const blockFrame = useRef(0);
  // Сколько миллисекунд идёт анимация сборки; null — не идёт.
  const [building, setBuilding] = useState<number | null>(null);
  const buildFrame = useRef(0);
  // Пошаговая сборка: сколько деталей уже поставлено (null — режим выключен)
  // и сколько миллисекунд летит на место последняя из них.
  const [step, setStep] = useState<number | null>(null);
  const [stepFlight, setStepFlight] = useState(PART_FLY_MS);
  const stepFrame = useRef(0);
  // Инерция поворота после отпускания.
  const spin = useRef({ yaw: 0, pitch: 0, at: 0 });
  const spinFrame = useRef(0);
  const buildTiming = useMemo(() => {
    const stepMs =
      scene.buildOrder.length > 1
        ? Math.min(
            PART_STEP_MS,
            (BUILD_MAX_MS - PART_FLY_MS) / (scene.buildOrder.length - 1),
          )
        : 0;
    const startAt = new Map<number, number>();

    scene.buildOrder.forEach((box, order) => startAt.set(box, order * stepMs));

    return {
      startAt,
      total: stepMs * Math.max(0, scene.buildOrder.length - 1) + PART_FLY_MS,
    };
  }, [scene]);
  // Деталь, на которую нажали, и деталь под мышью.
  const [selected, setSelected] = useState<number | null>(defaultSelected);
  const [hovered, setHovered] = useState<number | null>(null);
  const selectedBox =
    selected !== null && selected < boxes.length ? selected : null;
  // Грани, нарисованные в последний раз, в экранных точках: по ним ищем
  // деталь под пальцем. Последние в списке лежат сверху.
  const hitFaces = useRef<Array<{ box: number; points: number[][] }>>([]);
  const tapStart = useRef<{ x: number; y: number } | null>(null);
  // Куда и насколько приблизить камеру, чтобы выделенные детали были крупно,
  // но вокруг оставалась часть изделия и было понятно, где они стоят.
  const focusTarget = useMemo(() => {
    if (!showing || !highlightBoxes) {
      return null;
    }

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];

    for (const box of highlightBoxes) {
      for (const corner of scene.boxCorners[box] ?? []) {
        for (let axis = 0; axis < 3; axis += 1) {
          const value =
            corner[axis] + scene.explodeOffsets[box][axis] * explode;

          min[axis] = Math.min(min[axis], value);
          max[axis] = Math.max(max[axis], value);
        }
      }
    }

    if (!Number.isFinite(min[0])) {
      return null;
    }

    const radius =
      Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 || 1;

    return {
      center: min.map((value, axis) => (value + max[axis]) / 2),
      zoom: Math.min(
        FOCUS_MAX_ZOOM,
        Math.max(1, (scene.radius * 0.4) / radius),
      ),
    };
  }, [explode, highlightBoxes, scene, showing]);

  function stopAnimation() {
    cancelAnimationFrame(frameRef.current);
    setElapsed(null);
  }

  function stopBuilding() {
    cancelAnimationFrame(buildFrame.current);
    setBuilding(null);
  }

  function stopSpin() {
    cancelAnimationFrame(spinFrame.current);
    spin.current = { yaw: 0, pitch: 0, at: 0 };
  }

  // Плавно разбирает или собирает изделие.
  function animateExplode(target: number) {
    stopBuilding();
    cancelAnimationFrame(explodeFrame.current);
    setStep(null);

    if (target > 0 && explodedBlock !== null) {
      animateBlock(null);
    }

    const from = explode;
    const duration = EXPLODE_MS * Math.abs(target - from);
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const progress = duration > 0 ? Math.min(1, (now - start) / duration) : 1;

      setExplode(mix(from, target, easeInOutCubic(progress)));

      if (progress < 1) {
        explodeFrame.current = requestAnimationFrame(tick);
      }
    };

    explodeFrame.current = requestAnimationFrame(tick);
  }

  // Разбирает один блок (ящик): его детали расходятся, остальное изделие
  // стоит собранным. null — собрать блок обратно.
  function animateBlock(block: string | null) {
    cancelAnimationFrame(blockFrame.current);
    stopBuilding();
    setStep(null);

    const from = blockAmount;
    const target = block === null ? 0 : 1;

    if (block !== null) {
      setExplodedBlock(block);
    }

    const duration = EXPLODE_MS * Math.abs(target - from);
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const progress = duration > 0 ? Math.min(1, (now - start) / duration) : 1;

      setBlockAmount(mix(from, target, easeInOutCubic(progress)));

      if (progress < 1) {
        blockFrame.current = requestAnimationFrame(tick);
      } else if (block === null) {
        setExplodedBlock(null);
      }
    };

    blockFrame.current = requestAnimationFrame(tick);
  }

  // Детали по одной прилетают на свои места в порядке сборки.
  function playBuild() {
    stopAnimation();
    cancelAnimationFrame(explodeFrame.current);
    cancelAnimationFrame(buildFrame.current);
    cancelAnimationFrame(blockFrame.current);
    setExplode(0);
    setBlockAmount(0);
    setExplodedBlock(null);
    setStep(null);
    setFocused(false);
    setSelected(null);

    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const passed = now - start;

      if (passed >= buildTiming.total) {
        setBuilding(null);
        return;
      }

      setBuilding(passed);
      buildFrame.current = requestAnimationFrame(tick);
    };

    setBuilding(0);
    buildFrame.current = requestAnimationFrame(tick);
  }

  // Пошаговая сборка: показать первые count деталей, последняя прилетает
  // на место и остаётся выделенной с карточкой.
  function goToStep(count: number) {
    const total = scene.buildOrder.length;
    const next = Math.min(total, Math.max(1, count));

    stopAnimation();
    stopBuilding();
    cancelAnimationFrame(explodeFrame.current);
    cancelAnimationFrame(blockFrame.current);
    cancelAnimationFrame(stepFrame.current);
    setExplode(0);
    setBlockAmount(0);
    setExplodedBlock(null);
    setFocused(false);
    setStep(next);
    setSelected(scene.buildOrder[next - 1] ?? null);

    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const passed = now - start;

      setStepFlight(Math.min(PART_FLY_MS, passed));

      if (passed < PART_FLY_MS) {
        stepFrame.current = requestAnimationFrame(tick);
      }
    };

    setStepFlight(0);
    stepFrame.current = requestAnimationFrame(tick);
  }

  function leaveSteps() {
    cancelAnimationFrame(stepFrame.current);
    setStep(null);
    setSelected(null);
  }

  // Всё как при открытии: собрано, общий вид, ничего не выбрано.
  function resetView() {
    stopAnimation();
    stopBuilding();
    stopSpin();
    cancelAnimationFrame(explodeFrame.current);
    cancelAnimationFrame(blockFrame.current);
    cancelAnimationFrame(stepFrame.current);
    setExplode(0);
    setBlockAmount(0);
    setExplodedBlock(null);
    setStep(null);
    setSelected(null);
    setFocused(false);
    setView(DEFAULT_VIEW);
  }

  // Поворот докручивается по инерции после отпускания.
  function startSpin() {
    const { yaw, pitch, at } = spin.current;

    // Палец остановился перед отпусканием: инерции нет.
    if (performance.now() - at > 80) {
      return;
    }

    let velocity = { yaw, pitch };
    const tick = () => {
      velocity = {
        yaw: velocity.yaw * SPIN_DECAY,
        pitch: velocity.pitch * SPIN_DECAY,
      };

      if (Math.hypot(velocity.yaw, velocity.pitch) < SPIN_STOP) {
        return;
      }

      setView((current) => ({
        ...current,
        yaw: current.yaw + velocity.yaw,
        pitch: Math.min(
          Math.PI / 2,
          Math.max(-Math.PI / 2, current.pitch + velocity.pitch),
        ),
      }));
      spinFrame.current = requestAnimationFrame(tick);
    };

    spinFrame.current = requestAnimationFrame(tick);
  }

  useEffect(
    () => () => {
      cancelAnimationFrame(explodeFrame.current);
      cancelAnimationFrame(buildFrame.current);
      cancelAnimationFrame(blockFrame.current);
      cancelAnimationFrame(stepFrame.current);
      cancelAnimationFrame(spinFrame.current);
    },
    [],
  );

  // Стрелки на клавиатуре листают шаги сборки.
  const stepRef = useRef(step);
  const goToStepRef = useRef(goToStep);

  useEffect(() => {
    stepRef.current = step;
    goToStepRef.current = goToStep;
  });

  useEffect(() => {
    if (step === null) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      const current = stepRef.current;

      if (current === null || event.altKey || event.metaKey || event.ctrlKey) {
        return;
      }

      const target = event.target as HTMLElement | null;

      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        goToStepRef.current(current + 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        goToStepRef.current(current - 1);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  function boxAt(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();

    if (!rect) {
      return null;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    for (let index = hitFaces.current.length - 1; index >= 0; index -= 1) {
      const face = hitFaces.current[index];

      if (insidePolygon(x, y, face.points)) {
        return face.box;
      }
    }

    // Тонкие детали с торца на экране не шире линии: ищем грань, край
    // которой проходит рядом с точкой нажатия.
    let nearest: { box: number; distance: number } | null = null;

    for (const face of hitFaces.current) {
      const distance = distanceToPolygon(x, y, face.points);

      if (distance <= TAP_SLOP && (!nearest || distance < nearest.distance)) {
        nearest = { box: face.box, distance };
      }
    }

    return nearest?.box ?? null;
  }

  useEffect(() => {
    if (
      animationKey === undefined ||
      !markedBoxes ||
      markedBoxes.size === 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const passed = now - start;

      if (passed >= ANIMATION_MS) {
        setElapsed(null);
        return;
      }

      setElapsed(passed);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame((now) => {
      // Показ заканчивается в обычном общем виде.
      setView(DEFAULT_VIEW);
      setFocused(true);
      tick(now);
    });

    return () => cancelAnimationFrame(frameRef.current);
  }, [animationKey, markedBoxes]);

  useEffect(() => {
    if (
      !showing ||
      !focused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let frame = 0;
    const start = performance.now() + ANIMATION_MS;
    const tick = (now: number) => {
      const passed = now - start;

      if (passed >= BEACON_MS * BEACON_WAVES) {
        setBeacon(null);
        return;
      }

      setBeacon(passed >= 0 ? passed : null);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      setBeacon(null);
    };
  }, [animationKey, focused, showing]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setSize({ width: canvas.clientWidth, height: canvas.clientHeight });
    });

    observer.observe(canvas);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context || size.width === 0) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);

    // Первые мгновения показа камера подлетает к изделию сбоку и сверху.
    const intro =
      elapsed !== null && elapsed < INTRO_MS
        ? easeOutCubic(elapsed / INTRO_MS)
        : 1;
    // Камера наезжает на деталь во время первого «вдоха».
    const focus =
      focusTarget && focused
        ? elapsed === null
          ? 1
          : easeOutCubic(
              Math.min(1, Math.max(0, (elapsed - INTRO_MS) / PULSE_MS)),
            )
        : 0;
    const center = focusTarget
      ? scene.center.map((value, axis) =>
          mix(value, focusTarget.center[axis], focus),
        )
      : scene.center;
    const shown = {
      yaw: mix(view.yaw - 1.2, view.yaw, intro),
      pitch: mix(0.75, view.pitch, intro),
      zoom:
        mix(0.6, view.zoom, intro) *
        (focusTarget ? mix(1, focusTarget.zoom, focus) : 1),
    };
    // Деталь дважды плавно увеличивается и возвращается к своему размеру,
    // оставаясь на своём месте в изделии.
    const pulse =
      elapsed !== null && elapsed >= INTRO_MS
        ? Math.sin((((elapsed - INTRO_MS) % PULSE_MS) / PULSE_MS) * Math.PI) **
          2
        : 0;
    const grow = 1 + 0.22 * pulse;
    // Мигание цветом во время показа.
    const flash =
      elapsed !== null ? 0.5 + 0.5 * Math.sin((elapsed / 330) * Math.PI) : 0;
    const markColor = MARK_COLOR.map((value, index) =>
      mix(value, FLASH_COLOR[index], flash),
    );
    const cosYaw = Math.cos(shown.yaw);
    const sinYaw = Math.sin(shown.yaw);
    const cosPitch = Math.cos(shown.pitch);
    const sinPitch = Math.sin(shown.pitch);
    // Поворот вокруг вертикали (Y), затем наклон вокруг горизонтали (X).
    const rotate = (point: number[]) => {
      const x = point[0] * cosYaw + point[2] * sinYaw;
      const z = -point[0] * sinYaw + point[2] * cosYaw;

      return [
        x,
        point[1] * cosPitch - z * sinPitch,
        point[1] * sinPitch + z * cosPitch,
      ];
    };
    // Разобранное изделие занимает больше места: отдаляем камеру.
    const scale =
      (Math.min(size.width, size.height) /
        (mix(scene.radius, scene.explodedRadius, explode) * 2.05)) *
      shown.zoom;
    const toScreen = (point: number[]) => [
      size.width / 2 + point[0] * scale,
      size.height / 2 - point[1] * scale,
    ];
    const light = [0.35, 0.55, 0.76];
    const stepOrder = new Map<number, number>();

    if (step !== null) {
      scene.buildOrder.forEach((box, order) => stepOrder.set(box, order));
    }

    // Сдвиг каждой детали: разборка, разборка блока или полёт на место при
    // сборке. appear — насколько деталь уже видна (0 — ещё не вылетела).
    const placement = scene.boxCenters.map((_, box) => {
      const exploded = scene.explodeOffsets[box];
      const flyIn = (progress: number) => {
        const flight = 1 - easeOutCubic(progress);

        return {
          offset: exploded.map(
            (value, axis) =>
              (value * 1.2 + (axis === 1 ? scene.radius * 0.35 : 0)) * flight,
          ),
          appear: progress,
        };
      };

      if (building !== null) {
        return flyIn(
          Math.min(
            1,
            Math.max(
              0,
              (building - (buildTiming.startAt.get(box) ?? 0)) / PART_FLY_MS,
            ),
          ),
        );
      }

      if (step !== null) {
        const order = stepOrder.get(box) ?? 0;

        if (order >= step) return { offset: [0, 0, 0], appear: 0 };
        if (order === step - 1) return flyIn(stepFlight / PART_FLY_MS);

        return { offset: [0, 0, 0], appear: 1 };
      }

      const inBlock =
        explodedBlock !== null && boxes[box].info?.block === explodedBlock
          ? blockAmount
          : 0;

      return {
        offset: exploded.map(
          (value, axis) =>
            value * explode + scene.blockOffsets[box][axis] * inBlock,
        ),
        appear: 1,
      };
    });
    const drawn = scene.faces
      .map((face) => {
        const normal = rotate(face.normal);
        const { offset, appear } = placement[face.box];

        // Грань смотрит от зрителя или деталь ещё не вылетела: не рисуем.
        if (normal[2] <= 0.001 || appear <= 0) {
          return null;
        }

        const marked =
          (markedBoxes?.has(face.box) ?? false) || face.box === selectedBox;
        const factor = markedBoxes?.has(face.box) ? grow : 1;
        const points = face.points.map((point) =>
          rotate(
            point.map(
              (value, axis) =>
                face.pivot[axis] +
                (value - face.pivot[axis]) * factor +
                offset[axis] -
                center[axis],
            ),
          ),
        );
        const depth =
          points.reduce((sum, point) => sum + point[2], 0) / points.length;
        const shade =
          0.55 +
          0.45 *
            Math.max(
              0,
              normal[0] * light[0] +
                normal[1] * light[1] +
                normal[2] * light[2],
            );

        return {
          points,
          depth,
          shade,
          tone: face.tone,
          box: face.box,
          marked,
          appear,
        };
      })
      .filter((face) => face !== null)
      // Выделенные детали рисуем последними, чтобы их было видно сквозь
      // остальные.
      .sort(
        (left, right) =>
          Number(left.marked) - Number(right.marked) ||
          left.depth - right.depth,
      );

    context.lineJoin = "round";
    context.lineWidth = 0.6;
    context.strokeStyle = "rgba(60, 48, 38, 0.55)";

    // Границы выделенных деталей на экране: вокруг них рисуем кольцо,
    // а под выбранной подписываем размеры.
    const markedBounds = new Map<number, number[]>();
    const hits: Array<{ box: number; points: number[][] }> = [];
    // В пошаговой сборке остальные детали не бледнеют: нужно видеть, куда
    // встаёт новая.
    const dimOthers = step === null && selectedBox !== null;

    for (const face of drawn) {
      const isSelected = face.box === selectedBox;
      // Разобранный блок виден целиком, остальное изделие бледнеет.
      const inOpenBlock =
        explodedBlock !== null &&
        blockAmount > 0 &&
        boxes[face.box].info?.block === explodedBlock;
      const isMarked = face.marked && !isSelected;
      const selecting = markedBoxes !== null || highlightTone !== null;
      const muted = isSelected
        ? false
        : markedBoxes
          ? !isMarked
          : (dimOthers && !inOpenBlock) ||
            (highlightTone !== null && face.tone !== highlightTone);
      const base = isSelected
        ? SELECT_COLOR
        : muted
          ? [226, 224, 220]
          : isMarked
            ? markColor
            : selecting
              ? MARK_COLOR
              : (toneColors?.[face.tone] ??
                palette[face.tone % palette.length]);
      // Деталь под мышью чуть светлее.
      const color =
        face.box === hovered && !isSelected
          ? base.map((value) => mix(value, 255, 0.25))
          : base;

      context.globalAlpha =
        (muted ? (markedBoxes ? 0.22 : dimOthers ? 0.35 : 0.45) : 1) *
        Math.min(1, face.appear * 2.5);
      // У выделенной детали контур темнее и толще.
      context.lineWidth = face.marked ? 1.4 : 0.6;
      context.strokeStyle = isSelected
        ? "rgba(20, 52, 82, 0.95)"
        : face.marked
          ? "rgba(110, 38, 18, 0.9)"
          : "rgba(60, 48, 38, 0.55)";

      const screen = face.points.map(toScreen);

      hits.push({ box: face.box, points: screen });
      context.beginPath();
      screen.forEach(([x, y], index) => {
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.closePath();
      context.fillStyle = `rgb(${color
        .map((value) => Math.round(value * face.shade))
        .join(",")})`;
      context.fill();
      context.stroke();

      if (face.marked) {
        const bounds = markedBounds.get(face.box) ?? [
          Infinity,
          Infinity,
          -Infinity,
          -Infinity,
        ];

        for (const [x, y] of screen) {
          bounds[0] = Math.min(bounds[0], x);
          bounds[1] = Math.min(bounds[1], y);
          bounds[2] = Math.max(bounds[2], x);
          bounds[3] = Math.max(bounds[3], y);
        }

        markedBounds.set(face.box, bounds);
      }
    }
    context.globalAlpha = 1;
    hitFaces.current = hits;

    // Отверстия присадки на выбранной детали: кружок в месте сверления
    // и штрих вглубь по направлению отверстия.
    const selectedInfo = selectedBox !== null ? boxes[selectedBox] : null;

    if (
      selectedInfo?.info?.drillHoles &&
      selectedBox !== null &&
      placement[selectedBox].appear > 0
    ) {
      const { offset } = placement[selectedBox];
      const project = (local: number[]) =>
        toScreen(
          rotate(
            toWorld(selectedInfo.matrix, local[0], local[1], local[2]).map(
              (value, axis) => value + offset[axis] - center[axis],
            ),
          ),
        );

      context.fillStyle = HOLE_COLOR;
      context.strokeStyle = HOLE_COLOR;
      context.lineWidth = 1.5;

      for (const hole of selectedInfo.info.drillHoles) {
        const start = project([hole.x, hole.y, hole.z]);
        const end = project([
          hole.x + hole.dx * hole.depth,
          hole.y + hole.dy * hole.depth,
          hole.z + hole.dz * hole.depth,
        ]);
        const direction = toWorldDirection(
          selectedInfo.matrix,
          hole.dx,
          hole.dy,
          hole.dz,
        );
        // Отверстие смотрит от зрителя: оно на обратной стороне детали.
        const towardViewer = rotate(direction)[2] < 0;

        context.globalAlpha = towardViewer ? 0.95 : 0.3;
        context.beginPath();
        context.moveTo(start[0], start[1]);
        context.lineTo(end[0], end[1]);
        context.stroke();
        context.beginPath();
        context.arc(
          start[0],
          start[1],
          Math.max(2.2, (hole.diameter / 2) * scale),
          0,
          Math.PI * 2,
        );
        context.fill();
      }

      context.globalAlpha = 1;
    }

    // Размеры выбранной детали под ней на макете.
    const selectedBounds =
      selectedBox !== null ? markedBounds.get(selectedBox) : undefined;

    if (selectedBounds && selectedInfo) {
      const info = selectedInfo.info;
      const label = info
        ? `${numberFormatter.format(info.length)} × ${numberFormatter.format(info.width)} × ${numberFormatter.format(info.thickness)} мм`
        : `${numberFormatter.format(selectedInfo.sizeX)} × ${numberFormatter.format(selectedInfo.sizeY)} × ${numberFormatter.format(selectedInfo.thickness)} мм`;

      context.font =
        "600 12px ui-sans-serif, system-ui, -apple-system, sans-serif";
      context.textBaseline = "middle";
      context.textAlign = "center";

      const width = context.measureText(label).width + 14;
      const x = Math.min(
        size.width - width / 2 - 4,
        Math.max(width / 2 + 4, (selectedBounds[0] + selectedBounds[2]) / 2),
      );
      const y = Math.min(size.height - 14, selectedBounds[3] + 14);

      context.fillStyle = "rgba(255, 255, 255, 0.92)";
      context.fillRect(x - width / 2, y - 10, width, 20);
      context.strokeStyle = "rgba(20, 52, 82, 0.6)";
      context.lineWidth = 1;
      context.strokeRect(x - width / 2, y - 10, width, 20);
      context.fillStyle = "rgb(20, 52, 82)";
      context.fillText(label, x, y);
    }

    if (beacon !== null && elapsed === null) {
      const wave = (beacon % BEACON_MS) / BEACON_MS;
      // Соседние детали обводим одним кольцом, чтобы кольца не путались.
      const circles = [...markedBounds.entries()]
        .filter(([box]) => box !== selectedBox || markedBoxes?.has(box))
        .map(([, [minX, minY, maxX, maxY]]) => ({
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2,
          r: Math.max(14, Math.hypot(maxX - minX, maxY - minY) / 2 + 8),
        }));

      for (let merged = true; merged; ) {
        merged = false;

        for (let i = 0; i < circles.length && !merged; i += 1) {
          for (let j = i + 1; j < circles.length && !merged; j += 1) {
            const a = circles[i];
            const b = circles[j];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);

            if (distance < a.r + b.r) {
              const r = Math.max(a.r, b.r, (distance + a.r + b.r) / 2);
              const shift = distance > 0 ? (r - a.r) / distance : 0;

              circles[i] = {
                x: a.x + (b.x - a.x) * shift,
                y: a.y + (b.y - a.y) * shift,
                r,
              };
              circles.splice(j, 1);
              merged = true;
            }
          }
        }
      }

      context.lineWidth = 2.5;
      context.strokeStyle = `rgba(232, 104, 40, ${0.75 * (1 - wave)})`;

      for (const { x, y, r } of circles) {
        context.beginPath();
        context.arc(x, y, r + wave * 36, 0, Math.PI * 2);
        context.stroke();
      }
    }
  }, [
    beacon,
    blockAmount,
    boxes,
    building,
    buildTiming,
    elapsed,
    explode,
    explodedBlock,
    focusTarget,
    focused,
    highlightTone,
    hovered,
    markedBoxes,
    scene,
    selectedBox,
    size,
    step,
    stepFlight,
    toneColors,
    view,
  ]);

  const info = selectedBox !== null ? boxes[selectedBox]?.info : undefined;
  const sameCount = useMemo(() => {
    if (!info) return 0;

    const key = (part: BazisPartInfo) =>
      [part.name, part.material, part.length, part.width, part.thickness].join(
        "|",
      );
    const own = key(info);

    return boxes.filter((box) => box.info && key(box.info) === own).length;
  }, [boxes, info]);
  // Где деталь стоит в изделии: ближний к началу координат угол,
  // считая от угла всего изделия.
  const placeAt =
    selectedBox !== null
      ? [0, 1, 2].map((axis) =>
          Math.round(
            Math.min(
              ...(scene.boxCorners[selectedBox] ?? []).map(
                (corner) => corner[axis],
              ),
            ) - scene.min[axis],
          ),
        )
      : null;
  // К каким деталям крепится выбранная (по общему крепежу).
  const attachedTo =
    selectedBox !== null
      ? [...scene.neighbors[selectedBox]]
          .filter(
            (other) =>
              step === null ||
              scene.buildOrder.indexOf(other) <
                scene.buildOrder.indexOf(selectedBox),
          )
          .map((other) => boxes[other]?.info?.name || `деталь ${other + 1}`)
      : [];
  const attachedLabel =
    attachedTo.length > 0
      ? [...new Set(attachedTo)]
          .map((name) => {
            const count = attachedTo.filter((item) => item === name).length;

            return count > 1 ? `${name} ×${count}` : name;
          })
          .join(", ")
      : "";
  const holesLabel = info?.drillHoles?.length
    ? (() => {
        const face = info.drillHoles.filter((hole) => hole.kind === "face");
        const edge = info.drillHoles.filter((hole) => hole.kind === "edge");

        return [
          face.length > 0 ? `в пласть ${face.length}` : "",
          edge.length > 0 ? `в торец ${edge.length}` : "",
        ]
          .filter(Boolean)
          .join(", ");
      })()
    : info?.holes
      ? `${info.holes} отв.`
      : "";
  const facts: Array<[string, string]> = info
    ? [
        [
          "Размер",
          `${numberFormatter.format(info.length)} × ${numberFormatter.format(info.width)} × ${numberFormatter.format(info.thickness)} мм`,
        ],
        ["Материал", info.material || "не указан"],
        ...(info.edges !== undefined
          ? ([
              [
                "Кромка, сторон",
                info.edgeMaterial && info.edges !== "нет"
                  ? `${info.edges} (${info.edgeMaterial})`
                  : info.edges,
              ],
            ] as Array<[string, string]>)
          : []),
        ...(info.position
          ? ([["Позиция в проекте", `№ ${info.position}`]] as Array<
              [string, string]
            >)
          : []),
        ...(info.block
          ? ([["Входит в", info.block]] as Array<[string, string]>)
          : []),
        ...(placeAt
          ? ([
              [
                "Положение в изделии",
                `X ${placeAt[0]} · Y ${placeAt[1]} · Z ${placeAt[2]} мм`,
              ],
            ] as Array<[string, string]>)
          : []),
        ...(attachedLabel
          ? ([
              [step !== null ? "Крепится к" : "Скреплена с", attachedLabel],
            ] as Array<[string, string]>)
          : []),
        ...(holesLabel
          ? ([["Присадка", holesLabel]] as Array<[string, string]>)
          : []),
        ...(info.textured
          ? ([["Текстура", "по длине, не поворачивать"]] as Array<
              [string, string]
            >)
          : []),
        ...(info.complexContour
          ? ([["Контур", "фигурный (вырезы или скругления)"]] as Array<
              [string, string]
            >)
          : []),
        ...(sameCount > 1
          ? ([["Таких в проекте", `${sameCount} шт.`]] as Array<
              [string, string]
            >)
          : []),
      ]
    : [];
  const selectedBlock =
    info?.block && scene.innerBlocks.has(info.block) ? info.block : null;
  const stepTotal = scene.buildOrder.length;
  const buttonClassName =
    "border border-[#cbc7bf] bg-white px-3 py-1.5 text-xs font-medium text-[#171714] transition hover:border-[#171714] disabled:cursor-default disabled:opacity-40 disabled:hover:border-[#cbc7bf]";

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {views.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              stopAnimation();
              stopSpin();
              setFocused(false);
              setView({ yaw: item.yaw, pitch: item.pitch, zoom: 1 });
            }}
            className={buttonClassName}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            setView((current) => ({ ...current, zoom: current.zoom * 1.3 }))
          }
          aria-label="Приблизить"
          className={buttonClassName}
        >
          +
        </button>
        <button
          type="button"
          onClick={() =>
            setView((current) => ({
              ...current,
              zoom: Math.max(0.3, current.zoom / 1.3),
            }))
          }
          aria-label="Отдалить"
          className={buttonClassName}
        >
          −
        </button>
        <button type="button" onClick={resetView} className={buttonClassName}>
          Сбросить вид
        </button>
        <button
          type="button"
          onClick={() => animateExplode(explode > 0.5 ? 0 : 1)}
          className={buttonClassName}
        >
          {explode > 0.5 ? "Собрать" : "Разобрать"}
        </button>
        <button
          type="button"
          onClick={() => (building !== null ? stopBuilding() : playBuild())}
          className={buttonClassName}
        >
          {building !== null ? "Остановить сборку" : "▶ Анимация сборки"}
        </button>
        <button
          type="button"
          onClick={() => (step === null ? goToStep(1) : leaveSteps())}
          aria-pressed={step !== null}
          className={`${buttonClassName} ${step !== null ? "border-[#171714] bg-[#171714] text-white hover:bg-[#2b2b27]" : ""}`}
        >
          {step === null ? "Сборка по шагам" : "Выйти из сборки по шагам"}
        </button>
        <label className="flex min-w-48 flex-1 items-center gap-2 text-xs text-[#55524c] sm:max-w-72">
          <span className="whitespace-nowrap">Разнести детали</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(explode * 100)}
            onChange={(event) => {
              stopBuilding();
              cancelAnimationFrame(explodeFrame.current);
              setStep(null);
              setExplode(Number(event.target.value) / 100);
            }}
            className="w-full accent-[#a94730]"
          />
        </label>
      </div>
      {step !== null ? (
        <div className="flex flex-wrap items-center gap-2 border border-[#171714] bg-white px-3 py-2 text-sm text-[#171714]">
          <button
            type="button"
            onClick={() => goToStep(step - 1)}
            disabled={step <= 1}
            aria-label="Предыдущий шаг"
            className={buttonClassName}
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => goToStep(step + 1)}
            disabled={step >= stepTotal}
            aria-label="Следующий шаг"
            className={buttonClassName}
          >
            ▶
          </button>
          <p className="min-w-0 flex-1">
            <span className="font-semibold">
              Шаг {step} из {stepTotal}:
            </span>{" "}
            {info?.name || `деталь ${(scene.buildOrder[step - 1] ?? 0) + 1}`}
            {attachedLabel ? (
              <span className="text-[#55524c]">
                {" "}
                · крепится к: {attachedLabel}
              </span>
            ) : null}
            {step >= stepTotal ? (
              <span className="text-[#55524c]"> · изделие собрано</span>
            ) : null}
          </p>
          <span className="hidden text-xs text-[#77736c] sm:inline">
            Стрелки ← → на клавиатуре листают шаги
          </span>
        </div>
      ) : null}
      <div className="relative grid gap-2">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Объёмный вид проекта. Поворачивайте мышью или пальцем."
          className={`${heightClassName} w-full cursor-grab touch-none border border-[#d7d4ce] bg-[#f6f4f0] active:cursor-grabbing`}
          onPointerDown={(event) => {
            stopAnimation();
            stopSpin();
            tapStart.current =
              pointers.current.size === 0
                ? { x: event.clientX, y: event.clientY }
                : null;
            event.currentTarget.setPointerCapture(event.pointerId);
            pointers.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
          }}
          onPointerMove={(event) => {
            const previous = pointers.current.get(event.pointerId);

            if (!previous) {
              // Мышь без нажатия: подсвечиваем деталь под ней.
              if (event.pointerType === "mouse") {
                const box = boxAt(event.clientX, event.clientY);

                if (box !== hovered) setHovered(box);
              }

              return;
            }

            const next = { x: event.clientX, y: event.clientY };

            if (
              tapStart.current &&
              Math.hypot(
                next.x - tapStart.current.x,
                next.y - tapStart.current.y,
              ) > TAP_SLOP
            ) {
              tapStart.current = null;
            }

            if (pointers.current.size === 2) {
              // Два пальца: меняем масштаб по изменению расстояния.
              const other = [...pointers.current.entries()].find(
                ([id]) => id !== event.pointerId,
              )?.[1];

              if (other) {
                const before = Math.hypot(
                  previous.x - other.x,
                  previous.y - other.y,
                );
                const after = Math.hypot(next.x - other.x, next.y - other.y);

                if (before > 0) {
                  setView((current) => ({
                    ...current,
                    zoom: Math.min(
                      40,
                      Math.max(0.3, current.zoom * (after / before)),
                    ),
                  }));
                }
              }
            } else {
              const yaw = (next.x - previous.x) * 0.008;
              const pitch = (next.y - previous.y) * 0.008;

              spin.current = { yaw, pitch, at: performance.now() };
              setView((current) => ({
                ...current,
                yaw: current.yaw + yaw,
                pitch: Math.min(
                  Math.PI / 2,
                  Math.max(-Math.PI / 2, current.pitch + pitch),
                ),
              }));
            }

            pointers.current.set(event.pointerId, next);
          }}
          onPointerUp={(event) => {
            pointers.current.delete(event.pointerId);

            // Нажатие без поворота выбирает деталь, нажатие мимо — снимает выбор.
            if (tapStart.current) {
              const box = boxAt(event.clientX, event.clientY);

              if (step !== null) {
                // В пошаговой сборке нажатие на поставленную деталь
                // переходит к её шагу.
                if (box !== null) {
                  goToStep(scene.buildOrder.indexOf(box) + 1);
                }
              } else {
                setSelected((current) => (box === current ? null : box));
              }

              tapStart.current = null;
            } else if (pointers.current.size === 0) {
              startSpin();
            }
          }}
          onPointerCancel={(event) => {
            pointers.current.delete(event.pointerId);
            tapStart.current = null;
          }}
          onPointerLeave={() => setHovered(null)}
          onWheel={(event) => {
            stopAnimation();
            const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;

            setView((current) => ({
              ...current,
              zoom: Math.min(40, Math.max(0.3, current.zoom * factor)),
            }));
          }}
          style={{ cursor: hovered !== null ? "pointer" : undefined }}
        />
        {selectedBox !== null ? (
          <aside
            aria-live="polite"
            className="grid gap-2 border border-[#d7d4ce] bg-white/95 p-3 text-sm shadow-sm sm:absolute sm:top-3 sm:right-3 sm:w-80"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold break-words text-[#171714]">
                {step !== null ? `Шаг ${step}. ` : ""}
                {info?.name || `Деталь ${selectedBox + 1}`}
              </p>
              <button
                type="button"
                onClick={() =>
                  step !== null ? leaveSteps() : setSelected(null)
                }
                aria-label="Закрыть"
                className="-mt-1 -mr-1 px-2 text-lg leading-none text-[#77736c] hover:text-[#171714]"
              >
                ×
              </button>
            </div>
            {facts.length > 0 ? (
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                {facts.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-[#77736c]">{label}</dt>
                    <dd className="break-words text-[#171714]">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-[#77736c]">
                {`${numberFormatter.format(boxes[selectedBox].sizeX)} × ${numberFormatter.format(boxes[selectedBox].sizeY)} × ${numberFormatter.format(boxes[selectedBox].thickness)} мм`}
              </p>
            )}
            {selectedBlock && step === null ? (
              <button
                type="button"
                onClick={() =>
                  animateBlock(
                    explodedBlock === selectedBlock && blockAmount > 0.5
                      ? null
                      : selectedBlock,
                  )
                }
                className={`${buttonClassName} justify-self-start`}
              >
                {explodedBlock === selectedBlock && blockAmount > 0.5
                  ? `Собрать «${selectedBlock}»`
                  : `Разобрать «${selectedBlock}»`}
              </button>
            ) : null}
          </aside>
        ) : null}
      </div>
      <p className="text-xs text-[#77736c]">
        Поворачивайте мышью или пальцем, приближайте колесом или двумя пальцами.
        Нажмите на деталь, чтобы увидеть её размер, материал, присадку и место в
        изделии. Показаны детали из плитных материалов; фурнитура и профили не
        рисуются.
      </p>
    </div>
  );
}
