import assert from "node:assert/strict";
import test from "node:test";

import { kitchenFittings } from "../features/constructor/assembly";
import { buildKitchenModel } from "../features/constructor/kitchen-model";
import {
  KITCHEN_DEFAULTS,
  OVEN_NICHE,
  buildKitchen,
  kitchenLegs,
  kitchenPreset,
  type KitchenLayout,
  type KitchenSpec,
} from "../features/services/kitchen-builder";

const T = 16;
const options = {
  doorOpen: 0,
  bodyMaterial: "ЛДСП белая",
  facadeMaterial: "ЛДСП белая",
};
const kitchen = (layout: KitchenLayout): KitchenSpec => ({
  ...KITCHEN_DEFAULTS,
  layout,
  walls: kitchenPreset(layout),
});

// Прямоугольник модуля на полу (x, z) по всем его деталям в макете.
function footprints(spec: KitchenSpec) {
  const result = buildKitchen(spec, T);
  const boxes = buildKitchenModel(spec, T, result, options);
  const rects = new Map<
    string,
    { x0: number; x1: number; z0: number; z1: number; y0: number }
  >();
  for (const box of boxes) {
    const code = /, ((?:\d+-)?[НВ]\d+):/.exec(box.info?.name ?? "")?.[1];
    if (!code) continue;
    const m = box.matrix;
    for (const x of [box.x, box.x + box.sizeX]) {
      for (const y of [box.y, box.y + box.sizeY]) {
        for (const z of [0, box.thickness]) {
          const wx = m[0] * x + m[1] * y + m[2] * z + m[3];
          const wy = m[4] * x + m[5] * y + m[6] * z + m[7];
          const wz = m[8] * x + m[9] * y + m[10] * z + m[11];
          const rect = rects.get(code) ?? {
            x0: Infinity,
            x1: -Infinity,
            z0: Infinity,
            z1: -Infinity,
            y0: Infinity,
          };
          rect.x0 = Math.min(rect.x0, wx);
          rect.x1 = Math.max(rect.x1, wx);
          rect.z0 = Math.min(rect.z0, wz);
          rect.z1 = Math.max(rect.z1, wz);
          rect.y0 = Math.min(rect.y0, wy);
          rects.set(code, rect);
        }
      }
    }
  }
  return { result, boxes, rects };
}

for (const layout of ["line", "corner", "u"] as KitchenLayout[]) {
  test(`kitchen ${layout}: preset builds without problems`, () => {
    const spec = kitchen(layout);
    const result = buildKitchen(spec, T);
    assert.deepEqual(result.problems, []);
    assert.ok(result.parts.length > 0);
    for (const part of result.parts) {
      assert.ok(part.length > 0 && part.width > 0, part.title);
      assert.ok(Math.max(part.length, part.width) <= 2750, part.title);
    }
    assert.equal(result.worktop, 100 + 720 + 38);
  });

  test(`kitchen ${layout}: modules stay in the room and do not overlap`, () => {
    const spec = kitchen(layout);
    const { rects } = footprints(spec);
    const back = spec.walls[0].length;
    const side = Math.max(0, ...spec.walls.slice(1).map((wall) => wall.length));
    for (const [code, rect] of rects) {
      assert.ok(rect.x0 > -0.5 && rect.x1 < back + 0.5, `${code} x`);
      assert.ok(rect.z0 > -0.5, `${code} z`);
      if (layout !== "line") assert.ok(rect.z1 < side + 0.5, `${code} z`);
      assert.ok(rect.y0 > -0.5, `${code} y`);
    }
    const codes = [...rects.keys()];
    for (const row of ["Н", "В"]) {
      const list = codes.filter((code) => code.includes(row));
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const a = rects.get(list[i])!;
          const b = rects.get(list[j])!;
          const overlap =
            Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.5 &&
            Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 0.5;
          assert.ok(!overlap, `${list[i]} overlaps ${list[j]}`);
        }
      }
    }
  });
}

test("kitchen line: countertop and plinth run along the wall", () => {
  const spec = kitchen("line");
  const result = buildKitchen(spec, T);
  assert.deepEqual(result.countertops, [{ wall: 0, from: 0, to: 3000 }]);
  assert.deepEqual(result.plinths, [{ wall: 0, from: 0, to: 3000 }]);
  const plinth = result.parts.filter((part) => /: цоколь$/.test(part.title));
  assert.equal(
    plinth.reduce((sum, part) => sum + part.length * part.quantity, 0),
    3000,
  );
  assert.ok(plinth.every((part) => part.width === 97));
  // Мойка — без крыши, с двумя царгами; посудомойка — один фасад.
  const sink = result.modules.find((item) => item.type === "sink")!;
  const sinkParts = sink.result!.parts.map((part) => part.title);
  assert.ok(sinkParts.some((title) => /царга/.test(title)));
  assert.ok(!sinkParts.some((title) => /: крыша/.test(title)));
  assert.ok(result.parts.some((part) => /фасад посудомойки/.test(part.title)));
});

