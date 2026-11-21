import assert from "node:assert/strict";
import test from "node:test";

import {
  cabinetAssembly,
  cabinetFittings,
} from "../features/constructor/assembly";
import {
  buildCabinet,
  CABINET_KINDS,
  type CabinetSpec,
} from "../features/services/cabinet-builder";
import { hardwareHoles } from "../features/services/drilling-hardware";
import {
  buildKitchen,
  KITCHEN_DEFAULTS,
} from "../features/services/kitchen-builder";
import { kitchenFittings } from "../features/constructor/assembly";

// Тумба 600 × 720 × 560 с тремя ящиками без дверей.
const base: CabinetSpec = {
  kind: "base",
  ...CABINET_KINDS.base.defaults,
  width: 600,
  height: 720,
  depth: 560,
  plinth: 0,
  doors: 0,
  drawers: 3,
};

const sides = (spec: CabinetSpec, t = 16) =>
  buildCabinet(spec, t).parts.find((part) =>
    part.title.endsWith("ящик боковина"),
  )!;
const walls = (spec: CabinetSpec, t = 16) =>
  buildCabinet(spec, t).parts.find((part) =>
    part.title.endsWith("ящик стенка"),
  )!;

test("ball runners keep the old box: opening − 26, full slide length", () => {
  const result = buildCabinet(base, 16);
  assert.equal(result.drawers?.system, "ball");
  assert.equal(result.drawers?.slide, 550);
  assert.equal(result.drawers?.boxWidth, 568 - 26);
  assert.equal(sides(base).length, 550);
});

test("Hettich YOU undermount: inside width opening − 42, box NL − 10", () => {
  const spec = {
    ...base,
    hardware: { drawers: "hettich-quadro-v6-you" as const },
  };
  const result = buildCabinet(spec, 16);
  // Глубина 560: самая длинная Quadro V6 YOU M в магазине — 500.
  assert.equal(result.drawers?.slide, 500);
  assert.equal(result.drawers?.boxLength, 490);
  // Внутри 568 − 42 = 526, снаружи + две боковины по 16.
  assert.equal(result.drawers?.boxWidth, 558);
  assert.equal(sides(spec).length, 490);
  assert.equal(walls(spec).length, 526);
  assert.deepEqual(result.drawers?.bottom, { length: 490, width: 558 });
  assert.deepEqual(result.problems, []);
});

test("Hettich YOU refuses drawer sides thicker than 16 mm", () => {
  const spec = { ...base, hardware: { drawers: "hettich-actro-you" as const } };
  const result = buildCabinet(spec, 18);
  assert.ok(result.problems.some((problem) => /до 16 мм/.test(problem)));
});

test("Samet SMART: inside width opening − 45, − 46 for 19 mm board", () => {
  const spec = { ...base, hardware: { drawers: "samet-smart" as const } };
  assert.equal(buildCabinet(spec, 16).drawers?.boxWidth, 568 - 45 + 32);
  const thick = buildCabinet(spec, 19);
  assert.equal(thick.drawers?.boxWidth, 600 - 38 - 46 + 38);
});

test("runner length follows the system's lengths and depth reserve", () => {
  // Samet SO-CLASS — до 500 мм, хотя корпус берёт 550.
  const so = buildCabinet(
    { ...base, hardware: { drawers: "samet-so-class" } },
    16,
  );
  assert.equal(so.drawers?.slide, 500);
  // Hettich YOU: глубина от NL + 3. 503 хватает на 500, 502 — нет.
  const you = {
    ...base,
    hardware: { drawers: "hettich-quadro-v6-you" as const },
  };
  assert.equal(buildCabinet({ ...you, depth: 503 }, 16).drawers?.slide, 500);
  assert.equal(buildCabinet({ ...you, depth: 502 }, 16).drawers?.slide, 450);
});

