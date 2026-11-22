/* Ручная правка карты раскроя: детали можно двигать, поворачивать, убирать с карты и класть на другой лист.
   Правленая карта хранится в материале (m.manual) и действует, пока не изменились детали и параметры раскроя.
   Координаты деталей — внутри листа после торцовки, как у автоматического раскроя. */
const EPS = 1e-6;

const inner = s => ({ w: s.L - 2 * (s.tx || 0), h: s.W - 2 * (s.ty || 0) });

/** Можно ли положить деталь l×w в точку x,y: внутри листа и с зазором k (пропил или фреза) от остальных. */
export function canPlace(sheet, x, y, l, w, k, skip = -1) {
  const a = inner(sheet);
  if (x < -EPS || y < -EPS || x + l > a.w + EPS || y + w > a.h + EPS) return false;
  return sheet.items.every((o, i) => i === skip
    || x >= o.x + o.l + k - EPS || o.x >= x + l + k - EPS || y >= o.y + o.w + k - EPS || o.y >= y + w + k - EPS);
}

/** Притягивает точку к краям листа и соседних деталей (с учётом пропила), если они ближе tol мм. */
export function snapPos(sheet, idx, x, y, k, tol = 40) {
  const it = sheet.items[idx], a = inner(sheet);
  const xs = [0, a.w - it.l], ys = [0, a.h - it.w];
  sheet.items.forEach((o, i) => { if (i !== idx) { xs.push(o.x + o.l + k, o.x - k - it.l, o.x); ys.push(o.y + o.w + k, o.y - k - it.w, o.y); } });
  const near = (v, list) => list.reduce((b, c) => (Math.abs(c - v) < Math.abs(b - v) ? c : b), Infinity);
  const nx = near(x, xs), ny = near(y, ys);
  return { x: Math.abs(nx - x) <= tol ? nx : Math.round(x), y: Math.abs(ny - y) <= tol ? ny : Math.round(y) };
}

/** Первое свободное место для детали: перебираем углы уже лежащих деталей, сверху вниз и слева направо. */
export function findSpot(sheet, l, w, k, canRotate = false) {
  const xs = [0, ...sheet.items.map(o => o.x + o.l + k)], ys = [0, ...sheet.items.map(o => o.y + o.w + k)];
  const pts = ys.flatMap(y => xs.map(x => ({ x, y }))).sort((a, b) => a.y - b.y || a.x - b.x);
  for (const r of canRotate ? [false, true] : [false]) {
    const L = r ? w : l, W = r ? l : w;
    for (const p of pts) if (canPlace(sheet, p.x, p.y, L, W, k)) return { ...p, rot: r };
  }
  return null;
}

/** Разбирает раскладку на сквозные (гильотинные) резы, как их делает форматная пила.
 *  Возвращает {cuts, free} или null, если карту нельзя порезать сквозными резами. */
