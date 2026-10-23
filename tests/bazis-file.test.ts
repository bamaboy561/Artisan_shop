import assert from "node:assert/strict";
import test from "node:test";

import { isBazisFile, withBazisExtension } from "../lib/bazis-file";

const project = new Uint8Array(64);
project.set([0x42, 0x5a, 0x38, 0x35]); // «BZ85»

test("проект Базиса без .b3d в имени получает расширение", async () => {
  const file = await withBazisExtension(new File([project], "Шкаф кухня"));
  assert.equal(file.name, "Шкаф кухня.b3d");
  assert.equal(file.size, project.length);
});

test("приписку .bin от Android меняем на .b3d", async () => {
  const file = await withBazisExtension(new File([project], "Шкаф.bin"));
  assert.equal(file.name, "Шкаф.b3d");
});

test("обычные файлы и проект с .b3d не трогаем", async () => {
  const pdf = new File([new Uint8Array(64)], "смета.pdf");
  const b3d = new File([project], "Шкаф.B3D");
  assert.equal(await withBazisExtension(pdf), pdf);
  assert.equal(await withBazisExtension(b3d), b3d);
  assert.equal(await isBazisFile(pdf), false);
});
