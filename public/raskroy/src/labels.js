/* Наклейки на детали по шаблонам цеха Artisan: NESTING 80×60 мм, HOLZMA и ALTENDORF 58×80 мм.
   Каждая наклейка — SVG в миллиметрах, печатается в натуральную величину. */

const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ө: 'o', ү: 'u', ң: 'n' };
/** Транслитерация для QR и ссылок: «Кухня Костя» → «Kuhnya_Kostya». */
export function translit(s) {
  return String(s ?? '').split('').map(ch => { const l = ch.toLowerCase(), t = TR[l]; if (t === undefined) return ch; return ch === l ? t : t.charAt(0).toUpperCase() + t.slice(1); })
    .join('').replace(/\s+/g, '_').replace(/[^\w.\-]/g, '');
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Матрица QR через библиотеку qrcodejs (если она загрузилась). */
function qrMatrix(text) {
  if (typeof window === 'undefined' || !window.QRCode) return null;
  try {
    const div = document.createElement('div');
    const q = new window.QRCode(div, { text, width: 64, height: 64, correctLevel: window.QRCode.CorrectLevel.M });
    const m = q._oQRCode; const n = m.getModuleCount(); const rows = [];
    for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c < n; c++) row.push(m.isDark(r, c)); rows.push(row); }
    return rows;
  } catch (e) { return null; }
}
function qrSvg(text, x, y, size) {
  const m = qrMatrix(text);
  if (!m) return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="none" stroke="#000" stroke-width=".3"/><text x="${x + size / 2}" y="${y + size / 2}" font-size="3" text-anchor="middle" dominant-baseline="middle">QR</text>`;
  const n = m.length, c = size / n; let d = '';
  m.forEach((row, r) => row.forEach((on, k) => { if (on) d += `M${(x + k * c).toFixed(3)} ${(y + r * c).toFixed(3)}h${c.toFixed(3)}v${c.toFixed(3)}h-${c.toFixed(3)}z`; }));
  return `<path d="${d}" fill="#000"/>`;
}
const txt = (x, y, w, s, size = 2.6, opt = {}) =>
  `<text x="${opt.align === 'center' ? x + w / 2 : x}" y="${y + size * .85}" font-size="${size}" font-weight="${opt.bold === false ? 400 : 700}" text-anchor="${opt.align === 'center' ? 'middle' : 'start'}" textLength="${opt.fit ? w : ''}" lengthAdjust="spacingAndGlyphs"><tspan>${esc(s)}</tspan></text>`.replace(' textLength=""', '');
// Обрезка строки под ширину (примерно 0.55 высоты шрифта на символ).
const fitStr = (s, w, size = 2.6) => { s = String(s ?? ''); const max = Math.floor(w / (size * .55)); return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s; };

/* Значки обработки: свои простые рисунки */
const ICON = {
  groove: (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 10})"><rect x=".5" y=".5" width="9" height="9" fill="none" stroke="#000" stroke-width=".8"/><rect x="3.8" y=".5" width="2.4" height="9" fill="#000"/></g>`,
  drill: (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 10})"><rect x=".5" y=".5" width="9" height="9" fill="none" stroke="#000" stroke-width=".8"/><circle cx="5" cy="5" r="2.6" fill="#000"/></g>`,
  mill: (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 10})"><rect x=".5" y=".5" width="9" height="9" fill="none" stroke="#000" stroke-width=".8"/><path d="M2 8 V4 A2 2 0 0 1 4 2 H8" fill="none" stroke="#000" stroke-width="1.2"/></g>`,
};

