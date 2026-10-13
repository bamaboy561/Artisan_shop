import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCutListText,
  parseLength,
} from "../features/services/cut-list-import";

test("размеры с единицами SketchUp переводятся в мм", () => {
  assert.equal(parseLength("720"), 720);
  assert.equal(parseLength("720 mm"), 720);
  assert.equal(parseLength("~ 720,5mm"), 720.5);
  assert.equal(parseLength("72 см"), 720);
  assert.equal(parseLength("0,72 m"), 720);
  assert.equal(parseLength("abc"), null);
});

test("выгрузка OpenCutList на русском: чистовой размер, кромка, материал", () => {
  const csv = [
    "N°;Определение;Количество;Длина - пильная;Ширина - пильная;Толщина - пильная;Пильная длина;Ширина;Толщина;Площадь - фактическая;Имя материала;Название;Маркеры;Кромка по длине 1;Кромка по длине 2;Кромка по ширине 1;Кромка по ширине 2",
    'A;Боковина;2;725 mm;565 mm;16 mm;720 mm;560 mm;16 mm;0,4 m²;ЛДСП Белый;#1;;"Кромка ПВХ (0,4 x 22)";;;',
    'B;Полка;3;569 mm;545 mm;16 mm;564 mm;540 mm;16 mm;0,3 m²;ЛДСП Белый;#2;;"Кромка ПВХ (2 x 22)";"Кромка ПВХ (2 x 22)";;',
    "C;Задняя стенка;1;700 mm;600 mm;3 mm;700 mm;600 mm;3 mm;0,4 m²;ХДФ;#3;;;;;",
  ].join("\n");
  const result = parseCutListText(csv);

  assert.equal(result.details.length, 3);
  assert.deepEqual(result.details[0], {
    title: "Боковина",
    length: 720,
    width: 560,
    quantity: 2,
    edgedSides: ["top"],
    material: "ЛДСП Белый",
  });
  assert.deepEqual(result.details[1].edgedSides, ["top", "bottom"]);
  assert.equal(result.details[1].quantity, 3);
  assert.deepEqual(result.details[2].edgedSides, []);
  assert.equal(result.details[2].material, "ХДФ");
});

test("выгрузка OpenCutList на английском через запятую", () => {
  const csv = [
    "No.,Designation,Quantity,Length - raw,Width - raw,Thickness - raw,Length,Width,Thickness,Material name,Edge Length 1,Edge Length 2,Edge Width 1,Edge Width 2",
    'A,Door,4,"1,985 mm",500 mm,16 mm,1982 mm,497 mm,16 mm,Kashmir,"PVC (1 x 22)","PVC (1 x 22)","PVC (1 x 22)","PVC (1 x 22)"',
  ].join("\n");
  const [door] = parseCutListText(csv).details;

  assert.equal(door.title, "Door");
  assert.equal(door.length, 1982);
  assert.equal(door.width, 497);
  assert.equal(door.quantity, 4);
  assert.deepEqual(door.edgedSides, ["top", "right", "bottom", "left"]);
});

test("свой шаблон сайта по-прежнему читается", () => {
  const result = parseCutListText(
    "Название\tДлина\tШирина\tКол-во\tД1\tД2\tШ1\tШ2\nБоковина\t720\t560\t2\t1\t0\t0\t0",
  );
  assert.deepEqual(result.details[0], {
    title: "Боковина",
    length: 720,
    width: 560,
    quantity: 2,
    edgedSides: ["top"],
  });
  assert.equal(
    parseCutListText("Полка 564 540 3 1Д").details[0].edgedSides.length,
    1,
  );
});
