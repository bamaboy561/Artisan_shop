import { inflateSync } from "node:zlib";

// Чтение проекта «Базис-Мебельщик» (.b3d). Формат не документирован: разобран
// по реальным файлам версии 11. Файл состоит из двух разделов. В каждом
// сначала идёт словарь имён полей, затем дерево узлов:
//   узел = номер имени (int32, -1 для элемента списка), число детей (int32),
//          тип значения (байт), значение, затем дети.
// Первый раздел лежит как есть (заголовок и картинка-превью), второй сжат
// zlib (сама модель).

export type BazisEdge = {
  side: "length" | "width" | "unknown";
  material: string;
  thickness: number | null;
};

// Отверстие присадки в координатах детали: точка начала на поверхности
// (x, y в плоскости контура, z по толщине), направление и глубина.
// face — сверлят в пласть, edge — в торец.
export type BazisHole = {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  diameter: number;
  depth: number;
  kind: "face" | "edge";
};

export type BazisPanel = {
  id: number | null;
  name: string;
  position: string;
  material: string;
  thickness: number;
  length: number;
  width: number;
  edges: BazisEdge[];
  // Вырезы и скругления: габарит взят по внешнему прямоугольнику.
  complexContour: boolean;
  // Блок проекта, в который входит деталь («Тумба», «Шкаф правый»).
  // Пусто, если деталь лежит в модели сама по себе.
  block: string;
  // Текстура задана в Базисе: длина идёт вдоль текстуры, поворачивать
  // деталь при раскрое нельзя (в GibLab это txt="true").
  textured: boolean;
  // Отверстия присадки на детали (см. collectDrilling).
  holes: number;
  drillHoles: BazisHole[];
  // Положение детали в модели для объёмного просмотра: прямоугольник
  // контура в плоскости детали (x, y, sizeX, sizeY), толщина идёт по оси Z
  // детали, matrix переводит точки детали в координаты модели
  // (три строки по четыре числа).
  box: {
    x: number;
    y: number;
    sizeX: number;
    sizeY: number;
    // Длина детали идёт по оси X контура (иначе по Y).
    lengthAlongX: boolean;
    matrix: number[];
  };
};

export type BazisHardwareRow = {
  name: string;
  quantity: number;
};

// Присадка: отверстия, которые станок сверлит в деталях, по диаметрам.
// face — в пласть, edge — в торец.
export type BazisDrillingRow = {
  diameter: number;
  face: number;
  edge: number;
};

export type BazisDrilling = {
  holes: number;
  rows: BazisDrillingRow[];
};

export type BazisPartRow = {
  name: string;
  position: string;
  material: string;
  thickness: number;
  length: number;
  width: number;
  quantity: number;
  edgedLengthSides: number;
  edgedWidthSides: number;
  edgeMaterial: string;
  complexContour: boolean;
  textured: boolean;
  // Отверстия во всех деталях строки (уже с учётом количества).
  holes: number;
};

export type BazisProject = {
  orderName: string;
  modelName: string;
  version: string;
  thumbnailPng: Buffer | null;
  materials: string[];
  panels: BazisPanel[];
  rows: BazisPartRow[];
  hardware: BazisHardwareRow[];
  drilling: BazisDrilling;
  // Пары деталей (номера в panels), скреплённых одной фурнитурой: по ним
  // строится порядок сборки на макете.
  joints: number[][];
};

export class BazisParseError extends Error {}

type NodeValue = string | number | boolean | Buffer | null;
type Node = { name: string; value: NodeValue; children: Node[] };

