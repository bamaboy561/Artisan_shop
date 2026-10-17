// Только типы: модуль работает и в браузере (калькулятор распила пишет
// им фрезеровку контура), чтение .b3d — в lib/server/bazis-giblab-export.
import type {
  GibLabButt,
  GibLabContourElement,
  GibLabSource,
  GibLabSourceHole,
  GibLabSourcePanel,
} from "@/lib/bazis-b3d";

// Выгрузка проекта Базиса в GibLab (.project) — перенос скрипта Базиса
// GibLabExport 1.86 с настройками, которыми пользуется цех:
//   детали объединены в одно изделие, точность 2 знака, лицевая сторона
//   учитывается, лист 2750 × 1830, фрезеровка контура фрезой 20 с
//   отступом 30, присадка с толщины 6,1 мм, отверстия от 1,5 мм,
//   выход сверла при сквозном сверлении 2 мм.
// Пазы и выборки (Cuts) в проектах, которые мы видели, не встречались и
// здесь не выгружаются.
const VERSION = "1.86";
const PRECISION = 2;
const SHEET_LENGTH = 2750;
const SHEET_WIDTH = 1830;
const CONTOUR_TOOL_D = 20;
const CONTOUR_OFFSET = 0;
const CONTOUR_D = 30;
const MIN_BORE_THICKNESS = 6.1;
const THROUGH_BORE_OFFSET = 2;

// ---------- числа так же, как в скрипте ----------

const rnd = (value: number, digits: number) => Number(value).toFixed(digits);
const rnd1 = (value: number) => Number(value).toFixed(1);
const rnd2 = (value: number) => {
  const result = Number(value).toFixed(2);
  return Number(result) === 0
    ? result.startsWith("-")
      ? "0"
      : result
    : result;
};
const rnd2s = (value: number | string) =>
  Number(value)
    .toFixed(2)
    .replace(/\.?0*$/, "");
const rnd4s = (value: number) =>
  Number(value)
    .toFixed(4)
    .replace(/\.?0*$/, "");
const round2 = (value: number) => Math.round(value * 100) / 100;
const isEqualFloat = (a: number, b: number) => Math.abs(a - b) < 0.01;
const isEqualFloat1 = (a: number, b: number) => Math.abs(a - b) < 0.1;
const compare = (a: number, b: number) =>
  Math.abs(a - b) < 0.01 ? 0 : a > b ? 1 : -1;
// В скрипте rnd1(x) == 0 сравнивает строку с числом.
const r1 = (value: number) => Number(rnd1(value));
const distance = (x1: number, y1: number, x2: number, y2: number) =>
  Math.hypot(x2 - x1, y2 - y1);

function escapeText(value: string, xml: boolean) {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': xml ? "&quot;" : "'",
    "'": "&#39;",
    "/": "&#x2F;",
  };

  return Array.from(String(value).replace(/[&<>"'/]/g, (s) => map[s]))
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 1328 ? `&#${code};` : ch;
    })
    .join("");
}

// ---------- геометрия контура ----------

type Point = { x: number; y: number };

const elementStart = (element: GibLabContourElement): Point =>
  element.type === 3
    ? { x: element.cx + element.r, y: element.cy }
    : { x: element.x1, y: element.y1 };
const elementEnd = (element: GibLabContourElement): Point =>
  element.type === 3
    ? { x: element.cx + element.r, y: element.cy }
    : { x: element.x2, y: element.y2 };
const samePoint = (a: Point, b: Point) =>
  isEqualFloat(a.x, b.x) && isEqualFloat(a.y, b.y);

const normAngle = (angle: number) => {
  if (Math.abs(angle - Math.PI * 2) < 1e-7) return angle;
  const value = angle % (Math.PI * 2);
  return value >= 0 ? value : value + Math.PI * 2;
};

// Направление дуги в файле: флаг 1 — против часовой стрелки от начала к
// концу (ArcDir в Базисе), 0 — по часовой.
const arcCounterClockwise = (
  element: Extract<GibLabContourElement, { type: 2 }>,
) => element.flag !== 0;

function arcSweep(element: Extract<GibLabContourElement, { type: 2 }>) {
  const start = Math.atan2(element.y1 - element.cy, element.x1 - element.cx);
  const end = Math.atan2(element.y2 - element.cy, element.x2 - element.cx);
  return arcCounterClockwise(element)
    ? { from: normAngle(start), to: normAngle(end) }
    : { from: normAngle(end), to: normAngle(start) };
}

function angleOnArc(
  element: Extract<GibLabContourElement, { type: 2 }>,
  angle: number,
) {
  const { from, to } = arcSweep(element);
  const value = normAngle(angle);
  return from <= to
    ? value >= from - 1e-9 && value <= to + 1e-9
    : value >= from - 1e-9 || value <= to + 1e-9;
}

const arcRadius = (element: Extract<GibLabContourElement, { type: 2 }>) =>
  distance(element.cx, element.cy, element.x1, element.y1);

function elementLength(element: GibLabContourElement) {
  if (element.type === 1) {
    return distance(element.x1, element.y1, element.x2, element.y2);
  }

  if (element.type === 3) {
    return 2 * Math.PI * element.r;
  }

  const { from, to } = arcSweep(element);
  const sweep = to >= from ? to - from : to + Math.PI * 2 - from;
  return sweep * arcRadius(element);
}

function distanceToElement(element: GibLabContourElement, point: Point) {
  if (element.type === 1) {
    const dx = element.x2 - element.x1;
    const dy = element.y2 - element.y1;
    const lengthSq = dx * dx + dy * dy;
    const t =
      lengthSq === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((point.x - element.x1) * dx + (point.y - element.y1) * dy) /
                lengthSq,
            ),
          );
    return distance(point.x, point.y, element.x1 + t * dx, element.y1 + t * dy);
  }

  if (element.type === 3) {
    return Math.abs(
      distance(point.x, point.y, element.cx, element.cy) - element.r,
    );
  }

  const angle = Math.atan2(point.y - element.cy, point.x - element.cx);

  if (angleOnArc(element, angle)) {
    return Math.abs(
      distance(point.x, point.y, element.cx, element.cy) - arcRadius(element),
    );
  }

  return Math.min(
    distance(point.x, point.y, element.x1, element.y1),
    distance(point.x, point.y, element.x2, element.y2),
  );
}

// Контур детали ломаной: дуги и окружности по 64 точки.
function polygonOf(elements: GibLabContourElement[]) {
  const points: Point[][] = [];

  for (const element of elements) {
    if (element.type === 1) {
      points.push([
        { x: element.x1, y: element.y1 },
        { x: element.x2, y: element.y2 },
      ]);
    } else if (element.type === 3) {
      const ring: Point[] = [];
      for (let i = 0; i <= 64; i += 1) {
        const a = (i / 64) * Math.PI * 2;
        ring.push({
          x: element.cx + element.r * Math.cos(a),
          y: element.cy + element.r * Math.sin(a),
        });
      }
      points.push(ring);
    } else {
      const { from, to } = arcSweep(element);
      const sweep = to >= from ? to - from : to + Math.PI * 2 - from;
      const r = arcRadius(element);
      const arc: Point[] = [];
      for (let i = 0; i <= 32; i += 1) {
        const a = from + (sweep * i) / 32;
        arc.push({
          x: element.cx + r * Math.cos(a),
          y: element.cy + r * Math.sin(a),
        });
      }
      points.push(arc);
    }
  }

  return points;
}