/** Чертёж детали: прямоугольник в пропорции, размеры, кромки толще и с символом. */
function partDrawing(d, x, y, w, h) {
  let L = d.l, W = d.w, e = d.edges; // e: {t,b,l,r} → {sym, t}
  if (W > L) { [L, W] = [W, L]; e = { t: e.l, b: e.r, l: e.b, r: e.t }; } // «оптимальный поворот»: длинная сторона горизонтально
  const pad = 5, aw = w - pad - 1, ah = h - pad - 1, k = Math.min(aw / L, ah / W);
  const rw = Math.max(6, L * k), rh = Math.max(4, W * k), rx = x + pad + (aw - rw) / 2, ry = y + pad + (ah - rh) / 2;
  const line = (x1, y1, x2, y2, ed) => ed ? `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="${ed.t >= 1 ? 1.2 : .7}"/>` : '';
  const sym = (s, tx, ty, anchor = 'middle') => s ? `<text x="${tx}" y="${ty}" font-size="1.9" text-anchor="${anchor}">${esc(s)}</text>` : '';
  return `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="none" stroke="#000" stroke-width=".25"/>
    ${line(rx, ry, rx + rw, ry, e.t)}${line(rx, ry + rh, rx + rw, ry + rh, e.b)}${line(rx, ry, rx, ry + rh, e.l)}${line(rx + rw, ry, rx + rw, ry + rh, e.r)}
    <text x="${rx + rw / 2}" y="${ry - 1.2}" font-size="3.2" font-weight="700" text-anchor="middle">${fmtSize(L)}</text>
    <text x="${rx - 1.2}" y="${ry + rh / 2}" font-size="3.2" font-weight="700" text-anchor="middle" transform="rotate(-90 ${rx - 1.2} ${ry + rh / 2})">${fmtSize(W)}</text>
    ${sym(e.t && e.t.sym, rx + rw / 2, ry + 2.4)}${sym(e.b && e.b.sym, rx + rw / 2, ry + rh - .8)}${sym(e.l && e.l.sym, rx + 1, ry + rh / 2 + .7, 'start')}${sym(e.r && e.r.sym, rx + rw - 1, ry + rh / 2 + .7, 'end')}`;
}
const fmtSize = v => (Math.round(v * 10) / 10).toString();

/* Шаблоны: координаты в мм, как в шаблонах цеха */
export const TEMPLATES = {
  NESTING: { title: 'NESTING (ЧПУ)', w: 80, h: 60, logo: [1, 0, 15, 10], project: [17, 4, 57], material: [17, 8, 57], name: [17, 12, 57], count: [17, 15.5, 15], pos: [35, 15.5, 12], product: [50, 15.5, 23],
    edges: [3, 19, 72], part: [3, 23, 26, 33], qr: [30, 35, 15], qrText: [30, 52, 15], xnc: [47, 35, 14], xncText: [47, 52, 14], mill: [64, 33, 9], groove: [63, 43, 5], drill: [70, 43, 5], machine: [62, 51], date: [62, 55] },
  HOLZMA: { title: 'HOLZMA (пила)', w: 58, h: 80, logo: [1, 1, 15, 10], xnc: [18, 1, 14], xncText: [1, 14, 15], mill: [43, 1, 9], groove: [41, 11, 5], drill: [48, 11, 5], project: [2, 21, 50], material: [2, 25, 50], name: [2, 29, 50],
    count: [2, 33, 15], pos: [19, 33, 12], product: [33, 33, 20], edges: [2, 38, 53], part: [3, 43, 32, 30], qr: [36, 48, 17], qrText: [36, 67, 17], machine: [3, 76], date: [40, 76] },
};
TEMPLATES.ALTENDORF = { ...TEMPLATES.HOLZMA, title: 'ALTENDORF (форматник)' };

/** Данные наклейки детали. */
export function partLabelData(P, it, m, extra = {}) {
  const p = it.p, side = s => { const b = P.bands[p.edges[s]]; return b ? { sym: b.sym || 'X', name: b.name, t: b.t } : null; };
  return { kind: 'part', project: P.name, order: P.order, material: `${m.name} ${m.t}`, name: p.name, count: p.count, code: p.code || String(p.id), product: p.product || '',
    l: p.l, w: p.w, edges: { t: side('t'), b: side('b'), l: side('l'), r: side('r') }, xnc: (p.xnc || [])[0] || '',
    drill: p.holes.length > 0, mill: p.mill > 0, groove: !!(p.gr && Object.values(p.gr).some(Boolean)), ...extra };
}
export function offcutLabelData(P, o, m) {
  return { kind: 'offcut', project: P.name, material: `${m.name} ${m.t}`, l: o.l, w: o.w, t: m.t };
}

