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
  // 4 болта, 4 полки × 2 ряда полкодержателей, 5 планок петель × 2.
  assert.equal(
    sideHoles.filter((hole) => hole.kind === "face" && hole.diameter === 5)
      .length,
    4 + 8 + 10,
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

test("hinge plates on the side match hinge heights on the door", () => {
  const result = buildCabinet(wardrobe, 16);
  const [left, right] = result.parts;
  const door = result.parts.find((part) => part.title.endsWith("дверь левая"))!;
  const cups = hardwareHoles(door.hardware, door.length, door.width, 16)
    .filter((hole) => hole.kind === "face" && hole.diameter === 35)
    .map((hole) => (hole.kind === "face" ? hole.x : 0));
  assert.equal(cups.length, 5);

  for (const side of [left, right]) {
    const plateItems = side.hardware?.filter(
      (item) => item.kind === "hingePlate",
    );
    const plates = hardwareHoles(plateItems, side.length, side.width, 16).map(
      (hole) => {
        assert.equal(hole.kind === "face" && hole.y, side.width - 37);
        return hole.kind === "face" ? hole.x : 0;
      },
    );
    // Дверь начинается над цоколем с зазором 3 мм; на каждую петлю —
    // два отверстия ±16 мм от её оси.
    const expected = cups.flatMap((x) => [70 + 3 + x - 16, 70 + 3 + x + 16]);
    assert.deepEqual(
      plates.map((x) => Math.round(x * 10) / 10),
      expected.map((x) => Math.round(x * 10) / 10),
    );
  }
});

test("one door gets plates only on the left side, no doors — none", () => {
  const plateCount = (doors: 0 | 1 | 2) =>
    buildCabinet({ ...wardrobe, doors }, 16)
      .parts.slice(0, 2)
      .map(
        (side) =>
          side.hardware?.filter((item) => item.kind === "hingePlate").length ??
          0,
      );
  assert.deepEqual(plateCount(1), [5, 0]);
  assert.deepEqual(plateCount(0), [0, 0]);
});
