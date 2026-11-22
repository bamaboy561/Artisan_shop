import { matKey } from './project.js';
import { cutGroups } from './optimizer.js';

/** Стоимость заказа по операциям. R — результат computeProject, prices — старые цены листов по matKey (если у материала нет m.price).
 *  Строка операции: {key, type, name, qty, unit, mat, work, total}. */
export function cost(P, R, prices = {}) {
  const ops = [], b = R.base;
  let sheets = 0, cutM = 0;
  for (const { m, o, mode, r } of R.mats) {
    // Цена листа: за лист (m.price) или за м² (m.priceM2); доп. форматы — своя цена или по площади.
    const sheetPrice = (L, W, own) => +(own ?? (m.priceM2 != null && m.priceM2 !== '' ? m.priceM2 * L * W / 1e6 : (m.price ?? prices[matKey(m)] ?? 0)));
    const mainPrice = sheetPrice(m.L, m.W);
    const fmtCost = r.formatsUsed.reduce((a, s) => a + sheetPrice(s.L, s.W, s.format.price), 0);
    const n = r.fullCount, matCost = r.charged * mainPrice + fmtCost;
    let work;
    if (mode === 'cnc') {
      const contour = r.sheets.reduce((a, s) => a + s.items.reduce((q, it) => q + 2 * (it.l + it.w), 0), 0) / 1000;
      work = contour * o.millPrice;
    } else if (o.cutMode === 'meter') {
      work = cutGroups(r.sheets, o.stack).reduce((a, g) => a + g.passes * g.s.cut, 0) / 1000 * o.cutPrice;
    } else work = n * o.cutPrice;
    sheets += n; cutM += r.cut;
    ops.push({ key: 'm:' + m.id, type: mode === 'cnc' ? 'CN' : 'CS', name: m.name + ' ' + m.t + ' мм', qty: n, unit: 'лист.',
      mat: matCost, work, price: mainPrice, charged: r.charged });
  }
  let edgeM = 0, edgeGlue = 0;
  for (const e of R.edges) {
    const band = P.bands[e.ref] || {};
    edgeM += e.mat; edgeGlue += e.glue;
    ops.push({ key: 'b:' + e.ref, type: 'EL', name: e.name, qty: e.mat, unit: 'м', mat: e.mat * (band.matPrice ?? 0), work: e.glue * (band.price ?? b.edgePrice) });
  }
  const holes = P.parts.reduce((a, p) => a + p.holes.length * p.count, 0);
  const millM = P.parts.reduce((a, p) => a + p.mill * p.count, 0) / 1000;
  if (holes || millM) ops.push({ key: 'xnc', type: 'XNC', name: 'Присадка и фрезеровка', qty: holes, unit: 'отв.', mat: 0, work: holes * b.holePrice + millM * b.millPrice });
  for (const g of Object.values(R.grooves || {})) {
    const gr = P.grooves[g.ref] || {};
    ops.push({ key: 'g:' + g.ref, type: 'GR', name: g.name, qty: g.len, unit: 'м', mat: 0, work: g.len * (+gr.price || 0) });
  }
  for (const { l, r } of R.lin || []) {
    const barPrice = l.priceM != null && l.priceM !== '' ? l.priceM * l.len / 1000 : +(l.price || 0);
    ops.push({ key: 'l:' + l.id, type: 'CL', name: l.name, qty: r.bars.length, unit: 'шт', mat: r.bars.length * barPrice, work: r.cuts * (+l.cutPrice || 0) });
  }
  const ex = P.extras || [];
  if (ex.length || P.showExtras) ops.push({ key: 'o', type: 'O', name: 'Комплектация и услуги', qty: ex.length, unit: 'поз.',
    mat: ex.filter(e => e.kind !== 'work').reduce((a, e) => a + (+e.qty || 0) * (+e.price || 0), 0),
    work: ex.filter(e => e.kind === 'work').reduce((a, e) => a + (+e.qty || 0) * (+e.price || 0), 0) });
  for (const r of ops) r.total = r.mat + r.work;
  const mat = ops.reduce((a, r) => a + r.mat, 0), work = ops.reduce((a, r) => a + r.work, 0);
  return { ops, sheets, cutM, edgeM, edgeGlue, holes, millM, mat, work, total: mat + work };
}