const MAX_NODES = 2_000_000;
const MAX_DEPTH = 64;
const MAX_MODEL_BYTES = 96 * 1024 * 1024;
const PANEL_TYPE = 4002;
const BLOCK_TYPE = 1005;
const HARDWARE_TYPE = 3001;
// Как в выгрузке Базиса в GibLab: тоньше 6,1 мм (ХДФ) не сверлят,
// отверстия меньше 1,5 мм — разметка, а не сверление.
const MIN_DRILL_THICKNESS = 6.1;
const MIN_DRILL_DIAMETER = 1.5;
// Отверстие может начинаться чуть в глубине детали (шуруп фасада сквозь
// стенку ящика начинается на 0,5 мм внутри). Глубже — это саморез,
// его вкручивают без сверления.
const HOLE_START_TOLERANCE = 1;
// Отверстие засчитывается детали, если уходит в неё глубже 0,5 мм,
// а в торец — глубже 2 мм.
const MIN_HOLE_DEPTH = 0.5;
const MIN_EDGE_DEPTH = 2;

// Матрица 3×4 (поворот и сдвиг), записанная по строкам.
type Matrix = number[];

const IDENTITY: Matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

function multiply(a: Matrix, b: Matrix): Matrix {
  const result: number[] = [];

  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      result.push(
        a[row * 4] * b[column] +
          a[row * 4 + 1] * b[4 + column] +
          a[row * 4 + 2] * b[8 + column] +
          (column === 3 ? a[row * 4 + 3] : 0),
      );
    }
  }

  return result;
}
const SECTION_MARK = Buffer.from([0x01, 0x00, 0x00, 0xff]);

class Reader {
  position = 0;
  private nodes = 0;

  constructor(
    private readonly buffer: Buffer,
    private keys: string[] = [],
  ) {}

  private need(bytes: number) {
    if (bytes < 0 || this.position + bytes > this.buffer.length) {
      throw new BazisParseError("Файл обрывается раньше времени.");
    }
  }

  uint32() {
    this.need(4);
    const value = this.buffer.readUInt32LE(this.position);
    this.position += 4;
    return value;
  }

  int32() {
    this.need(4);
    const value = this.buffer.readInt32LE(this.position);
    this.position += 4;
    return value;
  }

  byte() {
    this.need(1);
    return this.buffer[this.position++];
  }

  bytes(length: number) {
    this.need(length);
    const value = this.buffer.subarray(this.position, this.position + length);
    this.position += length;
    return value;
  }

  readKeys() {
    const count = this.uint32();
    this.uint32();

    if (count < 1 || count > 100_000) {
      throw new BazisParseError("Не удалось прочитать словарь полей.");
    }

    const keys = [""];

    for (let index = 1; index < count; index += 1) {
      const length = this.uint32();

      if (length > 256) {
        throw new BazisParseError("Не удалось прочитать словарь полей.");
      }

      keys.push(this.bytes(length).toString("latin1"));
    }

    this.keys = keys;
  }

  readNode(depth = 0): Node {
    if (depth > MAX_DEPTH || (this.nodes += 1) > MAX_NODES) {
      throw new BazisParseError("Проект слишком большой или повреждён.");
    }

    const key = this.int32();
    const childCount = this.uint32();
    const type = this.byte();
    let value: NodeValue = null;

    switch (type) {
      case 0:
      case 8:
        break;
      case 1:
        value = true;
        break;
      case 2:
        value = false;
        break;
      case 3:
        value = this.byte();
        break;
      case 4:
        value = this.int32();
        break;
      case 5:
      // 9 — дата и время, записаны тем же восьмибайтным числом.
      case 9:
        this.need(8);
        value = this.buffer.readDoubleLE(this.position);
        this.position += 8;
        break;
      case 6: {
        const length = this.uint32();

        if (length > 1_000_000) {
          throw new BazisParseError("Проект повреждён.");
        }

        value = this.bytes(length * 2).toString("utf16le");
        break;
      }
      case 7:
        value = this.bytes(this.uint32());
        break;
      default:
        throw new BazisParseError(
          "Эта версия проекта Базис пока не поддерживается.",
        );
    }

    if (childCount > MAX_NODES) {
      throw new BazisParseError("Проект повреждён.");
    }

    const children: Node[] = [];

    for (let index = 0; index < childCount; index += 1) {
      children.push(this.readNode(depth + 1));
    }

    return {
      name: key === -1 ? "[]" : (this.keys[key] ?? `#${key}`),
      value,
      children,
    };
  }
}

