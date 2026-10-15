import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync } from "node:zlib";

import {
  BazisParseError,
  parseBazisProject,
  readBazisGibLabSource,
} from "../lib/bazis-b3d";
import { buildGibLabProject } from "../lib/bazis-giblab";

// Собираем маленький проект в том же двоичном виде, что пишет Базис:
// словарь имён, затем узлы (ключ, число детей, тип, значение).
type Value =
  | { kind: "object" }
  | { kind: "int"; value: number }
  | { kind: "double"; value: number }
  | { kind: "date"; value: number }
  | { kind: "text"; value: string }
  | { kind: "blob"; value: Buffer };
type Node = { key: string | null; value: Value; children?: Node[] };

function int32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32LE(value);
  return buffer;
}

function encode(nodes: Node[]) {
  const names: string[] = [];
  const collect = (node: Node) => {
    if (node.key && !names.includes(node.key)) names.push(node.key);
    node.children?.forEach(collect);
  };
  nodes.forEach(collect);

  const write = (node: Node): Buffer => {
    const { value } = node;
    let payload: Buffer;
    let type: number;

    if (value.kind === "object") {
      type = 0;
      payload = Buffer.alloc(0);
    } else if (value.kind === "int") {
      type = 4;
      payload = int32(value.value);
    } else if (value.kind === "double" || value.kind === "date") {
      // Дата записана так же, как дробное число, но со своим типом 9.
      type = value.kind === "date" ? 9 : 5;
      payload = Buffer.alloc(8);
      payload.writeDoubleLE(value.value);
    } else if (value.kind === "text") {
      type = 6;
      payload = Buffer.concat([
        int32(value.value.length),
        Buffer.from(value.value, "utf16le"),
      ]);
    } else {
      type = 7;
      payload = Buffer.concat([int32(value.value.length), value.value]);
    }

    return Buffer.concat([
      int32(node.key ? names.indexOf(node.key) + 1 : -1),
      int32(node.children?.length ?? 0),
      Buffer.from([type]),
      payload,
      ...(node.children ?? []).map(write),
    ]);
  };

  return Buffer.concat([
    int32(names.length + 1),
    int32(0),
    ...names.map((name) =>
      Buffer.concat([int32(name.length), Buffer.from(name, "latin1")]),
    ),
    ...nodes.map(write),
  ]);
}

function rectangle(length: number, width: number, extraElements = 0) {
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    const buffer = Buffer.alloc(33);
    buffer[0] = 0x10;
    [x1, y1, x2, y2].forEach((value, index) =>
      buffer.writeDoubleLE(value, 1 + index * 8),
    );
    return buffer;
  };

  return Buffer.concat([
    int32(4 + extraElements),
    line(0, 0, length, 0),
    line(length, 0, length, width),
    line(length, width, 0, width),
    line(0, width, 0, 0),
    ...Array.from({ length: extraElements }, () => Buffer.from([0x20, 1, 2])),
  ]);
}

const text = (key: string, value: string): Node => ({
  key,
  value: { kind: "text", value },
});
const object = (key: string | null, children: Node[]): Node => ({
  key,
  value: { kind: "object" },
  children,
});

function panel(
  name: string,
  length: number,
  width: number,
  edgedElements: number[],
  extraElements = 0,
): Node {
  return object("Obj", [
    { key: "Type", value: { kind: "int", value: 4002 } },
    text("Name", name),
    text("ArtPos", "1"),
    text("Mat", "ЛДСП 16 мм Белый\r77"),
    { key: "Thick", value: { kind: "double", value: 16 } },
    {
      key: "Contour",
      value: { kind: "blob", value: rectangle(length, width, extraElements) },
    },
    object(
      "Butts",
      edgedElements.map((element) =>
        object("Butt", [
          text("Mat", "Кромка ПВХ 1/22"),
          { key: "Elem", value: { kind: "int", value: element } },
        ]),
      ),
    ),
  ]);
}

const mark = Buffer.from([0x01, 0x00, 0x00, 0xff]);
const png = Buffer.concat([
  Buffer.from([0x89]),
  Buffer.from("PNG\r\n", "latin1"),
  Buffer.alloc(8),
]);

