import assert from "node:assert/strict";
import test from "node:test";

import { kitchenFittings } from "../features/constructor/assembly";
import { buildKitchenModel } from "../features/constructor/kitchen-model";
import {
  CORNER_FILLER,
  KITCHEN_BACK,
  KITCHEN_DEFAULTS,
  PLINTH_SETBACK,
  WIDE_MODULE,
  OVEN_NICHE,
  buildKitchen,
  kitchenCutoutNote,
  kitchenDropTarget,
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
  // Столешница боковой стены — сразу за столешницей задней, над
  // фальшпанелью тоже.
  assert.deepEqual(side, [{ wall: 1, from: 600, to: 1850 }]);
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

test("kitchen: base modules have rails, the sink has no back", () => {
  const result = buildKitchen(kitchen("line"), T);
  for (const item of result.modules) {
    if (item.row !== "base" || !item.result) continue;
    const titles = item.result.parts.map((part) => part.title);
    assert.ok(
      titles.some((title) => /: царга$/.test(title)),
      item.code,
    );
    assert.ok(!titles.some((title) => /: крыша$/.test(title)), item.code);
    assert.equal(item.result.back === null, item.type === "sink", item.code);
  }
});

test("kitchen corner: filler and plinth close the inner corner", () => {
  const spec = kitchen("corner");
  const result = buildKitchen(spec, T);
  const face = KITCHEN_BACK + spec.baseDepth - PLINTH_SETBACK;
  const back = result.plinths.find((piece) => piece.wall === 0)!;
  const side = result.plinths.find((piece) => piece.wall === 1)!;
  // Цоколь задней стены начинается у цоколя боковой, боковой упирается в
  // лицо заднего.
  assert.equal(back.from, face);
  assert.equal(side.from, face + T);
  // Фальшпанель — от фасадов задней стены до первого модуля боковой.
  assert.equal(result.starts[1].base, spec.countertopDepth + CORNER_FILLER);
  const filler = result.parts.find((part) => /фальшпанель/.test(part.title))!;
  assert.equal(
    filler.width,
    result.starts[1].base - (KITCHEN_BACK + spec.baseDepth + T),
  );
  assert.deepEqual(result.fillers, [
    {
      wall: 1,
      from: KITCHEN_BACK + spec.baseDepth + T,
      to: result.starts[1].base,
    },
  ]);
  const lines = kitchenFittings(result, T);
  const count = (key: string) =>
    lines.find((line) => line.key === key)?.count ?? 0;
  assert.equal(count("worktopJoint"), 1);
  assert.equal(count("worktopConnector"), 3);
  assert.equal(count("worktopEnd"), 2);
  // Тонкая столешница: стяжки на угловой стык не встанут.
  assert.ok(
    buildKitchen({ ...spec, countertop: 22 }, T).problems.some((problem) =>
      /Столешница 22 мм: для стяжек/.test(problem),
    ),
  );
});

test("kitchen: wide modules stand on 6 legs", () => {
  const result = buildKitchen(kitchen("u"), T);
  const bodies = result.modules.filter(
    (item) => item.row === "base" && item.spec,
  );
  const expected = bodies.reduce(
    (sum, item) => sum + (item.width >= WIDE_MODULE ? 6 : 4),
    0,
  );
  assert.equal(kitchenLegs(result).legs, expected);
  assert.ok(bodies.some((item) => item.width >= WIDE_MODULE));
});

test("kitchen: tall oven keeps its roof", () => {
  const spec = kitchen("line");
  spec.walls[0].base[4] = { type: "tallOven", width: 600 };
  spec.walls[0].top[4] = { type: "none", width: 600 };
  const result = buildKitchen(spec, T);
  const tall = result.modules.find((item) => item.type === "tallOven")!;
  const titles = tall.result!.parts.map((part) => part.title);
  assert.ok(titles.some((title) => /: крыша$/.test(title)));
  assert.ok(!titles.some((title) => /: царга$/.test(title)));
});

test("kitchen corner: back plinth stays full when the side row is empty", () => {
  const spec = kitchen("corner");
  spec.walls[1].base = [];
  const result = buildKitchen(spec, T);
  const back = result.plinths.find((piece) => piece.wall === 0)!;
  assert.equal(back.from, 0);
});

test("кухня по блокам: пустые стены и блоки по одному", () => {
  for (const layout of ["line", "corner", "u"] as const) {
    const empty = kitchen(layout);
    empty.walls = empty.walls.map((wall) => ({ ...wall, base: [], top: [] }));
    const result = buildKitchen(empty, T);
    assert.deepEqual(result.problems, []);
    assert.equal(result.parts.length, 0);
    assert.equal(result.countertops.length, 0);
    assert.deepEqual(buildKitchenModel(empty, T, result, options), []);
    assert.deepEqual(kitchenFittings(result, T), []);
  }
  const spec = kitchen("line");
  spec.walls = [
    { ...spec.walls[0], base: [{ type: "drawers", width: 400 }], top: [] },
  ];
  const result = buildKitchen(spec, T);
  assert.ok(result.parts.some((part) => /, Н1: /.test(part.title)));
});

test("фурнитура одного блока: без столешницы, ножки только его", () => {
  const result = buildKitchen(kitchen("corner"), T);
  const all = kitchenFittings(result, T);
  const codes = result.modules.map((item) => item.code);
  const sum = new Map<string, number>();
  for (const code of codes)
    for (const line of kitchenFittings(result, T, code))
      sum.set(line.key, (sum.get(line.key) ?? 0) + line.count);
  for (const line of all) {
    if (
      [
        "worktopPlinth",
        "worktopJoint",
        "worktopConnector",
        "worktopEnd",
        "wallRail",
      ].includes(line.key)
    ) {
      assert.equal(sum.has(line.key) && line.key !== "wallRail", false);
      continue;
    }
    assert.equal(sum.get(line.key), line.count, line.key);
  }
  const drawers = result.modules.find(
    (item) => item.row === "base" && item.width < WIDE_MODULE && item.spec,
  )!;
  const legs = kitchenFittings(result, T, drawers.code).find(
    (line) => line.key === "kitchenLeg",
  );
  assert.equal(legs?.count, 4);
});

test("блок из полки встаёт к стене и между соседями", () => {
  const spec = kitchen("corner");
  const result = buildKitchen(spec, T);
  const back = result.modules.filter(
    (item) => item.wall === 0 && item.row === "base",
  );
  // На пол перед серединой второго блока задней стены, правее середины.
  const second = back[1];
  const x = second.at + second.width * 0.75;
  assert.deepEqual(kitchenDropTarget(spec, result, "base", [x, 0, 900]), {
    wall: 0,
    index: 2,
  });
  // У левой стены (x≈0), далеко от угла — в конец её ряда.
  const left = result.modules.filter(
    (item) => item.wall === 1 && item.row === "base",
  );
  assert.deepEqual(kitchenDropTarget(spec, result, "base", [100, 0, 2400]), {
    wall: 1,
    index: left.length,
  });
  // Нажали на блок: та же стена, перед ним, если левее его середины.
  assert.deepEqual(
    kitchenDropTarget(
      spec,
      result,
      "base",
      [second.at + 10, 300, 600],
      second.code,
    ),
    { wall: 0, index: 1 },
  );
  // Угловой — всегда в угол задней стены.
  assert.deepEqual(
    kitchenDropTarget(spec, result, "base", [100, 0, 2000], null, "corner"),
    { wall: 0, index: 0 },
  );
});

test("угловой блок: только в углу, у правого угла — до самого угла", () => {
  const u = kitchen("u");
  u.walls = u.walls.map((wall) => ({ ...wall, base: [], top: [] }));
  // П-образная: угловой последним, но ряд не доходит до правого угла.
  u.walls[0] = {
    ...u.walls[0],
    base: [
      { type: "corner", width: 1000 },
      { type: "drawers", width: 400 },
      { type: "corner", width: 1000 },
    ],
  };
  const short = buildKitchen(u, T);
  assert.ok(
    short.problems.some((text) =>
      /Н3: угловой блок у правого угла не доходит/.test(text),
    ),
    short.problems.join("\n"),
  );
  // Угловой посередине ряда.
  const corner = kitchen("corner");
  corner.walls = corner.walls.map((wall) => ({ ...wall, base: [], top: [] }));
  corner.walls[0] = {
    ...corner.walls[0],
    base: [
      { type: "corner", width: 1000 },
      { type: "corner", width: 1000 },
      { type: "drawers", width: 400 },
    ],
  };
  assert.ok(
    buildKitchen(corner, T).problems.some((text) =>
      /Н2: угловой блок ставьте первым/.test(text),
    ),
  );
  // Готовые наборы по-прежнему без предупреждений.
  for (const layout of ["line", "corner", "u"] as const) {
    assert.deepEqual(buildKitchen(kitchen(layout), T).problems, []);
  }
});

test("kitchen: countertop cutouts for the sink and the hob", () => {
  const spec = kitchen("line");
  const result = buildKitchen(spec, T);
  // Мойка Н2 (800, с 400): вырез 740 × 480 по центру тумбы и столешницы.
  // Варочная Н4 (600, с 1800): вырез 560 × 490.
  assert.deepEqual(
    result.cutouts.map((cut) => [
      cut.code,
      cut.kind,
      cut.at,
      cut.width,
      cut.back,
      cut.depth,
    ]),
    [
      ["Н2", "sink", 430, 740, 60, 480],
      ["Н4", "hob", 1820, 560, 55, 490],
    ],
  );
  assert.equal(
    kitchenCutoutNote(spec, result),
    "Вырезы в столешнице (сверьте с паспортом мойки и панели): Н2 мойка — 740 × 480 мм, 430 мм от левого края куска 3000 мм, 60 мм от переднего края; Н4 варочная панель — 560 × 490 мм, 1820 мм от левого края куска 3000 мм, 55 мм от переднего края.",
  );
  // В 3D столешница расступается: над вырезом её нет, есть мойка и панель.
  const boxes = buildKitchenModel(spec, T, result, options);
  const top = boxes.filter((box) => /: столешница$/.test(box.info?.name ?? ""));
  const covers = (x: number, z: number) =>
    top.some(
      (box) =>
        box.matrix[3] + box.x <= x &&
        x <= box.matrix[3] + box.x + box.sizeX &&
        box.matrix[11] <= z &&
        z <= box.matrix[11] + box.thickness,
    );
  assert.ok(!covers(800, 300), "над мойкой нет столешницы");
  assert.ok(!covers(2100, 300), "над панелью нет столешницы");
  assert.ok(covers(800, 30) && covers(800, 570) && covers(1500, 300));
  const area = top.reduce((sum, box) => sum + box.sizeX * box.thickness, 0);
  assert.equal(area, 3000 * 600 - 740 * 480 - 560 * 490);
  assert.ok(boxes.some((box) => /Н2: мойка/.test(box.info?.name ?? "")));
  assert.ok(
    boxes.some((box) => /Н4: варочная панель/.test(box.info?.name ?? "")),
  );
});

test("kitchen corner and U: countertop opens right over the sink and hob", () => {
  for (const layout of ["corner", "u"] as KitchenLayout[]) {
    const spec = kitchen(layout);
    const result = buildKitchen(spec, T);
    const boxes = buildKitchenModel(spec, T, result, options);
    // Точка в мировых x, z для бокса: обратное преобразование по осям.
    const inside = (box: (typeof boxes)[number], wx: number, wz: number) => {
      const m = box.matrix;
      const xs = [box.x, box.x + box.sizeX];
      const zs = [0, box.thickness];
      const px = xs.flatMap((x) => zs.map((z) => m[0] * x + m[2] * z + m[3]));
      const pz = xs.flatMap((x) => zs.map((z) => m[8] * x + m[10] * z + m[11]));
      return (
        Math.min(...px) < wx &&
        wx < Math.max(...px) &&
        Math.min(...pz) < wz &&
        wz < Math.max(...pz)
      );
    };
    const top = boxes.filter((box) =>
      /: столешница$/.test(box.info?.name ?? ""),
    );
    assert.ok(result.cutouts.length >= 2, layout);
    for (const cut of result.cutouts) {
      // Центр мойки или панели в мире — по её стеклу/дну.
      const appliance = boxes.find(
        (box) =>
          box.info?.name ===
          `Кухня, ${cut.code}: ${cut.kind === "sink" ? "мойка" : "варочная панель"}`,
      )!;
      const m = appliance.matrix;
      const cx = appliance.x + appliance.sizeX / 2;
      const cz = appliance.thickness / 2;
      const wx = m[0] * cx + m[2] * cz + m[3];
      const wz = m[8] * cx + m[10] * cz + m[11];
      assert.ok(
        !top.some((box) => inside(box, wx, wz)),
        `${layout} ${cut.code}: столешница закрывает вырез`,
      );
    }
  }
});

test("kitchen: shallow countertop leaves no room for the hob cutout", () => {
  const spec = { ...kitchen("line"), countertopDepth: 560 };
  const result = buildKitchen(spec, T);
  assert.ok(
    result.problems.some((problem) =>
      /^Н4: вырез под варочную панель 490/.test(problem),
    ),
  );
});
