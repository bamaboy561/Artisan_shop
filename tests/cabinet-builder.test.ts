import assert from "node:assert/strict";
import test from "node:test";

import {
  CABINET_KINDS,
  buildCabinet,
  hingeCount,
} from "../features/services/cabinet-builder";
import { hardwareHoles } from "../features/services/drilling-hardware";

const wardrobe = {
  kind: "wardrobe" as const,
  ...CABINET_KINDS.wardrobe.defaults,
};

test("wardrobe parts and sizes", () => {
  const result = buildCabinet(wardrobe, 16);
  const sizes = result.parts.map((part) => [
    part.title,
    part.length,
    part.width,
    part.quantity,
  ]);
  assert.deepEqual(sizes, [
    ["Шкаф: боковина левая", 2100, 580, 1],
    ["Шкаф: боковина правая", 2100, 580, 1],
    ["Шкаф: крыша", 768, 580, 1],
    ["Шкаф: дно", 768, 580, 1],
    ["Шкаф: полка", 766, 560, 4],
    ["Шкаф: цоколь", 768, 70, 1],
    ["Шкаф: дверь левая", 2027, 395.5, 1],
    ["Шкаф: дверь правая", 2027, 395.5, 1],
  ]);
  assert.deepEqual(result.back, { length: 2026, width: 796 });
  assert.deepEqual(result.problems, []);
  assert.equal(hingeCount(2027), 5);
});

test("minifix holes on the roof line up with bolt holes in the sides", () => {
  const result = buildCabinet(wardrobe, 16);
  const side = result.parts[0];
  const roof = result.parts[2];
  const sideHoles = hardwareHoles(side.hardware, side.length, side.width, 16);
  const roofHoles = hardwareHoles(roof.hardware, roof.length, roof.width, 16);
  // Болты крыши — у верхнего торца боковины (x = 2100 − 8), на 50 мм от
  // переднего и заднего края; торцевые отверстия крыши — там же по глубине.
  const bolts = sideHoles.filter(
    (hole) => hole.kind === "face" && hole.diameter === 5 && hole.x === 2092,
  );
  assert.deepEqual(
    bolts.map((hole) => (hole.kind === "face" ? hole.y : 0)),
    [50, 530],
  );
  const channels = roofHoles.filter((hole) => hole.kind === "edge");
  assert.deepEqual(
    channels.map((hole) =>
      hole.kind === "edge" ? [hole.side, hole.position] : null,
    ),
    [
      ["left", 50],
      ["left", 530],
      ["right", 50],
      ["right", 530],
    ],
  );
  // 4 полки × 2 ряда полкодержателей.
  assert.equal(
    sideHoles.filter((hole) => hole.kind === "face" && hole.diameter === 5)
      .length,
    4 + 8,
  );
});

test("small or oversize cabinets are flagged", () => {
  assert.equal(
    buildCabinet({ ...wardrobe, width: 100 }, 16).problems.length,
    1,
  );
  assert.equal(
    buildCabinet({ ...wardrobe, height: 2900 }, 16).problems.length,
    1,
  );
});
