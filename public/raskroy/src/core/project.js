/* Модель проекта
 P = {name, order, materials:[{id,name,code,t,L,W}], bands:{key:{name,t,w,code}},
      parts:[{id,name,l,w,count,grain,edges:{t,b,l,r},material,holes:[{x,y,d,dp,side}],mill,product}] }
 Размеры деталей хранятся чистовые (с кромкой), как в режиме GibLab cSizeMode=1. */
import { children, child, browserParseXml, escXml } from './xml.js';

/** Читает байты файла в кодировке, указанной в заголовке XML (GibLab пишет windows-1251). */
export function decode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const head = new TextDecoder('ascii').decode(bytes.slice(0, 200));
  const enc = /encoding="([^"]+)"/i.exec(head);
  return new TextDecoder(enc ? enc[1] : 'utf-8').decode(bytes);
}

/** Разбирает программу XNC из GibLab: отверстия и длина фрезеровки. */
export function parseProgram(xml, parseXml = browserParseXml) {
  const holes = [];
  if (!xml) return { holes, mill: 0 };
  const d = parseXml(xml.replace(/null/g, ''));
  if (!d) return { holes, mill: 0 };
  const tools = {};
  for (const t of Array.from(d.getElementsByTagName('tool'))) tools[t.getAttribute('name')] = +t.getAttribute('d');
  let last = {}, mill = 0, px = null, py = null;
  for (const el of children(d.documentElement)) {
    const tag = el.tagName, g = a => (el.hasAttribute(a) ? el.getAttribute(a) : null);
    if (tag === 'bf') {
      last = { x: +(g('x') ?? last.x), y: +(g('y') ?? last.y), dp: +(g('dp') ?? last.dp), name: g('name') ?? last.name };
      holes.push({ x: last.x, y: last.y, dp: last.dp, d: tools[last.name] || 5, side: 'face' });
    } else if (/^b[lrtb]$/.test(tag)) {
      holes.push({ side: tag, d: tools[g('name')] || 8, dp: +g('dp') || 0 });
    } else if (tag === 'ms') { px = +g('x'); py = +g('y'); }
    else if (tag === 'ml' || tag === 'ma') {
      const x = +g('x'), y = +g('y');
      if (px != null && !isNaN(x)) mill += Math.hypot(x - px, y - py);
      px = x; py = y;
    }
  }
  return { holes, mill };
}

/** Разбирает файл .project (GibLab / Базис) в модель P. */
export function parseProject(text, fileName = 'проект', parseXml = browserParseXml) {
  const doc = parseXml(text);
  if (!doc) throw new Error('Файл не похож на проект GibLab: не удалось прочитать XML.');
  const root = doc.documentElement, goods = {}, ops = {};
  for (const g of children(root)) {
    if (g.tagName === 'good') goods[g.getAttribute('id')] = g;
    if (g.tagName === 'operation') ops[g.getAttribute('id')] = g;
  }
  const parts = {}, products = [];
  for (const g of Object.values(goods)) {
    if (g.getAttribute('typeId') !== 'product') continue;
    products.push({ name: g.getAttribute('name'), order: g.getAttribute('product.order') || '' });
    for (const p of children(g, 'part')) {
      const a = n => p.getAttribute(n);
      parts[a('id')] = {
        id: +a('id'), name: a('name') || '', l: +a('dl') || +a('l'), w: +a('dw') || +a('w'), count: +a('count') || 1,
        grain: a('txt') === 'true', edges: { t: a('elt') || null, b: a('elb') || null, l: a('ell') || null, r: a('elr') || null },
        product: g.getAttribute('name'), holes: [], mill: 0, material: null, code: a('part.code') || a('code') || '', xnc: [],
      };
    }
  }
  const materials = {}, bands = {};
  for (const op of Object.values(ops)) {
    const type = op.getAttribute('typeId'), mid = child(op, 'material')?.getAttribute('id');
    const ids = children(op, 'part').map(p => p.getAttribute('id'));
    if (type === 'CS' && goods[mid]) {
      const g = goods[mid], s = child(g, 'part');
      const params = {}, num = a => (op.hasAttribute(a) ? +op.getAttribute(a) : null);
      if (num('cSizeMode') != null && num('cSizeMode') !== 1) params.sizeMode = num('cSizeMode');
      if (num('cTrimL') != null) params.trimL = num('cTrimL');
      if (num('cTrimW') != null) params.trimW = num('cTrimW');
      materials[mid] = { id: mid, name: g.getAttribute('name'), code: g.getAttribute('code') || '', t: +g.getAttribute('t'),
        L: s ? +s.getAttribute('l') : 2750, W: s ? +s.getAttribute('w') : 1830, params };
      ids.forEach(id => { if (parts[id]) parts[id].material = mid; });
    }
    if (type === 'EL' && goods[mid]) {
      const g = goods[mid];
      bands['@operation#' + op.getAttribute('id')] = { name: g.getAttribute('name'), t: +g.getAttribute('t') || 0,
        w: +g.getAttribute('w') || 0, code: g.getAttribute('code') || '' };
    }
    if (type === 'XNC') {
      const pr = parseProgram(op.getAttribute('program'), parseXml);
      const code = op.getAttribute('code') || '';
      ids.forEach(id => { if (parts[id]) { parts[id].holes.push(...pr.holes); parts[id].mill += pr.mill; if (code) parts[id].xnc.push(code); } });
    }
  }
  for (const p of Object.values(parts)) for (const s of 'tblr') if (p.edges[s] && !bands[p.edges[s]]) p.edges[s] = null;
  const pr = products[0];
  return { name: pr ? pr.name : fileName.replace(/\.\w+$/, ''), order: pr ? pr.order : '', date: '', due: '', note: '',
    parts: Object.values(parts), materials: Object.values(materials), bands };
}