// Точка внутри контура детали (с учётом вырезов: чётно-нечётное правило).
function isPointInside(elements: GibLabContourElement[], point: Point) {
  let inside = false;

  for (const chain of polygonOf(elements)) {
    for (let i = 0; i + 1 < chain.length; i += 1) {
      const a = chain[i];
      const b = chain[i + 1];

      if (
        a.y > point.y !== b.y > point.y &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
      ) {
        inside = !inside;
      }
    }
  }

  return inside;
}

// ---------- деталь ----------

type Bore = {
  plane: number;
  d: number;
  x: number;
  y: number;
  z: number;
  dp: string;
};

type Edge = {
  id: number;
  name: string;
  t: number;
  w: number;
  parts: Part[];
};

type PathElement = {
  Type: number;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  cx: number;
  cy: number;
  r: number;
  dir: boolean;
  lineSide: boolean;
  lineSideFull: boolean;
};

type Contour = {
  path: PathElement[];
  clockOtherWise: boolean;
  inner: boolean;
};

type Part = {
  id: number | null;
  count: number;
  name: string;
  materialName: string;
  code: string;
  artPos: string;
  thick: number;
  dl: number;
  dw: number;
  cl: number;
  cw: number;
  offsetX: number;
  offsetY: number;
  el: Array<Edge | undefined>;
  bFront: Bore[];
  bBack: Bore[];
  txt: boolean;
  bExThrough: boolean;
  contour: Contour[];
};

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

type Sheet = { name: string; t: number; parts: Part[] };

type ExportState = {
  operationId: number;
  edges: Edge[];
  sheets: Sheet[];
  holes: Array<GibLabSourceHole & { used: boolean }>;
};

function boundsOf(elements: GibLabContourElement[]): Bounds {
  const b = { minX: 1e6, minY: 1e6, maxX: -1e6, maxY: -1e6 };
  const set = (x: number, y: number) => {
    b.minX = Math.min(b.minX, x);
    b.minY = Math.min(b.minY, y);
    b.maxX = Math.max(b.maxX, x);
    b.maxY = Math.max(b.maxY, y);
  };

  for (const element of elements) {
    if (element.type === 1) {
      set(element.x1, element.y1);
      set(element.x2, element.y2);
    } else if (element.type === 3) {
      set(element.cx - element.r, element.cy - element.r);
      set(element.cx + element.r, element.cy + element.r);
    } else {
      const r = arcRadius(element);
      set(element.x1, element.y1);
      set(element.x2, element.y2);
      if (angleOnArc(element, Math.PI)) set(element.cx - r, element.cy);
      if (angleOnArc(element, 0)) set(element.cx + r, element.cy);
      if (angleOnArc(element, (Math.PI * 3) / 2))
        set(element.cx, element.cy - r);
      if (angleOnArc(element, Math.PI / 2)) set(element.cx, element.cy + r);
    }
  }

  return b;
}

const onTop = (b: Bounds, p: Point) => r1(p.y - b.maxY) === 0;
const onBottom = (b: Bounds, p: Point) => r1(p.y - b.minY) === 0;
const onLeft = (b: Bounds, p: Point) => r1(p.x - b.minX) === 0;
const onRight = (b: Bounds, p: Point) => r1(p.x - b.maxX) === 0;

function addEdge(
  state: ExportState,
  part: Part,
  material: string,
  thickness: number,
  width: number,
) {
  let edge = state.edges.find(
    (item) =>
      item.name === material && item.t === thickness && item.w === width,
  );

  if (!edge) {
    edge = {
      id: state.operationId++,
      name: material,
      t: thickness,
      w: width,
      parts: [],
    };
    state.edges.push(edge);
  }

  if (!edge.parts.includes(part)) {
    edge.parts.push(part);
  }

  return edge;
}

// Порядок элементов одного замкнутого контура: каждый следующий начинается
// там, где кончился предыдущий; перевёрнутые элементы разворачиваются.
function orderChain(
  items: Array<{ element: GibLabContourElement; tag: number }>,
) {
  if (items.length < 2) return items;

  const rest = [...items];
  const chain = [rest.shift()!];

  while (rest.length > 0) {
    const tail = elementEnd(chain[chain.length - 1].element);
    let index = rest.findIndex((item) =>
      samePoint(elementStart(item.element), tail),
    );

    if (index < 0) {
      index = rest.findIndex((item) =>
        samePoint(elementEnd(item.element), tail),
      );

      if (index < 0) {
        chain.push(...rest);
        break;
      }

      rest[index] = {
        ...rest[index],
        element: reverseElement(rest[index].element),
      };
    }

    chain.push(rest.splice(index, 1)[0]);
  }

  return chain;
}

function reverseElement(element: GibLabContourElement): GibLabContourElement {
  if (element.type === 1) {
    return {
      ...element,
      x1: element.x2,
      y1: element.y2,
      x2: element.x1,
      y2: element.y1,
    };
  }

  if (element.type === 2) {
    return {
      ...element,
      x1: element.x2,
      y1: element.y2,
      x2: element.x1,
      y2: element.y1,
      flag: element.flag === 0 ? 1 : 0,
    };
  }

  return element;
}

// Ориентированная площадь контура: больше нуля — против часовой стрелки.
function signedArea(elements: GibLabContourElement[]) {
  let area = 0;

  for (const chain of polygonOf(elements)) {
    for (let i = 0; i + 1 < chain.length; i += 1) {
      area += chain[i].x * chain[i + 1].y - chain[i + 1].x * chain[i].y;
    }
  }

  return area / 2;
}

