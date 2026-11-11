import assert from "node:assert/strict";
import test from "node:test";

import {
  matchMaterialToPreset,
  rankPresetsForMaterial,
  type MatchablePreset,
} from "../features/services/bazis-material-match";

const preset = (
  id: string,
  materialName: string,
  materialId: string,
  thicknessMm: number,
  sku = "",
): MatchablePreset => ({
  id,
  label: materialName,
  sku,
  materialName,
  materialId,
  thicknessMm,
});

const presets: MatchablePreset[] = [
  preset("manual:ldsp-16:2800x2070", "ЛДСП 16 мм", "ldsp-16", 16),
  preset("manual:ldsp-18:2800x2070", "ЛДСП 18 мм", "ldsp-18", 18),
  preset("manual:mdf-16:2800x2070", "МДФ 16 мм", "mdf-16", 16),
  preset("hpl-white-4", "HPL Белый 4 мм", "hpl-4", 4),
  preset(
    "kashemir-16",
    "ЛДСП Кашемир U6933 VL 16 мм 2750×1830",
    "ldsp-16",
    16,
    "U6933VL",
  ),
  preset("kashemir-18", "ЛДСП Кашемир U6933 VL 18 мм", "ldsp-18", 18),
  preset(
    "oak-4429",
    "ЛДСП Дуб серо-бежевый 4429 OW 16 мм 2800×2070",
    "ldsp-16",
    16,
  ),
  preset("satin-16", "ЛДСП Сатин 16 мм 3050×1220", "ldsp-16", 16),
];

test("материал находится по коду декора и толщине", () => {
  assert.deepEqual(matchMaterialToPreset("Кашемир U6933 VL", 16, presets), {
    presetId: "kashemir-16",
    confidence: "code",
  });
  assert.deepEqual(
    matchMaterialToPreset("Серо бежевый дуб 4429 OW", 16, presets),
    { presetId: "oak-4429", confidence: "code" },
  );
});

test("материал находится по названию", () => {
  assert.deepEqual(matchMaterialToPreset("ЛДСП 16 мм Кашемир", 16, presets), {
    presetId: "kashemir-16",
    confidence: "name",
  });
  assert.deepEqual(matchMaterialToPreset("САТИН", 16, presets), {
    presetId: "satin-16",
    confidence: "name",
  });
});

test("толщина не совпала: другой материал не подставляется", () => {
  assert.deepEqual(
    matchMaterialToPreset("Кашемир U6933 VL", 18, presets).presetId,
    "kashemir-18",
  );
});

test("ДВП и тонкий лист не попадают на HPL", () => {
  assert.deepEqual(
    matchMaterialToPreset("ДВП ламинированная белая", 3, presets),
    { presetId: null, confidence: "none" },
  );
  assert.deepEqual(matchMaterialToPreset("Белый_4.0", 4, presets), {
    presetId: null,
    confidence: "none",
  });
});

test("без названия на сайте берётся общий материал той же толщины", () => {
  assert.deepEqual(matchMaterialToPreset("Венге Цаво", 16, presets), {
    presetId: "manual:ldsp-16:2800x2070",
    confidence: "thickness",
  });
  assert.equal(
    matchMaterialToPreset("Венге Цаво", 16, presets, "satin-16").presetId,
    "satin-16",
  );
  assert.equal(
    matchMaterialToPreset("Венге Цаво", 16, presets, "kashemir-18").presetId,
    "manual:ldsp-16:2800x2070",
  );
});

test("в списке выбора остаются только подходящие по толщине", () => {
  const ids = rankPresetsForMaterial("Кашемир U6933 VL", 16, presets).map(
    (item) => item.preset.id,
  );
  assert.equal(ids[0], "kashemir-16");
  assert.ok(!ids.includes("kashemir-18"));
  assert.ok(!ids.includes("hpl-white-4"));
});

test("МДФ и ДВП по-русски не подменяются на ЛДСП", () => {
  assert.deepEqual(matchMaterialToPreset("МДФ 16 мм", 16, presets), {
    presetId: "manual:mdf-16:2800x2070",
    confidence: "thickness",
  });
  assert.equal(
    matchMaterialToPreset("ДВП белая", 6, [
      preset("manual:mdf-6:2800x2070", "МДФ 6 мм", "mdf-6", 6),
    ]).presetId,
    null,
  );
});

test("в таблице без колонки толщины толщина берётся из названия", () => {
  assert.deepEqual(
    matchMaterialToPreset("ЛДСП Кашемир U6933 18 мм", 0, presets),
    { presetId: "kashemir-18", confidence: "code" },
  );
});
