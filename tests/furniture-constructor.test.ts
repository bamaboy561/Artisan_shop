import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCabinetModel,
  TONE_BACK,
  TONE_FACADE,
  TONE_LED,
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

test("confirmat joint: through holes in the sides match the roof edges", () => {
  for (const joint of ["confirmat", "confirmatDowel"] as const) {
    const spec = { ...wardrobe, joint };
    const result = buildCabinet(spec, 16);
    const [side, , roof] = result.parts;
    const through = hardwareHoles(side.hardware, side.length, side.width, 16)
      .filter(
        (hole) =>
          hole.kind === "face" && hole.diameter === 7 && hole.depth === 16,
      )
      .map((hole) => (hole.kind === "face" ? [hole.x, hole.y] : []));
    // Глубина 580: по два конфирмата на крышу и дно + евровинт цоколя.
    assert.deepEqual(through.slice(0, 2), [
      [2092, 50],
      [2092, 530],
    ]);
    assert.equal(
      hardwareHoles(side.hardware, side.length, side.width, 16).some(
        (hole) =>
          hole.kind === "face" && hole.diameter === 5 && hole.x === 2092,
      ),
      false,
    );
    const roofEdges = hardwareHoles(roof.hardware, roof.length, roof.width, 16)
      .filter((hole) => hole.kind === "edge" && hole.diameter === 5)
      .map((hole) => (hole.kind === "edge" ? [hole.side, hole.position] : []));
    assert.deepEqual(roofEdges, [
      ["left", 50],
      ["left", 530],
      ["right", 50],
      ["right", 530],
    ]);

    const fittings = Object.fromEntries(
      cabinetFittings(spec, result, 16).map((line) => [line.key, line.count]),
    );
    assert.equal(fittings.minifix, undefined);
    assert.equal(fittings.minifixStem, undefined);
    // 8 в корпус + 2 в цоколь.
    assert.equal(fittings.confirmat, 10);
    assert.equal(fittings.dowel, joint === "confirmat" ? undefined : 8);

    const lines = cabinetFittings(spec, result, 16);
    const steps = cabinetAssembly(spec, result, lines);
    const added = new Set(steps.flatMap((step) => step.added));
    for (const part of result.parts) assert.ok(added.has(partKind(part.title)));
    const used = new Map<string, number>();
    for (const step of steps)
      for (const item of step.fittings)
        used.set(item.label, (used.get(item.label) ?? 0) + item.count);
    for (const line of lines) assert.equal(used.get(line.label), line.count);
  }
});

test("deep cabinet gets three confirmats per joint", () => {
  const spec = { ...wardrobe, depth: 650, joint: "confirmat" as const };
  const fittings = Object.fromEntries(
    cabinetFittings(spec, buildCabinet(spec, 16), 16).map((line) => [
      line.key,
      line.count,
    ]),
  );
  assert.equal(fittings.confirmat, 14);
});

test("LED in the sides: grooves behind hinge plates, profile in metres", () => {
  const spec = { ...wardrobe, led: "sides" as const };
  const result = buildCabinet(spec, 16);
  const sides = result.parts.filter((part) => /боковина/.test(part.title));
  for (const side of sides) {
    assert.deepEqual(side.milling?.grooves, [
      { side: "top", indent: 70, width: 10, depth: 10 },
    ]);
  }
  assert.equal(
    result.parts.some((part) => /полка/.test(part.title) && part.milling),
    false,
  );
  const lines = cabinetFittings(spec, result, 16);
  const byKey = Object.fromEntries(lines.map((line) => [line.key, line]));
  // Два паза по 2100 мм — 5 м профиля и ленты.
  assert.equal(byKey.ledProfile.count, 5);
  assert.equal(byKey.ledProfile.unit, "м");
  assert.equal(byKey.ledStrip.count, 5);
  const steps = cabinetAssembly(spec, result, lines);
  assert.ok(steps.some((step) => step.added.includes("подсветка")));
  const glow = buildCabinetModel(spec, 16, result, options).filter(
    (box) => box.tone === TONE_LED,
  );
  assert.equal(glow.length, 2);
});