function child(node: Node | undefined, name: string) {
  return node?.children.find((item) => item.name === name);
}

function text(node: Node | undefined, name: string) {
  const value = child(node, name)?.value;

  return typeof value === "string" ? value : "";
}

function numeric(node: Node | undefined, name: string) {
  const value = child(node, name)?.value;

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Базис дописывает к названию материала служебный код после перевода строки.
function cleanName(value: string) {
  return value
    .split(/[\r\n]/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

// Контур детали: число элементов и сами элементы.
//   отрезок    = байт 0x10 и четыре числа (x1, y1, x2, y2);
//   окружность = байт 0x11 и три числа (центр x, y и радиус);
//   дуга       = байт 0x12, шесть чисел (центр, начало, конец) и байт-флаг.
// line заполнен только у отрезка; points — точки для габарита детали.
type ContourElement = { line: number[] | null; points: number[][] };

function readContour(blob: Buffer) {
  if (blob.length < 4) {
    return { total: 0, elements: [] as ContourElement[] };
  }

  const total = blob.readUInt32LE(0);
  const elements: ContourElement[] = [];
  let position = 4;
  const numbers = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      blob.readDoubleLE(position + 1 + index * 8),
    );

  for (let index = 0; index < total && index < 10_000; index += 1) {
    const kind = blob[position];

    if (kind === 0x10 && position + 33 <= blob.length) {
      const line = numbers(4);

      elements.push({
        line,
        points: [
          [line[0], line[1]],
          [line[2], line[3]],
        ],
      });
      position += 33;
    } else if (kind === 0x11 && position + 25 <= blob.length) {
      const [x, y, radius] = numbers(3);

      elements.push({
        line: null,
        points: [
          [x - radius, y - radius],
          [x + radius, y + radius],
        ],
      });
      position += 25;
    } else if (kind === 0x12 && position + 50 <= blob.length) {
      const arc = numbers(6);

      elements.push({
        line: null,
        points: [
          [arc[2], arc[3]],
          [arc[4], arc[5]],
        ],
      });
      position += 50;
    } else {
      break;
    }
  }

  return { total, elements };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

// Положение объекта в родителе: сдвиг (X, Y, Z) и поворот кватернионом
// (Rx, Ry, Rz, Rw). Объект без Trans стоит на месте.
function readTransform(node: Node): Matrix {
  const trans = child(node, "Trans");

  if (!trans) {
    return IDENTITY;
  }

  const x = numeric(trans, "Rx") ?? 0;
  const y = numeric(trans, "Ry") ?? 0;
  const z = numeric(trans, "Rz") ?? 0;
  const w = numeric(trans, "Rw") ?? 1;

  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - z * w),
    2 * (x * z + y * w),
    numeric(trans, "X") ?? 0,
    2 * (x * y + z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z - x * w),
    numeric(trans, "Y") ?? 0,
    2 * (x * z - y * w),
    2 * (y * z + x * w),
    1 - 2 * (x * x + y * y),
    numeric(trans, "Z") ?? 0,
  ];
}

function readPanel(
  node: Node,
  matrix: Matrix,
  block: string,
): BazisPanel | null {
  const contour = child(node, "Contour")?.value;
  const thickness = numeric(node, "Thick");

  if (!Buffer.isBuffer(contour) || thickness === null) {
    return null;
  }

  const { total, elements } = readContour(contour);

  if (elements.length === 0) {
    return null;
  }

  const xs = elements.flatMap((item) => item.points.map((point) => point[0]));
  const ys = elements.flatMap((item) => item.points.map((point) => point[1]));
  const sizeX = round(Math.max(...xs) - Math.min(...xs));
  const sizeY = round(Math.max(...ys) - Math.min(...ys));
  // TexDir: 1 текстура вдоль X контура, 2 вдоль Y. Так же длину и ширину
  // выгружает сам Базис в GibLab. Без текстуры длина это большая сторона.
  const textureDirection = numeric(node, "TexDir");
  const textured = textureDirection === 1 || textureDirection === 2;
  const lengthAlongX = textured ? textureDirection === 1 : sizeX >= sizeY;
  const length = lengthAlongX ? sizeX : sizeY;
  const width = lengthAlongX ? sizeY : sizeX;
  const edges: BazisEdge[] = (child(node, "Butts")?.children ?? [])
    .filter((item) => item.name === "Butt")
    .map((butt) => {
      const element = numeric(butt, "Elem");
      const line = element === null ? null : elements[element]?.line;
      let side: BazisEdge["side"] = "unknown";

      if (line) {
        const horizontal = Math.abs(line[1] - line[3]) < 0.01;
        const vertical = Math.abs(line[0] - line[2]) < 0.01;

        if (horizontal !== vertical) {
          side = horizontal === lengthAlongX ? "length" : "width";
        }
      }

      return {
        side,
        material: cleanName(text(butt, "Mat")),
        thickness: numeric(butt, "Thick"),
      };
    });

  return {
    id: numeric(node, "ID"),
    name: cleanName(text(node, "Name")) || "Деталь",
    position: text(node, "ArtPos"),
    material: cleanName(text(node, "Mat")),
    thickness,
    length,
    width,
    edges,
    block,
    complexContour:
      total !== 4 ||
      elements.length !== 4 ||
      elements.some((item) => !item.line),
    textured,
    holes: 0,
    drillHoles: [],
    box: {
      x: Math.min(...xs),
      y: Math.min(...ys),
      sizeX,
      sizeY,
      lengthAlongX,
      matrix: matrix.map((value) => Math.round(value * 1000) / 1000),
    },
  };
}

type Hole = {
  point: number[];
  direction: number[];
  diameter: number;
  depth: number;
};

type Fastener = { matrix: Matrix; holes: Hole[] };

type Collected = {
  panels: BazisPanel[];
  // Точная матрица детали: в box.matrix числа округлены для просмотра.
  panelMatrices: Matrix[];
  // Исходные узлы деталей: из них выгрузка в GibLab берёт контур и кромку.
  panelNodes: Node[];
  hardware: Map<string, number>;
  fasteners: Fastener[];
  // Отверстия фурнитуры по FastID (раздел FurnList проекта).
  furniture: Map<number, Hole[]>;
};

// Блоки фурнитуры из библиотеки (с DatumMode) не пропускаем: тем же
// признаком отмечены и целые модули кухни, и отдельные фасады, их детали
// пилить нужно. Лишняя деталь опоры в списке безопаснее пропавшего фасада.
function collectPanels(
  node: Node,
  collected: Collected,
  parentMatrix: Matrix = IDENTITY,
  depth = 0,
  parentBlock = "",
) {
  if (depth > MAX_DEPTH) {
    return;
  }

  // Положение вложенных объектов задано относительно родителя.
  const matrix =
    node.name === "Obj"
      ? multiply(parentMatrix, readTransform(node))
      : parentMatrix;
  const type = numeric(node, "Type");
  // Вложенные блоки складываются в путь: «Шкаф / Ящик».
  const ownBlock = type === BLOCK_TYPE ? cleanName(text(node, "Name")) : "";
  const block = ownBlock
    ? [parentBlock, ownBlock].filter(Boolean).join(" / ").slice(0, 120)
    : parentBlock;

  if (type === PANEL_TYPE) {
    const panel = readPanel(node, matrix, block);

    if (panel) {
      collected.panels.push(panel);
      collected.panelMatrices.push(matrix);
      collected.panelNodes.push(node);
    }
  } else if (type === HARDWARE_TYPE) {
    const name = cleanName(text(node, "Name"));

    if (name) {
      collected.hardware.set(name, (collected.hardware.get(name) ?? 0) + 1);
    }

    const holes = collected.furniture.get(numeric(node, "FastID") ?? NaN);

    if (holes) {
      collected.fasteners.push({ matrix, holes });
    }
  }

  for (const item of node.children) {
    if (item.name === "Objs" || item.name === "Obj" || item.name === "Model") {
      collectPanels(item, collected, matrix, depth + 1, block);
    }
  }
}

// Раздел FurnList: для каждой модели фурнитуры (FastID) её отверстия
// в собственных координатах модели.
function readFurnitureHoles(
  node: Node,
  furniture: Map<number, Hole[]>,
  depth = 0,
) {
  if (depth > MAX_DEPTH) {
    return;
  }

  if (node.name === "FurnList") {
    for (const item of node.children) {
      const id = numeric(item, "FastID");
      const holes = (child(item, "Holes")?.children ?? [])
        .filter((hole) => hole.name === "Hole")
        .map((hole) => ({
          point: [
            numeric(hole, "X") ?? 0,
            numeric(hole, "Y") ?? 0,
            numeric(hole, "Z") ?? 0,
          ],
          direction: [
            numeric(hole, "DirX") ?? 0,
            numeric(hole, "DirY") ?? 0,
            numeric(hole, "DirZ") ?? 0,
          ],
          diameter: 2 * (numeric(hole, "Radius") ?? 0),
          depth: numeric(hole, "Depth") ?? 0,
        }))
        .filter(
          (hole) => hole.diameter >= MIN_DRILL_DIAMETER && hole.depth > 0,
        );

      if (id !== null && holes.length > 0) {
        furniture.set(id, holes);
      }
    }

    return;
  }

  for (const item of node.children) {
    readFurnitureHoles(item, furniture, depth + 1);
  }
}

function transform(matrix: Matrix, vector: number[], isPoint: boolean) {
  return [0, 1, 2].map(
    (row) =>
      matrix[row * 4] * vector[0] +
      matrix[row * 4 + 1] * vector[1] +
      matrix[row * 4 + 2] * vector[2] +
      (isPoint ? matrix[row * 4 + 3] : 0),
  );
}

// Обратное преобразование (поворот без масштаба): из модели в деталь.
function toLocal(matrix: Matrix, vector: number[], isPoint: boolean) {
  const shifted = isPoint
    ? [vector[0] - matrix[3], vector[1] - matrix[7], vector[2] - matrix[11]]
    : vector;

  return [0, 1, 2].map(
    (column) =>
      matrix[column] * shifted[0] +
      matrix[4 + column] * shifted[1] +
      matrix[8 + column] * shifted[2],
  );
}

// Сколько миллиметров отрезка start→end лежит внутри коробки детали.
function lengthInside(
  start: number[],
  end: number[],
  low: number[],
  high: number[],
) {
  let from = 0;
  let to = 1;

  for (let axis = 0; axis < 3; axis += 1) {
    const delta = end[axis] - start[axis];

    if (Math.abs(delta) < 1e-9) {
      if (start[axis] < low[axis] - 0.01 || start[axis] > high[axis] + 0.01) {
        return 0;
      }
    } else {
      let enter = (low[axis] - 0.01 - start[axis]) / delta;
      let leave = (high[axis] + 0.01 - start[axis]) / delta;

      if (enter > leave) {
        [enter, leave] = [leave, enter];
      }

      from = Math.max(from, enter);
      to = Math.min(to, leave);

      if (from >= to) {
        return 0;
      }
    }
  }

  return (
    (to - from) *
    Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2])
  );
}

