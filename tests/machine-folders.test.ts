import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWatcherScript,
  diffFolder,
  findRequestNumbers,
  matchRequestByName,
  nameSkeleton,
  normalizeMachineFolders,
  parseWatcherReport,
} from "../features/production/machine-folders";

test("finds site request numbers in GibLab file names, not sizes", () => {
  assert.deepEqual(findRequestNumbers("R-2045 Ivanov shkaf Raskroi.saw"), [
    "R-2045",
  ]);
  assert.deepEqual(findRequestNumbers("r2050_kuhnya"), ["R-2050"]);
  assert.deepEqual(findRequestNumbers("zayavka 2061 Petrov"), ["R-2061"]);
  assert.deepEqual(findRequestNumbers("№2077 тумба"), ["R-2077"]);
  assert.deepEqual(findRequestNumbers("Vitalii Garderob 2750x1830"), []);
  assert.deepEqual(findRequestNumbers("sub\\R-2045 a.mpr"), ["R-2045"]);
});

test("matches a client by transliterated name only when unique", () => {
  assert.equal(nameSkeleton("Виталий"), nameSkeleton("Vitalij"));
  assert.equal(nameSkeleton("Виталий"), nameSkeleton("Vitalii"));
  const requests = [
    { id: "a", contactName: "Виталий" },
    { id: "b", contactName: "Асель Мамбетова" },
  ];
  assert.equal(
    matchRequestByName("Vitaliy Garderob (sait)", requests)?.id,
    "a",
  );
  assert.equal(matchRequestByName("Mambetova kuhnya.saw", requests)?.id, "b");
  assert.equal(matchRequestByName("Shkaf 1", requests), null);
  assert.equal(
    matchRequestByName("Vitalii", [
      ...requests,
      { id: "c", contactName: "Виталий К." },
    ]),
    null,
  );
});

test("diff adds new files, keeps known ones and removes missing", () => {
  const active = [
    { id: "1", folderId: "holzma", fileName: "A.saw" },
    { id: "2", folderId: "holzma", fileName: "B.saw" },
    { id: "3", folderId: "excitech", fileName: "C" },
  ];
  const diff = diffFolder(active, {
    id: "holzma",
    ok: true,
    files: [
      { name: "a.saw", size: 1, modifiedAt: null },
      { name: "D.saw", size: 1, modifiedAt: null },
    ],
  });
  assert.deepEqual(
    diff.added.map((f) => f.name),
    ["D.saw"],
  );
  assert.deepEqual(
    diff.kept.map((k) => k.id),
    ["1"],
  );
  assert.deepEqual(diff.removedIds, ["2"]);
  const offline = diffFolder(active, { id: "holzma", ok: false, files: [] });
  assert.deepEqual(offline.removedIds, []);
  assert.deepEqual(offline.added, []);
});

test("parses PowerShell reports with single objects and nulls", () => {
  const report = parseWatcherReport({
    computer: "GIBLAB-PC",
    folders: {
      id: "excitech",
      ok: true,
      files: { name: "R-2045", size: 10, modified: "2026-11-21T07:00:00Z" },
    },
  });
  assert.equal(report?.folders.length, 1);
  assert.equal(report?.folders[0].files[0].name, "R-2045");
  assert.equal(
    report?.folders[0].files[0].modifiedAt?.toISOString(),
    "2026-11-21T07:00:00.000Z",
  );
  const empty = parseWatcherReport({
    folders: [{ id: "holzma", ok: true, files: null }],
  });
  assert.deepEqual(empty?.folders[0].files, []);
});

test("normalizes folder settings and the watcher script embeds key once", () => {
  const folders = normalizeMachineFolders([
    { id: "holzma", name: "HOLZMA", path: "\\\\M03\\HolzmaKroy" },
    { id: "holzma", name: "Dup", path: "x" },
    { name: "", path: "" },
  ]);
  assert.equal(folders.length, 2);
  assert.notEqual(folders[1].id, "holzma");
  const script = buildWatcherScript({
    siteUrl: "https://artisan.shop.kg/",
    key: "k'1",
  });
  assert.match(script, /\$Key = 'k''1'/);
  assert.match(script, /\$Site = 'https:\/\/artisan\.shop\.kg'/);
  assert.equal(script.split("#PSSTART").length, 2);
  assert.match(script, /^@echo off\r\n/);
});