/** Новый проект — пустой: ни материалов, ни кромки, ни деталей. */
export function newProject() {
  return { name: 'Новый проект', order: '', date: '', due: '', note: '', materials: [], bands: {}, parts: [] };
}

export const matKey = m => m.name + '|' + m.t;
export const nextId = P => P.parts.reduce((a, p) => Math.max(a, p.id), 0) + 1;
export const partsOf = (P, m) => P.parts.filter(p => p.material === m.id && p.count > 0 && p.l > 0 && p.w > 0);
const bandT = (P, p, s) => P.bands[p.edges[s]]?.t || 0;

/** Пильный размер детали. o.sizeMode: 0 — введён пильный, 1 (по умолчанию) — чистовой с кромкой: минус толщина кромки,
 *  плюс прифуговка на кромкуемых сторонах; 2 — размер после прифуговки: плюс прифуговка.
 *  Длина детали идёт вдоль кромок «верх/низ», ширина — вдоль «лево/право». */
export function sawSize(P, p, o) {
  const j = k => (p.edges[k] ? (P.bands[p.edges[k]]?.joint ?? o.joint ?? 0) : 0);
  const mode = +(o.sizeMode ?? 1);
  if (mode === 0) return { l: p.l, w: p.w }; // введён пильный размер
  if (mode === 2) return { l: +(p.l + j('l') + j('r')).toFixed(2), w: +(p.w + j('t') + j('b')).toFixed(2) }; // размер после прифуговки
  return {
    l: +(p.l - bandT(P, p, 'l') - bandT(P, p, 'r') + j('l') + j('r')).toFixed(2),
    w: +(p.w - bandT(P, p, 't') - bandT(P, p, 'b') + j('t') + j('b')).toFixed(2),
  };
}

/** Вставка строк из Excel (через Tab): Длина, Ширина, Кол-во, Текстура, Кромка верх/низ/лево/право, Наименование.
 *  Кромка: пусто/0 — нет, 1 — первая кромка проекта, иначе имя кромки (новая создаётся). Возвращает число добавленных строк. */
