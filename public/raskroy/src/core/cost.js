import { matKey } from './project.js';
import { cutGroups } from './optimizer.js';

/** Цена отверстия по диаметру: из таблицы holePrices, иначе общая holePrice. */
export const holeRate = (b, d) => +(b.holePrices?.[d] ?? b.holePrices?.[Math.round(d)] ?? b.holePrice ?? 0);

/** Стоимость заказа по операциям. R — результат computeProject, prices — цены листов по matKey (если у материала нет m.price),
 *  bandPrices — цены кромки за метр по ключу кромки (если у кромки нет matPrice), например из прайса сайта.
 *  Строка операции: {key, type, name, qty, unit, mat, work, total, lines}. lines — позиции для сметы и КП:
 *  {g: 'mat'|'work'|'kit', name, qty, unit, price, sum, missing} (missing — цена не задана). */
export function cost(P, R, prices = {}, bandPrices = {}) {
  const ops = [], b = R.base;
  const L = (g, name, qty, unit, price, missing = false) => ({ g, name, qty, unit, price: +price || 0, sum: qty * (+price || 0), missing });
  let sheets = 0, cutM = 0;
  for (const { m, o, mode, r } of R.mats) {
    // Цена листа: за лист (m.price) или за м² (m.priceM2); доп. форматы — своя цена или по площади.
    const own = m.price != null && m.price !== '' ? +m.price : null, hasM2 = m.priceM2 != null && m.priceM2 !== '';
    const listed = prices[matKey(m)] ?? (m.code ? prices['code:' + m.code] : undefined);
    const sheetPrice = (Lm, Wm, f) => +(f ?? (hasM2 ? m.priceM2 * Lm * Wm / 1e6 : (own ?? listed ?? 0)));
    const priced = own != null || hasM2 || listed != null;
    const mainPrice = sheetPrice(m.L, m.W);
    const n = r.fullCount, lines = [];
    const fmtCost = r.formatsUsed.reduce((a, s) => a + sheetPrice(s.L, s.W, s.format.price), 0);
    const matCost = r.charged * mainPrice + fmtCost;
    const mname = `${m.name} ${m.t} мм`;
    if (r.charged) lines.push(L('mat', `${mname}, лист ${m.L}×${m.W}`, r.charged, 'лист', mainPrice, !priced));
    for (const s of r.formatsUsed) lines.push(L('mat', `${mname}, лист ${s.L}×${s.W}`, 1, 'лист', sheetPrice(s.L, s.W, s.format.price), !priced && s.format.price == null));
    let work;
    if (mode === 'cnc') {
      const contour = r.sheets.reduce((a, s) => a + s.items.reduce((q, it) => q + 2 * (it.l + it.w), 0), 0) / 1000;
      work = contour * o.millPrice;
      if (contour) lines.push(L('work', `Раскрой на ЧПУ: ${mname}`, contour, 'м', o.millPrice));
    } else if (o.cutMode === 'meter') {
      const len = cutGroups(r.sheets, o.stack).reduce((a, g) => a + g.passes * g.s.cut, 0) / 1000;
      work = len * o.cutPrice;
      if (len) lines.push(L('work', `Распил: ${mname}`, len, 'м', o.cutPrice));
    } else {
      work = n * o.cutPrice;
      if (n) lines.push(L('work', `Распил: ${mname}`, n, 'лист', o.cutPrice));
    }
    sheets += n; cutM += r.cut;
    ops.push({ key: 'm:' + m.id, type: mode === 'cnc' ? 'CN' : 'CS', name: mname, qty: n, unit: 'лист.',
      mat: matCost, work, price: mainPrice, charged: r.charged, own: !!m.own, lines });
  }
  let edgeM = 0, edgeGlue = 0;
  for (const e of R.edges) {
    const band = P.bands[e.ref] || {};
    const hasOwn = band.matPrice != null && band.matPrice !== '';
    const mp = hasOwn ? +band.matPrice : (bandPrices[e.ref] ?? 0), rate = +(band.price ?? b.edgePrice);
    edgeM += e.mat; edgeGlue += e.glue;
    const lines = [L('mat', `Кромка ${e.name}`, e.mat, 'м', mp, !hasOwn && bandPrices[e.ref] == null), L('work', `Кромкование ${e.name}`, e.glue, 'м', rate)];
    ops.push({ key: 'b:' + e.ref, type: 'EL', name: e.name, qty: e.mat, unit: 'м', mat: e.mat * mp, work: e.glue * rate, own: !!band.own, lines });
  }
  // Присадка: по диаметрам, у каждого своя цена; фрезеровка криволинейная — за метр.
  const byD = new Map();
  for (const p of P.parts) for (const h of p.holes) byD.set(h.d, (byD.get(h.d) || 0) + p.count);
  const holes = [...byD.values()].reduce((a, n) => a + n, 0);
  const millM = P.parts.reduce((a, p) => a + p.mill * p.count, 0) / 1000;
  if (holes || millM) {
    const lines = [...byD.entries()].sort((x, y) => x[0] - y[0]).map(([d, n]) => L('work', `Сверление Ø${d} мм`, n, 'шт', holeRate(b, d)));
    const curve = +(b.curvePrice ?? b.millPrice);
    if (millM) lines.push(L('work', 'Фрезеровка криволинейная', millM, 'м', curve));
    ops.push({ key: 'xnc', type: 'XNC', name: 'Присадка и фрезеровка', qty: holes, unit: 'отв.', mat: 0, work: lines.reduce((a, l) => a + l.sum, 0), lines });
  }
  for (const g of Object.values(R.grooves || {})) {
    const gr = P.grooves[g.ref] || {};
    const rate = gr.price != null && gr.price !== '' && +gr.price ? +gr.price : +(b.groovePrice || 0);
    ops.push({ key: 'g:' + g.ref, type: 'GR', name: g.name, qty: g.len, unit: 'м', mat: 0, work: g.len * rate, lines: [L('work', g.name, g.len, 'м', rate)] });
  }
  for (const { l, r } of R.lin || []) {
    const barPrice = l.priceM != null && l.priceM !== '' ? l.priceM * l.len / 1000 : +(l.price || 0);
    const lines = [L('mat', `${l.name}, ${l.len} мм`, r.bars.length, 'шт', barPrice, !barPrice)];
    if (r.cuts) lines.push(L('work', `Распил: ${l.name}`, r.cuts, 'рез', +l.cutPrice || 0));
    ops.push({ key: 'l:' + l.id, type: 'CL', name: l.name, qty: r.bars.length, unit: 'шт', mat: r.bars.length * barPrice, work: r.cuts * (+l.cutPrice || 0), lines });
  }
  const ex = P.extras || [];
  if (ex.length || P.showExtras) ops.push({ key: 'o', type: 'O', name: 'Комплектация и услуги', qty: ex.length, unit: 'поз.',
    mat: ex.filter(e => e.kind !== 'work').reduce((a, e) => a + (+e.qty || 0) * (+e.price || 0), 0),
    work: ex.filter(e => e.kind === 'work').reduce((a, e) => a + (+e.qty || 0) * (+e.price || 0), 0),
    lines: ex.map(e => L(e.kind === 'work' ? 'work' : 'kit', e.name, +e.qty || 0, e.unit || 'шт', +e.price || 0, !(+e.price))) });
  for (const r of ops) r.total = r.mat + r.work;
  const mat = ops.reduce((a, r) => a + r.mat, 0), work = ops.reduce((a, r) => a + r.work, 0);
  return { ops, sheets, cutM, edgeM, edgeGlue, holes, millM, mat, work, total: mat + work };
}
