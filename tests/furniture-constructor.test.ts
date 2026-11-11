import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCabinetModel,
  TONE_BACK,
  TONE_FACADE,
} from "../features/constructor/cabinet-model";
import {
  CABINET_KINDS,
  buildCabinet,
} from "../features/services/cabinet-builder";
import { hardwareHoles } from "../features/services/drilling-hardware";
import {
  cabinetAssembly,
  cabinetFittings,
  partKind,
} from "../features/constructor/assembly";

const wardrobe = {
  kind: "wardrobe" as const,
  ...CABINET_KINDS.wardrobe.defaults,
};
const options = {
  doorOpen: 0,
  bodyMaterial: "Белый",
  facadeMaterial: "Дуб",
};

function bounds(boxes: ReturnType<typeof buildCabinetModel>) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const box of boxes) {
    for (const x of [box.x, box.x + box.sizeX])
      for (const y of [box.y, box.y + box.sizeY])
        for (const z of [0, box.thickness]) {
          const m = box.matrix;
          const p = [
            m[0] * x + m[1] * y + m[2] * z + m[3],
            m[4] * x + m[5] * y + m[6] * z + m[7],
            m[8] * x + m[9] * y + m[10] * z + m[11],
          ];
          p.forEach((value, axis) => {
            min[axis] = Math.min(min[axis], value);
            max[axis] = Math.max(max[axis], value);
          });
        }
  }
  return { min, max };
}

test("model has a box for every part and the back panel", () => {
  const result = buildCabinet(wardrobe, 16);
  const boxes = buildCabinetModel(wardrobe, 16, result, options);
  const pieces = result.parts.reduce((sum, part) => sum + part.quantity, 0);
  assert.equal(boxes.length, pieces + 1);
  assert.equal(boxes.filter((box) => box.tone === TONE_FACADE).length, 2);
  assert.equal(boxes.filter((box) => box.tone === TONE_BACK).length, 1);
});

test("closed wardrobe fits its overall size, doors on the front", () => {
  const result = buildCabinet(wardrobe, 16);
  const { min, max } = bounds(buildCabinetModel(wardrobe, 16, result, options));
  assert.deepEqual(min, [0, 0, -3]);
  assert.deepEqual(max, [800, 2100, 580 + 16]);
});

test("open doors swing out to the front", () => {
  const result = buildCabinet(wardrobe, 16);
  const closed = bounds(buildCabinetModel(wardrobe, 16, result, options));
  const open = bounds(
    buildCabinetModel(wardrobe, 16, result, { ...options, doorOpen: 1 }),
  );
  assert.ok(open.max[2] > closed.max[2] + 300);
});

test("fittings follow the drilling of the parts", () => {
  const result = buildCabinet(wardrobe, 16);
  const fittings = Object.fromEntries(
    cabinetFittings(wardrobe, result, 16).map((line) => [line.key, line.count]),
  );
  // Крыша и дно: по 2 эксцентрика и 2 шканта на каждый из двух стыков.
  assert.equal(fittings.minifix, 8);
  assert.equal(fittings.minifixStem, 8);
  assert.equal(fittings.dowel, 8);
  // Цоколь: по евровинту с каждой стороны.
  assert.equal(fittings.confirmat, 2);
  // 4 полки × 4 полкодержателя.
  assert.equal(fittings.shelfPin, 16);
  // Дверь 2027 мм — 5 петель, две двери.
  assert.equal(fittings.hinge, 10);
  assert.equal(fittings.handle, 2);
  assert.equal(fittings.hanger, undefined);
  assert.ok(fittings.backNail > 30);
});

test("wall cabinet gets hangers and one dowel per joint", () => {
  const wall = { kind: "wall" as const, ...CABINET_KINDS.wall.defaults };
  const result = buildCabinet(wall, 16);
  const fittings = Object.fromEntries(
    cabinetFittings(wall, result, 16).map((line) => [line.key, line.count]),
  );
  assert.equal(fittings.hanger, 2);
  assert.equal(fittings.dowel, 4);
  assert.equal(fittings.confirmat, undefined);
});

test("dowel holes in the sides line up with the roof", () => {
  const result = buildCabinet(wardrobe, 16);
  const [side, , roof] = result.parts;
  const sideDowels = hardwareHoles(side.hardware, side.length, side.width, 16)
    .filter((hole) => hole.kind === "face" && hole.diameter === 8)
    .map((hole) => (hole.kind === "face" ? [hole.x, hole.y] : []));
  assert.deepEqual(sideDowels, [
    [2092, 130],
    [2092, 450],
    [78, 130],
    [78, 450],
  ]);
  const roofDowels = hardwareHoles(roof.hardware, roof.length, roof.width, 16)
    .filter(
      (hole) =>
        hole.kind === "edge" && hole.diameter === 8 && hole.depth === 20,
    )
    .map((hole) => (hole.kind === "edge" ? [hole.side, hole.position] : []));
  assert.deepEqual(roofDowels, [
    ["left", 130],
    ["left", 450],
    ["right", 130],
    ["right", 450],
  ]);
});

test("assembly steps cover every part and the fittings", () => {
  const result = buildCabinet(wardrobe, 16);
  const fittings = cabinetFittings(wardrobe, result, 16);
  const steps = cabinetAssembly(wardrobe, result, fittings);
  const added = new Set(steps.flatMap((step) => step.added));
  for (const part of result.parts) assert.ok(added.has(partKind(part.title)));
  assert.ok(added.has("задняя стенка"));
  const used = new Map<string, number>();
  for (const step of steps)
    for (const item of step.fittings)
      used.set(item.label, (used.get(item.label) ?? 0) + item.count);
  for (const line of fittings) assert.equal(used.get(line.label), line.count);
});
