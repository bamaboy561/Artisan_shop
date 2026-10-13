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
  // Положение детали в модели для объёмного просмотра: прямоугольник
  // контура в плоскости детали (x, y, sizeX, sizeY), толщина идёт по оси Z
  // детали, matrix переводит точки детали в координаты модели
  // (три строки по четыре числа).
  box: {
    x: number;
    y: number;
    sizeX: number;
    sizeY: number;
    matrix: number[];
  };
};

export type BazisHardwareRow = {
  name: string;
  quantity: number;
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
};

export class BazisParseError extends Error {}

type NodeValue = string | number | boolean | Buffer | null;
type Node = { name: string; value: NodeValue; children: Node[] };

const MAX_NODES = 2_000_000;
const MAX_DEPTH = 64;
const MAX_MODEL_BYTES = 96 * 1024 * 1024;
const PANEL_TYPE = 4002;
const HARDWARE_TYPE = 3001;

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

// Контур детали: число элементов и сами элементы. Отрезок = байт 0x10 и
// четыре числа (x1, y1, x2, y2). Дуги и окружности пока не разбираем.
function readContourLines(blob: Buffer) {
  if (blob.length < 4) {
    return { total: 0, lines: [] as number[][] };
  }

  const total = blob.readUInt32LE(0);
  const lines: number[][] = [];
  let position = 4;

  for (let index = 0; index < total && index < 10_000; index += 1) {
    if (position + 33 > blob.length || blob[position] !== 0x10) {
      break;
    }

    lines.push([
      blob.readDoubleLE(position + 1),
      blob.readDoubleLE(position + 9),
      blob.readDoubleLE(position + 17),
      blob.readDoubleLE(position + 25),
    ]);
    position += 33;
  }

  return { total, lines };
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

function readPanel(node: Node, matrix: Matrix): BazisPanel | null {
  const contour = child(node, "Contour")?.value;
  const thickness = numeric(node, "Thick");

  if (!Buffer.isBuffer(contour) || thickness === null) {
    return null;
  }

  const { total, lines } = readContourLines(contour);

  if (lines.length === 0) {
    return null;
  }

  const xs = lines.flatMap((line) => [line[0], line[2]]);
  const ys = lines.flatMap((line) => [line[1], line[3]]);
  const sizeX = round(Math.max(...xs) - Math.min(...xs));
  const sizeY = round(Math.max(...ys) - Math.min(...ys));
  const length = Math.max(sizeX, sizeY);
  const width = Math.min(sizeX, sizeY);
  const lengthAlongX = sizeX >= sizeY;
  const edges: BazisEdge[] = (child(node, "Butts")?.children ?? [])
    .filter((item) => item.name === "Butt")
    .map((butt) => {
      const element = numeric(butt, "Elem");
      const line = element === null ? undefined : lines[element];
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
    complexContour: total !== 4 || lines.length !== 4,
    box: {
      x: Math.min(...xs),
      y: Math.min(...ys),
      sizeX,
      sizeY,
      matrix: matrix.map((value) => Math.round(value * 1000) / 1000),
    },
  };
}

function collectPanels(
  node: Node,
  panels: BazisPanel[],
  hardware: Map<string, number>,
  parentMatrix: Matrix = IDENTITY,
  depth = 0,
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

  if (type === PANEL_TYPE) {
    const panel = readPanel(node, matrix);

    if (panel) {
      panels.push(panel);
    }
  } else if (type === HARDWARE_TYPE) {
    const name = cleanName(text(node, "Name"));

    if (name) {
      hardware.set(name, (hardware.get(name) ?? 0) + 1);
    }
  }

  for (const item of node.children) {
    if (item.name === "Objs" || item.name === "Obj" || item.name === "Model") {
      collectPanels(item, panels, hardware, matrix, depth + 1);
    }
  }
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
    ]);
    const existing = rows.get(key);

    if (existing) {
      existing.quantity += 1;
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

export function parseBazisProject(file: Buffer): BazisProject {
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
  const panels: BazisPanel[] = [];
  const hardware = new Map<string, number>();

  while (model.position < modelBytes.length) {
    const node = model.readNode();

    for (const item of node.children) {
      if (item.name === "Model") {
        collectPanels(item, panels, hardware);
      }
    }
  }

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
  };
}
