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
  kupeSchemeSections,
  KUPE_SCHEMES,
  KUPE_SECTION_TEMPLATES,
  slideKupeDoor,
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

test("drawers under doors: hinge plates move up with the doors", () => {
  const spec = { ...wardrobe, drawers: 2 };
  const result = buildCabinet(spec, 16);
  const side = result.parts.find((part) => /боковина левая/.test(part.title))!;
  const plates = side.hardware!.filter((item) => item.kind === "hingePlate");
  const doorBottom = 2100 - result.doorHeight;
  assert.equal(plates[0].offset, doorBottom + 100);
  assert.equal(plates[plates.length - 1].offset, 2100 - 100);
});

test("kupe: antresol, two rods, drawers between spacers", () => {
  const kupe = { kind: "kupe" as const, ...CABINET_KINDS.kupe.defaults };
  const result = buildCabinet(kupe, 16);
  assert.deepEqual(result.problems, []);
  const part = (kind: string) =>
    result.parts.find((entry) => partKind(entry.title) === kind);
  // 1800 − 2·16 − 16 = 1752 → две секции по 876, перегородка с 892.
  assert.deepEqual(result.kupe?.partitions, [892]);
  assert.equal(part("перегородка 1")?.length, 2400 - 70 - 32);
  // Двери: (1800 + 25) / 2, высота 2400 − 70 − 40, без присадки.
  assert.equal(part("дверь купе")?.quantity, 2);
  assert.equal(part("дверь купе")?.width, 912.5);
  assert.equal(part("дверь купе")?.length, 2290);
  assert.equal(part("дверь купе")?.hardware, undefined);
  // Секция 1: 2 ящика, полка над ними, 3 полки, антресоль.
  assert.equal(part("полка над ящиками, секция 1")?.quantity, 1);
  assert.equal(part("полка, секция 1")?.quantity, 3);
  assert.equal(part("полка антресоли, секция 1")?.length, 874);
  // Секция 2: антресоль на 400 мм ниже крыши, средняя полка, 2 штанги.
  const second = result.kupe!.sections[1];
  assert.deepEqual(
    second.zones.map((zone) => zone.kind),
    ["antresol", "rod", "rod"],
  );
  assert.deepEqual(
    second.shelves.map((shelf) => shelf.at),
    [1019, 2400 - 16 - 400 - 16],
  );
  assert.deepEqual(second.rods, [1898, 949]);
  // Проём левой двери до 887,5, секция до 892: проставка справа 16 мм.
  const box = result.kupe!.sections[0].drawer!;
  assert.equal(box.spacerLeft, 0);
  assert.equal(box.spacerRight, 16);
  assert.equal(part("фасад ящика, секция 1")?.width, 856);
  assert.ok(box.frontLeft + box.frontWidth <= 887.5 - 5);
  assert.equal(part("проставка ящиков, секция 1")?.quantity, 1);
  assert.equal(result.drawers?.slide, 500);
  // Крыша: сквозные Ø7 под конфирматы перегородки по центру её толщины.
  const roof = part("крыша")!;
  const roofHoles = hardwareHoles(roof.hardware, roof.length, roof.width, 16);
  assert.equal(
    roofHoles.filter(
      (hole) => hole.kind === "face" && hole.diameter === 7 && hole.x === 884,
    ).length,
    3,
  );
  // Перегородка: полкодержатели сквозные, общая высота антресоли — одна.
  const wall = part("перегородка 1")!;
  const pins = hardwareHoles(wall.hardware, wall.length, wall.width, 16).filter(
    (hole) => hole.kind === "face" && hole.diameter === 5,
  );
  assert.equal(pins.length, 6 * 2);

  const fittings = cabinetFittings(kupe, result, 16);
  const count = (key: string) =>
    fittings.find((line) => line.key === key)?.count ?? 0;
  assert.equal(count("kupeRoller"), 2);
  assert.equal(count("topTrack"), 1);
  assert.equal(count("rod"), 2);
  assert.equal(count("rodHolder"), 4);
  assert.equal(count("shelfPin"), (1 + 3 + 1 + 1 + 1) * 4);
  assert.equal(count("spacerScrew"), 4);
  // Ручки только на фасадах ящиков, у дверей-купе их нет.
  assert.equal(count("handle"), 2);
  assert.equal(count("hinge"), 0);

  const steps = cabinetAssembly(kupe, result, fittings);
  const used = new Map<string, number>();
  for (const step of steps)
    for (const item of step.fittings)
      used.set(item.label, (used.get(item.label) ?? 0) + item.count);
  for (const line of fittings) assert.equal(used.get(line.label), line.count);
  const added = new Set(steps.flatMap((step) => step.added));
  for (const entry of result.parts)
    assert.ok(added.has(partKind(entry.title)), partKind(entry.title));

  const boxes = buildCabinetModel(kupe, 16, result, options);
  for (const entry of boxes)
    assert.ok(
      added.has(partKind(entry.info?.name ?? "")) ||
        partKind(entry.info?.name ?? "") === "задняя стенка",
      entry.info?.name,
    );
  const pieces = result.parts.reduce((sum, entry) => sum + entry.quantity, 0);
  // + задняя стенка, 2 дна ящиков, 2 штанги.
  assert.equal(boxes.length, pieces + 1 + 2 + 2);
  const { min, max } = bounds(boxes);
  assert.equal(min[0], 0);
  assert.equal(max[0], 1800);
});

