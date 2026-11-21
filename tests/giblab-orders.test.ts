import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyGibLabProject,
  gibLabOrderFileName,
  gibLabOrderFolder,
  normalizeGibLabOrderSettings,
  parseGibLabOrderSettings,
} from "../features/production/giblab-orders";

test("order folder follows the operator's year\\month\\DD-MM layout in Bishkek time", () => {
  assert.equal(
    gibLabOrderFolder(new Date("2026-11-21T08:00:00Z")),
    "2026\\Ноябрь\\21-11",
  );
  // 20:30 UTC = 02:30 next day in Bishkek
  assert.equal(
    gibLabOrderFolder(new Date("2026-12-31T20:30:00Z")),
    "2027\\Январь\\01-01",
  );
  assert.equal(
    gibLabOrderFolder(new Date("2026-11-09T05:00:00Z")),
    "2026\\Ноябрь\\09-11",
  );
});

test("order file name starts with the request number and is safe for Windows", () => {
  assert.equal(
    gibLabOrderFileName({
      number: "R-2045",
      id: "x",
      contactName: "Алишер",
      contactPhone: "+996 (703) 981-048",
    }),
    "R-2045 Алишер 0703981048.project",
  );
  assert.equal(
    gibLabOrderFileName({
      number: null,
      id: "abcdefgh123",
      contactName: 'ООО "Мебель/Дом"?',
      contactPhone: "",
    }),
    "ABCDEFGH ООО Мебель Дом.project",
  );
});

test("settings default to the photo path and creating on a new request", () => {
  const settings = parseGibLabOrderSettings(null);
  assert.equal(settings.root, "D:\\GibLabLocal\\projects");
  assert.equal(settings.trigger, "new");
  assert.equal(
    normalizeGibLabOrderSettings({
      enabled: true,
      root: " ",
      trigger: "in-progress",
    }).root,
    "D:\\GibLabLocal\\projects",
  );
  assert.equal(normalizeGibLabOrderSettings({ trigger: "x" }).trigger, "new");
});

test("empty project carries the order name and escapes xml", () => {
  const xml = emptyGibLabProject('R-2045 "Иванов" & Ко', "comment -- x");
  assert.match(xml, /name="R-2045 &quot;Иванов&quot; &amp; Ко"/);
  assert.doesNotMatch(xml, /<!--[^>]*--[^>]*-->/);
});
