import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeGibLabProject,
  isHdfSheet,
  readGibLabProject,
} from "../features/production/giblab-project-read";

const program = (inner: string) =>
  inner
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const xml = `<?xml version="1.0" encoding="UTF-8"?><project cost="7330" currency="сом" name="R-1 Тест">
<good typeId="product" id="2" name="кухня"><part cl="700" count="2" dl="700" dw="500" id="1" name="Бок"/><part count="1" dl="600" dw="300" id="2" name="Полка"/></good>
<good typeId="sheet" code="0101" count="6" id="6" l="2750" name="Белый.Гладкий" t="16" w="1830"/>
<good typeId="sheet" code="0001" count="2" id="8" l="2800" name="ХДФ" t="3" w="2070"/>
<good typeId="sheet" code="0001" count="0" id="11" l="2800" name="ХДФ" t="3" w="2070"/>
<good typeId="band" code="0102" count="133.02" id="22" name="ПВХ.Белый" t="1" w="19"/>
<operation cMaterialCount="6" cPartCount="3" id="7" typeId="CS"><material id="6" count="6"/><part id="1"/><part id="2"/></operation>
<operation cMaterialCount="2" id="8" typeId="CS"><material id="8" count="2"/><part id="2"/></operation>
<operation id="9" typeId="CS"><material id="11" count="0"/></operation>
<operation elLength="116" id="1" typeId="EL"><material id="22" count="133.02"/><part id="1"/></operation>
<operation countBore="3" id="16" typeId="XNC" program="${program('<program dx="700" dy="500" dz="16"><tool name="Bore5" d="5"/><tool name="Bore35" d="35"/><bf x="1" y="1" name="Bore5"/><bf x="2" y="1" name="Bore35"/><bl y="50" name="Bore5"/><ms x="0" y="0" name="Mill20"/><ml x="100" y="0"/><ml x="100" y="100"/><gr x1="0" y1="10" x2="500" y2="10" name="Cut4"/></program>')}"><part id="1"/></operation>
</project>`;

test("reads sheets, band, holes, milling from a finished GibLab project", () => {
  const s = readGibLabProject(
    decodeGibLabProject(new TextEncoder().encode(xml)),
  );
  assert.equal(s.cost, 7330);
  assert.deepEqual(
    s.sheets.map((sheet) => [sheet.name, sheet.sheets, sheet.parts]),
    [
      ["Белый.Гладкий", 6, 3],
      ["ХДФ", 2, 1],
    ],
  );
  assert.equal(s.bands[0].meters, 116);
  assert.equal(s.bands[0].metersWithWaste, 133.02);
  // Деталь 1 — 2 шт.: отверстия считаются на каждую.
  assert.deepEqual(s.drilling, { "5": 4, "35": 2 });
  assert.equal(s.faceHoles, 4);
  assert.equal(s.edgeHoles, 2);
  assert.equal(s.millMeters, 0.4);
  assert.equal(s.grooveMeters, 1);
  assert.equal(s.parts, 3);
  assert.equal(isHdfSheet(s.sheets[1]), true);
  assert.equal(isHdfSheet(s.sheets[0]), false);
});

test("decodes windows-1251 projects", () => {
  const bytes = Uint8Array.from([
    ...new TextEncoder().encode(
      '<?xml version="1.0" encoding="windows-1251"?><project name="',
    ),
    0xc1,
    0xee,
    0xea, // «Бок»
    ...new TextEncoder().encode('"/>'),
  ]);
  assert.equal(readGibLabProject(decodeGibLabProject(bytes)).name, "Бок");
});