function project(panels: Node[], documentExtra: Node[] = []) {
  const header = encode([
    object("Header", [
      { key: "Version", value: { kind: "int", value: 14 } },
      { key: "Thumbnail", value: { kind: "blob", value: png } },
      object("Article", [text("Name", "Модель"), text("OrderName", "Шкаф")]),
    ]),
  ]);
  const model = encode([
    object("Document", [
      { key: "DateTimeLastSaved", value: { kind: "date", value: 46000.5 } },
      object("Model", [object("Objs", panels)]),
      ...documentExtra,
    ]),
  ]);

  return Buffer.concat([
    Buffer.from("BZ85", "latin1"),
    mark,
    Buffer.from([0]),
    header,
    mark,
    Buffer.from([1]),
    deflateSync(model),
  ]);
}

test("reads order name, preview, panels, sizes and edged sides", () => {
  const parsed = parseBazisProject(
    project([
      panel("Бок", 2000, 500, [0, 1]),
      panel("Бок", 2000, 500, [0, 1]),
      // Длина идёт по вертикали контура: стороны кромки не должны путаться.
      panel("Полка", 300, 800, [0]),
    ]),
  );

  assert.equal(parsed.orderName, "Шкаф");
  assert.equal(parsed.version, "14");
  assert.ok(parsed.thumbnailPng);
  assert.equal(parsed.panels.length, 3);
  assert.equal(parsed.rows.length, 2);

  const side = parsed.rows.find((row) => row.name === "Бок");
  assert.deepEqual(
    [side?.length, side?.width, side?.quantity, side?.material],
    [2000, 500, 2, "ЛДСП 16 мм Белый"],
  );
  assert.deepEqual([side?.edgedLengthSides, side?.edgedWidthSides], [1, 1]);

  const shelf = parsed.rows.find((row) => row.name === "Полка");
  assert.deepEqual([shelf?.length, shelf?.width], [800, 300]);
  assert.deepEqual([shelf?.edgedLengthSides, shelf?.edgedWidthSides], [0, 1]);
});

test("panels with cut-outs keep the outer size and are flagged", () => {
  const parsed = parseBazisProject(project([panel("Фасад", 700, 400, [], 1)]));

  assert.equal(parsed.rows[0].complexContour, true);
  assert.deepEqual([parsed.rows[0].length, parsed.rows[0].width], [700, 400]);
});

test("rejects foreign, truncated and corrupted files with a clear error", () => {
  const valid = project([panel("Бок", 2000, 500, [])]);

  assert.throws(
    () => parseBazisProject(Buffer.from("not a bazis project file at all....")),
    BazisParseError,
  );
  assert.throws(
    () => parseBazisProject(valid.subarray(0, 60)),
    BazisParseError,
  );

  const corrupted = Buffer.from(valid);
  corrupted.fill(0xff, corrupted.length - 12);
  assert.throws(() => parseBazisProject(corrupted), BazisParseError);
});

test("edge after a rounded corner is still assigned to its side", () => {
  const numbers = (kind: number, values: number[], tail = 0) => {
    const buffer = Buffer.alloc(1 + values.length * 8 + tail);
    buffer[0] = kind;
    values.forEach((value, index) =>
      buffer.writeDoubleLE(value, 1 + index * 8),
    );
    return buffer;
  };
  // Бок 350 × 2000 с вырезом под цоколь: дуга стоит перед нижней стороной.
  const contour = Buffer.concat([
    int32(6),
    numbers(0x10, [350, 0, 350, 2000]),
    numbers(0x10, [350, 2000, 0, 2000]),
    numbers(0x10, [0, 2000, 0, 90]),
    numbers(0x10, [20, 70, 20, 0]),
    numbers(0x12, [0, 70, 0, 90, 20, 70], 1),
    numbers(0x10, [20, 0, 350, 0]),
  ]);
  const side = panel("Бок", 1, 1, [0, 5]);
  const contourNode = side.children?.find((item) => item.key === "Contour");

  assert.ok(contourNode);
  contourNode.value = { kind: "blob", value: contour };

  const [row] = parseBazisProject(project([side])).rows;

  assert.deepEqual([row.length, row.width], [2000, 350]);
  assert.deepEqual([row.edgedLengthSides, row.edgedWidthSides], [1, 1]);
  assert.equal(row.complexContour, true);
});

const double = (key: string, value: number): Node => ({
  key,
  value: { kind: "double", value },
});
const int = (key: string, value: number): Node => ({
  key,
  value: { kind: "int", value },
});

