import assert from "node:assert/strict";
import test from "node:test";

import {
  contourMillingProgram,
  describeMilling,
  emptyMilling,
  mergePrograms,
  rotateMilling,
  roundedContour,
  sanitizeMilling,
} from "../features/services/part-milling";

const withCorner = () => {
  const milling = emptyMilling();
  milling.corners.topLeft = 50;
  return milling;
};

test("rounded contour is closed and keeps straight sides", () => {
  const elements = roundedContour(700, 400, withCorner());
  assert.equal(elements.length, 5);
  assert.deepEqual(elements[3], {
    type: 2,
    cx: 50,
    cy: 350,
    x1: 50,
    y1: 400,
    x2: 0,
    y2: 350,
    flag: 1,
  });
});

test("corner rounding becomes a GibLab milling program like the Bazis export", () => {
  const program = contourMillingProgram(700, 400, 16, withCorner())!;
  assert.match(program, /<program dx="700.00" dy="400.00" dz="16.00">/);
  assert.match(program, /<tool name="Mill20" d="20" \/>/);
  assert.match(program, /<mac x="0" y="50" cx="50" cy="50" dir="false"\/>/);
  assert.equal(contourMillingProgram(700, 400, 16, emptyMilling()), null);
});

test("drilling and milling share one program", () => {
  const merged = mergePrograms(
    '<?xml version="1.0"?><program dx="1" dy="1" dz="1"><tool name="Bore5" d="5" /><bf x="1" y="1" dp="5" name="Bore5"/></program>',
    '<?xml version="1.0"?><program dx="1" dy="1" dz="1"><tool name="Mill20" d="20" /><var name="contMillDepth" expr="dz"/><ms x="0" y="0"/></program>',
  )!;
  assert.equal(
    merged,
    '<?xml version="1.0"?><program dx="1" dy="1" dz="1"><tool name="Bore5" d="5" /><tool name="Mill20" d="20" /><var name="contMillDepth" expr="dz"/><bf x="1" y="1" dp="5" name="Bore5"/><ms x="0" y="0"/></program>',
  );
});

test("rotation, description and draft checks", () => {
  const milling = withCorner();
  milling.bevels.bottom = 45;
  const rotated = rotateMilling(milling);
  assert.equal(rotated.corners.topRight, 50);
  assert.equal(rotated.bevels.left, 45);
  assert.equal(describeMilling(milling), "R50 левый верхний, скос 45° низ");
  assert.equal(
    sanitizeMilling({ corners: { topLeft: -3 }, bevels: { top: 17 } }),
    undefined,
  );
  assert.equal(sanitizeMilling({ bevels: { top: 22.5 } })?.bevels.top, 22.5);
});
