/* Гильотинный раскрой листа: каждая деталь кладётся в свободный прямоугольник,
   остаток режется на два новых (сквозной рез), учитывается пропил и торцовка. */
import { sawSize, matKey } from './project.js';
import { layoutSig, sheetsFromManual } from './manual.js';

const fits = (l, w, L, W) => l <= L + 1e-6 && w <= W + 1e-6;

/** Резы записываются в sh.cuts в порядке выполнения: каждый рез делит участок, созданный предыдущими резами.
 *  d: 'T' торцовка, 'H' рез вдоль длины листа (по X), 'V' рез поперёк (по Y); x, y — начало реза без торцовки.
 *  items: [{p,l,w,rot}], bins0: остатки со склада [{l,w,...}], L×W: формат листа, k: пропил,
 *  split: 'horiz' | 'vert' | 'short' | 'long' — какой рез делать первым,
 *  trim: торцовка с каждой стороны — число или {x: по длине, y: по ширине}.
 *  bins0: сначала заполняемые листы: остатки со склада {l,w} (без торцовки) и дополнительные форматы {l,w,format:true} (с торцовкой). */
export function pack(items, bins0, L, W, k, split, trim) {
  const unplaced = [];
  const tx = typeof trim === 'object' ? trim.x : trim, ty = typeof trim === 'object' ? trim.y : trim;
  const newSheet = (L, W, t, extra) => ({ ...extra, L, W, tx: t ? tx : 0, ty: t ? ty : 0, trim: t ? tx : 0, items: [],
    free: [{ x: 0, y: 0, w: L - (t ? 2 * tx : 0), h: W - (t ? 2 * ty : 0) }],
    cut: t ? (tx > 0 ? 2 * W : 0) + (ty > 0 ? 2 * L : 0) : 0,
    cuts: t ? [...(ty > 0 ? [{ d: 'T', len: L }] : []), ...(tx > 0 ? [{ d: 'T', len: W }] : [])] : [] });
  const sheets = bins0.map(b => newSheet(b.l, b.w, !!b.format, b.format ? { format: b } : { stock: b }));
  for (const it of items) {
    let best = null;
    sheets.forEach((sh, si) => sh.free.forEach((f, fi) => {
      for (const r of it.rot ? [false, true] : [false]) {
        const l = r ? it.w : it.l, w = r ? it.l : it.w;
        if (fits(l, w, f.w, f.h)) {
          const sc = (sh.stock ? -1e6 : 0) + Math.min(f.w - l, f.h - w);
          if (!best || sc < best.sc) best = { sc, si, fi, r, l, w };
        }
      }
    }));
    if (!best) {
      // Новый основной лист — только если деталь на нём помещается, причём поворот лишь с разрешения текстуры.
      const uL = L - 2 * tx, uW = W - 2 * ty;
      const r = fits(it.l, it.w, uL, uW) ? false : it.rot && fits(it.w, it.l, uL, uW) ? true : null;
      if (r === null) { unplaced.push({ ...it, why: placeWhy(it, uL, uW, L, W) }); continue; }
      sheets.push(newSheet(L, W, true, {}));
      best = { si: sheets.length - 1, fi: 0, r, l: r ? it.w : it.l, w: r ? it.l : it.w };
    }
    const sh = sheets[best.si], f = sh.free.splice(best.fi, 1)[0];
    sh.items.push({ x: f.x, y: f.y, l: best.l, w: best.w, rot: best.r, p: it.p });
    const rw = f.w - best.l - k, bh = f.h - best.w - k;
    const horiz = split === 'horiz' ? true : split === 'vert' ? false
      : split === 'short' ? (f.w - best.l) < (f.h - best.w) : (f.w - best.l) >= (f.h - best.w);
    const cut = (d, x, y, len) => { sh.cut += len; sh.cuts.push({ d, x, y, len }); };
    if (horiz) { // сначала рез вдоль длины на всю ширину участка
      if (bh > -k) cut('H', f.x, f.y + best.w, f.w);
      if (rw > -k) cut('V', f.x + best.l, f.y, best.w);
      if (rw > 0) sh.free.push({ x: f.x + best.l + k, y: f.y, w: rw, h: best.w });
      if (bh > 0) sh.free.push({ x: f.x, y: f.y + best.w + k, w: f.w, h: bh });
    } else {
      if (rw > -k) cut('V', f.x + best.l, f.y, f.h);
      if (bh > -k) cut('H', f.x, f.y + best.w, best.l);
      if (rw > 0) sh.free.push({ x: f.x + best.l + k, y: f.y, w: rw, h: f.h });
      if (bh > 0) sh.free.push({ x: f.x, y: f.y + best.w + k, w: best.l, h: bh });
    }
  }
  const out = sheets.filter(s => s.items.length);
  out.unplaced = unplaced;
  return out;
}

