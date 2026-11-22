/* PDF для печати: отчёт по заказу и наклейки, чёрно-белые, чтобы печатались на любом принтере.
   jsPDF и шрифт DejaVu (с кириллицей) лежат в vendor/ и загружаются только при первом PDF. */

let ready = null;
function loadScript(src) {
  return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('не загрузился ' + src)); document.head.appendChild(s); });
}
const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
function load() {
  if (!ready) ready = (async () => {
    if (!window.jspdf) await loadScript('vendor/jspdf.umd.min.js');
    const [r, b] = await Promise.all(['vendor/fonts/DejaVuSansCondensed.ttf', 'vendor/fonts/DejaVuSansCondensed-Bold.ttf'].map(u => fetch(u).then(x => { if (!x.ok) throw new Error('нет шрифта'); return x.arrayBuffer(); })));
    return { regular: b64(r), bold: b64(b) };
  })().catch(e => { ready = null; throw e; });
  return ready;
}
async function newDoc(opts) {
  const fonts = await load();
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true, ...opts });
  doc.addFileToVFS('dv.ttf', fonts.regular); doc.addFont('dv.ttf', 'DV', 'normal');
  doc.addFileToVFS('dvb.ttf', fonts.bold); doc.addFont('dvb.ttf', 'DV', 'bold');
  doc.setFont('DV', 'normal'); doc.setTextColor(0); doc.setDrawColor(0);
  return doc;
}

/** Обрезает строку под ширину, добавляя «…». */
function fit(doc, s, w) {
  s = String(s ?? '');
  if (doc.getTextWidth(s) <= w) return s;
  while (s.length > 1 && doc.getTextWidth(s + '…') > w) s = s.slice(0, -1);
  return s + '…';
}

/** Отчёт. model: {title, head: [строки], blocks: [{h}|{table:{cols:[{t,w,r}], rows, total}}|{maps:[{s, caption, cuts}]}]}. */
export async function reportPdf(model) {
  const doc = await newDoc(), PW = 210, M = 14, CW = PW - 2 * M, BOTTOM = 297 - 14;
  let y = M, page = 1;
  const footer = () => { doc.setFont('DV', 'normal'); doc.setFontSize(7); doc.text(`${model.title} · стр. ${page}`, PW - M, 297 - 7, { align: 'right' }); };
  const need = h => { if (y + h > BOTTOM) { footer(); doc.addPage(); page++; y = M; return true; } return false; };
  doc.setFont('DV', 'bold'); doc.setFontSize(14); doc.text(model.title, M, y + 5); y += 9;
  doc.setFont('DV', 'normal'); doc.setFontSize(9);
  for (const l of model.head) { doc.text(fit(doc, l, CW), M, y + 3); y += 4.6; }
  y += 2;
  for (const b of model.blocks) {
    if (b.h) { need(14); y += 3; doc.setFont('DV', 'bold'); doc.setFontSize(11); doc.text(fit(doc, b.h, CW), M, y + 4); y += 6.5; doc.setLineWidth(0.4); doc.line(M, y, M + CW, y); y += 1.5; }
    if (b.table) {
      const { cols, rows, total } = b.table, sum = cols.reduce((a, c) => a + c.w, 0), k = CW / sum, rh = 5;
      const xs = []; let x = M; for (const c of cols) { xs.push(x); x += c.w * k; }
      const headRow = () => { doc.setFont('DV', 'bold'); doc.setFontSize(7.5); cols.forEach((c, i) => doc.text(fit(doc, c.t, c.w * k - 2), c.r ? xs[i] + c.w * k - 1 : xs[i] + 1, y + 3.5, c.r ? { align: 'right' } : undefined)); y += rh; doc.setLineWidth(0.3); doc.line(M, y, M + CW, y); };
      need(rh * 3); headRow();
      const all = total ? [...rows, total] : rows;
      all.forEach((row, ri) => {
        if (need(rh)) headRow();
        const isTotal = total && ri === all.length - 1;
        doc.setFont('DV', isTotal ? 'bold' : 'normal'); doc.setFontSize(8);
        if (isTotal) { doc.setLineWidth(0.3); doc.line(M, y, M + CW, y); }
        row.forEach((v, i) => { const c = cols[i]; doc.text(fit(doc, v, c.w * k - 2), c.r ? xs[i] + c.w * k - 1 : xs[i] + 1, y + 3.6, c.r ? { align: 'right' } : undefined); });
        y += rh; doc.setLineWidth(0.1); doc.setDrawColor(170); doc.line(M, y, M + CW, y); doc.setDrawColor(0);
      });
      y += 2;
    }
    if (b.maps) {
      const per = 2, gap = 6, mw = (CW - gap * (per - 1)) / per;
      for (let i = 0; i < b.maps.length; i += per) {
        const row = b.maps.slice(i, i + per);
        const hs = row.map(m => mw * m.s.W / m.s.L + 6 + (m.cuts ? Math.ceil(m.cuts.length / 2) * 3.4 + 2 : 0));
        need(Math.max(...hs));
        row.forEach((m, j) => drawMap(doc, m, M + j * (mw + gap), y, mw));
        y += Math.max(...hs) + 4;
      }
    }
  }
  footer();
  return doc.output('blob');
}

