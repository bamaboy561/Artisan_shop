/* ЧПУ Excitech + NCStudio. ЧЕРНОВИК: формат программы ещё не сверен с образцом .nc со станка,
   запускать на станке нельзя, пока не сверим заголовок, смену инструмента и нули. */

/** Отверстия детали в координатах листа (без торцовки). При повороте X детали идёт вдоль Y листа. */
export function holePoints(it) {
  return it.p.holes.filter(h => h.side === 'face').map(h => ({
    X: it.rot ? it.x + h.y : it.x + h.x,
    Y: it.rot ? it.y + (it.p.l - h.x) : it.y + h.y,
    d: h.d, dp: h.dp,
  }));
}

/** G-код для одного листа нестинга: сначала присадка по диаметрам, потом контуры от мелких деталей к крупным. */
export function gcode(projectName, m, s, idx, o) {
  const tx = s.tx ?? s.trim, ty = s.ty ?? s.trim, r = o.toolD / 2, z = -(m.t + o.overcut);
  const n = v => (+v).toFixed(2).replace(/\.?0+$/, '') || '0';
  const L = [], add = x => L.push(x);
  add(`(Artisan Raskroy - ${String(projectName).replace(/[()]/g, '')} - list ${idx + 1})`);
  add(`(Material: ${String(m.name).replace(/[()]/g, '')} ${m.L}x${m.W}x${m.t}, details: ${s.items.length})`);
  add('G90 G17 G21'); add(`G0 Z${n(o.safeZ)}`);
  const byD = {};
  s.items.forEach(it => holePoints(it).forEach(h => (byD[h.d] = byD[h.d] || []).push(h)));
  Object.entries(byD).sort((a, b) => a[0] - b[0]).forEach(([d, hs]) => {
    add(`(Drill D${d}, holes ${hs.length})`); add('M05'); add(`(TOOL CHANGE: Bore${d})`); add(`M03 S${n(o.spindle)}`);
    hs.sort((a, b) => a.Y - b.Y || a.X - b.X).forEach(h => {
      add(`G0 X${n(h.X + tx)} Y${n(h.Y + ty)}`); add('G0 Z5'); add(`G1 Z${n(-h.dp)} F${n(o.feedZ)}`); add(`G0 Z${n(o.safeZ)}`);
    });
  });
  add(`(Contour mill D${o.toolD}, outside, CCW)`); add('M05'); add(`(TOOL CHANGE: MillBaseCut D${o.toolD})`); add(`M03 S${n(o.spindle)}`);
  [...s.items].sort((a, b) => a.l * a.w - b.l * b.w).forEach(it => {
    const x0 = it.x + tx - r, y0 = it.y + ty - r, x1 = it.x + tx + it.l + r, y1 = it.y + ty + it.w + r;
    add(`(${it.p.name.replace(/[()]/g, '')} ${it.p.l}x${it.p.w})`);
    add(`G0 X${n(x0)} Y${n(y0)}`); add('G0 Z5'); add(`G1 Z${n(z)} F${n(o.feedZ)}`);
    add(`G1 X${n(x0)} Y${n(y1)} F${n(o.feedXY)}`); add(`G1 X${n(x1)} Y${n(y1)}`); add(`G1 X${n(x1)} Y${n(y0)}`); add(`G1 X${n(x0)} Y${n(y0)}`);
    add(`G0 Z${n(o.safeZ)}`);
  });
  add('M05'); add(`G0 Z${n(o.safeZ)}`); add('G0 X0 Y0'); add('M30');
  return L.join('\n');
}
