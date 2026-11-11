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

test("milling is measured in metres for the price list", async () => {
  const { millingMeters } = await import("../features/services/part-milling");
  const milling = emptyMilling();
  milling.corners.topLeft = 100;
  milling.corners.topRight = 100;
  milling.bevels.bottom = 45;
  const meters = millingMeters(700, 400, milling);
  assert.equal(Math.round(meters.curve * 1000), Math.round(Math.PI * 100));
  assert.equal(meters.bevel, 0.7);
});

test("LED groove becomes a straight milling pass and is priced per metre", async () => {
  const { grooveMillingProgram, millingMeters, grooveRect } =
    await import("../features/services/part-milling");
  const milling = emptyMilling();
  milling.grooves = [{ side: "top", indent: 20, width: 10, depth: 10 }];
  // Паз у верхнего края: от y = 400 − 20 − 10 до 400 − 20.
  assert.deepEqual(grooveRect(milling.grooves[0], 700, 400), {
    x: 0,
    y: 370,
    w: 700,
    h: 10,
    along: true,
  });
  assert.equal(
    grooveMillingProgram(700, 400, 16, milling),
    '<?xml version="1.0" encoding="UTF-8"?><program dx="700.00" dy="400.00" dz="16.00"><tool name="Mill10" d="10" /><ms x="0" y="375" dp="10" name="Mill10" c="0"/><ml x="700" y="375"/></program>',
  );
  assert.equal(millingMeters(700, 400, milling).groove, 0.7);
  assert.equal(describeMilling(milling), "паз 10×10 в 20 мм от верхнего края");
  // Поворот детали: паз переходит на правый край.
  assert.equal(rotateMilling(milling).grooves?.[0].side, "right");
  assert.deepEqual(
    sanitizeMilling({
      grooves: [
        { side: "left", indent: 5, width: 10, depth: 10 },
        { side: "x" },
      ],
    })?.grooves,
    [{ side: "left", indent: 5, width: 10, depth: 10 }],
  );
  // Паз шире фрезы — два прохода, глубина не больше толщины − 2 мм.
  milling.grooves = [{ side: "left", indent: 0, width: 18, depth: 20 }];
  const wide = grooveMillingProgram(700, 400, 16, milling)!;
  assert.match(
    wide,
    /<ms x="5" y="0" dp="14"[^>]*\/><ml x="5" y="400"\/><ms x="13" y="0"/,
  );
});

test("unfinished groove (zero width) is neither milled nor billed", async () => {
  const { grooveMillingProgram, millingMeters } =
    await import("../features/services/part-milling");
  const milling = emptyMilling();
  milling.grooves = [{ side: "top", indent: 20, width: 0, depth: 10 }];
  assert.equal(grooveMillingProgram(700, 400, 16, milling), null);
  assert.equal(millingMeters(700, 400, milling).groove, 0);
});
