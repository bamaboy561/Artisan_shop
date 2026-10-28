import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import {
  CutListPhotoError,
  cutListPhotoSchema,
  parseCutListPhotoResult,
} from "../features/services/cut-list-photo-result";

const row = (changes = {}) => ({
  title: "Боковина",
  material: null,
  length: 720,
  width: 560,
  quantity: 2,
  edgeText: "2Д",
  edgeLong: null,
  edgeShort: null,
  uncertain: false,
  ...changes,
});

const answer = (rows: unknown[], changes = {}) => ({
  complete: true,
  warnings: [],
  rows,
  ...changes,
});

test("строки с фото становятся деталями калькулятора, кромка текстом", () => {
  const result = parseCutListPhotoResult(
    answer([
      row(),
      row({ title: "Полка", length: 564, width: 540, quantity: 3, edgeText: "1Д" }),
      row({ title: "Фасад", length: 716, width: 396, edgeText: "кругом" }),
    ]),
  );

  assert.equal(result.details.length, 3);
  assert.deepEqual(result.details[0], {
    title: "Боковина",
    length: 720,
    width: 560,
    quantity: 2,
    edgedSides: ["top", "bottom"],
  });
  assert.deepEqual(result.details[1].edgedSides, ["top"]);
  assert.deepEqual(result.details[2].edgedSides, [
    "top",
    "right",
    "bottom",
    "left",
  ]);
  assert.equal(result.skippedLines, 0);
  // Сверка с оригиналом нужна всегда.
  assert.ok(result.warnings[0].includes("Сверьте"));
});

test("кромка, отмеченная на эскизе, берётся по числу сторон", () => {
  const result = parseCutListPhotoResult(
    answer([row({ edgeText: null, edgeLong: 1, edgeShort: 2 })]),
  );
  assert.deepEqual(result.details[0].edgedSides, ["top", "right", "left"]);
});

test("размеры не переставляются и не додумываются", () => {
  const result = parseCutListPhotoResult(
    answer([
      row({ length: 400, width: 1200 }),
      row({ title: "Дно", length: null, width: 560 }),
      row({ title: "Крышка", quantity: null, uncertain: true }),
    ]),
  );

  assert.equal(result.details.length, 2);
  assert.equal(result.details[0].length, 400);
  assert.equal(result.details[0].width, 1200);
  assert.equal(result.skippedLines, 1);
  assert.ok(result.warnings.some((note) => note.includes("«Дно»")));
  assert.equal(result.details[1].quantity, 1);
  assert.ok(
    result.warnings.some(
      (note) => note.includes("«Крышка»") && note.includes("количество"),
    ),
  );
});

test("материал из заголовка сохраняется, чтобы калькулятор разделил группы", () => {
  const result = parseCutListPhotoResult(
    answer([
      row({ material: "ЛДСП белый 16" }),
      row({ title: "Задняя стенка", material: "ХДФ", edgeText: null }),
    ]),
  );
  assert.equal(result.details[0].material, "ЛДСП белый 16");
  assert.equal(result.details[1].material, "ХДФ");
  assert.ok(result.warnings.some((note) => note.includes("кромка не указана")));
});

test("обрезанное фото и подозрительные размеры дают предупреждения", () => {
  const result = parseCutListPhotoResult(
    answer([row({ length: 3050 })], { complete: false }),
  );
  assert.ok(result.warnings.some((note) => note.includes("обрезана")));
  assert.ok(result.warnings.some((note) => note.includes("больше листа")));
});

test("пустой ответ или ответ не по схеме — понятная ошибка", () => {
  assert.throws(
    () => parseCutListPhotoResult(answer([])),
    CutListPhotoError,
  );
  assert.throws(
    () => parseCutListPhotoResult(answer([row({ length: null, width: null })])),
    CutListPhotoError,
  );
  assert.throws(
    () => parseCutListPhotoResult({ rows: "не таблица" }),
    CutListPhotoError,
  );
});

test("схема подходит для строгого JSON-режима: все поля обязательны", () => {
  const schema = z.toJSONSchema(cutListPhotoSchema) as {
    required: string[];
    additionalProperties: boolean;
    properties: {
      rows: {
        items: { required: string[]; properties: Record<string, unknown> };
      };
    };
  };
  assert.equal(schema.additionalProperties, false);
  const item = schema.properties.rows.items;
  assert.deepEqual(
    [...item.required].sort(),
    Object.keys(item.properties).sort(),
  );
});