// Присадка по правилам выгрузки Базиса в GibLab: отверстие фурнитуры
// засчитывается детали, если начинается на её пласти и уходит внутрь
// (в пласть) или входит в неё через торец глубже 2 мм (в торец).
// Сквозное отверстие через две детали считается в каждой.
// Контур детали берётся габаритом: для вырезов это приближение.
function collectDrilling(collected: Collected): {
  drilling: BazisDrilling;
  joints: number[][];
} {
  const rows = new Map<number, BazisDrillingRow>();
  let total = 0;
  // Какие детали сверлит каждая единица фурнитуры: они скреплены вместе.
  const joined = collected.fasteners.map(() => new Set<number>());

  collected.panels.forEach((panel, index) => {
    if (panel.thickness < MIN_DRILL_THICKNESS) {
      return;
    }

    const matrix = collected.panelMatrices[index];
    const low = [panel.box.x, panel.box.y, 0];
    const high = [
      panel.box.x + panel.box.sizeX,
      panel.box.y + panel.box.sizeY,
      panel.thickness,
    ];

    for (const [fastenerIndex, fastener] of collected.fasteners.entries()) {
      for (const hole of fastener.holes) {
        const start = toLocal(
          matrix,
          transform(fastener.matrix, hole.point, true),
          true,
        );
        const direction = toLocal(
          matrix,
          transform(fastener.matrix, hole.direction, false),
          false,
        );
        const end = start.map(
          (value, axis) => value + direction[axis] * hole.depth,
        );
        const inside = lengthInside(start, end, low, high);

        // Отверстие соседней детали, которое лишь касается этой, не в счёт.
        if (inside < MIN_HOLE_DEPTH) {
          continue;
        }

        let kind: "face" | "edge" | null = null;

        if (Math.abs(direction[2]) > 0.99) {
          const fromSurface =
            direction[2] > 0
              ? start[2] <= HOLE_START_TOLERANCE
              : start[2] >= panel.thickness - HOLE_START_TOLERANCE;

          kind = fromSurface ? "face" : null;
        } else if (
          Math.abs(direction[2]) < 0.01 &&
          start[2] > 0 &&
          start[2] < panel.thickness &&
          inside > MIN_EDGE_DEPTH &&
          end[0] >= low[0] - 0.01 &&
          end[0] <= high[0] + 0.01 &&
          end[1] >= low[1] - 0.01 &&
          end[1] <= high[1] + 0.01
        ) {
          kind = "edge";
        }

        if (!kind) {
          continue;
        }

        const diameter = Math.round(hole.diameter * 10) / 10;
        const row = rows.get(diameter) ?? { diameter, face: 0, edge: 0 };
        row[kind] += 1;
        rows.set(diameter, row);
        panel.holes += 1;
        panel.drillHoles.push({
          x: round(start[0]),
          y: round(start[1]),
          z: round(start[2]),
          dx: round(direction[0]),
          dy: round(direction[1]),
          dz: round(direction[2]),
          diameter,
          depth: round(Math.min(hole.depth, inside)),
          kind,
        });
        joined[fastenerIndex].add(index);
        total += 1;
      }
    }
  });

  const pairs = new Set<string>();
  const joints: number[][] = [];

  for (const indexes of joined) {
    const sorted = [...indexes].sort((left, right) => left - right);

    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const key = `${sorted[i]}:${sorted[j]}`;

        if (!pairs.has(key)) {
          pairs.add(key);
          joints.push([sorted[i], sorted[j]]);
        }
      }
    }
  }

  return {
    drilling: {
      holes: total,
      rows: [...rows.values()].sort(
        (left, right) => right.diameter - left.diameter,
      ),
    },
    joints,
  };
}