function createPart(state: ExportState, panel: GibLabSourcePanel): Part | null {
  const elements = panel.elements;

  if (elements.length === 0) return null;

  const bounds = boundsOf(elements);
  const cl = bounds.maxX - bounds.minX;
  const cw = bounds.maxY - bounds.minY;
  const part: Part = {
    id: null,
    count: 1,
    name: panel.name,
    materialName: panel.material,
    code: panel.artPos,
    artPos: panel.artPos,
    thick: panel.thickness,
    dl: cl,
    dw: cw,
    cl,
    cw,
    offsetX: 0,
    offsetY: 0,
    el: [],
    bFront: [],
    bBack: [],
    txt: panel.texDir > 0,
    bExThrough: false,
    contour: [],
  };
  const bThrough: Bore[] = [];
  const bHor: Bore[] = [];

  // Кромка по элементам контура: если на элементе две кромки, берётся
  // та, что толще.
  const tags = elements.map(() => -1);
  panel.butts.forEach((butt, index) => {
    if (butt.elem < 0 || butt.elem >= elements.length) return;
    const current = tags[butt.elem];
    if (
      current >= 0 &&
      r1(panel.butts[current].thickness) > r1(butt.thickness)
    ) {
      return;
    }
    tags[butt.elem] = index;
  });
  const buttOf = (tag: number): GibLabButt | null =>
    tag >= 0 ? panel.butts[tag] : null;

  // Разбиваем контур: окружности отдельно, остальное — по связности.
  const tagged = elements.map((element, index) => ({
    element,
    tag: tags[index],
  }));
  const contours: Array<Array<{ element: GibLabContourElement; tag: number }>> =
    [];
  const pool = tagged.filter((item) => item.element.type !== 3);

  for (const item of tagged) {
    if (item.element.type === 3) contours.push([item]);
  }

  while (pool.length > 0) {
    const group = [pool.pop()!];

    for (let k = 0; k < group.length; k += 1) {
      const a = group[k].element;
      for (let j = 0; j < pool.length; j += 1) {
        const b = pool[j].element;
        if (
          samePoint(elementEnd(b), elementStart(a)) ||
          samePoint(elementStart(b), elementEnd(a)) ||
          samePoint(elementStart(b), elementStart(a)) ||
          samePoint(elementEnd(b), elementEnd(a))
        ) {
          group.push(pool.splice(j, 1)[0]);
          j -= 1;
        }
      }
    }

    contours.push(group);
  }

  const ordered = contours.map((group) => orderChain(group));

  ordered.forEach((group, jc) => {
    const groupElements = group.map((item) => item.element);
    const first = groupElements[0];
    const firstPoint =
      first.type === 3 ? { x: first.cx, y: first.cy } : elementStart(first);
    const clockOtherWise = ordered.some(
      (other, ic) =>
        ic !== jc &&
        isPointInside(
          other.map((item) => item.element),
          firstPoint,
        ),
    );
    let items = group;

    // Замкнутый контур, идущий против часовой стрелки, разворачиваем.
    const closed =
      first.type === 3 ||
      samePoint(
        elementEnd(groupElements[groupElements.length - 1]),
        elementStart(first),
      );
    if (closed && first.type !== 3 && signedArea(groupElements) < 0) {
      items = [...group].reverse().map((item) => ({
        ...item,
        element: reverseElement(item.element),
      }));
    }

    const cntr: Array<{ element: GibLabContourElement; tag: number } | null> = [
      ...items,
    ];
    const elCan = [true, true, true, true];
    let cntRect = 0;

    for (let j = 0; j < cntr.length; j += 1) {
      const item = cntr[j]!;
      const element = item.element;
      if (element.type !== 1) continue;
      const butt = buttOf(item.tag);
      const length = elementLength(element);
      const p1 = { x: element.x1, y: element.y1 };
      const p2 = { x: element.x2, y: element.y2 };
      let side = -1;

      if (onLeft(bounds, p1) && onLeft(bounds, p2) && r1(length - cw) === 0)
        side = 2;
      else if (onTop(bounds, p1) && onTop(bounds, p2) && r1(length - cl) === 0)
        side = 0;
      else if (
        onRight(bounds, p1) &&
        onRight(bounds, p2) &&
        r1(length - cw) === 0
      )
        side = 3;
      else if (
        onBottom(bounds, p1) &&
        onBottom(bounds, p2) &&
        r1(length - cl) === 0
      )
        side = 1;

      if (side >= 0) {
        cntRect += 1;
        if (butt)
          part.el[side] = addEdge(
            state,
            part,
            butt.material,
            butt.thickness,
            butt.width,
          );
        cntr[j] = null;
        elCan[side] = false;
      }
    }

    for (let j = 0; j < cntr.length; j += 1) {
      const item = cntr[j];
      if (!item || item.element.type > 1) continue;
      const element = item.element as Extract<
        GibLabContourElement,
        { type: 1 }
      >;
      const butt = buttOf(item.tag);
      if (!butt) continue;
      const p1 = { x: element.x1, y: element.y1 };
      const p2 = { x: element.x2, y: element.y2 };
      const name = `!СмЧт ${butt.material}`;

      if (!part.el[2] && onLeft(bounds, p1) && onLeft(bounds, p2)) {
        part.el[2] = addEdge(state, part, name, butt.thickness, butt.width);
        cntr[j] = null;
      } else if (!part.el[0] && onTop(bounds, p1) && onTop(bounds, p2)) {
        part.el[0] = addEdge(state, part, name, butt.thickness, butt.width);
        cntr[j] = null;
      } else if (!part.el[3] && onRight(bounds, p1) && onRight(bounds, p2)) {
        part.el[3] = addEdge(state, part, name, butt.thickness, butt.width);
        cntr[j] = null;
      } else if (!part.el[1] && onBottom(bounds, p1) && onBottom(bounds, p2)) {
        part.el[1] = addEdge(state, part, name, butt.thickness, butt.width);
        cntr[j] = null;
      }
    }

    for (const item of cntr) {
      if (!item) continue;
      const butt = buttOf(item.tag);
      if (!butt) continue;
      const element = item.element;
      const name = `!СмЧт ${butt.material}`;
      const add = (side: number) => {
        part.el[side] = addEdge(state, part, name, butt.thickness, butt.width);
      };

      if (element.type === 1) {
        const p1 = { x: element.x1, y: element.y1 };
        const p2 = { x: element.x2, y: element.y2 };
        if (
          !part.el[2] &&
          elCan[2] &&
          (onLeft(bounds, p1) || onLeft(bounds, p2))
        )
          add(2);
        if (!part.el[0] && elCan[0] && (onTop(bounds, p1) || onTop(bounds, p2)))
          add(0);
        if (
          !part.el[3] &&
          elCan[3] &&
          (onRight(bounds, p1) || onRight(bounds, p2))
        )
          add(3);
        if (
          !part.el[1] &&
          elCan[1] &&
          (onBottom(bounds, p1) || onBottom(bounds, p2))
        )
          add(1);
      } else if (element.type === 2) {
        const p1 = { x: element.x1, y: element.y1 };
        const p2 = { x: element.x2, y: element.y2 };
        const r = distance(element.x1, element.y1, element.cx, element.cy);
        if (
          !part.el[2] &&
          elCan[2] &&
          (onLeft(bounds, p1) ||
            onLeft(bounds, p2) ||
            Math.abs(r1(element.cx - r - bounds.minX)) < 3)
        )
          add(2);
        if (
          !part.el[0] &&
          elCan[0] &&
          (onTop(bounds, p1) ||
            onTop(bounds, p2) ||
            Math.abs(r1(element.cy + r - bounds.maxY)) < 3)
        )
          add(0);
        if (
          !part.el[3] &&
          elCan[3] &&
          (onRight(bounds, p1) ||
            onRight(bounds, p2) ||
            Math.abs(r1(element.cx + r - bounds.maxX)) < 3)
        )
          add(3);
        if (
          !part.el[1] &&
          elCan[1] &&
          (onBottom(bounds, p1) ||
            onBottom(bounds, p2) ||
            Math.abs(r1(element.cy - r - bounds.minY)) < 3)
        )
          add(1);
      } else {
        add(0);
        add(1);
        add(2);
        add(3);
      }
    }

    if (cntRect < 4) {
      part.contour.push(
        buildContourPath(items, bounds, cl, cw, clockOtherWise),
      );
    }
  });

  collectBores(state, panel, part, bounds, bThrough, bHor);

  // Лицевая сторона не задана: если сверху сверлить нечего, а снизу есть —
  // деталь переворачивается.
  const frontFace = panel.frontFace ?? 2;
  const emptyFront = part.bFront.length === 0 && part.bBack.length > 0;

  if ((frontFace === 2 && emptyFront) || frontFace === 1) {
    part.offsetX = part.dl - (part.cl + 0);
    [part.el[2], part.el[3]] = [part.el[3], part.el[2]];
    const oldFront = part.bFront;
    part.bFront = [...part.bBack, ...bThrough, ...bHor];
    part.bBack = oldFront;
    reverseBores(part, part.bFront);
    reverseBores(part, part.bBack);

    for (const contour of part.contour) {
      if (contour.path.length === 0) continue;
      if (contour.path[0].Type !== 3)
        contour.clockOtherWise = !contour.clockOtherWise;
      for (const e of contour.path) {
        if (e.Type === 1) {
          e.sx = part.cl - e.sx;
          e.ex = part.cl - e.ex;
        } else if (e.Type === 2) {
          e.sx = part.cl - e.sx;
          e.ex = part.cl - e.ex;
          e.cx = part.cl - e.cx;
          e.dir = !e.dir;
        } else if (e.Type === 3) {
          e.cx = part.cl - e.cx;
        }
      }
    }
  } else if (bThrough.length > 0 || bHor.length > 0) {
    part.bFront = [...part.bFront, ...bThrough, ...bHor];
  }

  part.bExThrough = bThrough.length > 0;
  part.bFront.sort(sortBores);
  part.bBack.sort(sortBores);

  // Текстура поперёк или без текстуры, но деталь «стоит»: поворот на 90°.
  if (panel.texDir === 2 || (panel.texDir === 0 && part.cw > part.cl)) {
    [part.dl, part.dw] = [part.dw, part.dl];
    [part.cl, part.cw] = [part.cw, part.cl];
    const offsetX = part.offsetX;
    part.offsetX = part.dl - (part.cl + part.offsetY);
    part.offsetY = offsetX;
    const [et, eb, el, er] = [part.el[0], part.el[1], part.el[2], part.el[3]];
    part.el = [];
    if (el) part.el[0] = el;
    if (er) part.el[1] = er;
    if (eb) part.el[2] = eb;
    if (et) part.el[3] = et;

    for (const bore of [...part.bFront, ...part.bBack]) {
      switch (bore.plane) {
        case 0:
          bore.plane = 3;
          bore.y = bore.x;
          break;
        case 1:
          bore.plane = 2;
          bore.y = bore.x;
          break;
        case 2:
          bore.plane = 0;
          bore.x = part.cl - bore.y;
          break;
        case 3:
          bore.plane = 1;
          bore.x = part.cl - bore.y;
          break;
        case 4:
        case 5: {
          const ty = bore.y;
          bore.y = bore.x;
          bore.x = part.cl - ty;
          break;
        }
      }
    }

    for (const contour of part.contour) rotatePath90(part, contour.path);
  }

  let sheet = state.sheets.find(
    (item) => item.name === panel.material && item.t === panel.thickness,
  );
  if (!sheet) {
    sheet = { name: panel.material, t: panel.thickness, parts: [] };
    state.sheets.push(sheet);
  }
  sheet.parts.push(part);

  return part;
}

