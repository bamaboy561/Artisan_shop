// Готовый проект GibLab (.project) → что нужно заявке на распил: листы
// (декор, формат, сколько листов ушло на карты раскроя), кромка (метры),
// присадка по диаметрам, фрезеровка и пазы. Оператор доделывает заказ в
// GibLab, а сайт берёт цифры оттуда, а не считает заново.

export type GibLabSheetUse = {
  name: string;
  code: string | null;
  thicknessMm: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  // Листов на картах раскроя (cMaterialCount операции CS).
  sheets: number;
  parts: number;
};

export type GibLabBandUse = {
  name: string;
  code: string | null;
  thicknessMm: number | null;
  widthMm: number | null;
  // Длина кромления по деталям (elLength) и расход с запасом GibLab.
  meters: number;
  metersWithWaste: number | null;
};

export type GibLabProjectSummary = {
  name: string | null;
  // Сумма, которую посчитал сам GibLab (если в нём заведены цены).
  cost: number | null;
  currency: string | null;
  sheets: GibLabSheetUse[];
  bands: GibLabBandUse[];
  // Отверстия по диаметрам («5», «8», «35»…), с количеством деталей.
  drilling: Record<string, number>;
  faceHoles: number;
  edgeHoles: number;
  // Фрезеровка контура и пазы в пласти, погонные метры.
  millMeters: number;
  grooveMeters: number;
  parts: number;
};

type Attrs = Record<string, string>;

function decodeEntities(text: string) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&");
}

function readAttrs(tag: string): Attrs {
  const attrs: Attrs = {};
  for (const match of tag.matchAll(/([\w.:-]+)\s*=\s*"([^"]*)"/g)) {
    attrs[match[1]] = decodeEntities(match[2]);
  }
  return attrs;
}

function num(value: string | undefined) {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

// GibLab пишет проект то в UTF-8, то в windows-1251: смотрим заголовок XML.
export function decodeGibLabProject(bytes: Uint8Array) {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 200));
  const encoding = /encoding\s*=\s*["']([^"']+)["']/i.exec(head)?.[1];
  const label = /1251/.test(encoding ?? "") ? "windows-1251" : "utf-8";
  return new TextDecoder(label).decode(bytes);
}

export function isGibLabProjectXml(xml: string) {
  return /<project\b/.test(xml.slice(0, 2000));
}

// Длина пути фрезы: «ms» — начало, дальше отрезки «ml» и дуги «ma».
function millLength(program: string) {
  let total = 0;
  let x: number | null = null;
  let y: number | null = null;
  for (const match of program.matchAll(/<(ms|ml|ma)\b([^>]*)\/?>/g)) {
    const attrs = readAttrs(match[2]);
    const nx = num(attrs.x);
    const ny = num(attrs.y);
    if (nx === null || ny === null) continue;
    if (match[1] !== "ms" && x !== null && y !== null) {
      total += Math.hypot(nx - x, ny - y);
    }
    x = nx;
    y = ny;
  }
  return total;
}

function grooveLength(program: string) {
  let total = 0;
  for (const match of program.matchAll(/<gr\b([^>]*)\/?>/g)) {
    const a = readAttrs(match[1]);
    const [x1, y1, x2, y2] = [num(a.x1), num(a.y1), num(a.x2), num(a.y2)];
    if (x1 === null || y1 === null || x2 === null || y2 === null) continue;
    total += Math.hypot(x2 - x1, y2 - y1);
  }
  return total;
}

function diameterKey(value: number) {
  return String(Math.round(value * 10) / 10);
}