export function groupBazisPanels(panels: BazisPanel[]): BazisPartRow[] {
  const rows = new Map<string, BazisPartRow>();

  for (const panel of panels) {
    const edgedLengthSides = panel.edges.filter(
      (edge) => edge.side === "length",
    ).length;
    const edgedWidthSides = panel.edges.filter(
      (edge) => edge.side === "width",
    ).length;
    const edgeMaterial = [
      ...new Set(panel.edges.map((edge) => edge.material).filter(Boolean)),
    ].join(", ");
    const key = JSON.stringify([
      panel.name,
      panel.material,
      panel.thickness,
      panel.length,
      panel.width,
      edgedLengthSides,
      edgedWidthSides,
      edgeMaterial,
      panel.complexContour,
      panel.textured,
    ]);
    const existing = rows.get(key);

    if (existing) {
      existing.quantity += 1;
      existing.holes += panel.holes;
    } else {
      rows.set(key, {
        name: panel.name,
        position: panel.position,
        material: panel.material,
        thickness: panel.thickness,
        length: panel.length,
        width: panel.width,
        quantity: 1,
        edgedLengthSides,
        edgedWidthSides,
        edgeMaterial,
        complexContour: panel.complexContour,
        textured: panel.textured,
        holes: panel.holes,
      });
    }
  }

  return [...rows.values()].sort(
    (left, right) =>
      left.material.localeCompare(right.material, "ru") ||
      right.length * right.width - left.length * left.width ||
      left.name.localeCompare(right.name, "ru"),
  );
}