test("kupe: own section widths, rod with trousers, shoes, four doors", () => {
  const kupe = {
    kind: "kupe" as const,
    ...CABINET_KINDS.kupe.defaults,
    width: 2800,
    slidingDoors: 4 as const,
    sections: [
      {
        width: 564,
        fill: "rodShelves" as const,
        shelves: 2,
        drawers: 0,
        shoes: true,
      },
      { width: 764, fill: "twoRods" as const, shelves: 0, drawers: 0 },
      { fill: "rodTrousers" as const, shelves: 0, drawers: 3 },
      { width: 564, fill: "shelves" as const, shelves: 5, drawers: 0 },
    ],
  };
  const result = buildCabinet(kupe, 16);
  const sections = result.kupe!.sections;
  assert.deepEqual(
    sections.map((section) => section.width),
    [564, 764, 2800 - 32 - 48 - 564 - 764 - 564, 564],
  );
  assert.equal(sections[0].shelves[0].kind, "полка для обуви");
  assert.equal(sections[2].trousers.length, 1);
  const door = result.parts.find((part) => /дверь купе/.test(part.title))!;
  assert.equal(door.quantity, 4);
  assert.ok(Math.abs(4 * door.width - 3 * 25 - 2800) < 0.5);
  const fittings = cabinetFittings(kupe, result, 16);
  assert.equal(fittings.find((line) => line.key === "trousers")?.count, 1);
  const steps = cabinetAssembly(kupe, result, fittings);
  const added = new Set(steps.flatMap((step) => step.added));
  for (const entry of result.parts)
    assert.ok(added.has(partKind(entry.title)), partKind(entry.title));
  // Ящики третьей секции проходят в проём своей двери.
  const box = sections[2].drawer!;
  const doorWidth = door.width;
  const windows = [0, 1, 2, 3].map((j) => [
    j * (doorWidth - 25) + (j > 0 ? 25 : 0),
    j * (doorWidth - 25) + doorWidth - (j < 3 ? 25 : 0),
  ]);
  assert.ok(
    windows.some(
      ([from, to]) =>
        box.frontLeft >= from && box.frontLeft + box.frontWidth <= to,
    ),
  );
});

test("kupe with three doors keeps the doors inside the width", () => {
  const kupe = {
    kind: "kupe" as const,
    ...CABINET_KINDS.kupe.defaults,
    width: 2400,
    slidingDoors: 3 as const,
    sections: undefined,
  };
  const result = buildCabinet(kupe, 16);
  assert.equal(result.kupe?.sections.length, 3);
  assert.equal(result.kupe?.partitions.length, 2);
  const door = result.parts.find((part) => /дверь купе/.test(part.title))!;
  assert.equal(door.quantity, 3);
  assert.ok(Math.abs(3 * door.width - 2 * 25 - 2400) < 0.5);
});

test("kupe shelf pins: four per shelf even when partition holes are shared", () => {
  const kupe = {
    kind: "kupe" as const,
    ...CABINET_KINDS.kupe.defaults,
    antresol: false,
    sections: [
      { fill: "shelves" as const, shelves: 4, drawers: 0 },
      { fill: "shelves" as const, shelves: 4, drawers: 0 },
    ],
  };
  const result = buildCabinet(kupe, 16);
  const fittings = cabinetFittings(kupe, result, 16);
  assert.equal(fittings.find((line) => line.key === "shelfPin")?.count, 8 * 4);
  assert.equal(result.drawers, null);
  assert.ok(!result.parts.some((part) => /проставка/.test(part.title)));
});