test("LED under shelves: groove on every shelf, none without doors in sides", () => {
  const spec = { ...wardrobe, led: "shelves" as const, doors: 0 as const };
  const result = buildCabinet(spec, 16);
  const shelf = result.parts.find((part) => /полка/.test(part.title))!;
  assert.deepEqual(shelf.milling?.grooves, [
    { side: "top", indent: 30, width: 10, depth: 10 },
  ]);
  const glow = buildCabinetModel(spec, 16, result, options).filter(
    (box) => box.tone === TONE_LED,
  );
  assert.equal(glow.length, spec.shelves);
  const noDoors = buildCabinet({ ...spec, led: "sides" }, 16);
  assert.equal(noDoors.parts[0].milling?.grooves?.[0].indent, 20);
});

test("LED groove is refused on a board thinner than 14 mm", () => {
  const spec = { ...wardrobe, led: "sides" as const };
  const result = buildCabinet(spec, 10);
  assert.ok(result.parts.every((part) => !part.milling));
  assert.match(result.problems.join(" "), /не сделать в плите 10 мм/);
  assert.equal(buildCabinet(spec, 16).problems.length, 0);
});

test("wardrobe drawers: fronts under the doors, boxes on 550 mm slides", () => {
  const spec = { ...wardrobe, drawers: 2 };
  const result = buildCabinet(spec, 16);
  const drawers = result.drawers!;
  assert.equal(drawers.slide, 550);
  assert.equal(drawers.frontHeight, 180);
  assert.deepEqual(drawers.frontsAt, [73, 256]);
  assert.equal(drawers.boxWidth, 768 - 26);
  assert.equal(drawers.boxHeight, 130);
  // Двери начинаются над ящиками и доходят до верха.
  assert.equal(result.doorHeight, 2100 - 439);
  assert.equal(drawers.shelfAt, 423);
  const byKind = Object.fromEntries(
    result.parts.map((part) => [partKind(part.title), part]),
  );
  assert.equal(byKind["ящик боковина"].quantity, 4);
  assert.equal(byKind["ящик стенка"].length, 742 - 32);
  assert.equal(byKind["фасад ящика"].width, 794);
  assert.ok(byKind["полка над ящиками"]);
  const lines = cabinetFittings(spec, result, 16);
  const fit = Object.fromEntries(lines.map((line) => [line.key, line.count]));
  assert.equal(fit.slide, 2);
  assert.equal(fit.handle, 4);
  // 8 в корпус + 2 цоколь — это минификс; у коробов по 8 конфирматов.
  assert.equal(fit.confirmat, 2 + 16);
  // Все детали и вся фурнитура попадают в инструкцию.
  const steps = cabinetAssembly(spec, result, lines);
  const added = new Set(steps.flatMap((step) => step.added));
  for (const part of result.parts) assert.ok(added.has(partKind(part.title)));
  const used = new Map<string, number>();
  for (const step of steps)
    for (const item of step.fittings)
      used.set(item.label, (used.get(item.label) ?? 0) + item.count);
  for (const line of lines) assert.equal(used.get(line.label), line.count);
  const model = buildCabinetModel(spec, 16, result, options);
  assert.equal(
    model.filter((box) => box.info?.name.endsWith(": фасад ящика")).length,
    2,
  );
});

test("base cabinet without doors: drawer fronts fill the height", () => {
  const base = {
    kind: "base" as const,
    ...CABINET_KINDS.base.defaults,
    doors: 0 as const,
    drawers: 3,
  };
  const result = buildCabinet(base, 16);
  const drawers = result.drawers!;
  assert.equal(drawers.shelfAt, null);
  assert.equal(drawers.frontHeight, 237);
  // Верх последнего фасада — верх тумбы.
  assert.equal(
    drawers.frontsAt[2] + drawers.frontHeight,
    CABINET_KINDS.base.defaults.height,
  );
  assert.equal(
    result.parts.some((part) => /полка/.test(part.title)),
    false,
  );
  const lines = cabinetFittings(base, result, 16);
  const steps = cabinetAssembly(base, result, lines);
  const used = new Map<string, number>();
  for (const step of steps)
    for (const item of step.fittings)
      used.set(item.label, (used.get(item.label) ?? 0) + item.count);
  for (const line of lines) assert.equal(used.get(line.label), line.count);
});

