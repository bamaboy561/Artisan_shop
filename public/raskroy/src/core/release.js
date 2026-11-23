/* «Выпустить в работу»: одна проверка перед цехом (комплектность, геометрия карт, ограничения станков, цены)
   и фиксация версии проекта, по которой готовятся карты, этикетки и файлы для станков. */
import { placedCounts } from './operations.js';
import { badHoles } from './drill.js';
import { layoutKey } from './stockops.js';

const h32 = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };

/** Отпечаток того, что уходит в цех: детали, материалы, кромки, пазы, параметры и ручные карты.
 *  Шапка заказа, статус, смета и КП в него не входят. */
export function productionHash(P) {
  const pick = ({ id, name, l, w, count, grain, edges, gr, material, holes, mill, product, code }) => ({ id, name, l, w, count, grain, edges, gr, material, holes, mill, product, code });
  return h32(JSON.stringify({ parts: P.parts.map(pick), materials: P.materials, bands: P.bands, grooves: P.grooves || {}, linear: P.linear || [] }));
}

/** Проверка перед выпуском. limits: {sawL, sawW, cncL, cncW} — 0 или пусто, если не проверять.
 *  Возвращает {errors, warnings}: с ошибками выпускать нельзя, предупреждения показываются. */
export function releaseCheck(P, R, C, E, limits = {}) {
  const errors = [], warnings = [];
  const live = P.parts.filter(p => p.count > 0);
  if (!live.length) errors.push('В проекте нет деталей.');
  const mats = new Set(P.materials.map(m => m.id));
  for (const p of live) {
    if (!(p.l > 0 && p.w > 0)) errors.push(`№${p.id} «${p.name}»: не задан размер.`);
    if (!mats.has(p.material)) errors.push(`№${p.id} «${p.name}»: не выбран материал (операция раскроя).`);
    for (const s of ['t', 'b', 'l', 'r']) if (p.edges?.[s] && !P.bands[p.edges[s]]) errors.push(`№${p.id} «${p.name}»: кромка стороны ${s} не найдена в операциях кромки.`);
    if (badHoles(p).length) errors.push(`№${p.id} «${p.name}»: отверстия выходят за деталь (${badHoles(p).length}).`);
  }
  const placed = placedCounts(R);
  for (const x of R.mats) {
    const r = x.r, name = `${x.m.name} ${x.m.t} мм`;
    for (const t of r.tooBig) errors.push(`${name}: №${t.p.id} «${t.p.name}» ${t.l}×${t.w} — ${t.why || 'больше листа'}.`);
    for (const u of r.unplaced) errors.push(`${name}: №${u.p.id} «${u.p.name}» не разложена — ${u.why || 'нет места на картах'}.`);
    for (const e of r.errors) errors.push(`${name}, карта ${e.sheet + 1}: №${e.p.id} «${e.p.name}» — ${e.msg}.`);
    if (x.mode !== 'cnc' && r.sheets.some(s => s.guillotine === false)) errors.push(`${name}: ручная карта не режется сквозными резами на пиле.`);
    const told = new Set([...r.tooBig, ...r.unplaced].map(t => t.p.id));
    for (const p of live.filter(p => p.material === x.m.id && !told.has(p.id))) {
      const n = placed.get(p.id) || 0;
      if (n < p.count && !r.small.some(s => s.p === p)) errors.push(`${name}: №${p.id} «${p.name}» на картах ${n} из ${p.count}.`);
    }
    if (r.small.length) warnings.push(`${name}: деталей меньше минимального размера, на карты не попали: ${r.small.length}.`);
    const [mL, mW] = x.mode === 'cnc' ? [limits.cncL, limits.cncW] : [limits.sawL, limits.sawW];
    const big = r.sheets.filter(s => (mL > 0 && Math.max(s.L, s.W) > mL) || (mW > 0 && Math.min(s.L, s.W) > mW));
    if (big.length) errors.push(`${name}: лист ${big[0].L}×${big[0].W} больше, чем принимает ${x.mode === 'cnc' ? 'ЧПУ' : 'пила'} (${mL || '—'}×${mW || '—'}).`);
    if (x.mode === 'cnc') warnings.push(`${name}: программа для ЧПУ ещё не сверена с образцом .nc, файл на станок не выпускается.`);
    if (r.stale) warnings.push(`${name}: ручные правки карты устарели, карта рассчитана заново.`);
  }
  if (E?.missing?.length) warnings.push(`Нет цены у ${E.missing.length} поз. сметы: ${E.missing.slice(0, 5).map(l => l.name).join(', ')}${E.missing.length > 5 ? '…' : ''}. Клиентское КП не утвердить, пока цены не заполнены.`);
  return { errors, warnings };
}

/** Запись о выпуске: номер версии, время, отпечаток проекта и карт. */
export function makeRelease(P, R, C, { now = Date.now(), by = '' } = {}) {
  const n = (P.releases || []).reduce((a, x) => Math.max(a, x.n), 0) + 1;
  return { n, at: now, by, hash: productionHash(P), sheets: C.sheets, parts: P.parts.reduce((a, p) => a + (+p.count || 0), 0),
    maps: R.mats.map(x => ({ mat: x.m.id, name: `${x.m.name} ${x.m.t} мм`, sheets: x.r.fullCount, key: layoutKey(x.r) })) };
}

/** Последний выпуск и изменён ли проект после него. */
export function releaseState(P) {
  const last = (P.releases || [])[P.releases?.length - 1];
  return last ? { last, changed: last.hash !== productionHash(P) } : { last: null, changed: false };
}