function buildContourPath(
  items: Array<{ element: GibLabContourElement; tag: number }>,
  bounds: Bounds,
  cl: number,
  cw: number,
  clockOtherWise: boolean,
): Contour {
  const contour: Contour = { path: [], clockOtherWise, inner: clockOtherWise };

  for (const { element } of items) {
    if (
      element.type !== 3 &&
      r1(element.x1 - element.x2) === 0 &&
      r1(element.y1 - element.y2) === 0
    ) {
      continue;
    }

    const e: PathElement = {
      Type: element.type,
      sx: 0,
      sy: 0,
      ex: 0,
      ey: 0,
      cx: 0,
      cy: 0,
      r: 0,
      dir: false,
      lineSide: false,
      lineSideFull: false,
    };

    if (element.type === 1) {
      const length = elementLength(element);
      e.sx = element.x1 - bounds.minX;
      e.sy = element.y1 - bounds.minY;
      e.ex = element.x2 - bounds.minX;
      e.ey = element.y2 - bounds.minY;
      const p1 = { x: element.x1, y: element.y1 };
      const p2 = { x: element.x2, y: element.y2 };
      if (
        (r1(e.sx) === 0 && r1(e.ex) === 0) ||
        (onRight(bounds, p1) && onRight(bounds, p2))
      ) {
        e.lineSide = true;
        e.lineSideFull = r1(length - cw) === 0;
      }
      if (
        (onTop(bounds, p1) && onTop(bounds, p2)) ||
        (r1(e.sy) === 0 && r1(e.ey) === 0)
      ) {
        e.lineSide = true;
        e.lineSideFull = r1(length - cl) === 0;
      }
      e.sy = cw - e.sy;
      e.ey = cw - e.ey;
    } else if (element.type === 2) {
      e.cx = element.cx - bounds.minX;
      e.cy = cw - (element.cy - bounds.minY);
      e.sx = element.x1 - bounds.minX;
      e.sy = cw - (element.y1 - bounds.minY);
      e.ex = element.x2 - bounds.minX;
      e.ey = cw - (element.y2 - bounds.minY);
      e.r = arcRadius(element);
      e.dir = !arcCounterClockwise(element);
    } else {
      e.cx = element.cx - bounds.minX;
      e.cy = cw - (element.cy - bounds.minY);
      e.r = element.r;
      e.dir = false;
    }

    contour.path.push(e);
  }

  // Внутренний вырез начинается с середины первого элемента.
  if (contour.inner && contour.path.length > 1) {
    const e = contour.path[0];
    if (e.Type === 1) {
      const sx = e.sx;
      const sy = e.sy;
      e.sx = (e.sx + e.ex) / 2;
      e.sy = (e.sy + e.ey) / 2;
      contour.path.push({ ...e, sx, sy, ex: e.sx, ey: e.sy });
    } else if (e.Type === 2) {
      const sx = e.sx;
      const sy = e.sy;
      let sa = normAngle(Math.atan2(e.sy - e.cy, e.sx - e.cx));
      let ea = normAngle(Math.atan2(e.ey - e.cy, e.ex - e.cx));
      if (!e.dir) [sa, ea] = [ea, sa];
      if (sa > ea) ea += Math.PI * 2;
      const a = normAngle(sa + (ea - sa) / 2);
      e.sx = e.cx + Math.cos(a) * e.r;
      e.sy = e.cy + Math.sin(a) * e.r;
      contour.path.push({ ...e, sx, sy, ex: e.sx, ey: e.sy });
    }
  }

  return contour;
}

function rotatePath90(part: Part, path: PathElement[]) {
  for (const e of path) {
    if (e.Type === 1) {
      [e.sx, e.sy] = [part.cl - e.sy, e.sx];
      [e.ex, e.ey] = [part.cl - e.ey, e.ex];
    } else if (e.Type === 2) {
      [e.sx, e.sy] = [part.cl - e.sy, e.sx];
      [e.ex, e.ey] = [part.cl - e.ey, e.ex];
      [e.cx, e.cy] = [part.cl - e.cy, e.cx];
    } else if (e.Type === 3) {
      e.dir = true;
      [e.cx, e.cy] = [part.cl - e.cy, e.cx];
    }
  }
}

function reverseBores(part: Part, bores: Bore[]) {
  for (const bore of bores) {
    switch (bore.plane) {
      case 0:
      case 1:
        bore.x = part.cl - bore.x;
        bore.z = part.thick - bore.z;
        break;
      case 2:
        bore.plane = 3;
        bore.z = part.thick - bore.z;
        break;
      case 3:
        bore.plane = 2;
        bore.z = part.thick - bore.z;
        break;
      case 4:
      case 5:
        bore.x = part.cl - bore.x;
        break;
    }
  }
}