function readProject(file: Buffer) {
  if (file.length < 32 || file.subarray(0, 4).toString("latin1") !== "BZ85") {
    throw new BazisParseError("Это не проект Базис-Мебельщик (.b3d).");
  }

  // Раздел 1: заголовок, не сжат.
  if (!file.subarray(4, 8).equals(SECTION_MARK) || file[8] !== 0) {
    throw new BazisParseError(
      "Эта версия проекта Базис пока не поддерживается.",
    );
  }

  const header = new Reader(file);
  header.position = 9;
  header.readKeys();
  const headerNode = header.readNode();
  const article = child(headerNode, "Article");
  const thumbnail = child(headerNode, "Thumbnail")?.value;
  const version = numeric(headerNode, "Version");
  const materials = (
    child(child(child(article, "ExtraInfo"), "Drawings"), "Materials")
      ?.children ?? []
  )
    .map((item) => cleanName(text(item, "Name")))
    .filter(Boolean);

  // Раздел 2: модель, сжата zlib.
  const modelStart = header.position;

  if (
    !file.subarray(modelStart, modelStart + 4).equals(SECTION_MARK) ||
    file[modelStart + 4] !== 1
  ) {
    throw new BazisParseError("В проекте не найдена модель.");
  }

  let modelBytes: Buffer;

  try {
    modelBytes = inflateSync(file.subarray(modelStart + 5), {
      maxOutputLength: MAX_MODEL_BYTES,
    });
  } catch {
    throw new BazisParseError("Не удалось распаковать модель проекта.");
  }

  const model = new Reader(modelBytes);
  model.readKeys();
  const roots: Node[] = [];

  while (model.position < modelBytes.length) {
    roots.push(model.readNode());
  }

  const collected: Collected = {
    panels: [],
    panelMatrices: [],
    panelNodes: [],
    hardware: new Map(),
    fasteners: [],
    furniture: new Map(),
  };

  for (const node of roots) {
    readFurnitureHoles(node, collected.furniture);
  }

  for (const node of roots) {
    for (const item of node.children) {
      if (item.name === "Model") {
        collectPanels(item, collected);
      }
    }
  }

  return { headerNode, article, version, thumbnail, materials, collected };
}

