import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  buildGibLabCatalogRows,
  buildGibLabCatalogWorkbook,
  normalizeGibLabCatalogSettings,
  parseSheetSizeMm,
} from "../features/production/giblab-catalog";

test("sheet size is read in mm or metres, long side first, edge sizes ignored", () => {
  assert.deepEqual(parseSheetSizeMm("2800×2070"), {
    length: 2800,
    width: 2070,
  });
  assert.deepEqual(parseSheetSizeMm(null, "Дуб Коми 2.75*1.83"), {
    length: 2750,
    width: 1830,
  });
  assert.deepEqual(parseSheetSizeMm("2070 x 2800 мм"), {
    length: 2800,
    width: 2070,
  });
  assert.equal(parseSheetSizeMm("19*1"), null);
  assert.equal(parseSheetSizeMm(""), null);
});

const categories = [
  { id: "plates", name: "ЛДСП", slug: "ldsp", kind: "PLATE", parentId: "root" },
  { id: "root", name: "Плиты", slug: "plity", kind: "PLATE", parentId: null },
  {
    id: "edge",
    name: "Кромка ПВХ",
    slug: "kromka",
    kind: "OTHER",
    parentId: null,
  },
  { id: "hw", name: "Петли", slug: "petli", kind: "FITTINGS", parentId: null },
];

const base = {
  price: null,
  stockQuantity: null,
  format: null,
  thicknessMm: null,
  edgeThicknessMm: null,
  edgeWidthMm: null,
};

const products = [
  {
    ...base,
    id: "1",
    sku: "L-1",
    name: "Дуб Коми 2.75*1.83",
    categoryId: "plates",
    price: 3200,
    stockQuantity: 14,
    thicknessMm: 16,
  },
  {
    ...base,
    id: "2",
    sku: "E-1",
    name: "Кромка белая 19/1",
    categoryId: "edge",
    price: 25,
    edgeThicknessMm: 1,
    edgeWidthMm: 19,
  },
  {
    ...base,
    id: "3",
    sku: "H-1",
    name: "Петля Blum",
    categoryId: "hw",
    price: 300,
  },
];

test("catalog follows GibLab's demo tree: sheets by thickness and format, edging apart", () => {
  const rows = buildGibLabCatalogRows(categories, products);
  const folders = rows.filter((row) => row.folder === 1);
  assert.deepEqual(
    folders.map((row) => row.name),
    [
      "Кромочные материалы",
      "Листовой материал",
      "Кромка ПВХ",
      "ЛДСП",
      "ЛДСП - 16 мм",
      "2750х1830",
    ],
  );
  const byName = (name: string) => rows.find((row) => row.name === name)!;
  assert.equal(byName("ЛДСП").parentId, byName("Листовой материал").id);
  assert.equal(byName("Листовой материал").parentId, "");
  const sheet = byName("Дуб Коми 2.75*1.83");
  assert.equal(sheet.parentId, byName("2750х1830").id);
  assert.equal(sheet.unit, "м2");
  assert.equal(sheet.price, 635.87); // 3200 / (2.75 * 1.83)
  assert.deepEqual(
    [sheet.thickness, sheet.length, sheet.width],
    [16, 2750, 1830],
  );
  assert.equal(sheet.stock, 14);
  const edge = byName("Кромка белая 19/1");
  assert.equal(edge.unit, "м");
  assert.equal(edge.params, '<tool.edgeline elWidthPreJoint="1"/>');
  assert.deepEqual([edge.thickness, edge.width, edge.price], [1, 19, 25]);
  assert.equal(
    rows.some((row) => row.name === "Петля Blum"),
    false,
  );
  assert.ok(rows.every((row) => Number.isInteger(row.id)));
});

test("ids stay the same when other products are added", () => {
  const before = buildGibLabCatalogRows(categories, products);
  const after = buildGibLabCatalogRows(categories, [
    {
      ...base,
      id: "0",
      sku: "L-0",
      name: "Акация 2800*2070",
      categoryId: "plates",
      thicknessMm: 18,
    },
    ...products,
  ]);
  const id = (rows: typeof before, name: string) =>
    rows.find((row) => row.name === name)!.id;
  assert.equal(
    id(after, "Дуб Коми 2.75*1.83"),
    id(before, "Дуб Коми 2.75*1.83"),
  );
  assert.equal(id(after, "ЛДСП - 16 мм"), id(before, "ЛДСП - 16 мм"));
});

test("workbook is an .xls laid out like GibLab's goods.xls", () => {
  const rows = buildGibLabCatalogRows(categories, products);
  const buffer = buildGibLabCatalogWorkbook(rows);
  assert.equal(buffer.subarray(0, 4).toString("hex"), "d0cf11e0");
  const book = XLSX.read(buffer, { type: "buffer" });
  const data = XLSX.utils.sheet_to_json<unknown[]>(
    book.Sheets[book.SheetNames[0]],
    {
      header: 1,
      defval: "",
    },
  );
  assert.deepEqual(data[0].slice(0, 10), [
    "id",
    "paren_id",
    "isfolder",
    "code",
    "name",
    "unit",
    "price",
    "Толщина",
    "Длина",
    "Ширина",
  ]);
  assert.equal(data.length, rows.length + 1);
  const sheet = data.find((line) => line[4] === "Дуб Коми 2.75*1.83")!;
  assert.deepEqual(sheet.slice(5, 10), ["м2", 635.87, 16, 2750, 1830]);
  assert.equal(sheet[12], 14);
});

test("catalog path falls back to the default and gets a file name", () => {
  assert.equal(
    normalizeGibLabCatalogSettings({ enabled: true, path: "" }).path,
    "D:\\GibLabLocal\\goods.xls",
  );
  assert.equal(
    normalizeGibLabCatalogSettings({ enabled: true, path: "E:\\GibLab\\" })
      .path,
    "E:\\GibLab\\goods.xls",
  );
});
