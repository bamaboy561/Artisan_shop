import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyGibLabProject,
  gibLabOrderFileName,
  gibLabOrderFolder,
  gibLabPartPosition,
  normalizeGibLabOrderSettings,
  orderedBazisFiles,
  parseGibLabOrderSettings,
  parseGibLabPartPosition,
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

test("order file name ends with the site code for the assembly QR", () => {
  assert.equal(
    gibLabOrderFileName({
      number: "R-2045",
      id: "x",
      contactName: "Алишер",
      contactPhone: "+996 (703) 981-048",
      code: "K7M2XQ9P",
    }),
    "R-2045 Алишер 0703981048 K7M2XQ9P.project",
  );
  // Длинное имя режется, а код остаётся целым.
  const long = gibLabOrderFileName({
    number: "R-1",
    id: "x",
    contactName: "Очень длинное имя ".repeat(10),
    contactPhone: "0700000000",
    code: "ABCDEFGH",
  });
  assert.ok(long.endsWith(" ABCDEFGH.project"));
});

test("bazis files keep upload order so file numbers do not move", () => {
  const files = [
    { id: "c", fileName: "кухня-2.B3D", createdAt: new Date("2026-11-03") },
    { id: "x", fileName: "заявка.project", createdAt: new Date("2026-11-01") },
    { id: "a", fileName: "кухня.b3d", createdAt: new Date("2026-11-01") },
    { id: "b", fileName: "шкаф.b3d", createdAt: new Date("2026-11-02") },
  ];
  assert.deepEqual(
    orderedBazisFiles(files).map((file) => file.id),
    ["a", "b", "c"],
  );
});

test("part position carries the file number only when there are several files", () => {
  assert.equal(gibLabPartPosition(1, 1, "5"), "5");
  assert.equal(gibLabPartPosition(2, 3, "5"), "2-5");
  assert.equal(gibLabPartPosition(2, 3, ""), "");
  assert.deepEqual(parseGibLabPartPosition("2-5", 3), {
    fileIndex: 1,
    position: "5",
  });
  // Позиция Базиса с дефисом внутри.
  assert.deepEqual(parseGibLabPartPosition("1-1-3", 2), {
    fileIndex: 0,
    position: "1-3",
  });
  // Один файл: дефис — часть позиции.
  assert.deepEqual(parseGibLabPartPosition("1-3", 1), {
    fileIndex: 0,
    position: "1-3",
  });
  // Нет такого файла — ищем как есть в первом.
  assert.deepEqual(parseGibLabPartPosition("9-5", 2), {
    fileIndex: 0,
    position: "9-5",
  });
});