export function parseBazisProject(file: Buffer): BazisProject {
  const { article, version, thumbnail, materials, collected } =
    readProject(file);
  const { panels, hardware } = collected;
  const { drilling, joints } = collectDrilling(collected);

  return {
    orderName: cleanName(text(article, "OrderName")),
    modelName: cleanName(text(article, "Name")),
    version: version === null ? "" : String(version),
    thumbnailPng:
      Buffer.isBuffer(thumbnail) &&
      thumbnail.subarray(1, 4).toString("latin1") === "PNG"
        ? thumbnail
        : null,
    materials,
    panels,
    rows: groupBazisPanels(panels),
    hardware: [...hardware.entries()]
      .map(([name, quantity]) => ({ name, quantity }))
      .sort(
        (left, right) =>
          right.quantity - left.quantity ||
          left.name.localeCompare(right.name, "ru"),
      ),
    drilling,
    joints,
  };
}

// Данные для выгрузки в GibLab (lib/bazis-giblab.ts): контур детали
// элементами, кромка по элементам, текстура, материал вместе с кодом
// (вторая строка названия) и все отверстия фурнитуры в координатах модели.
export type GibLabContourElement =
  | { type: 1; x1: number; y1: number; x2: number; y2: number }
  | {
      type: 2;
      cx: number;
      cy: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      flag: number;
    }
  | { type: 3; cx: number; cy: number; r: number };

