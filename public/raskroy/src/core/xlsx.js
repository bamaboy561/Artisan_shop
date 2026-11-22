// Чтение таблиц Excel (.xlsx) и CSV без сторонних библиотек.
// .xlsx — это zip с XML внутри: распаковываем встроенным в браузер (и Node 18+) DecompressionStream.
import { browserParseXml, children } from './xml.js';

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflateRaw(data) {
  const ds = new DecompressionStream('deflate-raw');
  const out = new Response(new Blob([data]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}

/** Список файлов zip-архива: имя → функция, которая отдаёт распакованные байты. */
export function unzip(buf) {
  const b = new Uint8Array(buf);
  let e = b.length - 22;
  while (e >= 0 && u32(b, e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Это не файл Excel (.xlsx)');
  const n = u16(b, e + 10); let p = u32(b, e + 16);
  const files = {};
  for (let i = 0; i < n; i++) {
    if (u32(b, p) !== 0x02014b50) break;
    const method = u16(b, p + 10), size = u32(b, p + 20), nl = u16(b, p + 28), xl = u16(b, p + 30), cl = u16(b, p + 32), off = u32(b, p + 42);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl));
    const start = off + 30 + u16(b, off + 26) + u16(b, off + 28), raw = b.subarray(start, start + size);
    files[name] = () => (method === 0 ? Promise.resolve(raw) : method === 8 ? inflateRaw(raw) : Promise.reject(new Error('Неизвестное сжатие в файле')));
    p += 46 + nl + xl + cl;
  }
  return files;
}

const colIndex = ref => { let n = 0; for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const list = (el, tag) => { const nl = el.getElementsByTagName(tag); return Array.from({ length: nl.length }, (_, i) => nl[i]); }; // xmldom не умеет for..of
const textOf = el => list(el, 't').map(t => t.textContent).join('');

/** Первый лист книги .xlsx как массив строк (каждая строка — массив значений ячеек). */
export async function readXlsx(buf, parseXml = browserParseXml) {
  const z = unzip(buf), dec = new TextDecoder();
  const xml = async name => (z[name] ? parseXml(dec.decode(await z[name]())) : null);
  const shared = [];
  const ss = await xml('xl/sharedStrings.xml');
  if (ss) for (const si of children(ss.documentElement, 'si')) shared.push(textOf(si));
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = await xml('xl/workbook.xml'), rels = await xml('xl/_rels/workbook.xml.rels');
  const first = wb && wb.getElementsByTagName('sheet')[0];
  if (first && rels) {
    const rid = first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    for (const r of list(rels, 'Relationship')) if (r.getAttribute('Id') === rid) {
      const t = r.getAttribute('Target'); sheetPath = t.startsWith('/') ? t.slice(1) : 'xl/' + t;
    }
  }
  const sh = await xml(sheetPath);
  if (!sh) throw new Error('В файле Excel не найден лист');
  const rows = [];
  for (const row of list(sh, 'row')) {
    const r = []; let next = 0;
    for (const c of children(row, 'c')) {
      const ref = c.getAttribute('r'), i = ref ? colIndex(ref) : next; next = i + 1;
      const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0];
      let val = '';
      if (t === 's') val = shared[+v?.textContent] ?? '';
      else if (t === 'inlineStr') val = textOf(c);
      else if (v) val = v.textContent;
      r[i] = val;
    }
    const ri = +row.getAttribute('r') - 1;
    rows[ri >= 0 ? ri : rows.length] = Array.from(r, x => x ?? '');
  }
  return Array.from(rows, x => x || []);
}

/** Текст CSV: Excel в русской Windows сохраняет его в windows-1251, остальные программы — в UTF-8. */
export function decodeText(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { return new TextDecoder('windows-1251').decode(b); }
}

/** CSV из Excel: разделитель «;», «,» или табуляция, кавычки по правилам CSV. */
export function readCsv(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/)[0];
  const sep = ['\t', ';', ','].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Заголовки колонок, которые встречаются в таблицах деталей мебельщиков.
const COLS = [
  ['l', /^(длина|дл\.?|l|length|высота)$|длин/i],
  ['w', /^(ширина|шир\.?|w|width)$|ширин/i],
  ['count', /кол|шт|qty|count|колич/i],
  ['grain', /текст|волок|grain|напр/i],
  ['name', /наимен|назван|^деталь|name|описан/i],
  ['product', /издел|модуль|product|шкаф/i],
  ['et', /верх|дл\D*1|l1|(^|\D)1(\D|$)/i],
  ['eb', /низ|дл\D*2|l2|(^|\D)2(\D|$)/i],
  ['el', /лев|шир\D*1|w1|(^|\D)3(\D|$)/i],
  ['er', /прав|шир\D*2|w2|(^|\D)4(\D|$)/i],
];

/** Находит строку заголовка и номера колонок. Если заголовка нет, колонки идут как при вставке:
 *  длина, ширина, кол-во, текстура, кромка верх, низ, лево, право, наименование, изделие. */
export function tableColumns(rows) {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const cells = rows[r].map(c => String(c ?? '').trim());
    const map = {};
    cells.forEach((c, i) => {
      if (!c) return;
      const edge = /кром|^(верх|низ|лев|прав|дл\D*[12]|шир\D*[12]|[lw][12])/i.test(c); // «Кромка длина 1» — это кромка, а не длина детали
      for (const [k, re] of COLS) if (map[k] == null && (k[0] === 'e') === edge && re.test(c)) { map[k] = i; break; }
    });
    const edgeCols = cells.map((c, i) => (/кром/i.test(c) ? i : -1)).filter(i => i >= 0 && ![map.et, map.eb, map.el, map.er].includes(i));
    ['et', 'eb', 'el', 'er'].forEach(k => { if (map[k] == null && edgeCols.length) map[k] = edgeCols.shift(); });
    if (map.l != null && map.w != null) return { header: r, map };
  }
  return { header: -1, map: { l: 0, w: 1, count: 2, grain: 3, et: 4, eb: 5, el: 6, er: 7, name: 8, product: 9 } };
}

/** Строки таблицы → текст в формате вставки из Excel (его понимает pasteRows). */
export function rowsToPaste(rows) {
  const { header, map } = tableColumns(rows);
  const get = (row, k) => (map[k] == null ? '' : String(row[map[k]] ?? '').trim().replace(/\t/g, ' '));
  return rows.slice(header + 1).map(row => ['l', 'w', 'count', 'grain', 'et', 'eb', 'el', 'er', 'name', 'product'].map(k => get(row, k)).join('\t')).join('\n');
}