/** SVG одной наклейки. tpl — ключ шаблона, logo — URL логотипа, now — дата для печати. */
export function labelSvg(d, tplKey, { logo = 'icons/artisan-logo.png', now = new Date(), site = 'https://artisan.shop.kg/dg' } = {}) {
  const T = TEMPLATES[tplKey] || TEMPLATES.NESTING, W = T.w, H = T.h;
  const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  let body = '';
  if (d.kind === 'offcut') {
    const code = `Заказ:_${d.project}_Остаток_${fmtSize(d.l)}x${fmtSize(d.w)}x${fmtSize(d.t)}`;
    body = txt(1, 4, W - 2, fitStr(code, W - 2, 3), 3, { align: 'center' }) + txt(1, 11, W - 2, fitStr('М: ' + d.material, W - 2, 3.2), 3.2)
      + txt(0, H * .32, W, 'Деловой остаток', 4.6, { align: 'center' }) + txt(1, H * .32 + 7, W - 2, `${fmtSize(d.l)} × ${fmtSize(d.w)}`, 4.6, { align: 'center' })
      + qrSvg(translit(code), W - 19, H - 19, 15) + txt(1, H - 6, 30, date, 2.4, { bold: false });
  } else {
    const edgeLine = ['t', 'b', 'l', 'r'].map((s, i) => d.edges[s] ? `${'ВНЛП'[i]}:(${d.edges[s].sym}) ${d.edges[s].name}` : '').filter(Boolean).join('  ');
    const g = (k, f) => (T[k] ? f(...T[k]) : '');
    body = g('logo', (x, y, w, h) => logo ? `<image href="${esc(logo)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMinYMid meet"/>` : '')
      + g('project', (x, y, w) => txt(x, y, w, fitStr(d.project, w), 2.6))
      + g('material', (x, y, w) => txt(x, y, w, fitStr(d.material, w), 2.6))
      + g('name', (x, y, w) => txt(x, y, w, fitStr(d.name, w), 2.6))
      + g('count', (x, y, w) => txt(x, y, w, 'Кол-во:' + d.count, 2.6))
      + g('pos', (x, y, w) => txt(x, y, w, 'Поз:' + d.code, 2.6))
      + g('product', (x, y, w) => txt(x, y, w, fitStr(d.product, w), 2.6))
      + g('edges', (x, y, w) => edgeLine ? txt(x, y, w, fitStr(edgeLine, w, 2.3), 2.3, { bold: false }) : '')
      + g('part', (x, y, w, h) => partDrawing(d, x, y, w, h))
      + g('qr', (x, y, s) => qrSvg(`${site}?c=${translit(d.project)}&p=${encodeURIComponent(d.code)}`, x, y, s))
      + g('qrText', (x, y, w) => txt(x, y, w, 'СБОРКА', 2, { align: 'center' }))
      + (d.xnc ? g('xnc', (x, y, s) => qrSvg(translit(d.xnc), x, y, s)) + g('xncText', (x, y, w) => txt(x, y, w, fitStr(translit(d.xnc), w, 2), 2, { align: 'center' })) : '')
      + (d.mill ? g('mill', (x, y, s) => ICON.mill(x, y, s)) : '') + (d.groove ? g('groove', (x, y, s) => ICON.groove(x, y, s)) : '') + (d.drill ? g('drill', (x, y, s) => ICON.drill(x, y, s)) : '')
      + g('machine', (x, y) => txt(x, y, 20, tplKey, 2)) + g('date', (x, y) => `<text x="${W - 1}" y="${y + 1.7}" font-size="2" text-anchor="end">${date}</text>`);
  }
  return `<svg class="lblsvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" font-family="Arial, Helvetica, sans-serif" fill="#000">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>${body}</svg>`;
}