/** Почему деталь не легла на основной лист: понятная причина для оператора. */
function placeWhy(it, uL, uW, L, W) {
  if (!it.rot && fits(it.w, it.l, uL, uW)) return `помещается только с поворотом, а поворот запрещён текстурой`;
  return `не помещается на основной лист ${L}×${W}` + (it.fmt ? ', а дополнительные листы закончились' : '');
}

/** Проверка карт: каждая деталь внутри листа (с учётом торцовки), детали не накладываются
 *  (с учётом пропила), повёрнута только деталь без текстуры. Возвращает список ошибок [{sheet, p, msg}]. */
export function checkSheets(sheets, k = 0, grainOff = false) {
  const errs = [], E = 0.01;
  sheets.forEach((s, si) => {
    const W0 = s.L - 2 * (s.tx || 0), H0 = s.W - 2 * (s.ty || 0);
    s.items.forEach((a, ai) => {
      if (a.x < -E || a.y < -E || a.x + a.l > W0 + E || a.y + a.w > H0 + E)
        errs.push({ sheet: si, p: a.p, msg: `деталь ${a.l}×${a.w} выходит за границы листа ${s.L}×${s.W}` });
      if (a.rot && a.p.grain && !grainOff) errs.push({ sheet: si, p: a.p, msg: 'деталь с текстурой повёрнута' });
      for (let bi = ai + 1; bi < s.items.length; bi++) {
        const b = s.items[bi];
        if (a.x < b.x + b.l + k - E && b.x < a.x + a.l + k - E && a.y < b.y + b.w + k - E && b.y < a.y + a.w + k - E)
          errs.push({ sheet: si, p: a.p, msg: `накладывается на деталь «${b.p.name}» (с учётом пропила ${k} мм)` });
      }
    });
  });
  return errs;
}

const ORDERS = [
  (a, b) => b.l * b.w - a.l * a.w,
  (a, b) => Math.max(b.l, b.w) - Math.max(a.l, a.w),
  (a, b) => b.l - a.l || b.w - a.w,
  (a, b) => b.w - a.w || b.l - a.l,
  (a, b) => (b.l + b.w) - (a.l + a.w),
];

/** Раскрой одного материала. mode 'saw' — пила (пильные размеры, пропил, склад остатков),
 *  'cnc' — нестинг на ЧПУ (чистовые размеры, зазор = диаметр фрезы). */
