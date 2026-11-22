/** Расход кромки по каждому виду (свес b.add и отход b.waste задаются у кромки, иначе берутся из общих настроек): сколько метров клеится и сколько уходит с учётом свеса и отхода. */
export function edgeStats(P, o) {
  const by = {};
  for (const p of P.parts) for (const s of 'tblr') {
    const ref = p.edges[s], b = ref && P.bands[ref];
    if (!b) continue;
    const len = s === 't' || s === 'b' ? p.l : p.w;
    const add = b.add ?? o.edgeAdd ?? 0, waste = b.waste ?? o.edgeWaste ?? 0;
    by[ref] = by[ref] || { ref, name: b.name, t: b.t, w: b.w, code: b.code, glue: 0, mat: 0, sides: 0, parts: 0 };
    by[ref].glue += len * p.count / 1000;
    by[ref].mat += (len + 2 * add) * p.count * (1 + waste / 100) / 1000;
    by[ref].sides += p.count;
  }
  return Object.values(by).sort((a, b) => b.mat - a.mat);
}
