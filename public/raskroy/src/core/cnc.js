/* ЧПУ Excitech под NCStudio: программа листа нестинга (.anc) и программа этикетировщика (.cyc).
   Формат сверен с файлами со станка цеха (лист 2800×1220×18, фреза 6 мм):
   - ось Y станка идёт вдоль длины листа, ось X — поперёк и со знаком минус;
   - ноль Z на столе: верх листа Z = толщина, сквозной рез Z = 0;
   - сначала предрез всех линий в два прохода с оставлением тонкого слоя, потом чистовой обход каждой детали
     от мелких к крупным, с заходом на кромке детали и перекрытием в конце;
   - этикетировщик ставит этикетку в центр детали: V = X, U = Y.
   Сверловка в образцах не встречалась: её блок собран по таблице инструментов станка и перед первым
   запуском проверяется холостым ходом. */

/** Отверстия детали в координатах листа (без торцовки). При повороте X детали идёт вдоль Y листа. */
export function holePoints(it) {
  return it.p.holes.filter(h => h.side === 'face').map(h => ({
    X: it.rot ? it.x + h.y : it.x + h.x,
    Y: it.rot ? it.y + (it.p.l - h.x) : it.y + h.y,
    d: h.d, dp: h.dp,
  }));
}

const HEAD = ['G90', 'G40', 'G80', 'M724', 'M709', 'G53 Z0', 'G54', 'M722', 'M721', 'M15', 'M05'];
const TAIL = ['M05', 'M15', 'M721', 'G53Z0', 'M05', 'M722', 'M721', 'G53 Z0', 'M603', 'M30', ';', '%'];

const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ө: 'o', ү: 'u', ң: 'n' };
/** Латиница для комментариев программы: «МДФ Крем брюле» → «MDF Krem bryule». */
export function cncText(s) {
  return String(s ?? '').split('').map(ch => { const l = ch.toLowerCase(), t = TR[l]; if (t === undefined) return ch; return ch === l ? t : t.charAt(0).toUpperCase() + t.slice(1); })
    .join('').replace(/[^\x20-\x7e]/g, '').replace(/[()]/g, '').trim();
}

const f1 = v => (Math.round(v * 10) / 10 + 0).toFixed(1);

/** Прямоугольник обхода детали в координатах станка (центр фрезы на расстоянии радиуса от детали). */
export function cncRect(it, s, r) {
  const tx = s.tx ?? s.trim, ty = s.ty ?? s.trim;
  const y0 = it.x + tx - r, y1 = it.x + tx + it.l + r, x0 = -(it.y + ty - r), x1 = -(it.y + ty + it.w + r);
  return { x0, x1, y0, y1 }; // x0 > x1: ось X станка отрицательная
}

/** Отрезки всех контуров без повторов: общие линии соседних деталей сливаются в одну. */
export function cutLines(rects) {
  const k = v => Math.round(v * 1000) / 1000, H = new Map(), V = new Map();
  const put = (map, key, a, b) => { const l = map.get(key) || []; l.push([Math.min(a, b), Math.max(a, b)]); map.set(key, l); };
  for (const q of rects) {
    put(H, k(q.y0), q.x0, q.x1); put(H, k(q.y1), q.x0, q.x1);
    put(V, k(q.x0), q.y0, q.y1); put(V, k(q.x1), q.y0, q.y1);
  }
  const merge = l => l.sort((a, b) => a[0] - b[0]).reduce((acc, s) => {
    const last = acc.at(-1); if (last && s[0] <= last[1] + 1e-6) last[1] = Math.max(last[1], s[1]); else acc.push([...s]); return acc;
  }, []);
  const out = [];
  for (const [y, l] of V) for (const [a, b] of merge(l)) out.push({ ax: y, ay: a, bx: y, by: b }); // вдоль Y станка
  for (const [y, l] of H) for (const [a, b] of merge(l)) out.push({ ax: b, ay: y, bx: a, by: y }); // поперёк, от края к центру
  return out;
}

