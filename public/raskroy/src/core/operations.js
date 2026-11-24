/* Проект как список операций, как привыкли в цеху: каждый листовой материал — свой раскрой
   (на пиле CS или нестингом на ЧПУ CN) со своими параметрами, каждая кромка — операция EL,
   присадка из проекта — операция XNC. */
import { optimizeMaterial, } from './optimizer.js';
import { partsOf } from './project.js';
import { edgeStats } from './edges.js';
import { optimizeLinear } from './linear.js';

/** Значения по умолчанию для новых операций. Параметры конкретного материала лежат в m.params и перекрывают их. */
export const DEFAULTS = {
  kerf: 4.4, trim: 10, sizeMode: 1, round: 'none', stack: 1, offArea: 0, dir: 'any', grain: 'file', minPart: 0, offMin1: 300, offMin2: 100, useStock: true,
  edgeAdd: 30, edgeWaste: 0, joint: 0,
  // ЧПУ Excitech: значения как в программах со станка цеха (ноль Z на столе, предрез 2 прохода с оставлением 1,2 мм).
  toolD: 6, toolT: 1, overcut: 0, spindle: 18000, feedXY: 15000, feedZ: 5000, lift: 20, preCut: true, preStep: 15, preLeave: 1.2, lead: 97, overlap: 3,
  drillTools: '7=16, 8=17, 10=21, 22=22', drillS: 0, drillFeed: 0, cncDraft: false, machineSub: false,
  cutMode: 'sheet', cutPrice: 300, edgePrice: 28, holePrice: 10, millPrice: 25, curvePrice: 200, groovePrice: 200,
  // Присадка: цена отверстия по диаметру, как в прайсе сайта. Диаметр не из списка — по holePrice.
  holePrices: { 3: 4, 5: 6, 6: 8, 7: 8, 8: 10, 10: 10, 15: 13, 20: 20, 25: 21, 35: 32 },
};

export const matOpts = (m, base = DEFAULTS) => ({ ...DEFAULTS, ...base, ...(m.params || {}) });
export const opType = m => (m.op === 'CN' ? 'CN' : 'CS');

/** Список операций проекта в порядке показа. */
export function operations(P) {
  const ops = P.materials.map(m => ({ key: 'm:' + m.id, type: opType(m), name: m.name + ' ' + m.t + ' мм', m }));
  for (const [k, b] of Object.entries(P.bands)) ops.push({ key: 'b:' + k, type: 'EL', name: b.name, band: b, ref: k });
  for (const [k, g] of Object.entries(P.grooves || {})) ops.push({ key: 'g:' + k, type: 'GR', name: g.name, groove: g, ref: k });
  if (P.parts.some(p => p.holes.length || p.mill)) ops.push({ key: 'xnc', type: 'XNC', name: 'Присадка и фрезеровка' });
  for (const l of P.linear || []) ops.push({ key: 'l:' + l.id, type: 'CL', name: l.name, lin: l });
  if ((P.extras || []).length || P.showExtras) ops.push({ key: 'o', type: 'O', name: 'Комплектация и услуги' });
  return ops;
}

/** Раскрой всех материалов, каждый со своими параметрами. */
export function computeProject(P, base = DEFAULTS, stock = []) {
  const t0 = Date.now();
  const mats = P.materials.map(m => {
    const o = matOpts(m, base), mode = opType(m) === 'CN' ? 'cnc' : 'saw';
    return { m, o, mode, r: optimizeMaterial(P, m, partsOf(P, m), o, mode, stock) };
  });
  const lin = (P.linear || []).map(l => ({ l, r: optimizeLinear(l) }));
  return { base: { ...DEFAULTS, ...base }, mats, lin, grooves: grooveStats(P), edges: edgeStats(P, { ...DEFAULTS, ...base }), ms: Date.now() - t0 };
}

/** Длина пазов по каждому виду паза: паз по стороне детали идёт на всю её длину (верх/низ) или ширину (лево/право). */
export function grooveStats(P) {
  const by = {};
  for (const p of P.parts) for (const s of 'tblr') {
    const ref = p.gr?.[s], g = ref && P.grooves?.[ref];
    if (!g) continue;
    const len = (s === 't' || s === 'b' ? p.l : p.w) * p.count / 1000;
    by[ref] = by[ref] || { ref, name: g.name, len: 0, sides: 0 };
    by[ref].len += len; by[ref].sides += p.count;
  }
  return by;
}

/** Сколько штук каждой детали попало в раскрой (для колонки «в раскрое»). */
export function placedCounts(R) {
  const c = new Map();
  for (const x of R.mats) for (const s of x.r.sheets) for (const it of s.items) c.set(it.p.id, (c.get(it.p.id) || 0) + 1);
  return c;
}
