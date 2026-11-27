import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSeasonMode, resolveSeason } from "../lib/season";

// Время Бишкека = UTC+6.
const at = (iso: string) => new Date(iso);

test("авто: включено с 1 декабря по 14 января по времени Бишкека", () => {
  assert.equal(resolveSeason("auto", at("2026-11-30T17:59:00Z")), null);
  assert.equal(
    resolveSeason("auto", at("2026-11-30T18:00:00Z"))?.greeting,
    "С наступающим 2027 годом!",
  );
  assert.equal(
    resolveSeason("auto", at("2027-01-01T00:00:00Z"))?.greeting,
    "С Новым 2027 годом!",
  );
  assert.ok(resolveSeason("auto", at("2027-01-14T17:00:00Z")));
  assert.equal(resolveSeason("auto", at("2027-01-14T18:00:00Z")), null);
});

test("вручную: on всегда, off никогда", () => {
  assert.equal(
    resolveSeason("on", at("2026-11-27T10:00:00Z"))?.greeting,
    "С наступающим 2027 годом!",
  );
  assert.equal(resolveSeason("off", at("2026-12-20T10:00:00Z")), null);
});

test("неизвестное значение считается авто", () => {
  assert.equal(normalizeSeasonMode("winter"), "auto");
  assert.equal(normalizeSeasonMode(undefined), "auto");
  assert.equal(normalizeSeasonMode("off"), "off");
});
