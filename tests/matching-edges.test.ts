import assert from "node:assert/strict";
import test from "node:test";

import { findMatchingEdges } from "../features/storefront/matching-edges";

const edge = (name: string, inStock = true) => ({ name, slug: name, inStock });
const edges = [
  edge("Кромка Серый Кварцит 1*19 мм"),
  edge("4429OW Дуб серо-бежевый 1*19мм"),
  edge("Кромка ПВХ Кашемир шагрень 19/1"),
  edge("S-119-ABS-Светло-бежевый/VL/22/1.0"),
  edge("Кромка ПВХ Белый супермат 19/1"),
  edge("Дуб Алабама 1*22мм"),
];

const names = (plate: string) =>
  findMatchingEdges(plate, edges).map((item) => item.name);

test("edge band in the same decor is found for a plate", () => {
  assert.deepEqual(names("Серый Кварцит 2.75*1.83"), [
    "Кромка Серый Кварцит 1*19 мм",
  ]);
  assert.deepEqual(names("Дуб Серо-Бежевый  2.75*1.83"), [
    "4429OW Дуб серо-бежевый 1*19мм",
  ]);
  assert.deepEqual(names("Кашемир  2.75*1.83"), [
    "Кромка ПВХ Кашемир шагрень 19/1",
  ]);
  assert.deepEqual(names("Светло-бежевый 2.75*1.83"), [
    "S-119-ABS-Светло-бежевый/VL/22/1.0",
  ]);
});

test("other decors are not suggested", () => {
  assert.deepEqual(names("Белый шагрень 2.75*1.83"), []);
  assert.deepEqual(names("Дуб Коми 2.75*1.83"), []);
});