export function pasteRows(P, text, mat) {
  let n = 0;
  const bandByName = Object.fromEntries(Object.entries(P.bands).map(([k, b]) => [b.name.toLowerCase(), k]));
  const firstBand = Object.keys(P.bands)[0];
  const num = v => parseFloat(String(v ?? '').replace(',', '.'));
  const edge = v => {
    v = (v || '').trim();
    if (!v || v === '0') return null;
    if (v === '1') return firstBand || null;
    const k = bandByName[v.toLowerCase()];
    if (k) return k;
    let i = Object.keys(P.bands).length + 1; while (P.bands['b' + i]) i++;
    const nk = 'b' + i;
    P.bands[nk] = { name: v, t: /(^|\D)2(\D|$)/.test(v) ? 2 : 0.4, w: 19, code: '' };
    bandByName[v.toLowerCase()] = nk;
    return nk;
  };
  for (const line of text.split(/\r?\n/)) {
    const c = line.split('\t');
    if (c.length < 2) continue;
    const l = num(c[0]), w = num(c[1]);
    if (!(l > 0 && w > 0)) continue;
    P.parts.push({ id: nextId(P), name: (c[8] || '').trim() || 'Деталь', l, w, count: parseInt(c[2]) || 1,
      grain: !/^(0|нет|no|false)$/i.test((c[3] || '1').trim()),
      edges: { t: edge(c[4]), b: edge(c[5]), l: edge(c[6]), r: edge(c[7]) }, material: mat, holes: [], mill: 0, product: (c[9] || '').trim() });
    n++;
  }
  return n;
}

/** Экспорт в формат .project, который открывает GibLab. */
export function toProjectXml(P, o, optsFor = () => o) {
  const X = escXml; let id = 1; const out = [], ops = [], bandOp = {}; let opId = 1;
  Object.keys(P.bands).forEach(k => (bandOp[k] = opId++));
  const partsXml = P.parts.map(p => `<part id="${p.id}" name="${X(p.name)}" dl="${p.l}" dw="${p.w}" count="${p.count}" txt="${p.grain}"${
    ['t', 'b', 'l', 'r'].map(s => (p.edges[s] ? ` el${s}="@operation#${bandOp[p.edges[s]]}"` : '')).join('')}/>`).join('');
  out.push(`<good typeId="product" id="${10000 + id++}" count="1" name="${X(P.name)}" product.order="${X(P.order)}">${partsXml}</good>`);
  P.materials.forEach(m => {
    const tId = 10000 + id++, mId = 10000 + id++, sId = 10000 + id++;
    const mo = optsFor(m);
    out.push(`<good typeId="tool.cutting" id="${tId}" swSawthick="${mo.kerf}"/>`);
    out.push(`<good typeId="sheet" id="${mId}" t="${m.t}" name="${X(m.name)}" code="${X(m.code)}"><part id="${sId}" count="10000" l="${m.L}" w="${m.W}"/></good>`);
    ops.push(`<operation typeId="CS" id="${opId++}" tool1="${tId}" cSizeMode="${mo.sizeMode ?? 1}" cTrimL="${mo.trimL ?? mo.trim}" cTrimW="${mo.trimW ?? mo.trim}"><material id="${mId}"/>${
      partsOf(P, m).map(p => `<part id="${p.id}"/>`).join('')}</operation>`);
  });
  Object.entries(P.bands).forEach(([k, b]) => {
    const tId = 10000 + id++, bId = 10000 + id++;
    out.push(`<good typeId="tool.edgeline" id="${tId}"/>`);
    out.push(`<good typeId="band" id="${bId}" t="${b.t}" w="${b.w}" name="${X(b.name)}" code="${X(b.code)}"/>`);
    ops.unshift(`<operation typeId="EL" id="${bandOp[k]}" tool1="${tId}"><material id="${bId}"/>${
      P.parts.filter(p => Object.values(p.edges).includes(k)).map(p => `<part id="${p.id}"/>`).join('')}</operation>`);
  });
  return `<?xml version="1.0" encoding="utf-8"?><project version="1" currency="сом">\n${out.join('\n')}\n${ops.join('\n')}\n</project>`;
}

/** Список деталей для Excel, разделитель «;». */
export function toCsv(P, o) {
  const head = '№;Наименование;Материал;Длина;Ширина;Кол-во;Текстура;Кромка верх;низ;лево;право;Пильная длина;Пильная ширина';
  return [head].concat(P.parts.map(p => {
    const s = sawSize(P, p, o), m = P.materials.find(x => x.id === p.material);
    return [p.id, p.name, m ? m.name : '', p.l, p.w, p.count, p.grain ? 1 : 0,
      ...['t', 'b', 'l', 'r'].map(k => P.bands[p.edges[k]]?.name || ''), s.l, s.w].join(';');
  })).join('\n');
}
