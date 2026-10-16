import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDrillingProgram,
  createHardware,
  hardwareHoles,
  holesToDrillCounts,
  rotateHoles,
  sanitizeHardware,
} from "../features/services/drilling-hardware";

test("minifix on the left edge gives face cams and edge channels", () => {
  const item = createHardware("minifix", "left");
  const holes = hardwareHoles([item], 800, 400, 16);
  assert.equal(holes.length, 4);
  assert.deepEqual(
    holes
      .filter((hole) => hole.kind === "face")
      .map((hole) => [hole.x, hole.y, hole.diameter]),
    [
      [34, 50, 15],
      [34, 350, 15],
    ],
  );
  assert.deepEqual(holesToDrillCounts(holes), { "15": 2, "8": 2 });
});

test("shelf pins run with a step at both edges and stay inside the part", () => {
  const item = { ...createHardware("shelfPins", "bottom"), count: 40 };
  const holes = hardwareHoles([item], 720, 560, 16);
  // 200 + 32·k ≤ 720 − 2.5 → k = 0…16, 17 positions per row, two rows.
  assert.equal(holes.length, 34);
  assert.ok(holes.every((hole) => hole.kind === "face" && hole.x + 2.5 <= 720));
});

test("handle gives two through holes around the centre", () => {
  const holes = hardwareHoles([createHardware("handle", "top")], 596, 716, 16);
  assert.deepEqual(
    holes.map((hole) =>
      hole.kind === "face" ? [hole.x, hole.y, hole.depth] : null,
    ),
    [
      [234, 666, 16],
      [362, 666, 16],
    ],
  );
});

test("rotated parts keep holes in place", () => {
  const holes = hardwareHoles([createHardware("hinge", "left")], 700, 400, 16);
  const rotated = rotateHoles(holes, 700);
  assert.deepEqual(
    rotated.map((hole) => (hole.kind === "face" ? [hole.x, hole.y] : null)),
    [
      [100, 677.5],
      [300, 677.5],
    ],
  );
});

test("GibLab program uses top-left origin and through depth", () => {
  const holes = hardwareHoles(
    [createHardware("handle", "top"), createHardware("dowelEdge", "right")],
    596,
    716,
    16,
  );
  const program = buildDrillingProgram(holes, 596, 716, 16);
  assert.match(program, /<program dx="596" dy="716" dz="16">/);
  assert.match(
    program,
    /<bf x="234" y="50" dp="throughBoreDepth" name="BoreTh5"\/>/,
  );
  assert.match(
    program,
    /<br ver="2" y="684" z="8" dp="30" m="true" name="Bore8"\/>/,
  );
  assert.match(program, /name="throughBoreDepth"/);
});

test("draft data is checked before use", () => {
  assert.equal(sanitizeHardware("nope"), undefined);
  const [item] = sanitizeHardware([
    { kind: "hinge", side: "left", count: "x" },
  ])!;
  assert.equal(item.count, 2);
  assert.deepEqual(item.holes, [{ diameter: 35, depth: 13 }]);
  assert.equal(sanitizeHardware([{ kind: "evil", side: "left" }]), undefined);
});
