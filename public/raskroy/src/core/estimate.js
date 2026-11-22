/* Смета заказа и КП клиенту. Строки берутся из расчёта стоимости (cost → lines), сверху — наценка, скидка
   и «материал заказчика» (плиту или кромку клиент привёз сам, считаем только работу).
   Прайс сайта (плиты, кромка, фурнитура, цены работ) подставляется там, где у материала своей цены нет. */
import { matKey } from './project.js';

export const EST_DEFAULT = { ownSheets: false, ownBands: false, markupMat: 0, markupWork: 0, discount: 0, validDays: 7 };
export const GROUP_NAME = { mat: 'Материалы', work: 'Работы', kit: 'Фурнитура и прочее' };

const r2 = v => Math.round(v * 100) / 100;

/** Смета по проекту. C — результат cost(). Цены в строках для клиента уже с наценкой. */
export function estimate(P, C) {
  const e = { ...EST_DEFAULT, ...(P.est || {}) };
  const groups = { mat: [], work: [], kit: [] };
  for (const op of C.ops) for (const l of op.lines || []) {
    if (l.g === 'mat' && ((op.type === 'CS' || op.type === 'CN') && e.ownSheets || op.type === 'EL' && e.ownBands)) continue;
    if (!l.qty) continue;
    const k = 1 + (l.g === 'work' ? +e.markupWork || 0 : +e.markupMat || 0) / 100;
    groups[l.g].push({ ...l, op: op.key, base: l.sum, price: r2(l.price * k), sum: r2(l.price * k) * l.qty });
  }
  const sum = (a, f) => a.reduce((s, l) => s + l[f], 0);
  const all = [...groups.mat, ...groups.work, ...groups.kit];
  const byPrice = sum(all, 'base'), withMarkup = sum(all, 'sum');
  const discount = withMarkup * (+e.discount || 0) / 100;
  return {
    e, groups,
    totals: Object.fromEntries(Object.keys(groups).map(g => [g, sum(groups[g], 'sum')])),
    byPrice, markup: withMarkup - byPrice, discount, total: Math.round(withMarkup - discount),
    missing: all.filter(l => l.missing),
  };
}

const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();

/** Ищет позицию прайса для материала: по коду, по точному названию, или единственную, чьё название
 *  начинается с названия материала и совпадает по толщине. */
export function findInCatalog(list, { code, name, t }) {
  if (!list?.length) return null;
  if (code) { const c = list.find(x => x.code && x.code === code); if (c) return c; }
  const n = norm(name); if (!n) return null;
  const exact = list.filter(x => norm(x.name) === n && (t == null || x.t == null || +x.t === +t));
  if (exact.length === 1) return exact[0];
  const pre = list.filter(x => norm(x.name).startsWith(n) && (t == null || x.t == null || +x.t === +t));
  return pre.length === 1 ? pre[0] : null;
}

/** Цены из прайса сайта для материалов проекта, у которых нет своей цены: {prices по matKey, bandPrices по ключу кромки, found}. */
export function catalogPrices(P, cat) {
  const prices = {}, bandPrices = {}, found = {};
  if (!cat) return { prices, bandPrices, found };
  for (const m of P.materials) {
    const s = findInCatalog(cat.sheets, m);
    if (!s) continue;
    // Цена листа сайта пересчитывается на формат листа в проекте через цену за м².
    prices[matKey(m)] = s.L && s.W && (s.L !== m.L || s.W !== m.W) ? r2(s.price / (s.L * s.W) * m.L * m.W) : s.price;
    found['m:' + m.id] = s;
  }
  for (const [k, b] of Object.entries(P.bands)) {
    const s = findInCatalog(cat.bands, b);
    if (s) { bandPrices[k] = s.price; found['b:' + k] = s; }
  }
  return { prices, bandPrices, found };
}

/** Цены работ сайта в виде общих расценок программы. */
export function servicesToBase(s) {
  if (!s) return {};
  const o = {};
  if (s.sheet != null) o.cutPrice = s.sheet;
  if (s.edge != null) o.edgePrice = s.edge;
  if (s.drilling) o.holePrices = Object.fromEntries(Object.entries(s.drilling).map(([d, p]) => [+d, +p]));
  if (s.milling != null) o.curvePrice = s.milling;
  if (s.groove != null) o.groovePrice = s.groove;
  return o;
}