// Отверстие модели фурнитуры: точка, направление, диаметр и глубина.
function hole(
  [x, y, z]: number[],
  [dirX, dirY, dirZ]: number[],
  diameter: number,
  depth: number,
): Node {
  return object("Hole", [
    double("X", x),
    double("Y", y),
    double("Z", z),
    double("DirX", dirX),
    double("DirY", dirY),
    double("DirZ", dirZ),
    double("Radius", diameter / 2),
    double("Depth", depth),
  ]);
}

test("counts drilling from furniture holes like the GibLab export", () => {
  // Деталь 500 × 300 × 16 стоит в начале координат, у фурнитуры нет
  // сдвига: отверстия заданы прямо в координатах детали.
  const furniture = object("FurnList", [
    object("F7", [
      int("FastID", 7),
      object("Holes", [
        // Чашка петли с лицевой пласти.
        hole([100, 100, 16], [0, 0, -1], 35, 13),
        // Шуруп фасада сквозь стенку ящика: начинается на 0,5 мм внутри.
        hole([200, 100, 0.5], [0, 0, 1], 4, 30),
        // Саморез из середины толщины: не сверлят.
        hole([300, 100, 8], [0, 0, 1], 3.5, 16),
        // Евровинт в торец: 20 мм внутри детали.
        hole([-10, 150, 8], [1, 0, 0], 5, 30),
        // Отверстие соседней детали только касается пласти.
        hole([400, 100, -16], [0, 0, 1], 8, 16),
        // Разметка меньше 1,5 мм.
        hole([450, 100, 16], [0, 0, -1], 1, 3),
      ]),
    ]),
  ]);
  const fastener = object("Obj", [
    int("Type", 3001),
    text("Name", "Крепёж"),
    int("FastID", 7),
  ]);
  // Блок из библиотеки (DatumMode): тем же признаком отмечены и фасады,
  // поэтому его детали остаются в списке.
  const leg = object("Obj", [
    int("Type", 1005),
    text("Name", "Опора в сборе"),
    int("DatumMode", 1),
    object("Objs", [panel("Фронтальная1", 100, 30, [])]),
  ]);

  const parsed = parseBazisProject(
    project([panel("Дверь", 500, 300, []), fastener, leg], [furniture]),
  );

  assert.deepEqual(
    parsed.panels.map((item) => item.name),
    ["Дверь", "Фронтальная1"],
  );
  assert.deepEqual(parsed.drilling, {
    holes: 3,
    rows: [
      { diameter: 35, face: 1, edge: 0 },
      { diameter: 5, face: 0, edge: 1 },
      { diameter: 4, face: 1, edge: 0 },
    ],
  });
  assert.equal(parsed.rows.find((row) => row.name === "Дверь")?.holes, 3);
  assert.deepEqual(
    parsed.hardware.map((item) => item.name),
    ["Крепёж"],
  );
});

test("GibLab export writes parts, sheet with code, edges and drilling", () => {
  const furniture = object("FurnList", [
    object("F7", [
      int("FastID", 7),
      object("Holes", [hole([100, 100, 16], [0, 0, -1], 35, 13)]),
    ]),
  ]);
  const fastener = object("Obj", [
    int("Type", 3001),
    text("Name", "Петля"),
    int("FastID", 7),
  ]);
  const xml = buildGibLabProject(
    readBazisGibLabSource(
      project(
        [
          panel("Дверь", 500, 300, [0, 2]),
          panel("Дверь", 500, 300, [0, 2]),
          fastener,
        ],
        [furniture],
      ),
    ),
  );

  // Две одинаковые двери — одна строка с количеством 2: петля стоит только
  // в одной, поэтому строк две.
  assert.match(xml, /<project importBMV="1\.86">/);
  assert.match(
    xml,
    /name="Дверь" dl="500\.00" dw="300\.00" count="1" txt="false" code="1"/,
  );
  assert.match(
    xml,
    /<good typeId="sheet" id="\d+" t="16\.00" name="ЛДСП 16 мм Белый" code="77">/,
  );
  assert.match(xml, /<operation typeId="EL" id="1" tool1="\d+" >/);
  assert.match(xml, /elt="@operation#1" elb ="@operation#1"/);
  assert.match(
    xml,
    /&lt;bf x=&quot;100&quot; y=&quot;200&quot; dp=&quot;13&quot; name=&quot;Bore35&quot;/,
  );
});