function sortBores(a: Bore, b: Bore) {
  return (
    compare(a.plane, b.plane) ||
    compare(a.d, b.d) ||
    compare(a.x, b.x) ||
    compare(a.y, b.y) ||
    compare(a.z, b.z) ||
    compare(Number(a.dp), Number(b.dp))
  );
}

// В координаты детали: обратное к матрице детали (поворот без масштаба).
function toLocal(matrix: number[], v: number[], isPoint: boolean) {
  const s = isPoint
    ? [v[0] - matrix[3], v[1] - matrix[7], v[2] - matrix[11]]
    : v;
  return [0, 1, 2].map(
    (column) =>
      matrix[column] * s[0] +
      matrix[4 + column] * s[1] +
      matrix[8 + column] * s[2],
  );
}

function collectBores(
  state: ExportState,
  panel: GibLabSourcePanel,
  part: Part,
  bounds: Bounds,
  bThrough: Bore[],
  bHor: Bore[],
) {
  if (!(MIN_BORE_THICKNESS < part.thick)) return;

  const elements = panel.elements;
  const thick = panel.thickness;
  const cw = part.cw;

  for (const hole of state.holes) {
    if (hole.used) continue;
    const pos = toLocal(panel.matrix, hole.start, true);
    if (pos[2] < -(hole.depth + thick) || pos[2] > hole.depth + thick) continue;
    const dir = toLocal(panel.matrix, hole.direction, false);
    const point = { x: pos[0], y: pos[1] };

    if (r1(Math.abs(dir[2])) === 1 && isPointInside(elements, point)) {
      const hz = pos[2];
      const x = pos[0] - bounds.minX;
      const y = cw - pos[1] + bounds.minY;

      if (dir[2] > 0.01) {
        if (hz <= 0.5 && hz + hole.depth > 0.01) {
          const bore: Bore = {
            plane: 5,
            d: hole.diameter,
            x,
            y,
            z: 0,
            dp: rnd1(hz + hole.depth),
          };
          if (Math.round(thick * 10) > Math.round(Number(bore.dp) * 10))
            part.bBack.push(bore);
          else bThrough.push(bore);
          hole.used = isEqualFloat(hz, 0) && thick >= hole.depth;
        }
        continue;
      }

      const depth = hole.depth - (hz - thick);
      if (hz - thick >= -0.5 && depth >= 0.01) {
        const bore: Bore = {
          plane: 4,
          d: hole.diameter,
          x,
          y,
          z: 0,
          dp: rnd2(depth),
        };
        if (Math.round(thick * 10) > Math.round(Number(bore.dp) * 10))
          part.bFront.push(bore);
        else bThrough.push(bore);
        hole.used = isEqualFloat(hz, thick) && thick >= hole.depth;
      }
      continue;
    }

    if (r1(dir[2]) !== 0 || pos[2] <= 0 || pos[2] >= thick) continue;

    const endGlobal = hole.start.map(
      (value, axis) => value + hole.direction[axis] * hole.depth,
    );
    const end = toLocal(panel.matrix, endGlobal, true);
    const endPoint = { x: end[0], y: end[1] };

    if (!isPointInside(elements, endPoint)) continue;

    const hdx = r1(dir[0]);
    const hdy = r1(dir[1]);

    for (let j = 0; j < elements.length; j += 1) {
      const element = elements[j];
      // Скрипт прибавляет толщину кромки без подрезки (contour.Data.Butt),
      // но в выгрузках Базиса она не прибавляется ни разу: у элементов
      // контура этих данных нет. Делаем так же, как выходит у Базиса.
      const bt = 0;
      const contOffset =
        rnd1(
          distanceToElement(element, point) +
            distanceToElement(element, endPoint),
        ) === rnd1(hole.depth);
      const contEdgeOffset = r1(distanceToElement(element, endPoint) + bt) > 2;

      if (!(contOffset && contEdgeOffset)) continue;

      const dp = rnd1(distanceToElement(element, endPoint) + bt);
      const z = part.thick - pos[2];

      if (hdx === 1) {
        bHor.push({
          plane: 2,
          d: hole.diameter,
          x: 0,
          y: cw - pos[1] + bounds.minY,
          z,
          dp,
        });
      } else if (hdx === -1) {
        bHor.push({
          plane: 3,
          d: hole.diameter,
          x: 0,
          y: cw - pos[1] + bounds.minY,
          z,
          dp,
        });
      } else if (hdx === 0) {
        if (hdy === 1) {
          bHor.push({
            plane: 1,
            d: hole.diameter,
            x: pos[0] - bounds.minX,
            y: 0,
            z,
            dp,
          });
        } else if (hdy === -1) {
          bHor.push({
            plane: 0,
            d: hole.diameter,
            x: pos[0] - bounds.minX,
            y: 0,
            z,
            dp,
          });
        }
      }
      hole.used = isEqualFloat(Number(dp), hole.depth);
      break;
    }
  }
}

function isEqualBore(a: Bore, b: Bore) {
  return (
    a.plane === b.plane &&
    isEqualFloat(a.d, b.d) &&
    isEqualFloat(a.x, b.x) &&
    isEqualFloat(a.y, b.y) &&
    isEqualFloat(a.z, b.z) &&
    isEqualFloat(Number(a.dp), Number(b.dp))
  );
}

// Как isEqualPart в скрипте. Детали с фрезеровкой контура не объединяются
// никогда: так ведёт себя сам скрипт.
function isEqualPart(a: Part, b: Part) {
  if (
    a.code !== b.code ||
    a.name !== b.name ||
    a.materialName !== b.materialName
  )
    return false;
  if (
    !isEqualFloat(a.thick, b.thick) ||
    !isEqualFloat(a.dl, b.dl) ||
    !isEqualFloat(a.dw, b.dw)
  )
    return false;
  if (
    a.el.length !== b.el.length ||
    a.bFront.length !== b.bFront.length ||
    a.bBack.length !== b.bBack.length
  )
    return false;
  if (a.contour.length !== b.contour.length) return false;
  for (let i = 0; i < a.el.length; i += 1)
    if (a.el[i] !== b.el[i]) return false;
  for (let i = 0; i < a.bFront.length; i += 1)
    if (!isEqualBore(a.bFront[i], b.bFront[i])) return false;
  for (let i = 0; i < a.bBack.length; i += 1)
    if (!isEqualBore(a.bBack[i], b.bBack[i])) return false;
  return a.contour.length === 0;
}

// ---------- программы станка ----------

type Tools = Map<string, number>;

function toolsXml(tools: Tools) {
  return [...tools.entries()]
    .map(([name, d]) => `<tool name="${name}" d="${rnd2s(d)}" />`)
    .join("");
}