test("kupe: sections, partition, TopLine L doors and rod", () => {
  const kupe = { kind: "kupe" as const, ...CABINET_KINDS.kupe.defaults };
  const result = buildCabinet(kupe, 16);
  assert.deepEqual(result.problems, []);
  const part = (kind: string) =>
    result.parts.find((entry) => partKind(entry.title) === kind);
  // 1800 − 2·16 = 1768, минус перегородка 16 → две секции по 876.
  assert.deepEqual(result.kupe?.partitions, [892]);
  assert.equal(result.kupe?.sections[0].width, 876);
  assert.equal(part("перегородка 1")?.length, 2400 - 70 - 32);
  // Двери: (1800 + 25) / 2, высота 2400 − 70 − 40.
  assert.equal(part("дверь купе")?.quantity, 2);
  assert.equal(part("дверь купе")?.width, 912.5);
  assert.equal(part("дверь купе")?.length, 2290);
  assert.equal(part("дверь купе")?.hardware, undefined);
  // Секция 1: 2 ящика, полка над ними и 4 полки; секция 2: шляпная полка.
  assert.equal(part("полка над ящиками")?.quantity, 1);
  assert.equal(part("полка")?.quantity, 5);
  assert.equal(part("полка")?.length, 874);
  assert.equal(part("фасад ящика")?.width, 872);
  assert.equal(result.drawers?.slide, 500);
  assert.equal(result.kupe?.sections[1].rodAt, 2400 - 16 - 400 - 16 - 70);
  // Крыша: сквозные Ø7 под конфирматы перегородки по центру её толщины.
  const roof = part("крыша")!;
  const roofHoles = hardwareHoles(roof.hardware, roof.length, roof.width, 16);
  assert.equal(
    roofHoles.filter(
      (hole) => hole.kind === "face" && hole.diameter === 7 && hole.x === 884,
    ).length,
    3,
  );
  // Перегородка: полкодержатели сквозные, с двух сторон.
  const wall = part("перегородка 1")!;
  const pins = hardwareHoles(wall.hardware, wall.length, wall.width, 16).filter(
    (hole) => hole.kind === "face" && hole.diameter === 5,
  );
  assert.equal(pins.length, (1 + 4 + 1) * 2);

  const fittings = cabinetFittings(kupe, result, 16);
  const count = (key: string) =>
    fittings.find((line) => line.key === key)?.count ?? 0;
  assert.equal(count("kupeRoller"), 2);
  assert.equal(count("topTrack"), 1);
  assert.equal(count("rod"), 1);
  assert.equal(count("rodHolder"), 2);
  // Ручки только на фасадах ящиков, у дверей-купе их нет.
  assert.equal(count("handle"), 2);
  assert.equal(count("hinge"), 0);

  const steps = cabinetAssembly(kupe, result, fittings);
  const used = new Map<string, number>();
  for (const step of steps)
    for (const item of step.fittings)
      used.set(item.label, (used.get(item.label) ?? 0) + item.count);
  for (const line of fittings) assert.equal(used.get(line.label), line.count);
  const shown = new Set(steps.flatMap((step) => step.added));
  for (const entry of result.parts)
    assert.ok(shown.has(partKind(entry.title)), partKind(entry.title));

  const boxes = buildCabinetModel(kupe, 16, result, options);
  const pieces = result.parts.reduce((sum, entry) => sum + entry.quantity, 0);
  // + задняя стенка, 2 дна ящиков, штанга.
  assert.equal(boxes.length, pieces + 1 + 2 + 1);
  const { min, max } = bounds(boxes);
  assert.equal(min[0], 0);
  assert.equal(max[0], 1800);
});

test("kupe with three doors keeps the doors inside the width", () => {
  const kupe = {
    kind: "kupe" as const,
    ...CABINET_KINDS.kupe.defaults,
    width: 2400,
    slidingDoors: 3 as const,
  };
  const result = buildCabinet(kupe, 16);
  assert.equal(result.kupe?.sections.length, 3);
  assert.equal(result.kupe?.partitions.length, 2);
  const door = result.parts.find((part) => /дверь купе/.test(part.title))!;
  assert.equal(door.quantity, 3);
  assert.ok(Math.abs(3 * door.width - 2 * 25 - 2400) < 0.5);
});
