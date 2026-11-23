/* Выгрузка раскроя на пилу Holzma в формате CadMatic PTX 1.13.
   Сделано по одному старому образцу файла из цеха; свежим файлом с пилы не проверено.
   Карта раскладывается в дерево сквозных резов: торцовка (90/91/92…), продольные полосы, поперечные резы и
   дорезы, одинаковые соседние куски записываются одним резом с количеством. */

const E = 0.05;
const r1 = v => Math.round(v * 10) / 10;
const csv = a => a.map(v => v === undefined || v === null ? '' : String(v).replace(/[,\r\n]/g, ' ')).join(',');

/** Кодировка windows-1251 (так пишет файлы CadMatic). */
let CP = null;
export function encode1251(text) {
  if (!CP) {
    CP = new Map();
    const dec = new TextDecoder('windows-1251');
    for (let b = 128; b < 256; b++) CP.set(dec.decode(new Uint8Array([b])), b);
  }
  const out = new Uint8Array(text.length);
  let n = 0;
  for (const ch of text) out[n++] = ch.charCodeAt(0) < 128 ? ch.charCodeAt(0) : CP.get(ch) ?? 63;
  return out.slice(0, n);
}

/** Группы деталей по одной оси: отрезки [a, b], не перекрывающиеся между собой. */
function groupsAlong(items, ax) {
  const s = ax === 'x' ? 'x' : 'y', len = ax === 'x' ? 'l' : 'w';
  const sorted = [...items].sort((a, b) => a[s] - b[s]);
  const out = [];
  for (const it of sorted) {
    const a = it[s], b = it[s] + it[len], g = out[out.length - 1];
    if (g && a < g.b - E) { g.b = Math.max(g.b, b); g.items.push(it); } else out.push({ a, b, items: [it] });
  }
  return out;
}

/** Дерево резов участка. func: 0 — резы по X (головные), 1 — по Y (продольные полосы), 2 — по X, 3 — по Y …
 *  Возвращает [{func, dim, repeat, part, kids, trim}] или бросает ошибку, если карту нельзя порезать сквозными резами. */
function tree(items, reg, func, raw, trims, depth = 0) {
  const ax = func % 2 === 0 ? 'x' : 'y', cross = ax === 'x' ? 'y' : 'x';
  const gs = groupsAlong(items, ax);
  if (depth > 12) throw new Error('слишком сложная карта');
  const nodes = [];
  if (raw[ax] && trims[ax] > 0) nodes.push({ func: 90 + func, dim: trims[ax], repeat: 0, part: 0, sig: 't' });
  const raw2 = { ...raw, [ax]: false };
  for (const g of gs) {
    const sub = { ...reg, [ax + '0']: g.a, [ax + '1']: g.b };
    const one = g.items.length === 1 && g.items[0];
    const crossLen = ax === 'x' ? 'w' : 'l';
    let node;
    if (one && Math.abs(one[crossLen] - (reg[cross + '1'] - reg[cross + '0'])) < E && Math.abs(one[cross] - reg[cross + '0']) < E)
      node = { func, dim: r1(g.b - g.a), repeat: 1, part: one.p.id, sig: 'p' + one.p.id };
    else {
      if (gs.length === 1 && depth > 0 && reg.stuck === ax) throw new Error('карту нельзя порезать сквозными резами');
      const kids = tree(g.items, { ...sub, stuck: gs.length === 1 ? cross : null }, func + 1, raw2, trims, depth + 1);
      node = { func, dim: r1(g.b - g.a), repeat: 1, part: 0, kids, sig: JSON.stringify(kids.map(k => [k.func, k.dim, k.repeat, k.part, k.sig])) };
    }
    const prev = nodes[nodes.length - 1];
    if (prev && prev.func === func && prev.dim === node.dim && prev.sig === node.sig) prev.repeat++;
    else nodes.push(node);
  }
  return nodes;
}

/** Тип карты и дерево: 0 — сначала продольные полосы по всей длине, 2 — сначала головные резы по длине листа. */
export function patternTree(s) {
  const trims = { x: s.tx || 0, y: s.ty || 0 };
  const reg = { x0: 0, x1: s.L - 2 * trims.x, y0: 0, y1: s.W - 2 * trims.y };
  const raw = { x: true, y: true };
  const byY = groupsAlong(s.items, 'y'), byX = groupsAlong(s.items, 'x');
  if (byY.length > 1 || byX.length === 1) {
    try { return { type: 0, nodes: tree(s.items, reg, 1, raw, trims) }; } catch (e) { if (byX.length === 1) throw e; }
  }
  return { type: 2, nodes: tree(s.items, reg, 0, raw, trims) };
}