/** Карта раскроя в чёрно-белом виде: лист контуром, детали серой заливкой, остатки пунктиром. */
function drawMap(doc, { s, caption, cuts, offMin1 = 300, offMin2 = 100 }, x0, y0, w) {
  const k = w / s.L, h = s.W * k, tx = s.tx ?? s.trim ?? 0, ty = s.ty ?? s.trim ?? 0;
  doc.setLineWidth(0.35); doc.setDrawColor(0); doc.rect(x0, y0, w, h);
  doc.setLineWidth(0.15); doc.setFillColor(225);
  doc.setFont('DV', 'normal');
  for (const it of s.items) {
    const x = x0 + (it.x + tx) * k, y = y0 + (it.y + ty) * k, iw = it.l * k, ih = it.w * k;
    doc.setFillColor(225); doc.rect(x, y, iw, ih, 'FD'); // цвет текста в PDF — тоже заливка, поэтому задаём каждый раз
    const fs = Math.max(4, Math.min(7, Math.min(iw, ih) * 1.4));
    doc.setFontSize(fs);
    const t = `${it.l}×${it.w}`;
    if (doc.getTextWidth(t) < iw - 1 && ih > fs * 0.5) {
      doc.text(t, x + iw / 2, y + ih / 2 + (ih > fs * 0.9 ? -0.3 : fs * 0.12), { align: 'center' });
      if (ih > fs * 0.9) { doc.setFontSize(fs * 0.8); doc.text('№' + it.p.id, x + iw / 2, y + ih / 2 + fs * 0.35, { align: 'center' }); }
    }
  }
  doc.setLineDashPattern([1, 0.8], 0); doc.setLineWidth(0.2);
  for (const f of s.free || []) if (Math.max(f.w, f.h) >= offMin1 && Math.min(f.w, f.h) >= offMin2) doc.rect(x0 + (f.x + tx) * k, y0 + (f.y + ty) * k, f.w * k, f.h * k);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(7.5); doc.text(fit(doc, caption, w), x0, y0 + h + 4);
  if (cuts) {
    doc.setFontSize(6.5);
    cuts.forEach((c, i) => { const col = i % 2, row = Math.floor(i / 2); doc.text(fit(doc, `${i + 1}. ${c}`, w / 2 - 1), x0 + col * w / 2, y0 + h + 8 + row * 3.4); });
  }
}

/** Наклейки: каждую SVG-наклейку рисуем в 300 dpi, переводим в оттенки серого и кладём в PDF.
 *  layout 'sheet' — листы A4 по сетке, 'roll' — одна наклейка на страницу размера наклейки. */
export async function labelsPdf(svgs, { w, h, layout = 'sheet', onProgress } = {}) {
  const roll = layout === 'roll';
  const doc = await newDoc(roll ? { format: [w, h], orientation: w > h ? 'landscape' : 'portrait' } : {});
  const cols = Math.max(1, Math.floor((210 - 10) / (w + 4))), rows = Math.max(1, Math.floor((297 - 10) / (h + 4)));
  const gx = (210 - cols * w) / (cols + 1), gy = (297 - rows * h) / (rows + 1);
  const px = 12; // точек на мм ≈ 300 dpi
  const cv = document.createElement('canvas'); cv.width = Math.round(w * px); cv.height = Math.round(h * px);
  const ctx = cv.getContext('2d');
  for (let i = 0; i < svgs.length; i++) {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgs[i]], { type: 'image/svg+xml' }));
    await new Promise((ok, bad) => { img.onload = ok; img.onerror = () => bad(new Error('наклейка не нарисовалась')); img.src = url; });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(url);
    const d = ctx.getImageData(0, 0, cv.width, cv.height), a = d.data;
    for (let j = 0; j < a.length; j += 4) { const g = 0.299 * a[j] + 0.587 * a[j + 1] + 0.114 * a[j + 2]; a[j] = a[j + 1] = a[j + 2] = g; }
    ctx.putImageData(d, 0, 0);
    const png = cv.toDataURL('image/png');
    if (roll) { if (i) doc.addPage([w, h], w > h ? 'landscape' : 'portrait'); doc.addImage(png, 'PNG', 0, 0, w, h); }
    else {
      const n = i % (cols * rows); if (i && !n) doc.addPage();
      const c = n % cols, r = Math.floor(n / cols), x = gx + c * (w + gx), y = gy + r * (h + gy);
      doc.addImage(png, 'PNG', x, y, w, h); doc.setLineWidth(0.1); doc.setDrawColor(190); doc.rect(x, y, w, h);
    }
    if (onProgress && i % 10 === 9) onProgress(i + 1);
  }
  return doc.output('blob');
}

/** Отдать файл: в окне Claude через разрешённое скачивание, на своём сайте — обычной загрузкой. */
export async function saveFile(blob, filename) {
  let dl = null;
  try { dl = window.claude?.use ? await Promise.race([window.claude.use('downloads'), new Promise(r => setTimeout(() => r(null), 3000))]) : null; } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename, data: blob }); return 'saved'; }
    catch (e) { if (e?.code === 'declined' || e?.code === 'rate_limited') throw e; } // иначе пробуем обычную загрузку
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 30000);
  return 'downloaded';
}