function boreXml(part: Part, bores: Bore[], tools: Tools, vars: string[]) {
  let sb = "";

  if (part.bExThrough) {
    vars.push(
      `<var comment="Глубина сквозного отверстия" name="throughBoreDepth" type="double" expr="dz${THROUGH_BORE_OFFSET > 0 ? `+${rnd2(THROUGH_BORE_OFFSET)}` : ""}"/>`,
    );
  }

  for (const bore of bores) {
    const m = Math.abs(part.thick / 2 - bore.z) < 0.01;
    let name: string | null = `Bore${rnd2s(bore.d)}`;

    switch (bore.plane) {
      case 0:
        sb += `<bt ver="2" x="${rnd2s(part.offsetX + bore.x)}" z="${rnd2s(bore.z)}" dp="${bore.dp}" m="${m}" name="Bore${rnd2s(bore.d)}"/>`;
        break;
      case 1:
        sb += `<bb  ver="2" x="${rnd2s(part.offsetX + bore.x)}" z="${rnd2s(bore.z)}" dp="${bore.dp}" m="${m}" name="Bore${rnd2s(bore.d)}"/>`;
        break;
      case 2:
        sb += `<bl ver="2" y="${rnd2s(part.offsetY + bore.y)}" z="${rnd2s(bore.z)}" dp="${bore.dp}" m="${m}" name="Bore${rnd2s(bore.d)}"/>`;
        break;
      case 3:
        sb += `<br ver="2" y="${rnd2s(part.offsetY + bore.y)}" z="${rnd2s(bore.z)}" dp="${bore.dp}" m="${m}" name="Bore${rnd2s(bore.d)}"/>`;
        break;
      case 4:
      case 5: {
        const through = !(
          Math.round(part.thick * 10) > Math.round(Number(bore.dp) * 10)
        );
        name = `Bore${through ? "Th" : ""}${rnd2s(bore.d)}`;
        sb += `<bf x="${rnd2s(part.offsetX + bore.x)}" y="${rnd2s(part.offsetY + bore.y)}" dp="${through ? "throughBoreDepth" : rnd2s(bore.dp)}" name="${name}"/>`;
        break;
      }
      default:
        name = null;
    }

    if (name !== null && !tools.has(name)) tools.set(name, Math.abs(bore.d));
  }

  return sb;
}

const getDistance = distance;

function lineArcIntersects(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  radius: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const a = dx * dx + dy * dy;
  const b = 2 * (dx * (x1 - cx) + dy * (y1 - cy));
  const c = (x1 - cx) * (x1 - cx) + (y1 - cy) * (y1 - cy) - radius * radius;
  const det = b * b - 4 * a * c;
  if (a <= 1e-7 || det < 0) return null;
  const t1 = (-b + Math.sqrt(det)) / (2 * a);
  const t2 = (-b - Math.sqrt(det)) / (2 * a);
  const p1 = [x1 + t1 * dx, y1 + t1 * dy];
  const p2 = [x1 + t2 * dx, y1 + t2 * dy];
  return getDistance(x, y, p1[0], p1[1]) < getDistance(x, y, p2[0], p2[1])
    ? p1
    : p2;
}

function arcBorderIntersects(
  x: number,
  y: number,
  d: number,
  dl: number,
  dw: number,
  cx: number,
  cy: number,
  radius: number,
) {
  const side = getMinDistToBorderNum(x, y, dl, dw, d);
  switch (side) {
    case 0:
      return lineArcIntersects(x, y, -d, -d, -d, dw + d, cx, cy, radius);
    case 1:
      return lineArcIntersects(x, y, -d, -d, dl + d, -d, cx, cy, radius);
    case 2:
      return lineArcIntersects(
        x,
        y,
        dl + d,
        -d,
        dl + d,
        dw + d,
        cx,
        cy,
        radius,
      );
    default:
      return lineArcIntersects(
        x,
        y,
        -d,
        dw + d,
        dl + d,
        dw + d,
        cx,
        cy,
        radius,
      );
  }
}

function getMinDistToBorderNum(
  x: number,
  y: number,
  dl: number,
  dw: number,
  d: number,
) {
  let minSide = 0;
  let minDist = round2(getDistance(-d, y, x, y));
  let dist = round2(getDistance(x, -d, x, y));
  if (dist < minDist) {
    minDist = dist;
    minSide = 1;
  }
  dist = round2(getDistance(dl + d, y, x, y));
  if (dist < minDist) {
    minDist = dist;
    minSide = 2;
  }
  dist = round2(getDistance(x, dw, x, y));
  if (dist < minDist) {
    minSide = 3;
  }
  return minSide;
}

const isCorner = (x: number, y: number, dl: number, dw: number) =>
  (isEqualFloat1(x, 0) && isEqualFloat1(y, 0)) ||
  (isEqualFloat1(x, 0) && isEqualFloat1(y, dw)) ||
  (isEqualFloat1(x, dl) && isEqualFloat1(y, dw)) ||
  (isEqualFloat1(x, dl) && isEqualFloat1(y, 0));
const isSide = (x: number, y: number, dl: number, dw: number) =>
  isEqualFloat1(x, 0) ||
  isEqualFloat1(y, 0) ||
  isEqualFloat1(dl, x) ||
  isEqualFloat1(dw, y);

