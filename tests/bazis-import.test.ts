import assert from "node:assert/strict";
import test from "node:test";

import {
  bazisRowToDetail,
  groupBazisRowsByMaterial,
  type BazisImportRow,
} from "../features/services/bazis-import";

const row = (overrides: Partial<BazisImportRow>): BazisImportRow => ({
  name: "Полка",
  position: "5",
  material: "ЛДСП 16 мм Кашемир",
  thickness: 16,
  length: 800,
  width: 300,
  quantity: 2,
  edgedLengthSides: 1,
  edgedWidthSides: 0,
  complexContour: false,
  ...overrides,
});

test("кромка по сторонам переходит в стороны калькулятора", () => {
  assert.deepEqual(bazisRowToDetail(row({})).edgedSides, ["top"]);
  assert.deepEqual(
    bazisRowToDetail(row({ edgedLengthSides: 2, edgedWidthSides: 2 }))
      .edgedSides,
    ["top", "right", "bottom", "left"],
  );
  assert.deepEqual(
    bazisRowToDetail(row({ edgedLengthSides: 0, edgedWidthSides: 1 }))
      .edgedSides,
    ["right"],
  );
});

test("название с позицией и пометкой сложного контура, размеры целые", () => {
  const detail = bazisRowToDetail(
    row({ complexContour: true, length: 799.6, width: 300.2 }),
  );
  assert.equal(detail.title, "Полка (поз. 5), сложный контур");
  assert.equal(detail.length, 800);
  assert.equal(detail.width, 300);
});

test("детали делятся по материалу, самый большой первым", () => {
  const groups = groupBazisRowsByMaterial([
    row({ material: "ДВП белая", thickness: 3, length: 500, width: 400 }),
    row({ quantity: 4 }),
    row({ quantity: 1, complexContour: true }),
    row({ length: 0 }),
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].material, "ЛДСП 16 мм Кашемир");
  assert.equal(groups[0].pieces, 5);
  assert.equal(groups[0].complexCount, 1);
  assert.equal(groups[0].areaM2, 1.2);
  assert.equal(groups[1].details.length, 1);
});
