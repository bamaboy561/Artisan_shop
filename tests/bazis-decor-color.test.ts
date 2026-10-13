import assert from "node:assert/strict";
import test from "node:test";

import { guessDecorColor } from "../features/bazis/decor-color";

const brightness = (name: string) => {
  const color = guessDecorColor(name);

  assert.ok(color, `нет цвета для «${name}»`);

  return (color[0] + color[1] + color[2]) / 3;
};

test("decor colour follows the material name", () => {
  assert.ok(brightness("ЛДСП 16 мм Белый шагрень") > 220);
  assert.ok(brightness("ДВП ламинированная белая") > 220);
  assert.ok(brightness("Kronospan — Дуб венге 18 мм") < 80);
  assert.ok(brightness("ЛДСП Графит") < 120);
  assert.ok(brightness("ЛДСП 16 мм Кашемир") > 150);
});

test("unknown names keep the default palette", () => {
  assert.equal(guessDecorColor("Материал 7"), null);
  assert.equal(guessDecorColor(""), null);
});