test("двери-купе сдвигаются по своим дорожкам и не проходят друг через друга", () => {
  // Две двери 912 мм с перехлёстом 25: передняя (правая) уезжает влево,
  // задняя (левая) — вправо за переднюю.
  const two = { count: 2, width: 912, overlap: 25 };
  assert.deepEqual(slideKupeDoor(two, [0, 0], 1), [0, -887]);
  assert.deepEqual(slideKupeDoor(two, [0, 0], 0), [887, 0]);
  assert.deepEqual(slideKupeDoor(two, [887, 0], 0), [0, 0]);
  // Левая открыта, сдвигаем правую: левая сначала встаёт на место.
  assert.deepEqual(slideKupeDoor(two, [887, 0], 1), [0, -887]);

  // Три двери: средняя передняя едет влево, крайние задние — к середине,
  // но за среднюю, не налезая друг на друга.
  const three = { count: 3, width: 800, overlap: 25 };
  assert.deepEqual(slideKupeDoor(three, [0, 0, 0], 1), [0, -775, 0]);
  // Задние упираются друг в друга: проехать могут 750 мм из 775.
  assert.deepEqual(slideKupeDoor(three, [0, 0, 0], 2), [0, 0, -750]);
  assert.deepEqual(slideKupeDoor(three, [0, 0, 0], 0), [750, 0, 0]);
  // Правая задняя уже сдвинута влево: левой ехать некуда.
  assert.deepEqual(slideKupeDoor(three, [0, 0, -750], 0), [0, 0, -750]);

  // Четыре двери: открыть все передние, затем закрыть дверь 2, на место
  // которой заехала дверь 0, — дверь 0 тоже возвращается.
  const four = { count: 4, width: 600, overlap: 25 };
  let shifts = slideKupeDoor(four, [0, 0, 0, 0], 1);
  shifts = slideKupeDoor(four, shifts, 3);
  assert.deepEqual(shifts, [0, -575, 0, -575]);
  shifts = slideKupeDoor(four, [0, 0, 0, 0], 2);
  shifts = slideKupeDoor(four, shifts, 0);
  assert.deepEqual(shifts, [575, 0, 575, 0]);
  assert.deepEqual(slideKupeDoor(four, shifts, 2), [0, 0, 0, 0]);
});

test("купе: двери вне пределов Hettich TopLine L — предупреждение", () => {
  const narrow = buildCabinet(
    {
      ...CABINET_KINDS.kupe.defaults,
      kind: "kupe",
      width: 1000,
      slidingDoors: 3,
    },
    16,
  );
  assert.ok(narrow.problems.some((text) => /от 500 до 1500/.test(text)));
  const ok = buildCabinet({ ...CABINET_KINDS.kupe.defaults, kind: "kupe" }, 16);
  assert.ok(!ok.problems.some((text) => /TopLine/.test(text)));
});

test("купе: зоны секции сверху вниз — колонки, выдвижные полки, ящики посередине, брючница, обувь", () => {
  const kupe = {
    kind: "kupe" as const,
    ...CABINET_KINDS.kupe.defaults,
    width: 2400,
    slidingDoors: 3 as const,
    sections: [
      {
        zones: [
          { kind: "antresol" as const, height: 400 },
          { kind: "split" as const, count: 2, height: 700 },
          { kind: "trays" as const, count: 2 },
          { kind: "drawers" as const, count: 2 },
          { kind: "shoes" as const, count: 1 },
        ],
      },
      {
        zones: [
          { kind: "antresol" as const, height: 400 },
          { kind: "rod" as const },
          { kind: "trousers" as const, height: 800 },
        ],
      },
      {
        zones: [
          { kind: "antresol" as const, height: 400 },
          { kind: "shelves" as const, count: 2 },
          { kind: "split" as const, count: 1 },
        ],
      },
    ],
  };
  const result = buildCabinet(kupe, 16);
  assert.deepEqual(result.problems, []);
  const [first, second, third] = result.kupe!.sections;
  // Зоны занимают всю высоту внутри: сверху крыша, снизу дно.
  const bottomTop = 70 + 16;
  for (const section of [first, second, third]) {
    const last = section.zones[section.zones.length - 1];
    assert.ok(Math.abs(last.from - bottomTop) < 0.2);
    assert.ok(
      Math.abs(section.zones[0].from + section.zones[0].height - 2384) < 0.2,
    );
  }
  // Секция 1: стойка в зоне колонок, по 2 полки в каждой колонке.
  assert.equal(first.stands.length, 1);
  assert.equal(first.stands[0].height, 700);
  assert.equal(
    first.shelves.filter((shelf) => shelf.kind === "полка в колонке").length,
    4,
  );
  assert.equal(first.trays, 2);
  assert.equal(first.drawers, 2);
  // Ящики над обувью: фасады от полки над обувью.
  const shoeZone = first.zones[4];
  assert.equal(
    first.drawer!.frontsAt[0],
    round1(shoeZone.from + shoeZone.height + 16 + 3),
  );
  // Секция 2: штанга под антресолью, брючница под полкой над ней.
  assert.equal(second.trousers.length, 1);
  assert.equal(second.rods.length, 1);
  // Секция 3: стойка стоит на дне — в дне сквозное Ø7 под неё.
  assert.equal(third.stands[0].at, bottomTop);
  const part = (kind: string) =>
    result.parts.find((entry) => partKind(entry.title) === kind);
  assert.equal(part("выдвижная полка боковина, секция 1")?.width, 80);
  assert.equal(part("проставка выдвижных полок, секция 1")?.width, 300);
  assert.ok(part("полка со стойкой, секция 1"));
  const bottom = part("дно")!;
  const holes = hardwareHoles(bottom.hardware, bottom.length, bottom.width, 16);
  const standX = third.stands[0].left + 8 - 16;
  assert.ok(
    holes.some(
      (hole) =>
        hole.kind === "face" &&
        hole.diameter === 7 &&
        Math.abs(hole.x - standX) < 0.2,
    ),
  );

  const fittings = cabinetFittings(kupe, result, 16);
  const count = (key: string) =>
    fittings.find((line) => line.key === key)?.count ?? 0;
  assert.equal(count("slide"), 4);
  assert.equal(count("handle"), 2);
  assert.equal(count("trousers"), 1);
  const steps = cabinetAssembly(kupe, result, fittings);
  const used = new Map<string, number>();
  for (const step of steps)
    for (const item of step.fittings)
      used.set(item.label, (used.get(item.label) ?? 0) + item.count);
  for (const line of fittings)
    assert.equal(used.get(line.label), line.count, line.label);
  const added = new Set(steps.flatMap((step) => step.added));
  for (const entry of result.parts)
    assert.ok(added.has(partKind(entry.title)), partKind(entry.title));
  const boxes = buildCabinetModel(kupe, 16, result, options);
  for (const entry of boxes)
    assert.ok(
      added.has(partKind(entry.info?.name ?? "")) ||
        partKind(entry.info?.name ?? "") === "задняя стенка",
      entry.info?.name,
    );
});