// Фрезеровка контура детали со вырезами: перенос из exportGibLab.
function contourXml(part: Part, toolName: string) {
  const d = CONTOUR_D;
  let xml = "";

  for (const contour of part.contour) {
    if (contour.path.length === 0) continue;
    const path = contour.path;
    const cor = contour.clockOtherWise ? 2 : 1;
    const es = path[0];

    if (
      (es.Type === 1 || es.Type === 2) &&
      !(
        r1(es.sx) === 0 ||
        r1(es.sy) === 0 ||
        r1(part.cl - es.sx) === 0 ||
        r1(part.cw - es.sy) === 0
      )
    ) {
      let minL = 1e6;
      let minI = -1;
      path.forEach((e, i) => {
        for (const dist of [
          getDistance(0, e.sy, e.sx, e.sy),
          getDistance(e.sx, 0, e.sx, e.sy),
          getDistance(part.cl, e.sy, e.sx, e.sy),
          getDistance(e.sx, part.cw, e.sx, e.sy),
        ]) {
          if (dist < minL) {
            minL = round2(dist);
            minI = i;
          }
        }
      });
      if (minI > -1 && (!contour.inner || minL < 1)) {
        for (let c = 0; c < minI; c += 1) path.push(path.shift()!);
      }
    }

    const se = path[0];
    const ee = path[path.length - 1];
    if (
      (!isCorner(se.sx, se.sy, part.cl, part.cw) && se.Type !== 1) ||
      (!isCorner(ee.ex, ee.ey, part.cl, part.cw) && ee.Type !== 1)
    ) {
      let posL = -1;
      let posLC = 0;
      for (let i = 0; i < path.length; i += 1) {
        if (path[i].lineSide) {
          posLC += 1;
          if (posLC === 1) posL = i;
          else if (posLC === 2) break;
        } else {
          posL = -1;
          posLC = 0;
        }
      }
      if (posL > -1) {
        for (let c = 0; c < posL + 1; c += 1) path.push(path.shift()!);
      }
    }

    while (path.length > 1) {
      const e = path[0];
      const next = path[1];
      if (next.Type === 2) {
        if (isCorner(next.sx, next.sy, part.cl, part.cw)) {
          path.splice(0, 1);
          continue;
        } else if (isSide(next.sx, next.sy, part.cl, part.cw)) {
          const p = arcBorderIntersects(
            next.sx,
            next.sy,
            d,
            part.cl,
            part.cw,
            next.cx,
            next.cy,
            next.r,
          );
          if (
            p &&
            getMinDistToBorderNum(p[0], p[1], part.cl, part.cw, d) ===
              getMinDistToBorderNum(next.sx, next.sy, part.cl, part.cw, d)
          ) {
            path.splice(0, 1);
            continue;
          }
        }
      }
      if (e.lineSideFull || (e.lineSide && next.Type === 1)) {
        path.splice(0, 1);
        continue;
      }
      break;
    }

    while (path.length > 1) {
      const i = path.length - 1;
      const e = path[i];
      const prev = path[i - 1];
      if (prev.Type === 2) {
        if (isCorner(prev.ex, prev.ey, part.cl, part.cw)) {
          path.splice(i, 1);
          continue;
        } else if (isSide(prev.ex, prev.ey, part.cl, part.cw)) {
          const p = arcBorderIntersects(
            prev.ex,
            prev.ey,
            d,
            part.cl,
            part.cw,
            prev.cx,
            prev.cy,
            prev.r,
          );
          if (
            p &&
            getMinDistToBorderNum(p[0], p[1], part.cl, part.cw, d) ===
              getMinDistToBorderNum(prev.ex, prev.ey, part.cl, part.cw, d)
          ) {
            path.splice(i, 1);
            continue;
          }
        }
      }
      if (e.lineSideFull || (e.lineSide && prev.Type === 1)) {
        path.splice(i, 1);
        continue;
      }
      break;
    }

    const ox = part.offsetX;
    const oy = part.offsetY;
    let startMS = true;

    for (let i = 0; i < path.length; i += 1) {
      const e = path[i];

      if (e.Type === 1) {
        if (
          i > 0 &&
          e.lineSide &&
          path[i - 1].Type === 1 &&
          (i === path.length - 1 || path[i + 1].Type === 1)
        ) {
          startMS = true;
          continue;
        }
        let { sx, sy, ex, ey } = e;
        if (startMS) {
          if (
            !contour.inner &&
            d > 0.01 &&
            (r1(sx) === 0 ||
              r1(sy) === 0 ||
              r1(part.cl - sx) === 0 ||
              r1(part.cw - sy) === 0)
          ) {
            const a = Math.atan2(sy - ey, sx - ex);
            sx += d * Math.cos(a);
            sy += d * Math.sin(a);
          }
          xml += `<ms x="${rnd4s(ox + sx)}" y="${rnd4s(oy + sy)}" dp="contMillDepth" name="${toolName}" c="${cor}"/>`;
          startMS = false;
        }
        if (
          !contour.inner &&
          d > 0.01 &&
          (r1(ex) === 0 ||
            r1(ey) === 0 ||
            r1(part.cl - ex) === 0 ||
            r1(part.cw - ey) === 0)
        ) {
          if (
            i === path.length - 1 ||
            (path[i + 1].lineSide &&
              (i === path.length - 2 || path[i + 2].Type === 1))
          ) {
            const a = Math.atan2(ey - sy, ex - sx);
            ex += d * Math.cos(a);
            ey += d * Math.sin(a);
          }
        }
        xml += `<ml x="${rnd4s(ox + ex)}" y="${rnd4s(oy + ey)}"/>`;
      } else if (e.Type === 2) {
        let { sx, sy, ex, ey } = e;
        if (startMS) {
          let pb: number[] | null = null;
          if (contour.inner || d < 0.01) pb = [sx, sy];
          else if (
            r1(sx) === 0 ||
            r1(sy) === 0 ||
            r1(part.cl - sx) === 0 ||
            r1(part.cw - sy) === 0
          )
            pb = arcBorderIntersects(
              sx,
              sy,
              d,
              part.cl,
              part.cw,
              e.cx,
              e.cy,
              e.r,
            );
          if (pb === null) {
            const a = Math.atan2(sy - e.cy, sx - e.cx);
            const dcx = sx + d * Math.cos(a);
            const dcy = sy + d * Math.sin(a);
            const ang = a + (e.dir ? -Math.PI / 2 : Math.PI / 2);
            const dsx = dcx + d * Math.cos(ang);
            const dsy = dcy + d * Math.sin(ang);
            xml += `<ms x="${rnd4s(ox + dsx)}" y="${rnd4s(oy + dsy)}" dp="contMillDepth" name="${toolName}" c="${cor}"/>`;
            xml += `<mac x="${rnd4s(ox + sx)}" y="${rnd4s(oy + sy)}" cx="${rnd4s(ox + dcx)}" cy="${rnd4s(oy + dcy)}" dir="${!e.dir}"/>`;
          } else {
            sx = pb[0];
            sy = pb[1];
            xml += `<ms x="${rnd4s(ox + sx)}" y="${rnd4s(oy + sy)}" dp="contMillDepth" name="${toolName}" c="${cor}"/>`;
          }
          startMS = false;
        }
        let pb: number[] | null = null;
        if (i === path.length - 1 && d > 0.01) {
          if (
            !contour.inner &&
            (r1(ex) === 0 ||
              r1(ey) === 0 ||
              r1(part.cl - ex) === 0 ||
              r1(part.cw - ey) === 0)
          ) {
            pb = arcBorderIntersects(
              ex,
              ey,
              d,
              part.cl,
              part.cw,
              e.cx,
              e.cy,
              e.r,
            );
            if (pb) {
              ex = pb[0];
              ey = pb[1];
            }
          }
        }
        xml += `<mac x="${rnd4s(ox + ex)}" y="${rnd4s(oy + ey)}" cx="${rnd4s(ox + e.cx)}" cy="${rnd4s(oy + e.cy)}" dir="${e.dir}"/>`;
        if (
          i === path.length - 1 &&
          pb === null &&
          !contour.inner &&
          d > 0.01
        ) {
          const a = Math.atan2(ey - e.cy, ex - e.cx);
          const dcx = ex + d * Math.cos(a);
          const dcy = ey + d * Math.sin(a);
          const ang = a + (e.dir ? Math.PI / 2 : -Math.PI / 2);
          const dex = dcx + d * Math.cos(ang);
          const dey = dcy + d * Math.sin(ang);
          xml += `<mac x="${rnd4s(ox + dex)}" y="${rnd4s(oy + dey)}" cx="${rnd4s(ox + dcx)}" cy="${rnd4s(oy + dcy)}" dir="${!e.dir}"/>`;
        }
      } else if (e.Type === 3) {
        const { cx, cy, r } = e;
        xml += `<ms x="${rnd4s(ox + cx)}" y="${rnd4s(oy + cy - r)}" dp="contMillDepth" name="${toolName}" c="${cor}"/>`;
        xml += `<mac x="${rnd4s(ox + cx - r)}" y="${rnd4s(oy + cy)}" cx="${rnd4s(ox + cx)}" cy="${rnd4s(oy + cy)}" dir="false"/>`;
        xml += `<mac x="${rnd4s(ox + cx)}" y="${rnd4s(oy + cy + r)}" cx="${rnd4s(ox + cx)}" cy="${rnd4s(oy + cy)}" dir="false"/>`;
        xml += `<mac x="${rnd4s(ox + cx + r)}" y="${rnd4s(oy + cy)}" cx="${rnd4s(ox + cx)}" cy="${rnd4s(oy + cy)}" dir="false"/>`;
        xml += `<mac x="${rnd4s(ox + cx)}" y="${rnd4s(oy + cy - r)}" cx="${rnd4s(ox + cx)}" cy="${rnd4s(oy + cy)}" dir="false"/>`;
        startMS = true;
      }
    }
  }

  return xml;
}

// ---------- сборка файла ----------