/** Таблица свёрл станка из строки «7=16, 8=17, 10=21»: диаметр → номер инструмента. */
export function drillTable(str) {
  const t = {};
  String(str ?? '').split(/[,;\s]+/).forEach(x => { const m = x.match(/^(\d+(?:\.\d+)?)=(\d+)$/); if (m) t[+m[1]] = +m[2]; });
  return t;
}

/** Глубины предреза: шагами stepZ вниз от верха листа, последний проход оставляет слой leave. */
export function preDepths(t, stepZ, leave) {
  const d = []; let z = t;
  while (stepZ > 0 && z - stepZ > leave + 1e-9) { z -= stepZ; d.push(z); }
  d.push(leave);
  return d;
}

/**
 * Программа одного листа нестинга для Excitech (NCStudio, файл .anc).
 * o: toolD, spindle, feedXY, feedZ, lift (отвод над листом), overcut (рез ниже стола), preCut, preStep, preLeave,
 *    lead (заход на кромке детали от угла), overlap (перекрытие в конце обхода), drillTools («7=16, 8=17»: диаметр сверла = номер T),
 *    drillS и drillFeed (обороты и подача сверла; 0 — как у фрезы).
 * Возвращает { text, warnings }.
 */
export function excitechProgram(m, s, o) {
  const r = o.toolD / 2, t = +m.t, safe = t + (+o.lift || 20), zCut = -(+o.overcut || 0);
  const L = [], add = x => L.push(x), warnings = [];
  const tool = (name, T) => { add(`//${o.toolD}MM ${name}`); add(`T${T}`); add(`M03 S${o.spindle}`); add('M744'); add(`G0 Z${f1(safe)}`); };
  add(`//${cncText(m.name)} :${s.L}*${s.W}*${t}`);
  HEAD.forEach(add); add(`G0 Z${f1(safe)}`);

  // Сверловка в пласть: по диаметрам, номер инструмента из таблицы станка.
  const tx = s.tx ?? s.trim, ty = s.ty ?? s.trim, byD = {};
  s.items.forEach(it => holePoints(it).forEach(h => (byD[h.d] = byD[h.d] || []).push(h)));
  for (const [d, hs] of Object.entries(byD).sort((a, b) => a[0] - b[0])) {
    const T = drillTable(o.drillTools)[d];
    if (!T) { warnings.push(`Нет сверла ${d} мм в таблице инструментов: ${hs.length} отв. пропущено`); continue; }
    add(`//${d}MM Bore${d}`); add(`T${T}`); add(`M03 S${+o.drillS || o.spindle}`); add('M744'); add(`G0 Z${f1(safe)}`);
    hs.sort((a, b) => a.X - b.X || a.Y - b.Y).forEach(h => {
      add('//Drill'); add(`G0 X${f1(-(h.Y + ty))} Y${f1(h.X + tx)}`); add(`G1 Z${f1(t)}`);
      add(`G1 Z${f1(Math.max(t - h.dp, zCut))} F${+o.drillFeed || o.feedZ}`); add(`G0 Z${f1(safe)}`); // сквозное — не глубже, чем фреза заходит в стол
    });
    add('M05');
  }

  const items = [...s.items].sort((a, b) => a.l * a.w - b.l * b.w);
  const rects = items.map(it => cncRect(it, s, r));
  if (o.preCut !== false) {
    tool('MillPreCut', o.toolT || 1);
    const depths = preDepths(t, +o.preStep || 0, +o.preLeave || 0);
    for (const c of cutLines(rects)) for (const z of depths) {
      add('//Mill'); add(`G0 X${f1(c.ax)} Y${f1(c.ay)}`); add(`G1 Z${f1(t)}`); add(`G1 Z${f1(z)} F${o.feedZ}`);
      add(`G1 X${f1(c.bx)} Y${f1(c.by)} F${o.feedXY}`); add(`G0 Z${f1(safe)}`);
    }
    add('M05');
  }

  tool('MillBaseCut', o.toolT || 1);
  const lead = +o.lead || 97, ov = +o.overlap || 3;
  for (const q of rects) {
    const w = q.x0 - q.x1, sx = q.x1 + Math.min(lead, w / 2);
    const P = [[q.x1, q.y0], [q.x1, q.y1], [q.x0, q.y1], [q.x0, q.y0], [sx + ov, q.y0], [sx - ov, q.y0]];
    add('//Mill'); add(`G0 X${f1(sx)} Y${f1(q.y0)}`); add(`G1 Z${f1(t)}`); add(`G1 Z${f1(zCut)} F${o.feedZ}`);
    P.forEach(([x, y]) => add(`G1 X${f1(x)} Y${f1(y)} F${o.feedXY}`)); add(`G0 Z${f1(safe)}`);
  }
  TAIL.forEach(add);
  return { text: L.join('\r\n') + '\r\n', warnings };
}