export function readGibLabProject(xml: string): GibLabProjectSummary {
  const projectTag = /<project\b[^>]*>/.exec(xml)?.[0] ?? "";
  const project = readAttrs(projectTag);

  // Товары: листы и кромка, по id.
  const goods = new Map<string, Attrs>();
  for (const match of xml.matchAll(/<good\b([^>]*)>/g)) {
    const attrs = readAttrs(match[1]);
    if (attrs.id) goods.set(attrs.id, attrs);
  }

  // Детали изделий: id → количество. В операциях детали стоят ссылками
  // <part id="N"/> без размеров.
  const partCounts = new Map<string, number>();
  let parts = 0;
  for (const match of xml.matchAll(/<part\b([^>]*?)\/?>/g)) {
    const attrs = readAttrs(match[1]);
    if (!attrs.id || attrs.dl === undefined) continue;
    const count = Math.max(0, Math.round(num(attrs.count) ?? 1));
    if (!partCounts.has(attrs.id)) {
      partCounts.set(attrs.id, count);
      parts += count;
    }
  }

  const sheets: GibLabSheetUse[] = [];
  const bands: GibLabBandUse[] = [];
  const drilling: Record<string, number> = {};
  let faceHoles = 0;
  let edgeHoles = 0;
  let millMm = 0;
  let grooveMm = 0;

  for (const match of xml.matchAll(
    /<operation\b([^>]*?)(\/>|>([\s\S]*?)<\/operation>)/g,
  )) {
    const op = readAttrs(match[1]);
    const body = match[3] ?? "";
    const refs = [...body.matchAll(/<part id="([^"]+)"\s*\/>/g)].map(
      (ref) => ref[1],
    );
    const material = /<material\b([^>]*)\/?>/.exec(body);
    const materialAttrs = material ? readAttrs(material[1]) : null;
    const good = materialAttrs?.id ? goods.get(materialAttrs.id) : undefined;

    if (op.typeId === "CS") {
      const count = num(op.cMaterialCount) ?? num(materialAttrs?.count) ?? 0;
      if (!good || !(count > 0)) continue;
      sheets.push({
        name: good.name || "Лист",
        code: good.code || null,
        thicknessMm: num(good.t) ?? num(op.t),
        lengthMm: num(good.l),
        widthMm: num(good.w),
        sheets: Math.ceil(count),
        parts:
          num(op.cPartCount) ??
          refs.reduce((sum, id) => sum + (partCounts.get(id) ?? 1), 0),
      });
    } else if (op.typeId === "EL") {
      const meters = num(op.elLength);
      const withWaste = num(materialAttrs?.count);
      if (!good || !((meters ?? withWaste ?? 0) > 0)) continue;
      bands.push({
        name: good.name || "Кромка",
        code: good.code || null,
        thicknessMm: num(good.t) ?? num(op.t),
        widthMm: num(good.w),
        meters: round2(meters ?? withWaste ?? 0),
        metersWithWaste: withWaste === null ? null : round2(withWaste),
      });
    } else if (op.typeId === "XNC" && op.program) {
      const program = op.program;
      const multiplier =
        refs.reduce((sum, id) => sum + (partCounts.get(id) ?? 1), 0) || 1;
      const tools = new Map<string, number>();
      for (const tool of program.matchAll(/<tool\b([^>]*)\/?>/g)) {
        const attrs = readAttrs(tool[1]);
        const d = num(attrs.d);
        if (attrs.name && d !== null) tools.set(attrs.name, d);
      }
      for (const bore of program.matchAll(/<(bf|bl|br|bt|bb)\b([^>]*)\/?>/g)) {
        const attrs = readAttrs(bore[2]);
        const d =
          num(attrs.d) ??
          (attrs.name ? tools.get(attrs.name) : undefined) ??
          num(/(\d+(?:[.,]\d+)?)/.exec(attrs.name ?? "")?.[1]);
        if (!(d && d > 0)) continue;
        const key = diameterKey(d);
        drilling[key] = (drilling[key] ?? 0) + multiplier;
        if (bore[1] === "bf") faceHoles += multiplier;
        else edgeHoles += multiplier;
      }
      millMm += millLength(program) * multiplier;
      grooveMm += grooveLength(program) * multiplier;
    }
  }

  return {
    name: project.name || null,
    cost: num(project.cost),
    currency: project.currency || null,
    sheets,
    bands,
    drilling,
    faceHoles,
    edgeHoles,
    millMeters: round2(millMm / 1000),
    grooveMeters: round2(grooveMm / 1000),
    parts,
  };
}

export function isHdfSheet(
  sheet: Pick<GibLabSheetUse, "name" | "thicknessMm">,
) {
  return (
    /хдф|двп|hdf/i.test(sheet.name) ||
    (sheet.thicknessMm !== null && sheet.thicknessMm <= 5)
  );
}
