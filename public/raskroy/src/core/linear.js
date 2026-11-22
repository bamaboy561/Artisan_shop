/* Погонажный раскрой (столешницы, профиль, планки): детали по длине раскладываются на хлысты
   «первым подходящим по убыванию», с пропилом и торцовкой концов. */

/** op: {len — длина хлыста, kerf, trim — торцовка с каждого конца, parts: [{id,name,l,count}]}.
 *  Возвращает {bars: [{items:[{p,x,l}], used, rest}], tooLong, cuts, usedLen}. */
export function optimizeLinear(op) {
  const L = +op.len || 0, k = +(op.kerf ?? 4.4), t = +(op.trim ?? 0), work = L - 2 * t;
  const items = [], tooLong = [];
  for (const p of op.parts || []) for (let i = 0; i < (p.count || 0); i++) (p.l > work ? tooLong : items).push(p);
  items.sort((a, b) => b.l - a.l);
  const bars = [];
  for (const p of items) {
    let bar = bars.find(b => b.free >= p.l - 1e-6);
    if (!bar) { bar = { items: [], free: work, x: t }; bars.push(bar); }
    bar.items.push({ p, x: bar.x, l: p.l });
    bar.x += p.l + k; bar.free -= p.l + k;
  }
  let cuts = 0, usedLen = 0;
  for (const b of bars) {
    b.used = b.items.reduce((a, i) => a + i.l, 0);
    b.rest = Math.max(0, L - t - (b.x - k)); // хвост после последней детали
    cuts += b.items.length + (t > 0 ? 1 : 0) - (b.rest <= 0 ? 1 : 0);
    usedLen += b.used;
    delete b.free;
  }
  return { bars, tooLong, cuts, usedLen, util: bars.length ? usedLen / (bars.length * L) : 0 };
}