/** Короткий отпечаток текста программы: по нему видно, что автоматическая программа листа изменилась. */
export function gcodeHash(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text ?? '').replace(/\r\n/g, '\n')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** Ручная правка программы листа. edit = { text, base } — текст оператора и отпечаток автоматической программы,
    с которой он начинал. Если карта или параметры с тех пор изменились, правка устарела и на станок идёт автоматическая программа.
    Возвращает { text, edited, stale }; text всегда со строками \r\n, как ждёт NCStudio. */
export function sheetProgram(auto, edit) {
  if (!edit || typeof edit.text !== 'string') return { text: auto, edited: false, stale: false };
  if (edit.base !== gcodeHash(auto)) return { text: auto, edited: false, stale: true };
  const t = edit.text.replace(/\r\n|\r/g, '\n').replace(/\n*$/, '\n').replace(/\n/g, '\r\n');
  return { text: t, edited: true, stale: false };
}

/** Программа этикетировщика (.cyc): этикетка в центр каждой детали. img(it) — имя картинки этикетки. */
export function labelProgram(s, o, img) {
  const r = o.toolD / 2, L = ['M511', 'M605', 'M607'];
  for (const it of s.items) {
    const q = cncRect(it, s, r);
    L.push(`M609 {P="${img(it)}"}`, `G00 V${f1((q.x0 + q.x1) / 2)} U${f1((q.y0 + q.y1) / 2)}`, 'M606');
  }
  L.push('M608', 'M510', 'M500');
  return L.join('\r\n') + '\r\n';
}

/** Монохромная картинка BMP (1 бит на точку), как печатает этикетировщик. dark(x, y) — чёрная ли точка. */
export function bmp1(w, h, dark) {
  const row = Math.ceil(w / 32) * 4, size = 62 + row * h, b = new Uint8Array(size), v = new DataView(b.buffer);
  b[0] = 0x42; b[1] = 0x4d; v.setUint32(2, size, true); v.setUint32(10, 62, true);
  v.setUint32(14, 40, true); v.setInt32(18, w, true); v.setInt32(22, h, true); v.setUint16(26, 1, true); v.setUint16(28, 1, true);
  v.setUint32(34, row * h, true); v.setUint32(50, 2, true);
  b.set([0, 0, 0, 255, 255, 255, 255, 255], 54); // палитра: 0 — чёрный, 1 — белый
  for (let y = 0; y < h; y++) {
    const off = 62 + (h - 1 - y) * row;
    for (let x = 0; x < w; x++) if (!dark(x, y)) b[off + (x >> 3)] |= 0x80 >> (x & 7);
  }
  return b;
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = d => { let c = 0xffffffff; for (const x of d) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** ZIP без сжатия: files — [{ name, data: Uint8Array | string }]. */
export function zipStore(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    parts.push(new Uint8Array(h.buffer), name, data); central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const cl = central.reduce((a, x) => a + x.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cl, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)], out = new Uint8Array(all.reduce((a, x) => a + x.length, 0));
  let p = 0; for (const x of all) { out.set(x, p); p += x.length; }
  return out;
}
