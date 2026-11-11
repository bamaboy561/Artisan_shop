import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCabinetModel,
  countCabinetFittings,
  TONE_BACK,
  TONE_FACADE,
} from "../features/constructor/cabinet-model";
import {
  CABINET_KINDS,
  buildCabinet,
} from "../features/services/cabinet-builder";

const wardrobe = {
  kind: "wardrobe" as const,
  ...CABINET_KINDS.wardrobe.defaults,
};
const options = {
  doorsOpen: false,
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
    buildCabinetModel(wardrobe, 16, result, { ...options, doorsOpen: true }),
  );
  assert.ok(open.max[2] > closed.max[2] + 300);
});

test("fittings count", () => {
  const result = buildCabinet(wardrobe, 16);
  const fittings = Object.fromEntries(
    countCabinetFittings(result).map((item) => [item.key, item.count]),
  );
  assert.equal(fittings.handle, 2);
  assert.equal(fittings.shelfPin, 4 * 4);
  assert.ok(fittings.hinge >= 8);
  assert.ok(fittings.minifix >= 4);
});
