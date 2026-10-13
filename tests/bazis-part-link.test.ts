import assert from "node:assert/strict";
import test from "node:test";

import { findSameParts } from "../features/bazis/part-groups";

const panel = (name: string, length: number, material = 0) => ({
  name,
  material,
  thickness: 16,
  length,
  width: 500,
  edgedLengthSides: 1,
  edgedWidthSides: 0,
});

test("identical parts are found together, different ones are not", () => {
  const panels = [
    panel("Бок", 2000),
    panel("Полка", 768),
    panel("Бок", 2000),
    panel("Бок", 2000, 1),
    panel("Бок", 1900),
  ];

  assert.deepEqual(findSameParts(panels, 0), [0, 2]);
  assert.deepEqual(findSameParts(panels, 1), [1]);
  assert.deepEqual(findSameParts(panels, 9), []);
});
