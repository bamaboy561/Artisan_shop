/* Присадка детали: отверстия в пласть и в торец, типовые наборы (петли, полкодержатели, конфирматы, шканты)
   и загрузка отверстий и фрезеровки из чертежа DXF.
   Координаты в пласти: x вдоль длины детали от левого края, y вдоль ширины от верхнего края, мм.
   Отверстие в торец: side 'bt'|'bb'|'bl'|'br' (верх, низ, лево, право), x — положение вдоль торца, z — от лицевой пласти. */

export const SIDE_NAME = { face: 'пласть', bt: 'торец верх', bb: 'торец низ', bl: 'торец лево', br: 'торец право' };

const r1 = v => Math.round(v * 10) / 10;

/** Петли: чашка Ø35 у края двери (по умолчанию левого), отступ от торцов from, ещё одна петля на каждые 900 мм высоты. */
export function hingeHoles(p, { edge = 'l', offset = 22.5, from = 100, d = 35, dp = 12 } = {}) {
  const along = edge === 'l' || edge === 'r' ? p.w : p.l;
  const n = along > 1800 ? 4 : along > 900 ? 3 : 2;
  const pos = Array.from({ length: n }, (_, i) => r1(from + (along - 2 * from) * i / (n - 1)));
  return pos.map(a => ({ side: 'face', d, dp,
    x: edge === 'l' ? offset : edge === 'r' ? r1(p.l - offset) : a,
    y: edge === 't' ? offset : edge === 'b' ? r1(p.w - offset) : a }));
}

/** Полкодержатели: два ряда Ø5 вдоль длины детали, отступ inset от переднего и заднего края, шаг 32 мм. */
export function shelfPinHoles(p, { inset = 37, step = 32, from = 100, to = null, d = 5, dp = 12 } = {}) {
  const end = to ?? p.l - from, out = [];
  for (let x = from; x <= end + 1e-6; x += step) for (const y of [inset, p.w - inset]) out.push({ side: 'face', d, dp, x: r1(x), y: r1(y) });
  return out;
}

/** Крепёж боковины к горизонтали: отверстия в пласть по линии t/2 от края edge, отступ from от торцов и по одному на каждые 300 мм. */
export function faceJoinHoles(p, { edge = 't', t = 16, from = 50, d = 5, dp = null } = {}) {
  const along = edge === 'l' || edge === 'r' ? p.w : p.l;
  const n = Math.max(2, Math.ceil((along - 2 * from) / 300) + 1);
  const off = t / 2;
  return Array.from({ length: n }, (_, i) => r1(from + (along - 2 * from) * i / (n - 1))).map(a => ({ side: 'face', d, dp: dp ?? t,
    x: edge === 'l' ? off : edge === 'r' ? r1(p.l - off) : a, y: edge === 't' ? off : edge === 'b' ? r1(p.w - off) : a }));
}

/** Отверстия в торец (конфирмат Ø7, шкант Ø8): по торцу edge, отступ from от углов, z — середина толщины. */
export function edgeHoles(p, { edge = 't', from = 50, d = 7, dp = 50, t = 16 } = {}) {
  const along = edge === 'l' || edge === 'r' ? p.w : p.l;
  const n = Math.max(2, Math.ceil((along - 2 * from) / 300) + 1);
  return Array.from({ length: n }, (_, i) => ({ side: 'b' + edge, d, dp, x: r1(from + (along - 2 * from) * i / (n - 1)), z: r1(t / 2) }));
}

/** Отверстия, которые выходят за деталь (после изменения размера или поворота). */
export function badHoles(p) {
  return (p.holes || []).filter(h => h.side === 'face' && (h.x == null || h.x - h.d / 2 < -0.01 || h.y - h.d / 2 < -0.01 || h.x + h.d / 2 > p.l + 0.01 || h.y + h.d / 2 > p.w + 0.01));
}

/* ---------- DXF ---------- */

const arcLen = (r, a0, a1) => { let da = (a1 - a0) % 360; if (da <= 0) da += 360; return r * da * Math.PI / 180; };
const bulgeLen = (a, b, bulge) => {
  const c = Math.hypot(b.x - a.x, b.y - a.y);
  if (!bulge) return c;
  const th = 4 * Math.atan(Math.abs(bulge));
  return c * th / (2 * Math.sin(th / 2));
};
const polyArea = pts => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p.x * q.y - q.x * p.y; }, 0) / 2);