export type GibLabButt = {
  elem: number;
  material: string;
  thickness: number;
  width: number;
  clip: boolean;
};

export type GibLabSourcePanel = {
  name: string;
  artPos: string;
  material: string;
  thickness: number;
  texDir: number;
  frontFace: number | null;
  matrix: number[];
  elements: GibLabContourElement[];
  butts: GibLabButt[];
};

export type GibLabSourceHole = {
  start: number[];
  direction: number[];
  diameter: number;
  depth: number;
};

export type GibLabSource = {
  modelName: string;
  orderName: string;
  modelCode: string;
  panels: GibLabSourcePanel[];
  holes: GibLabSourceHole[];
};

function readContourElements(blob: Buffer) {
  const elements: GibLabContourElement[] = [];

  if (blob.length < 4) {
    return elements;
  }

  const total = blob.readUInt32LE(0);
  let position = 4;
  const numbers = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      blob.readDoubleLE(position + 1 + index * 8),
    );

  for (let index = 0; index < total && index < 10_000; index += 1) {
    const kind = blob[position];

    if (kind === 0x10 && position + 33 <= blob.length) {
      const [x1, y1, x2, y2] = numbers(4);
      elements.push({ type: 1, x1, y1, x2, y2 });
      position += 33;
    } else if (kind === 0x11 && position + 25 <= blob.length) {
      const [cx, cy, r] = numbers(3);
      elements.push({ type: 3, cx, cy, r });
      position += 25;
    } else if (kind === 0x12 && position + 50 <= blob.length) {
      const [cx, cy, x1, y1, x2, y2] = numbers(6);
      elements.push({
        type: 2,
        cx,
        cy,
        x1,
        y1,
        x2,
        y2,
        flag: blob[position + 49],
      });
      position += 50;
    } else {
      break;
    }
  }

  return elements;
}

export function readBazisGibLabSource(file: Buffer): GibLabSource {
  const { article, collected } = readProject(file);
  const panels = collected.panelNodes.map((node, index) => {
    const contour = child(node, "Contour")?.value;

    return {
      name: text(node, "Name"),
      artPos: text(node, "ArtPos"),
      material: text(node, "Mat"),
      thickness: numeric(node, "Thick") ?? 0,
      texDir: numeric(node, "TexDir") ?? 0,
      frontFace: numeric(node, "FrontFace"),
      matrix: collected.panelMatrices[index],
      elements: Buffer.isBuffer(contour) ? readContourElements(contour) : [],
      butts: (child(node, "Butts")?.children ?? [])
        .filter((item) => item.name === "Butt")
        .map((butt) => ({
          elem: numeric(butt, "Elem") ?? -1,
          material: text(butt, "Mat"),
          thickness: numeric(butt, "Thick") ?? 0,
          width: numeric(butt, "Width") ?? -1,
          // Нет поля Clip — кромка с подрезкой (так считает Базис).
          clip: child(butt, "Clip")?.value !== false,
        })),
    };
  });
  const holes = collected.fasteners.flatMap((fastener) =>
    fastener.holes.map((hole) => {
      const direction = transform(fastener.matrix, hole.direction, false);
      const length = Math.hypot(...direction) || 1;

      return {
        start: transform(fastener.matrix, hole.point, true),
        direction: direction.map((value) => value / length),
        diameter: hole.diameter,
        depth: hole.depth,
      };
    }),
  );

  return {
    modelName: text(article, "Name"),
    orderName: text(article, "OrderName"),
    modelCode: text(article, "Code"),
    panels,
    holes,
  };
}