test("купе: схемы с фото собираются без ошибок на ширине 1400–2700", () => {
  for (const scheme of KUPE_SCHEMES) {
    const width = scheme.sections.length > 2 ? 2700 : 1400;
    const kupe = {
      kind: "kupe" as const,
      ...CABINET_KINDS.kupe.defaults,
      width,
      slidingDoors: (scheme.sections.length > 2 ? 3 : 2) as 2 | 3,
      sections: kupeSchemeSections(scheme, width, 16),
    };
    const result = buildCabinet(kupe, 16);
    assert.deepEqual(result.problems, [], scheme.label);
  }
  for (const template of KUPE_SECTION_TEMPLATES) {
    const kupe = {
      kind: "kupe" as const,
      ...CABINET_KINDS.kupe.defaults,
      width: 1400,
      // По секции на дверь: ящики выходят в проём своей двери.
      sections: [{ zones: template.zones }, { zones: template.zones }],
    };
    assert.deepEqual(buildCabinet(kupe, 16).problems, [], template.label);
  }
});

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

test("купе: стойка колонок — отверстия в дне по её глубине, разные стойки отдельно", () => {
  const kupe = {
    kind: "kupe" as const,
    ...CABINET_KINDS.kupe.defaults,
    sections: [
      {
        zones: [
          { kind: "split" as const, count: 1, height: 700 },
          { kind: "split" as const, count: 2, height: 700 },
          { kind: "split" as const, count: 1 },
        ],
      },
      { zones: [{ kind: "rod" as const }] },
    ],
  };
  const result = buildCabinet(kupe, 16);
  const section = result.kupe!.sections[0];
  const stands = result.parts.filter((part) => /: стойка/.test(part.title));
  // Три стойки: 700 с 1 полкой, 700 с 2 полками, остаток — разные строки.
  assert.equal(stands.length, 3);
  assert.equal(
    stands.reduce((sum, part) => sum + part.quantity, 0),
    section.stands.length,
  );
  // Отверстия стойки в торце совпадают с отверстиями в дне.
  const bottomStand = section.stands.find((stand) => stand.at === 86)!;
  const standPart = result.parts.find(
    (part) => partKind(part.title) === `${bottomStand.kind}, секция 1`,
  )!;
  const edge = hardwareHoles(
    standPart.hardware,
    standPart.length,
    standPart.width,
    16,
  ).flatMap((hole) =>
    hole.kind === "edge" && hole.side === "left"
      ? [Math.round(hole.position)]
      : [],
  );
  const bottom = result.parts.find((part) => partKind(part.title) === "дно")!;
  const x = bottomStand.left + 8 - 16;
  const face = hardwareHoles(bottom.hardware, bottom.length, bottom.width, 16)
    .flatMap((hole) =>
      hole.kind === "face" &&
      hole.diameter === 7 &&
      Math.abs(hole.x - x) < 0.2
        ? [Math.round(hole.y)]
        : [],
    );
  assert.ok(edge.length > 0);
  for (const y of edge) assert.ok(face.includes(y), `${y} in ${face}`);
});