test("kitchen: tall pantry breaks the countertop", () => {
  const spec = kitchen("corner");
  const result = buildKitchen(spec, T);
  const side = result.countertops.filter((piece) => piece.wall === 1);
  assert.deepEqual(side, [{ wall: 1, from: 600, to: 1800 }]);
  const pantry = result.modules.find((item) => item.type === "tallPantry")!;
  assert.equal(pantry.bottom + pantry.height, 1500 + 720);
});

test("kitchen: corner modules put the blind part at the corner", () => {
  const result = buildKitchen(kitchen("u"), T);
  const corners = result.modules.filter(
    (item) => item.type === "corner" && item.row === "base",
  );
  assert.deepEqual(
    corners.map((item) => item.spec?.blind?.side),
    ["left", "right"],
  );
  for (const item of corners) {
    assert.ok(item.result!.parts.some((part) => /заглушка/.test(part.title)));
  }
});

test("kitchen: missing corner module is reported", () => {
  const spec = kitchen("corner");
  spec.walls[0].base[0] = { type: "doors", width: 1000 };
  const result = buildKitchen(spec, T);
  assert.ok(result.problems.some((problem) => /левого угла/.test(problem)));
});

test("kitchen: overflowing wall is reported", () => {
  const spec = kitchen("line");
  spec.walls[0].length = 2500;
  const result = buildKitchen(spec, T);
  assert.ok(result.problems.some((problem) => /Стена 1/.test(problem)));
});

test("kitchen: fittings sum modules and add legs, lifts, dryers", () => {
  const spec = kitchen("line");
  const result = buildKitchen(spec, T);
  const lines = kitchenFittings(result, T);
  const count = (key: string) =>
    lines.find((line) => line.key === key)?.count ?? 0;
  assert.equal(count("kitchenLeg"), kitchenLegs(result).legs);
  assert.equal(count("kitchenLeg"), 4 * 4);
  assert.equal(count("lift"), 1);
  assert.equal(count("dishDryer"), 1);
  // 3 ящика у тумбы, 3 под варочной.
  assert.equal(count("slide"), 6);
  assert.ok(count("confirmat") > 0);
  assert.ok(count("hinge") > 0);
  // У подъёмной двери нет петель: 4 двери снизу... считаем без неё.
  const lift = result.modules.find((item) => item.type === "lift")!;
  assert.ok(
    !lift.result!.parts.some((part) =>
      (part.hardware ?? []).some((hole) => hole.kind === "hinge"),
    ),
  );
});

test("kitchen: oven niche keeps the oven niche clear above the drawer", () => {
  for (const t of [16, 18]) {
    const spec = kitchen("line");
    spec.walls[0].base[3] = { type: "oven", width: 600 };
    const result = buildKitchen(spec, t);
    assert.deepEqual(result.problems, []);
    const oven = result.modules.find((item) => item.type === "oven")!;
    const cabinet = oven.result!;
    const front = cabinet.parts.find((part) => /фасад ящика/.test(part.title))!;
    const frontHeight = Math.min(front.length, front.width);
    assert.ok(frontHeight >= 100, `front ${frontHeight}`);
    // Ниша: от полки над ящиком до крыши.
    const clear = spec.baseHeight - t - 3 - (frontHeight + 3);
    assert.ok(clear >= OVEN_NICHE - 0.1, `niche ${clear} at ${t} mm`);
  }
});

test("kitchen: bottle cargo front has no hinges", () => {
  const spec = kitchen("line");
  spec.walls[0].base.push({ type: "bottle", width: 200 });
  spec.walls[0].length = 3200;
  const result = buildKitchen(spec, T);
  const bottle = result.modules.find((item) => item.type === "bottle")!;
  assert.ok(
    !bottle.result!.parts.some((part) =>
      (part.hardware ?? []).some(
        (hole) => hole.kind === "hinge" || hole.kind === "hingePlate",
      ),
    ),
  );
  const lines = kitchenFittings(result, T);
  assert.equal(lines.find((line) => line.key === "cargo")?.count, 1);
});

test("kitchen: wall cabinet over a tall pantry is reported", () => {
  const spec = kitchen("line");
  spec.walls[0].base[4] = { type: "tallPantry", width: 600 };
  const result = buildKitchen(spec, T);
  assert.ok(result.problems.some((problem) => /В5 висит над/.test(problem)));
  spec.walls[0].top[4] = { type: "none", width: 600 };
  assert.deepEqual(buildKitchen(spec, T).problems, []);
});