/** Строки CUTS одной карты: JOB, PTN, CUT, 0, FUNCTION, DIMENSION, REPEAT, PART, QTY. */
function cutRows(nodes, ptn, rows = []) {
  for (const n of nodes) {
    rows.push(csv(['CUTS', 1, ptn, rows.length + 1, 0, n.func, n.dim, n.repeat, n.part, n.part ? n.repeat : 0]));
    if (n.kids) cutRows(n.kids, ptn, rows);
  }
  return rows;
}

/** Файл PTX для одного материала. P — проект, x — результат раскроя {m, r, o}, groups — cutGroups(r.sheets, stack).
 *  Возвращает {text, warnings}; text в кодировке нужно перевести encode1251 и записать с CRLF (уже в тексте). */
export function holzmaPtx(P, x, groups, sawSizeOf = p => ({ l: p.l, w: p.w }), date = new Date()) {
  const { m, r, o } = x, warnings = [];
  const name = (P.name || 'zakaz').trim(), d = [date.getDate(), date.getMonth() + 1].map(v => String(v).padStart(2, '0')).join('.') + '.' + date.getFullYear();
  const due = P.due ? P.due.split('-').reverse().join('.') : d;
  const parts = [...new Map(r.sheets.flatMap(s => s.items.map(it => [it.p.id, it.p]))).values()].sort((a, b) => a.id - b.id);
  const qty = new Map(); groups.forEach(g => g.s.items.forEach(it => qty.set(it.p.id, (qty.get(it.p.id) || 0) + g.n)));
  const L = [csv(['HEADER', '1.13', name, 0, 0, 1]), csv(['JOBS', 1, name, P.order || '', d, due, '', 1, '', ''])];
  for (const p of parts) {
    const s = sawSizeOf(p), q = qty.get(p.id) || 0;
    L.push(csv(['PARTS_REQ', 1, p.id, '', 1, r1(s.l), r1(s.w), q, 0, 0, 0, q, 0, 0, 0]));
  }
  for (const p of parts) {
    const s = sawSizeOf(p), f = Array(31).fill('');
    Object.assign(f, { 0: 'PARTS_INF', 1: 1, 2: p.id, 4: 1, 5: r1(s.l), 6: r1(s.w), 7: name, 8: p.name || '', 18: m.name, 21: p.product || '', 26: 1, 27: 1, 30: `(CS) ${m.name}` });
    L.push(csv(f));
  }
  const boards = [];
  const boardOf = s => {
    const key = (s.stock ? 'S' : 'B') + s.L + 'x' + s.W;
    let b = boards.find(b => b.key === key);
    if (!b) { b = { key, i: boards.length + 1, s }; boards.push(b); }
    return b.i;
  };
  const pats = [];
  groups.forEach((g, gi) => {
    try { pats.push({ g, b: boardOf(g.s), ...patternTree(g.s) }); }
    catch (e) { warnings.push(`Карта ${gi + 1}: ${e.message}, в файл не вошла`); }
  });
  for (const b of boards)
    L.push(csv(['BOARDS', 1, b.i, '', 1, b.s.L, b.s.W, b.s.stock ? 1 : 1000, 2, 0, 0, b.s.stock ? `Остаток ${b.s.L} x ${b.s.W}` : `${b.s.L} x ${b.s.W}`, m.name, 1]));
  const k = r.k ?? o.kerf, tL = o.trimL ?? o.trim ?? 0, tW = o.trimW ?? o.trim ?? 0;
  L.push(csv(['MATERIALS', 1, 1, '', m.name, m.t, Math.max(1, o.stack || 1), k, k, tL, tL, tW, tW, 0, 0, 0, 1, 1, 1, 1, '', 1]));
  pats.forEach((pt, i) => {
    L.push(csv(['PATTERNS', 1, i + 1, pt.b, pt.type, pt.g.n, 1, 1, '', 0, 0]));
    L.push(...cutRows(pt.nodes, i + 1));
  });
  r.offcuts.forEach((f, i) => L.push(csv(['OFFCUTS', 1, i + 1, `Остаток ${f.l} x ${f.w}`, 1, f.l, f.w, 1])));
  return { text: L.join('\r\n') + '\r\n', warnings, patterns: pats.length };
}

/** Программа пилы для экрана «Таблица команд»: [{code, dim, n, part}] в порядке резов.
 *  code: T — торцовка, C — рез полосы, P — рез детали; цифра — уровень (1 — первые резы листа).
 *  Возвращает null, если карту нельзя порезать сквозными резами. */
export function sawCommands(s) {
  let t;
  try { t = patternTree(s); } catch (e) { return null; }
  const start = t.type === 2 ? 0 : 1, out = [];
  const walk = nodes => nodes.forEach(n => {
    const lvl = (n.func >= 90 ? n.func - 90 : n.func) - start + 1;
    out.push({ code: (n.func >= 90 ? 'T' : n.part ? 'P' : 'C') + lvl, dim: n.dim, n: n.func >= 90 ? 1 : n.repeat, part: n.part || '' });
    if (n.kids) walk(n.kids);
  });
  walk(t.nodes);
  return out;
}