export function guillotine(items, W, H, k) {
  const cuts = [], free = [];
  const go = (rx, ry, rw, rh, list) => {
    if (rw <= EPS || rh <= EPS) return true;
    if (!list.length) { free.push({ x: rx, y: ry, w: rw, h: rh }); return true; }
    if (list.length === 1) {
      const it = list[0];
      if (it.x - rx < EPS && it.y - ry < EPS && rx + rw - (it.x + it.l) < EPS && ry + rh - (it.y + it.w) < EPS) return true;
    }
    if (list.some(it => it.x < rx - EPS || it.y < ry - EPS)) return false;
    // Сквозной рез: полоса пропила [c, c+k] не задевает ни одну деталь. Пробуем резы по нижним и правым краям деталей.
    const tryCut = horiz => {
      const st = horiz ? ry : rx, lim = horiz ? ry + rh : rx + rw;
      // резы по дальнему краю детали и вплотную перед деталью (если рядом убрали деталь, линия реза осталась)
      const ends = [...new Set(list.flatMap(it => (horiz ? [it.y + it.w, it.y - k] : [it.x + it.l, it.x - k])))].filter(c => c > st + EPS).sort((a, b) => a - b);
      for (const c of ends) {
        if (c >= lim - EPS) continue;
        const before = [], after = [];
        let ok = true;
        for (const it of list) {
          const s = horiz ? it.y : it.x, e = horiz ? it.y + it.w : it.x + it.l;
          if (e <= c + EPS) before.push(it); else if (s >= c + k - EPS) after.push(it); else { ok = false; break; }
        }
        if (!ok) continue;
        const mark = cuts.length;
        cuts.push(horiz ? { d: 'H', x: rx, y: c, len: rw } : { d: 'V', x: c, y: ry, len: rh });
        const rest = Math.max(0, lim - c - k), fl = free.length;
        const ok2 = horiz ? go(rx, ry, rw, c - ry, before) && go(rx, c + k, rw, rest, after)
          : go(rx, ry, c - rx, rh, before) && go(c + k, ry, rest, rh, after);
        if (ok2) return true;
        cuts.length = mark; free.length = fl;
      }
      return false;
    };
    return rw >= rh ? tryCut(false) || tryCut(true) : tryCut(true) || tryCut(false);
  };
  return go(0, 0, W, H, items) ? { cuts, free } : null;
}

/** Отпечаток деталей и параметров: если он изменился, ручная карта устарела. */
export function layoutSig(m, items, k, tx, ty, mode) {
  const by = {};
  items.forEach(it => { const key = `${it.p.id}:${it.l}x${it.w}:${it.rot ? 1 : 0}`; by[key] = (by[key] || 0) + 1; });
  return `${mode}|${m.L}x${m.W}|${k}|${tx},${ty}|` + Object.keys(by).sort().map(key => key + '*' + by[key]).join(';');
}

/** Ручная карта из готового автоматического раскроя — с неё начинается правка. */
export function snapshotManual(r) {
  return { sig: r.sig, sheets: r.sheets.map(s => ({ L: s.L, W: s.W, tx: s.tx, ty: s.ty,
    ...(s.stock ? { stock: s.stock } : {}), ...(s.format ? { format: s.format } : {}),
    items: s.items.map(it => ({ id: it.p.id, x: it.x, y: it.y, l: it.l, w: it.w, rot: !!it.rot })) })) };
}

/** Листы для расчёта из ручной карты: резы и остатки считаются заново, неразложенные детали — отдельно. */
export function sheetsFromManual(man, items, k) {
  const left = [...items];
  const take = id => { const i = left.findIndex(it => it.p.id === id); return i < 0 ? null : left.splice(i, 1)[0]; };
  const sheets = man.sheets.map((ms, mi) => {
    const s = { mi, L: ms.L, W: ms.W, tx: ms.tx || 0, ty: ms.ty || 0, trim: ms.tx || 0, ...(ms.stock ? { stock: ms.stock } : {}), ...(ms.format ? { format: ms.format } : {}), keep: ms.keep, items: [] };
    ms.items.forEach((q, qi) => {
      const it = take(q.id);
      if (it) s.items.push({ qi, x: q.x, y: q.y, l: q.rot ? it.w : it.l, w: q.rot ? it.l : it.w, rot: q.rot, p: it.p });
    });
    const a = inner(s), g = guillotine(s.items, a.w, a.h, k);
    const trimCuts = [...(s.ty > 0 ? [{ d: 'T', len: s.L }] : []), ...(s.tx > 0 ? [{ d: 'T', len: s.W }] : [])];
    s.free = g ? g.free : [];
    s.cuts = g ? [...trimCuts, ...g.cuts] : trimCuts;
    s.guillotine = !!g;
    s.cut = (s.tx > 0 ? 2 * s.W : 0) + (s.ty > 0 ? 2 * s.L : 0) + (g ? g.cuts.reduce((x, c) => x + c.len, 0) : 0);
    return s;
  }).filter(s => s.items.length || s.keep);
  return { sheets, unplaced: left };
}