const sortParts = (a: Part, b: Part) =>
  a.code > b.code ? 1 : a.code < b.code ? -1 : 0;
const pad = (value: string, length: number) => value.padStart(length, "0");

export function buildGibLabProject(source: GibLabSource) {
  const state: ExportState = {
    operationId: 1,
    edges: [],
    sheets: [],
    holes: source.holes.map((hole) => ({ ...hole, used: false })),
  };
  const parts: Part[] = [];

  for (const panel of source.panels) {
    const part = createPart(state, panel);
    if (!part) continue;
    const same = parts.find((item) => isEqualPart(item, part));
    if (same) same.count += 1;
    else parts.push(part);
  }

  let goodId = 1;
  let partId = 1;
  let xml = `<?xml version="1.0" encoding="windows-1251"?><project importBMV="${VERSION}">\r\n`;
  const productId = goodId++;

  xml += `<good typeId="product" id="${productId}" count="1" name="${escapeText(source.modelName, false)}"`;
  if (source.modelCode) xml += ` code="${escapeText(source.modelCode, false)}"`;
  if (source.orderName)
    xml += ` product.order="${escapeText(source.orderName, false)}"`;
  xml += ` product.import="bm.${VERSION}">`;

  parts.sort(sortParts);
  for (const part of parts) {
    part.id = partId++;
    xml += `<part id="${part.id}" name="${escapeText(part.name, false)}" dl="${rnd(part.dl, PRECISION)}" dw="${rnd(part.dw, PRECISION)}" count="${part.count}" txt="${part.txt}" code="${part.code}" part.code="${part.code}"`;
    if (part.artPos)
      xml += ` part.position="${escapeText(part.artPos, false)}"`;
    if (part.el[0]) xml += ` elt="@operation#${part.el[0].id}"`;
    if (part.el[1]) xml += ` elb ="@operation#${part.el[1].id}"`;
    if (part.el[2]) xml += ` ell="@operation#${part.el[2].id}"`;
    if (part.el[3]) xml += ` elr="@operation#${part.el[3].id}"`;
    xml += "/>";
  }
  xml += " </good>";

  for (const sheet of state.sheets) {
    const [name, code] = sheet.name.split(/\r\n|\r|\n/g);
    const toolId = goodId++;
    const sheetId = goodId++;
    xml += `<good typeId="tool.cutting" id="${toolId}"/>`;
    xml += `<good typeId="sheet" id="${sheetId}" t="${rnd(sheet.t, PRECISION)}"`;
    if (name !== undefined) xml += ` name="${escapeText(name, false)}"`;
    if (code !== undefined) xml += ` code="${escapeText(code, false)}"`;
    xml += `><part id="${partId++}" count="10000" l="${rnd(SHEET_LENGTH, PRECISION)}" w="${rnd(SHEET_WIDTH, PRECISION)}"/></good>`;
    xml += `<operation typeId="CS" id="${state.operationId++}" tool1="${toolId}" cSizeMode="1"><material id="${sheetId}"/>`;
    for (const part of [...sheet.parts].sort(sortParts)) {
      if (part.id !== null) xml += `<part id="${part.id}" />`;
    }
    xml += "</operation>";
  }

  for (const edge of state.edges) {
    const [name, code] = edge.name.split(/\r\n|\r|\n/g);
    const toolId = goodId++;
    const bandId = goodId++;
    xml += `<good typeId="tool.edgeline" id="${toolId}"/>`;
    xml += `<good typeId="band" id="${bandId}" t="${rnd(edge.t, PRECISION)}" w="${rnd(edge.w, PRECISION)}"`;
    if (name !== undefined) xml += ` name="${escapeText(name, false)}"`;
    if (code !== undefined) xml += ` code="${escapeText(code, false)}"`;
    xml += "/>";
    xml += `<operation typeId="EL" id="${edge.id}" tool1="${toolId}" ><material id="${bandId}"/>`;
    for (const part of edge.parts) {
      if (part.id !== null) xml += `<part id="${part.id}" />`;
    }
    xml += "</operation>";
  }

  for (const part of parts) {
    const tools: Tools = new Map();
    const code = pad(String(part.code), 4);
    const idText = pad(String(part.id), 3);
    let contXml: string | null = null;
    let varsCont = "";
    const header = `<?xml version="1.0" encoding="UTF-8"?><program dx="${rnd2(part.dl)}" dy="${rnd2(part.dw)}" dz="${rnd2(part.thick)}">`;
    const operation = (side: number, suffix: number, program: string) =>
      `<operation typeId="XNC" id="${state.operationId++}" side="${side}" bySizeDetail="true" code="${code}x${idText}x${suffix}" typeName="${escapeText(part.name, false)}" program="${escapeText(program, true)}"><part id="${part.id}"/></operation>`;

    if (part.contour.length > 0) {
      const toolName = `Mill${rnd2s(CONTOUR_TOOL_D)}`;
      tools.set(toolName, CONTOUR_TOOL_D);
      varsCont = `<var comment="Глубина сквозного фрезерования контура" name="contMillDepth" type="double" expr="dz${CONTOUR_OFFSET > 0 ? `+${rnd2(CONTOUR_OFFSET)}` : ""}"/>`;
      contXml = contourXml(part, toolName);

      if (part.bFront.length === 0) {
        xml += operation(
          1,
          0,
          `${header}${toolsXml(tools)}${varsCont}${contXml}</program>`,
        );
        contXml = null;
        varsCont = "";
      }
    }

    if (part.bFront.length > 0) {
      const vars: string[] = [];
      let content = boreXml(part, part.bFront, tools, vars);
      if (contXml !== null) content += contXml;
      xml += operation(
        1,
        1,
        `${header}${toolsXml(tools)}${vars.join("")}${varsCont}${content}</program>`,
      );
      part.bExThrough = false;
    }

    if (part.bBack.length > 0) {
      const backTools: Tools = new Map();
      const vars: string[] = [];
      const content = boreXml(part, part.bBack, backTools, vars);
      xml += operation(
        2,
        2,
        `${header}${toolsXml(backTools)}${vars.join("")}${content}</program>`,
      );
    }
  }

  xml += "</project>";
  return xml;
}

// Файл для GibLab в кодировке windows-1251, как его пишет Базис.
const CP1251_EXTRA: Record<number, number> = {
  0x401: 0xa8,
  0x451: 0xb8,
  0x2116: 0xb9,
  0xab: 0xab,
  0xbb: 0xbb,
  0x2013: 0x96,
  0x2014: 0x97,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0xb0: 0xb0,
  0xa0: 0xa0,
  0x404: 0xaa,
  0x454: 0xba,
  0x406: 0xb2,
  0x456: 0xb3,
  0x407: 0xaf,
  0x457: 0xbf,
  0x490: 0xa5,
  0x491: 0xb4,
};

export function encodeWindows1251(text: string) {
  const bytes: number[] = [];

  for (const ch of text) {
    const code = ch.codePointAt(0)!;

    if (code < 0x80) bytes.push(code);
    else if (code >= 0x410 && code <= 0x44f) bytes.push(code - 0x410 + 0xc0);
    else if (CP1251_EXTRA[code] !== undefined) bytes.push(CP1251_EXTRA[code]);
    else for (const b of Buffer.from(`&#${code};`, "latin1")) bytes.push(b);
  }

  return Buffer.from(bytes);
}