test("undermount fittings: left and right runners and catches as separate lines", () => {
  const spec = { ...base, hardware: { drawers: "hettich-actro-you" as const } };
  const result = buildCabinet(spec, 16);
  const lines = cabinetFittings(spec, result, 16);
  const line = (key: string) => lines.find((item) => item.key === key)!;
  assert.match(line("slide").label, /Actro YOU.*левая/);
  assert.match(line("slide").note, /скрытого монтажа, по одной на ящик/);
  assert.equal(line("slide").count, 3);
  assert.equal(line("slideRight").count, 3);
  const left =
    "Hettich Направляющие полного выдвижения Actro YOU L 40 кг 450 мм левый";
  const right =
    "Hettich Направляющие полного выдвижения Actro YOU L 40 кг 450 мм правый";
  assert.ok(line("slide").search.test(left));
  assert.ok(!line("slide").search.test(right));
  assert.ok(line("slideRight").search.test(right));
  assert.ok(
    !line("slide").search.test(
      "Hettich Фиксатор Actro YOU для деревянных ящиков левый",
    ),
  );
  // Фиксаторы: левый и правый — разные товары, по одному на ящик.
  assert.equal(line("drawerCatch").count, 3);
  assert.equal(line("drawerCatchRight").count, 3);
  assert.ok(
    line("drawerCatchRight").search.test(
      "Hettich Фиксатор Actro YOU для деревянных ящиков правый 9320332",
    ),
  );
  assert.ok(
    !line("drawerCatch").search.test(
      "Hettich Фиксатор Actro YOU для деревянных ящиков правый 9320332",
    ),
  );
  const steps = cabinetAssembly(spec, result, lines);
  const runners = steps.find((step) => /направляющие/.test(step.title))!;
  assert.match(runners.text, /фиксаторы/);
  assert.equal(
    runners.fittings.filter((item) => /Фиксатор/.test(item.label)).length,
    2,
  );
});

test("kitchen sums left and right lines once", () => {
  const kitchen = buildKitchen(
    {
      ...KITCHEN_DEFAULTS,
      hardware: { drawers: "hettich-quadro-v6-you" },
    },
    16,
  );
  const lines = kitchenFittings(kitchen, 16);
  const keys = lines.map((line) => line.key);
  assert.equal(new Set(keys).size, keys.length);
  const left = lines.find((line) => line.key === "slide")!;
  assert.equal(
    lines.find((line) => line.key === "slideRight")?.count,
    left.count,
  );
});

test("hinge system sets the cup drilling depth and adds plates", () => {
  const wall: CabinetSpec = { kind: "wall", ...CABINET_KINDS.wall.defaults };
  const cupDepth = (spec: CabinetSpec) => {
    const result = buildCabinet(spec, 16);
    const door = result.parts.find((part) => /: дверь/.test(part.title))!;
    const cups = hardwareHoles(
      door.hardware!,
      door.length,
      door.width,
      16,
    ).filter((hole) => hole.diameter === 35);
    return cups[0].depth;
  };
  assert.equal(cupDepth(wall), 13);
  assert.equal(cupDepth({ ...wall, hardware: { hinges: "samet-star" } }), 11.5);
  const spec = { ...wall, hardware: { hinges: "hettich-sensys" as const } };
  const lines = cabinetFittings(spec, buildCabinet(spec, 16), 16);
  const hinges = lines.find((line) => line.key === "hinge")!;
  assert.match(hinges.label, /Sensys/);
  assert.equal(
    lines.find((line) => line.key === "hingePlate")?.count,
    hinges.count,
  );
  // Sensys — двери от 15 мм.
  assert.ok(
    buildCabinet(spec, 10).problems.some((problem) => /15–24/.test(problem)),
  );
});

test("shelf supports change the product, not the drilling", () => {
  const wardrobe: CabinetSpec = {
    kind: "wardrobe",
    ...CABINET_KINDS.wardrobe.defaults,
  };
  const spec = { ...wardrobe, hardware: { shelves: "if-flipper" as const } };
  const plain = cabinetFittings(wardrobe, buildCabinet(wardrobe, 16), 16);
  const flipper = cabinetFittings(spec, buildCabinet(spec, 16), 16);
  const pin = (lines: typeof plain) =>
    lines.find((line) => line.key === "shelfPin")!;
  assert.equal(pin(flipper).count, pin(plain).count);
  assert.match(pin(flipper).label, /FLIPPER/);
});

test("kitchen passes hardware to every module and sizes the lift", () => {
  const kitchen = buildKitchen(
    {
      ...KITCHEN_DEFAULTS,
      hardware: { drawers: "hettich-quadro-v6-you", lift: "samet-multi-mech" },
    },
    16,
  );
  const drawers = kitchen.modules.find((item) => item.result?.drawers);
  assert.equal(drawers?.result?.drawers?.system, "hettich-quadro-v6-you");
  const lines = kitchenFittings(kitchen, 16);
  const lift = lines.find((line) => line.key === "lift")!;
  assert.match(lift.label, /MULTI MECH/);
  assert.match(lift.note, /размер 237/);
  assert.match(
    lines.find((line) => line.key === "slide")!.label,
    /Quadro V6 YOU/,
  );
});