export function optimizeMaterial(P, m, parts, o, mode = 'saw', stock = []) {
  const k = mode === 'cnc' ? o.toolD : o.kerf;
  const tx = o.trimL ?? o.trim ?? 0, ty = o.trimW ?? o.trim ?? 0;
  const items = [], tooBig = [];
  parts.forEach(p => {
    const s = mode === 'cnc' ? { l: p.l, w: p.w } : sawSize(P, p, o);
    for (let i = 0; i < p.count; i++) items.push({ p, l: s.l, w: s.w, rot: o.grain === 'off' || !p.grain });
  });
  const formats = (m.formats || []).filter(f => f.l > 0 && f.w > 0 && f.qty > 0);
  const maxL = Math.max(m.L, ...formats.map(f => f.l)) , maxW = Math.max(m.W, ...formats.map(f => f.w));
  const fitsAny = it => [[m.L, m.W], ...formats.map(f => [f.l, f.w])].some(([L, W]) =>
    fits(it.l, it.w, L - 2 * tx, W - 2 * ty) || (it.rot && fits(it.w, it.l, L - 2 * tx, W - 2 * ty)));
  const ok = items.filter(it => {
    const f = fitsAny(it);
    if (!f) {
      const turn = [[m.L, m.W], ...formats.map(f => [f.l, f.w])].some(([L, W]) => !it.rot && fits(it.w, it.l, L - 2 * tx, W - 2 * ty));
      it.why = turn ? 'помещается только с поворотом, а поворот запрещён текстурой' : `больше листа ${maxL}×${maxW}`;
      tooBig.push(it);
    }
    // Помечаем детали, которые помещаются только на дополнительный формат: для понятной причины, если форматы кончатся.
    if (f && !(fits(it.l, it.w, m.L - 2 * tx, m.W - 2 * ty) || (it.rot && fits(it.w, it.l, m.L - 2 * tx, m.W - 2 * ty)))) it.fmt = true;
    return f && Math.min(it.l, it.w) >= o.minPart;
  });
  const small = items.filter(it => !tooBig.includes(it) && Math.min(it.l, it.w) < o.minPart);
  const bins = [
    ...(o.useStock && mode !== 'cnc' ? stock.filter(s => s.mat === matKey(m)).map(s => ({ ...s })) : []),
    ...formats.flatMap(f => Array.from({ length: Math.min(f.qty, 200) }, () => ({ ...f, format: true }))),
  ];
  const sig = layoutSig(m, ok, k, tx, ty, mode);
  const man = m.manual && m.manual.sig === sig ? m.manual : null; // ручная карта, пока детали и параметры не менялись
  let sheets, unplaced = [];
  if (man) ({ sheets, unplaced } = sheetsFromManual(man, ok, k));
  else {
    const splits = o.dir === 'length' ? ['horiz'] : o.dir === 'width' ? ['vert'] : ['short', 'long', 'horiz', 'vert'];
    let best = null;
    for (const ord of ORDERS) for (const sp of splits) {
      const res = pack([...ok].sort(ord), bins, m.L, m.W, k, sp, { x: tx, y: ty });
      const full = res.filter(s => !s.stock);
      const lastFill = full.length ? full[full.length - 1].items.reduce((a, i) => a + i.l * i.w, 0) : 0;
      const area = full.reduce((a, s) => a + s.L * s.W, 0);
      const score = res.unplaced.length * 1e18 + area * 1e3 + res.filter(s => s.stock).length * 1e10 - lastFill;
      if (!best || score < best.score) best = { score, sheets: res };
    }
    sheets = best ? best.sheets : [];
    unplaced = best ? best.sheets.unplaced : [];
  }
  const full = sheets.filter(s => !s.stock), main = full.filter(s => !s.format);
  const used = full.reduce((s, sh) => s + sh.items.reduce((a, i) => a + i.l * i.w, 0), 0);
  const fullArea = full.reduce((a, s) => a + s.L * s.W, 0);
  const offcuts = [];
  sheets.forEach((sh, i) => sh.free.forEach(f => {
    const a = Math.max(f.w, f.h), b = Math.min(f.w, f.h);
    if (a >= o.offMin1 && b >= o.offMin2 && (!o.offArea || a * b / 1e6 >= o.offArea)) offcuts.push({ sheet: i, l: Math.floor(f.w), w: Math.floor(f.h) });
  }));
  // Округление последнего основного листа: оплачивается занятая часть по длине (1/2, 1/3, 1/4 листа) или целый лист.
  let charged = main.length;
  const den = { '1/2': 2, '1/3': 3, '1/4': 4 }[o.round];
  if (den && main.length && main[main.length - 1].items.length) {
    const last = main[main.length - 1];
    const ext = Math.max(...last.items.map(i => i.x + i.l)) + 2 * last.tx;
    charged = main.length - 1 + Math.min(1, Math.ceil(ext / last.L * den - 1e-9) / den);
  }
  return { m, sheets, tooBig, small, offcuts, cut: sheets.reduce((a, s) => a + s.cut, 0) / 1000,
    util: fullArea ? used / fullArea : 0, fullCount: full.length, mainCount: main.length, charged,
    formatsUsed: full.filter(s => s.format), stockUsed: sheets.filter(s => s.stock), area: fullArea / 1e6,
    sig, manual: !!man, stale: !!m.manual && !man, unplaced, mode, k,
    errors: checkSheets(sheets, k, o.grain === 'off') };
}

/** Резка пакетом: одинаковые карты подряд режутся стопкой по stack листов. Возвращает [{s, n, passes}]. */
export function cutGroups(sheets, stack = 1) {
  // В подпись входят номер детали и поворот: одинаковая геометрия с разными деталями (а значит, с разной присадкой
  // и разными этикетками) — разные карты. holesKey добавляет отверстия и фрезеровку на случай, если они разные у одной детали.
  const holesKey = p => (p.holes || []).map(h => [h.side, h.x, h.y, h.d, h.dp].join(':')).join('|') + '/' + (p.mill || 0);
  const sig = s => (s.stock ? 'S' : s.format ? 'F' : '') + s.L + 'x' + s.W + ':' + s.items.map(i => [i.x, i.y, i.l, i.w, i.p?.id, i.rot ? 1 : 0, i.p ? holesKey(i.p) : ''].join(',')).join(';');
  const groups = [];
  sheets.forEach((s, i) => { const g = groups[groups.length - 1]; if (g && g.sig === sig(s)) g.n++; else groups.push({ sig: sig(s), s, i, n: 1 }); });
  for (const g of groups) g.passes = Math.ceil(g.n / Math.max(1, stack || 1));
  return groups;
}

/** Склад после раскроя: использованные остатки списываются, новые деловые остатки добавляются.
 *  Возвращает новый массив, исходный не меняет. */
export function applyOffcuts(stock, r, from = '', newId = () => Date.now() + Math.random()) {
  const used = new Set(r.stockUsed.map(s => s.stock.id));
  return stock.filter(s => !used.has(s.id)).concat(r.offcuts.map(o =>
    ({ id: newId(), mat: matKey(r.m), name: r.m.name, t: r.m.t, l: o.l, w: o.w, from })));
}
