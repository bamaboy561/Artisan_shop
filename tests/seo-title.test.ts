import assert from "node:assert/strict";
import test from "node:test";

import { isSpammySeoTitle } from "../lib/seo";

test("keyword-stuffed titles are rejected, normal ones kept", () => {
  assert.equal(
    isSpammySeoTitle("ЛДСП Бишкек большой формат акция дешево выгодно"),
    true,
  );
  assert.equal(isSpammySeoTitle("Фурнитура недорого"), true);
  assert.equal(
    isSpammySeoTitle("ЛДСП в Бишкеке — каталог, наличие и распил"),
    false,
  );
  assert.equal(
    isSpammySeoTitle("Дуб Коми 2.75*1.83 — Swiss Krono — ЛДСП в Бишкеке"),
    false,
  );
  assert.equal(isSpammySeoTitle("МДФ панели"), false);
});