/** Разбирает чертёж DXF (ASCII): отрезки, полилинии, окружности и дуги. */
export function parseDxf(text) {
  const lines = text.split(/\r?\n/);
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([+lines[i].trim(), lines[i + 1].trim()]);
  const circles = [], paths = [];
  let i = pairs.findIndex(([c, v], k) => c === 2 && v === 'ENTITIES' && pairs[k - 1]?.[1] === 'SECTION');
  if (i < 0) i = 0;
  let poly = null;
  const ent = () => { // собрать свойства одной сущности до следующего кода 0
    const e = { list: [] };
    for (i++; i < pairs.length && pairs[i][0] !== 0; i++) { const [c, v] = pairs[i]; e.list.push([c, v]); if (!(c in e)) e[c] = v; }
    return e;
  };
  while (i < pairs.length) {
    const [c, v] = pairs[i];
    if (c !== 0) { i++; continue; }
    if (v === 'ENDSEC' || v === 'EOF') break;
    const type = v, e = ent(), layer = e[8] || '';
    if (type === 'LINE') paths.push({ layer, closed: false, pts: [{ x: +e[10], y: +e[20] }, { x: +e[11], y: +e[21] }] });
    else if (type === 'CIRCLE') circles.push({ layer, x: +e[10], y: +e[20], r: +e[40] });
    else if (type === 'ARC') {
      const r = +e[40], a0 = +e[50], a1 = +e[51], cx = +e[10], cy = +e[20], pt = a => ({ x: cx + r * Math.cos(a * Math.PI / 180), y: cy + r * Math.sin(a * Math.PI / 180) });
      paths.push({ layer, closed: false, pts: [pt(a0), pt(a1)], len: arcLen(r, a0, a1), extra: [pt((a0 + (a1 < a0 ? a1 + 360 : a1)) / 2)] });
    } else if (type === 'LWPOLYLINE') {
      const pts = []; let last = null;
      for (const [k, val] of e.list) {
        if (k === 10) { last = { x: +val, y: 0, b: 0 }; pts.push(last); }
        else if (k === 20 && last) last.y = +val;
        else if (k === 42 && last) last.b = +val;
      }
      paths.push({ layer, closed: (+e[70] & 1) === 1, pts });
    } else if (type === 'POLYLINE') poly = { layer, closed: (+e[70] & 1) === 1, pts: [] };
    else if (type === 'VERTEX' && poly) poly.pts.push({ x: +e[10], y: +e[20], b: +(e[42] || 0) });
    else if (type === 'SEQEND' && poly) { paths.push(poly); poly = null; }
  }
  for (const p of paths) if (p.len == null) {
    let len = 0; const n = p.pts.length;
    for (let k = 0; k < n - 1 + (p.closed ? 1 : 0); k++) len += bulgeLen(p.pts[k], p.pts[(k + 1) % n], p.pts[k].b);
    p.len = len;
  }
  return { circles, paths };
}

const depthOf = (layer, def) => { const m = /(?:^|[^a-zа-я])(?:d|dp|depth|глуб\w*)[ _=-]?(\d+(?:[.,]\d+)?)/i.exec(' ' + layer); return m ? +m[1].replace(',', '.') : def; };

/** Деталь из чертежа: внешний контур задаёт размер, малые окружности — отверстия, остальные линии — фрезеровка.
 *  Ось Y в DXF смотрит вверх, у нас — вниз от верхнего края детали. Глубина берётся из имени слоя (D12, DEPTH_8), иначе def. */
export function dxfToPart(dxf, { maxHole = 35, depth = 12 } = {}) {
  const all = [...dxf.paths.flatMap(p => [...p.pts, ...(p.extra || [])]), ...dxf.circles.flatMap(c => [{ x: c.x - c.r, y: c.y - c.r }, { x: c.x + c.r, y: c.y + c.r }])];
  if (!all.length) throw new Error('В чертеже нет линий и окружностей');
  const closed = dxf.paths.filter(p => p.closed && p.pts.length > 2).sort((a, b) => polyArea(b.pts) - polyArea(a.pts));
  const outer = closed[0] || null;
  const box = pts => ({ x0: Math.min(...pts.map(p => p.x)), y0: Math.min(...pts.map(p => p.y)), x1: Math.max(...pts.map(p => p.x)), y1: Math.max(...pts.map(p => p.y)) });
  const b = box(outer ? outer.pts : all);
  const X = x => r1(x - b.x0), Y = y => r1(b.y1 - y);
  const holes = [], mill = [];
  let millLen = 0;
  for (const c of dxf.circles) {
    if (2 * c.r <= maxHole + 1e-6) holes.push({ side: 'face', x: X(c.x), y: Y(c.y), d: r1(2 * c.r), dp: depthOf(c.layer, depth) });
    else { millLen += 2 * Math.PI * c.r; mill.push({ circle: true, x: X(c.x), y: Y(c.y), r: c.r }); }
  }
  for (const p of dxf.paths) if (p !== outer) { millLen += p.len; mill.push({ pts: p.pts.map(q => ({ x: X(q.x), y: Y(q.y) })), closed: p.closed }); }
  return { l: r1(b.x1 - b.x0), w: r1(b.y1 - b.y0), holes, mill: Math.round(millLen), paths: mill, contour: !!outer };
}
