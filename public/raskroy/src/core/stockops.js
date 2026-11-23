/* Склад остатков: каждое оприходование — складская операция, привязанная к заказу, материалу и версии карт.
   Повторный расчёт той же карты ничего не добавляет; если карта изменилась, прежняя операция откатывается
   и записывается новая. Остатки своего же заказа этому заказу в раскрой не идут, а взятые им со склада
   остаются ему доступны, поэтому после оприходования карта не «уплывает». */
import { matKey } from './project.js';

const h32 = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };

/** Версия карт материала: листы, детали на них, взятые остатки и новые деловые остатки. */
export function layoutKey(r) {
  return h32(JSON.stringify([
    r.sheets.map(s => [s.stock ? 'S' + s.stock.id : s.format ? 'F' : '', s.L, s.W, s.items.map(i => [i.p?.id, i.x, i.y, i.l, i.w, i.rot ? 1 : 0])]),
    r.offcuts.map(o => [o.sheet, o.l, o.w]),
  ]));
}

/** Склад, каким его видит заказ uid: без остатков, которые этот заказ сам оприходовал, и с теми, что он уже списал.
 *  Материал, по которому заказ уже оприходовал остатки (лист порезан), видит только свои взятые остатки:
 *  новые куски, которые позже положили на склад другие заказы, его карту не меняют.
 *  locks — такие же замки от выпуска в работу: Map matKey → Set id остатков, взятых в выпущенную карту. */
export function stockForProject(stock, ledger, uid, locks = null) {
  const mine = (ledger || []).filter(o => o.uid === uid);
  if (!mine.length && !locks?.size) return stock;
  const added = new Set(mine.flatMap(o => o.added.map(a => a.id)));
  const lock = new Map(locks || []);
  for (const o of mine) { const mk = o.mk || o.added[0]?.mat || o.used[0]?.mat; if (mk) lock.set(mk, new Set(o.used.map(u => u.id))); }
  const have = new Set(stock.map(s => s.id));
  const free = s => !added.has(s.id) && (!lock.has(s.mat) || lock.get(s.mat).has(s.id));
  return [...stock.filter(free), ...mine.flatMap(o => o.used).filter(u => !have.has(u.id))];
}

/** Состояние складской операции заказа по материалу: 'none' — не было, 'done' — эта карта уже на складе,
 *  'changed' — на складе прежняя версия карты, 'blocked' — прежняя версия, но её остатки уже взял другой заказ. */
export function stockOpState(ledger, r, uid, matId) {
  const op = (ledger || []).find(o => o.uid === uid && o.mat === matId);
  if (!op) return { state: 'none' };
  if (op.key === layoutKey(r)) return { state: 'done', op };
  const by = consumers(ledger, op);
  return by.length ? { state: 'blocked', op, by } : { state: 'changed', op };
}

/** Чужие складские операции, которые уже взяли в раскрой остатки этой операции. */
export function consumers(ledger, op) {
  const ids = new Set(op.added.map(a => a.id));
  return (ledger || []).filter(o => o !== op && o.used.some(u => ids.has(u.id)));
}

function revert(stock, op) {
  const added = new Set(op.added.map(a => a.id)), have = new Set(stock.map(s => s.id));
  return [...stock.filter(s => !added.has(s.id)), ...op.used.filter(u => !have.has(u.id))];
}

/** Оприходовать остатки карты и списать взятые со склада. Возвращает {stock, ledger, done, replaced, blocked}; исходные не меняет.
 *  Если остатки прежней версии уже взял другой заказ, замена не делается: blocked — список таких операций. */
export function applyStockOp(stock, ledger = [], r, { uid, matId, from = '', now = Date.now(), newId = () => now + Math.random() }) {
  const key = layoutKey(r), prev = ledger.find(o => o.uid === uid && o.mat === matId);
  if (prev && prev.key === key) return { stock, ledger, done: false, replaced: false };
  const by = prev ? consumers(ledger, prev) : [];
  if (by.length) return { stock, ledger, done: false, replaced: false, blocked: by };
  let st = prev ? revert(stock, prev) : stock;
  const usedIds = new Set(r.stockUsed.map(s => s.stock.id));
  const used = st.filter(s => usedIds.has(s.id));
  const added = r.offcuts.map(o => ({ id: newId(), mat: matKey(r.m), name: r.m.name, t: r.m.t, l: o.l, w: o.w, from, order: uid }));
  st = st.filter(s => !usedIds.has(s.id)).concat(added);
  const op = { uid, mat: matId, mk: matKey(r.m), key, at: now, from, used, added };
  return { stock: st, ledger: [...ledger.filter(o => o !== prev), op].slice(-500), done: true, replaced: !!prev };
}
