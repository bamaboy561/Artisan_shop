/* Интерфейс программы. Расчёты живут в src/core, здесь только экран и события.
   Порядок работы как в цеху: шапка заказа → таблица операций (раскрой каждого материала, кромки, присадка)
   → у выбранной операции вкладки Параметры / Детали / Листы и остатки / Раскрой. */
import * as core from './core/index.js';
import { labelSvg, partLabelData, offcutLabelData, TEMPLATES } from './labels.js';
import { reportPdf, labelsPdf, saveFile } from './pdf.js';
import * as site from './site.js';

const $ = s => document.querySelector(s);
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('rk_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('rk_' + k, JSON.stringify(v)); } catch (e) { if (!store.full) { store.full = 1; toast('Память браузера заполнена: удалите старые проекты'); } } },
  del(k) { try { localStorage.removeItem('rk_' + k); } catch (e) {} },
};
function toast(msg) { document.querySelectorAll('.toast').forEach(x => x.remove()); const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2400); }

/* ===== Состояние ===== */
const legacy = {}; // настройки прототипа, если они остались в браузере
Object.keys(core.DEFAULTS).forEach(k => { const v = store.get(k, null); if (v != null) legacy[k] = v; });
let base = { ...core.DEFAULTS, ...legacy, ...store.get('base', {}) };
// Старые расценки прототипа (400 за лист и т. п.) меняем на цены из прайса цеха один раз.
if (base.curvePrice == null) { ['cutPrice', 'edgePrice', 'holePrice', 'curvePrice', 'groovePrice', 'holePrices'].forEach(k => (base[k] = core.DEFAULTS[k])); store.set('base', base); }
let siteCat = store.get('sitecat', null); // прайс сайта: плиты, кромка, фурнитура, цены работ
const eff = () => siteCat ? { ...base, ...core.servicesToBase(siteCat.services) } : base;
let stock = store.get('stock', []);
let ledger = store.get('stockops', []); // складские операции по заказам (см. core/stockops.js)
const sheetPrices = store.get('sheetPrices', {});
let P = null, R = null, C = null, E = null;
let ui = { screen: 'project', top: 'ops', op: null, sub: 'parts', sheet: 0, paste: false, ...store.get('ui', {}) };
let undo = [], redo = [];
let catalog = { materials: [], bands: [], ...store.get('catalog', {}) };
const sel = new Set(); // выделенные детали в таблице

const TYPE_NAME = { CS: 'Листовой раскрой', CN: 'Нестинг на ЧПУ', EL: 'Кромка', XNC: 'Присадка', GR: 'Пазование', CL: 'Погонажный раскрой', O: 'Комплектация' };
const SUBS = { CS: [['params', 'Параметры'], ['parts', 'Детали'], ['sheets', 'Листы и остатки'], ['cut', 'Раскрой']],
  CN: [['params', 'Параметры'], ['parts', 'Детали'], ['sheets', 'Листы и остатки'], ['cut', 'Раскрой']],
  EL: [['params', 'Параметры'], ['parts', 'Детали']], XNC: [['params', 'Параметры'], ['parts', 'Детали']],
  GR: [['params', 'Параметры'], ['parts', 'Детали']], CL: [['params', 'Параметры'], ['parts', 'Детали'], ['cut', 'Раскрой']], O: [['parts', 'Позиции']] };

/* Поля параметров: [ключ, подпись, тип, где хранится, доп.]. Где: m — материал, p — параметры материала (m.params),
   b — кромка, base — общие настройки. Пустое значение в p/b означает «как в общих настройках». */
const SEL = {
  dir: [['any', 'любые'], ['length', 'по длине'], ['width', 'по ширине']],
  grain: [['file', 'как в деталях'], ['off', 'без учёта (можно вращать)']],
  cutMode: [['sheet', 'за лист'], ['meter', 'за метр реза']],
  op: [['CS', 'на пиле (листовой раскрой)'], ['CN', 'на ЧПУ (нестинг)']],
  sizeMode: [['1', 'чистовой с кромкой'], ['0', 'пильный'], ['2', 'после прифуговки']],
  round: [['none', 'целыми листами'], ['1/2', 'до 1/2 листа'], ['1/3', 'до 1/3 листа'], ['1/4', 'до 1/4 листа']],
};
const F_MAT = [['Материал'], ['name', 'Наименование', 'text', 'm'], ['code', 'Код', 'text', 'm'], ['t', 'Толщина, мм', 'num', 'm'],
  ['op', 'Где режем', 'sel', 'm'], ['price', 'Цена листа, сом', 'num', 'm'], ['priceM2', 'или цена за м², сом', 'num', 'm'],
  ['round', 'Остаток листа оплачивается', 'sel', 'p']];
const F = {
  CS: [...F_MAT, ['Детали'], ['sizeMode', 'Размеры деталей вводятся', 'sel', 'p'], ['minPart', 'Мин. размер детали, мм', 'num', 'p'],
    ['Раскрой'], ['kerf', 'Толщина пилы, мм', 'num', 'p', 0.1], ['trimL', 'Торцовка по длине (с каждого края), мм', 'num', 'p', 1, 'trim'],
    ['trimW', 'Торцовка по ширине (с каждого края), мм', 'num', 'p', 1, 'trim'],
    ['dir', 'Первые резы', 'sel', 'p'], ['grain', 'Текстура', 'sel', 'p'], ['stack', 'Высота пакета, листов', 'num', 'p'],
    ['Остаток'], ['offMin1', 'Мин. размер первой стороны, мм', 'num', 'p'], ['offMin2', 'Мин. размер второй стороны, мм', 'num', 'p'],
    ['offArea', 'Мин. площадь остатка, м²', 'num', 'p', 0.01], ['useStock', 'Брать остатки со склада', 'chk', 'p'],
    ['Стоимость работы'], ['cutMode', 'Распил считать', 'sel', 'p'], ['cutPrice', 'Цена распила, сом', 'num', 'p']],
  CN: [...F_MAT, ['Фреза'], ['toolD', 'Диаметр фрезы, мм', 'num', 'p'], ['overcut', 'Выступ снизу, мм', 'num', 'p', 0.1],
    ['spindle', 'Обороты S', 'num', 'p'], ['feedXY', 'Подача XY, мм/мин', 'num', 'p'], ['feedZ', 'Подача Z, мм/мин', 'num', 'p'],
    ['safeZ', 'Отвод Z, мм', 'num', 'p'], ['Раскрой'], ['trimL', 'Торцовка по длине, мм', 'num', 'p', 1, 'trim'], ['trimW', 'Торцовка по ширине, мм', 'num', 'p', 1, 'trim'], ['grain', 'Текстура', 'sel', 'p'],
    ['Остаток'], ['offMin1', 'Мин. размер первой стороны, мм', 'num', 'p'], ['offMin2', 'Мин. размер второй стороны, мм', 'num', 'p'],
    ['Стоимость работы'], ['millPrice', 'Фрезеровка контура, сом за м', 'num', 'p']],
  EL: [['Кромка'], ['name', 'Наименование', 'text', 'b'], ['code', 'Код', 'text', 'b'], ['t', 'Толщина, мм', 'num', 'b', 0.1],
    ['w', 'Ширина, мм', 'num', 'b'], ['sym', 'Символ на наклейке', 'text', 'b'], ['Обработка'], ['joint', 'Прифуговка на сторону, мм', 'num', 'b', 0.1, 'joint'],
    ['add', 'Свес с каждого края, мм', 'num', 'b', 1, 'edgeAdd'], ['waste', 'Отход, %', 'num', 'b', 1, 'edgeWaste'],
    ['Стоимость'], ['matPrice', 'Материал, сом за м', 'num', 'b'], ['price', 'Кромкование, сом за м', 'num', 'b', 1, 'edgePrice']],
  GR: [['Паз'], ['name', 'Наименование', 'text', 'g'], ['w', 'Ширина паза, мм', 'num', 'g', 0.1], ['depth', 'Глубина, мм', 'num', 'g', 0.1],
    ['offset', 'Отступ от края, мм', 'num', 'g', 0.1], ['Стоимость'], ['price', 'Пазование, сом за м', 'num', 'g']],
  CL: [['Материал'], ['name', 'Наименование', 'text', 'l'], ['code', 'Код', 'text', 'l'], ['len', 'Длина хлыста, мм', 'num', 'l'],
    ['price', 'Цена хлыста, сом', 'num', 'l'], ['priceM', 'или цена за метр, сом', 'num', 'l'],
    ['Раскрой'], ['kerf', 'Толщина пилы, мм', 'num', 'l', 0.1], ['trim', 'Торцовка с каждого конца, мм', 'num', 'l'],
    ['Стоимость работы'], ['cutPrice', 'Цена реза, сом', 'num', 'l']],
  XNC: [['Стоимость (общая для проекта)'], ['holePrice', 'Отверстие другого диаметра, сом', 'num', 'base', 0.5], ['curvePrice', 'Фрезеровка криволинейная, сом за м', 'num', 'base']],
};
const F_BASE = [['Пила'], ['kerf', 'Толщина пилы, мм', 'num', 'base', 0.1], ['trim', 'Торцовка листа, мм', 'num', 'base'],
  ['sizeMode', 'Размеры деталей вводятся', 'sel', 'base'], ['round', 'Остаток листа оплачивается', 'sel', 'base'], ['stack', 'Высота пакета, листов', 'num', 'base'],
  ['dir', 'Первые резы', 'sel', 'base'], ['grain', 'Текстура', 'sel', 'base'], ['minPart', 'Мин. размер детали, мм', 'num', 'base'],
  ['offMin1', 'Деловой остаток от, мм', 'num', 'base'], ['offMin2', 'и шириной от, мм', 'num', 'base'], ['useStock', 'Брать остатки со склада', 'chk', 'base'],
  ['Кромка'], ['edgeAdd', 'Свес на сторону, мм', 'num', 'base'], ['edgeWaste', 'Отход, %', 'num', 'base'], ['joint', 'Прифуговка, мм', 'num', 'base', 0.5],
  ['ЧПУ Excitech'], ['toolD', 'Фреза, мм', 'num', 'base'], ['overcut', 'Выступ снизу, мм', 'num', 'base', 0.5], ['spindle', 'Обороты S', 'num', 'base'],
  ['feedXY', 'Подача XY, мм/мин', 'num', 'base'], ['feedZ', 'Подача Z, мм/мин', 'num', 'base'], ['safeZ', 'Отвод Z, мм', 'num', 'base'], ['cncDraft', 'Показывать черновик G-кода (только для сверки)', 'chk', 'base'],
  ['Ограничения станков (0 — не проверять)'], ['sawMaxL', 'Пила: макс. длина листа, мм', 'num', 'base'], ['sawMaxW', 'Пила: макс. ширина листа, мм', 'num', 'base'],
  ['cncMaxL', 'ЧПУ: макс. длина листа, мм', 'num', 'base'], ['cncMaxW', 'ЧПУ: макс. ширина листа, мм', 'num', 'base'],
  ['Расценки, сом'], ['cutMode', 'Распил считать', 'sel', 'base'], ['cutPrice', 'Цена распила', 'num', 'base'], ['edgePrice', 'Кромкование за м', 'num', 'base'],
  ['holePrice', 'Отверстие другого диаметра', 'num', 'base', 0.5], ['curvePrice', 'Фрезеровка криволинейная за м', 'num', 'base'],
  ['groovePrice', 'Паз за м (если у паза нет своей цены)', 'num', 'base'], ['millPrice', 'Нестинг на ЧПУ, за м контура', 'num', 'base']];

/* ===== Расчёт и история ===== */
function recalc(edited = false) {
  R = core.computeProject(P, eff(), core.stockForProject(stock, ledger, P.uid));
  const cp = core.catalogPrices(P, siteCat);
  C = core.cost(P, R, { ...cp.prices, ...sheetPrices }, cp.bandPrices);
  E = core.estimate(P, C);
  saveProject(P);
  if (P.site && !P.fresh && (edited || P.site.conflict)) scheduleSiteSave(); // на сайт пишем только правки, не простое открытие
}
/* --- Сайт: заявки на распил и сохранение проекта обратно в заявку --- */
let siteState = null, siteT = null, siteBusy = false, siteAgain = false;
function siteStatus(text, bad) { const el = $('#siteStatus'); if (el) { el.textContent = text; el.classList.toggle('bad', !!bad); el.hidden = !text; } }
function scheduleSiteSave() {
  clearTimeout(siteT);
  if (P.site?.conflict) return siteConflict(P.site.conflict); // пока конфликт не решён, ничего не пишем
  if (!P.site.dirty) { P.site.dirty = true; saveProject(P); }
  siteStatus('Есть изменения, сохраню на сайт…'); siteT = setTimeout(pushSite, 2500);
}
/** Заявку сохранил кто-то другой: показываем явно и даём выбрать, чья версия остаётся. */
function siteConflict(c) {
  const el = $('#siteStatus'); if (!el) return;
  const when = c.savedAt ? new Date(c.savedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  el.hidden = false; el.classList.add('bad');
  el.innerHTML = `Заявку уже сохранил${c.savedBy ? ' ' + esc(c.savedBy) : 'и с другого компьютера'}${when ? ' в ' + when : ''}. Ваши правки на сайт не записаны.
    <button class="btn xs" id="cfLoad">Открыть версию с сайта</button><button class="btn xs" id="cfMine">Записать мои правки поверх</button>`;
  $('#cfLoad').onclick = () => { const id = P.site.id; delete P.site.conflict; openSiteOrder(id, true); };
  $('#cfMine').onclick = () => { P.site.version = c.version; delete P.site.conflict; saveProject(P); pushSite(); };
}
async function pushSite() {
  if (!P.site) return;
  if (siteBusy) { siteAgain = true; return; }
  siteBusy = true; siteStatus('Сохраняю на сайт…');
  const Q = P;
  try {
    const { site: link, ...project } = Q; // связь с заявкой и номер версии в сам проект не пишем
    const res = await site.saveOrder(Q.site.id, { project: { ...project, site: { id: link.id, number: link.number } }, baseVersion: link.version ?? null,
      sheets: C.sheets, edgeMeters: +C.edgeM.toFixed(1), total: Q.kp ? Q.kp.total : E.total });
    if (Q.site === link) { link.version = res.version; if (!siteAgain) link.dirty = false; saveProject(Q); }
    siteStatus(`Сохранено на сайте в ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`);
    const o = siteState?.orders?.find(x => x.id === link.id); if (o) { o.savedAt = res.savedAt; o.sheets = C.sheets; }
  } catch (e) {
    if (e.conflict && Q.site) { Q.site.conflict = e.conflict; saveProject(Q); if (Q === P) siteConflict(e.conflict); }
    else siteStatus('Не сохранилось на сайте: ' + e.message, true);
  }
  siteBusy = false;
  if (siteAgain) { siteAgain = false; pushSite(); }
}
async function openSiteOrder(id, fresh = false) {
  try {
    // Заявка уже открыта на этом компьютере: открываем свою копию, если в ней есть несохранённые на сайт правки.
    const local = !fresh && store.get('p_site-' + id, null);
    toast('Открываю заявку…');
    const o = await site.openOrder(id);
    let Q;
    if (o.project) Q = o.project;
    else {
      Q = core.parseProject(core.decode(site.fromB64(o.projectFile)), (o.number || 'Заявка') + '.project');
      Q.name = [o.number, o.client].filter(Boolean).join(' ');
      Q.order = o.client || ''; Q.date = o.createdAt.slice(0, 10); Q.due = o.dueDate || ''; Q.note = o.note || o.material || '';
      Q.status = 'Заказан';
    }
    Q.site = { id: o.id, number: o.number, version: o.version ?? null }; Q.uid = 'site-' + o.id; delete Q.fresh;
    // На этом компьютере есть незаписанные на сайт правки: открываем их. Если на сайте за это время
    // сохранили другую версию, правки не теряем, а показываем выбор, чья версия остаётся.
    if (local?.site?.dirty && local.site.id === o.id) {
      if (local.site.version !== Q.site.version) local.site.conflict = { version: o.version ?? null, savedAt: o.savedAt || null, savedBy: o.savedBy || '' };
      Q = local;
    }
    saveProject(P); openProject(Q);
    if (P.site?.conflict) siteConflict(P.site.conflict);
    else siteStatus(o.savedAt ? 'Открыт проект, сохранённый на сайте' : `Заявка открыта (${o.source || 'с сайта'})`);
    toast(`Заявка ${o.number || ''} открыта`);
  } catch (e) { toast('Не удалось открыть заявку: ' + e.message); }
}
function siteNav(f) {
  if (!siteState) return '';
  if (siteState.login) return `<div class="mh">Заявки с сайта</div><a class="fitem" href="/login?next=/raskroy">Войти на сайт</a>`;
  const by = {};
  siteState.orders.forEach(o => { const m = site.orderMonth(o.createdAt); (by[m.key] = by[m.key] || { name: m.name, n: 0 }).n++; });
  const item = (key, name, n) => `<button class="fitem" data-folder="${key}" aria-current="${(f.folder || '') === key}"><span>${name}</span><b>${n}</b></button>`;
  return `<div class="mh">Заявки с сайта</div>${item('site', '🌐 Все заявки', siteState.orders.length)}${Object.keys(by).sort().reverse().map(k => item('site:' + k, '🗓 ' + by[k].name, by[k].n)).join('')}`;
}
function siteTable(f) {
  if (!siteState?.orders) return '<div class="empty">Заявки с сайта появятся, когда программа открыта на artisan.shop.kg/raskroy и вы вошли на сайт.</div>';
  const q = (f.q || '').trim().toLowerCase(), month = f.folder.startsWith('site:') ? f.folder.slice(5) : '';
  const list = siteState.orders.filter(o => (!month || site.orderMonth(o.createdAt).key === month) && (!q || `${o.number} ${o.client} ${o.material}`.toLowerCase().includes(q)));
  const today = new Date().toISOString().slice(0, 10);
  return list.length ? `<div class="tbl"><table class="siteorders"><thead><tr><th>Заявка</th><th>День</th><th>Клиент</th><th>Материал</th><th>Статус</th><th>Готовность</th><th class="r">Листов</th><th>Проект</th><th></th></tr></thead><tbody>
    ${list.map(o => `<tr data-sid="${esc(o.id)}" ${P.site?.id === o.id ? 'aria-selected="true"' : ''}><td><b>${esc(o.number || '—')}</b></td><td class="note">${site.orderMonth(o.createdAt).day}</td><td>${esc(o.client)}</td><td>${esc(o.material)}</td>
      <td>${esc(o.stage ? site.STAGE_NAME[o.stage] || o.stage : site.STATUS_NAME[o.status] || o.status)}</td><td class="${o.dueDate && o.dueDate < today && o.status !== 'COMPLETED' ? 'late' : ''}">${o.dueDate ? new Date(o.dueDate).toLocaleDateString('ru-RU') : ''}</td>
      <td class="n">${o.sheets ?? ''}</td><td class="note">${o.savedAt ? 'сохранён' : 'новый'}</td><td><button class="btn xs" data-sopen>${P.site?.id === o.id ? 'Открыт' : 'Открыть'}</button></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">Заявок не найдено.</div>';
}
/* Все проекты лежат в браузере: список rk_projects и сам проект в rk_p_<uid>. */
const libIndex = () => store.get('projects', []);
function saveProject(Q) {
  if (!Q.uid) Q.uid = core.newUid();
  if (Q === P) store.set('project', P);
  if (Q.fresh) return; // пустой новый проект попадает в список после первой правки
  store.set('p_' + Q.uid, Q);
  store.set('projects', core.upsertMeta(libIndex(), core.projectMeta(Q)));
}
function openProject(Q) { P = { date: '', due: '', note: '', ...Q }; undo = []; redo = []; sel.clear(); ui.op = null; ui.sheet = 0; ui.screen = 'project'; recalc(); clearTimeout(siteT); siteStatus(P.site ? 'Заявка с сайта ' + (P.site.number || '') : ''); if (P.site?.conflict) siteConflict(P.site.conflict); render(); }
/** Любое изменение проекта: запоминаем прежнее состояние для «Отменить», считаем заново, перерисовываем. */
function change(fn) {
  undo.push(JSON.stringify(P)); if (undo.length > 60) undo.shift(); redo = [];
  delete P.fresh; fn(); recalc(true); renderSoon();
}
function stepHistory(from, to) {
  if (!from.length) return toast('Нечего ' + (from === undo ? 'отменять' : 'возвращать'));
  const link = P.site; // связь с заявкой и версия не откатываются вместе с правками
  to.push(JSON.stringify(P)); P = JSON.parse(from.pop()); if (link) P.site = link; recalc(true); render();
}
let renderT = null;
function renderSoon() { clearTimeout(renderT); renderT = setTimeout(render, 0); }
function setUi(patch) { Object.assign(ui, patch); store.set('ui', ui); render(); }

const ops = () => core.operations(P);
const curOp = () => { const list = ops(); return list.find(o => o.key === ui.op) || list[0]; };
const resOf = m => R.mats.find(x => x.m === m);
const bandName = k => P.bands[k]?.name || '';

/* ===== Отрисовка ===== */
function render() {
  if (!P) return;
  const focus = document.activeElement?.dataset?.fid;
  renderHeader(); renderTotals();
  document.querySelectorAll('[data-screen]').forEach(b => b.setAttribute('aria-current', b.dataset.screen === ui.screen));
  const main = $('#main');
  ({ projects: renderProjects, project: renderProject, catalog: renderCatalog, stock: renderStock, labels: renderLabels, report: renderReport, estimate: renderEstimate, settings: renderSettings, export: renderExport })[ui.screen](main);
  if (focus) { const el = document.querySelector(`[data-fid="${focus}"]`); if (el) { el.focus(); if (el.select && el.type !== 'checkbox') el.select(); } }
}
function renderHeader() {
  const st = $('#hStatus'); if (!st.options.length) st.innerHTML = core.STATUSES.map(x => `<option>${x}</option>`).join('');
  const hf = $('#hFolder'), fl = allFolders(); if (P.folder && !fl.includes(P.folder)) fl.push(P.folder);
  const fo = '<option value="">без папки</option>' + fl.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
  if (hf.innerHTML !== fo) hf.innerHTML = fo;
  if (!P.status) P.status = core.STATUSES[0];
  document.querySelectorAll('[data-h]').forEach(el => { if (document.activeElement !== el) el.value = P[el.dataset.h] || ''; });
}
function renderTotals() {
  $('#totals').innerHTML = `<div class="mh">Стоимость, сом</div>
    <div class="trow"><span>Материалы</span><b>${fmt(C.mat)}</b></div><div class="trow"><span>Работа</span><b>${fmt(C.work)}</b></div>
    ${E.markup || E.discount || E.byPrice !== C.total ? `<div class="trow"><span>Наценка, скидка, материал заказчика</span><b>${fmt(E.total - C.total)}</b></div>` : ''}
    <div class="trow total"><span>Итого</span><b>${fmt(E.total)}</b></div>
    ${P.kp ? `<div class="trow"><span>Утверждено в КП №${P.kp.n}</span><b>${fmt(P.kp.total)}</b></div>` : ''}
    <div class="tmini">${fmt(C.sheets)} лист. · рез ${fmt(C.cutM, 1)} м · кромка ${fmt(C.edgeM, 1)} м · ${fmt(C.holes)} отв.</div>`;
}

/* --- Экран проекта: операции и выбранная операция --- */
function renderProject(main) {
  const list = ops(), op = curOp();
  if (op && ui.op !== op.key) ui.op = op.key;
  const rows = Object.fromEntries(C.ops.map(r => [r.key, r]));
  const topTabs = `<div class="tabs" role="tablist"><button class="tab" role="tab" data-top="ops" aria-selected="${ui.top === 'ops'}">Операции</button><button class="tab" role="tab" data-top="products" aria-selected="${ui.top === 'products'}">Изделия</button></div>`;
  const tools = ui.top === 'ops' ? `<div class="row tools">
      <button class="btn sm" data-add="CS">+ Листовой раскрой</button><button class="btn sm" data-add="CN">+ Нестинг ЧПУ</button><button class="btn sm" data-add="EL">+ Кромка</button>
      <button class="btn sm" data-add="GR">+ Паз</button><button class="btn sm" data-add="CL">+ Погонаж</button><button class="btn sm" data-add="O">+ Комплектация</button>
      <button class="btn sm" data-move="-1" aria-label="Вверх" title="Вверх">↑</button><button class="btn sm" data-move="1" aria-label="Вниз" title="Вниз">↓</button>
      <button class="btn sm" data-delop>Удалить</button><button class="btn sm primary" id="relOpen">Выпустить в работу</button></div>` : '';
  let table;
  if (ui.top === 'ops') {
    table = `<div class="tbl short"><table class="ops"><thead><tr><th>№</th><th>Тип</th><th>Наименование</th><th class="r">Кол-во</th><th class="r">Материал, сом</th><th class="r">Работа, сом</th><th class="r">Итого, сом</th></tr></thead><tbody>
      ${list.map((o, i) => { const r = rows[o.key] || { qty: 0, mat: 0, work: 0, total: 0, unit: '' };
        const nb = o.m ? problemsOf(resOf(o.m)).length : 0, warn = nb ? ` <span class="chip bad">ошибок: ${nb}</span>` : '';
        return `<tr data-op="${esc(o.key)}" aria-selected="${o.key === ui.op}" tabindex="0"><td class="n">${i + 1}</td><td><span class="tag t-${o.type}">${o.type}</span></td><td>${esc(o.name)}${warn}</td>
        <td class="n">${fmt(r.qty, r.unit === 'м' ? 1 : 0)} ${r.unit}</td><td class="n">${fmt(r.mat)}</td><td class="n">${fmt(r.work)}</td><td class="n"><b>${fmt(r.total)}</b></td></tr>`; }).join('')}
      ${list.length ? '' : '<tr><td colspan="7" class="empty">Проект пустой. Добавьте операцию кнопками выше (например, «+ Листовой раскрой»), откройте файл .project или загрузите таблицу Excel.</td></tr>'}
      </tbody><tfoot><tr><td></td><td></td><td>Итого по заказу</td><td></td><td class="n">${fmt(C.mat)}</td><td class="n">${fmt(C.work)}</td><td class="n"><b>${fmt(C.total)}</b></td></tr></tfoot></table></div>`;
  } else table = productsTable();
  main.innerHTML = `${releaseBanner()}${ui.rel ? releasePanel() : ''}<section class="panel"><div class="bar">${topTabs}${tools}</div>${table}</section>
    ${op && ui.top === 'ops' ? `<section class="panel" id="opPanel">${opPanel(op)}</section>` : ''}`;
  bindRelease(main);
  main.querySelectorAll('[data-top]').forEach(b => b.onclick = () => setUi({ top: b.dataset.top }));
  main.querySelectorAll('[data-op]').forEach(tr => {
    const pick = () => { if (ui.op !== tr.dataset.op) setUi({ op: tr.dataset.op, sheet: 0, sub: SUBS[ops().find(o => o.key === tr.dataset.op).type].some(s => s[0] === ui.sub) ? ui.sub : 'params' }); };
    tr.onclick = pick; tr.onkeydown = e => { if (e.key === 'Enter') pick(); };
  });
  main.querySelectorAll('[data-add]').forEach(b => b.onclick = () => addOp(b.dataset.add));
  main.querySelectorAll('[data-move]').forEach(b => b.onclick = () => moveOp(op, +b.dataset.move));
  const del = main.querySelector('[data-delop]'); if (del) del.onclick = () => deleteOp(op, del);
  if (op && ui.top === 'ops') bindOpPanel(op);
}
function productsTable() {
  const by = {};
  for (const p of P.parts) {
    const k = p.product || P.name; const x = by[k] = by[k] || { name: k, count: 0, area: 0, edge: 0, holes: 0 };
    x.count += p.count; x.area += p.l * p.w * p.count / 1e6; x.holes += p.holes.length * p.count;
    for (const s of 'tblr') if (p.edges[s]) x.edge += (s === 't' || s === 'b' ? p.l : p.w) * p.count / 1000;
  }
  return `<div class="tbl short"><table><thead><tr><th>Изделие</th><th class="r">Деталей</th><th class="r">Площадь, м²</th><th class="r">Кромка, м</th><th class="r">Отверстий</th></tr></thead><tbody>
    ${Object.values(by).map(x => `<tr><td>${esc(x.name)}</td><td class="n">${fmt(x.count)}</td><td class="n">${fmt(x.area, 2)}</td><td class="n">${fmt(x.edge, 1)}</td><td class="n">${fmt(x.holes)}</td></tr>`).join('')}
    </tbody></table></div>`;
}
function addOp(type) {
  change(() => {
    if (type === 'EL') { let i = 1; while (P.bands['b' + i]) i++; P.bands['b' + i] = { name: 'Новая кромка', t: 0.4, w: 19, code: '' }; ui.op = 'b:b' + i; }
    else if (type === 'GR') { P.grooves = P.grooves || {}; let i = 1; while (P.grooves['g' + i]) i++; P.grooves['g' + i] = { name: 'Паз 4×8 под ХДФ', w: 4, depth: 8, offset: 16, price: 0 }; ui.op = 'g:g' + i; }
    else if (type === 'CL') { const id = 'l' + Date.now(); P.linear = P.linear || []; P.linear.push({ id, name: 'Столешница 38 мм', code: '', len: 3050, kerf: 4.4, trim: 10, price: 0, cutPrice: 0, parts: [] }); ui.op = 'l:' + id; }
    else if (type === 'O') { P.showExtras = true; P.extras = P.extras || []; ui.op = 'o'; ui.sub = 'parts'; return; }
    else { const id = 'm' + Date.now(); P.materials.push({ id, name: type === 'CN' ? 'Материал для ЧПУ' : 'Новый материал', code: '', t: 16, L: 2750, W: 1830, op: type, params: {} }); ui.op = 'm:' + id; }
    ui.sub = 'params';
  });
}
function moveOp(op, d) {
  if (!op) return;
  if (op.m) { const i = P.materials.indexOf(op.m), j = i + d; if (j < 0 || j >= P.materials.length) return;
    change(() => { [P.materials[i], P.materials[j]] = [P.materials[j], P.materials[i]]; }); }
  else if (op.type === 'EL') { const keys = Object.keys(P.bands), i = keys.indexOf(op.ref), j = i + d; if (j < 0 || j >= keys.length) return;
    change(() => { [keys[i], keys[j]] = [keys[j], keys[i]]; P.bands = Object.fromEntries(keys.map(k => [k, P.bands[k]])); }); }
}
function deleteOp(op, btn) {
  if (!op || op.type === 'XNC') return toast('Присадка берётся из деталей, её нельзя удалить отдельно');
  if (op.type === 'GR') return change(() => { delete P.grooves[op.ref]; P.parts.forEach(p => { if (p.gr) for (const s of 'tblr') if (p.gr[s] === op.ref) p.gr[s] = null; }); ui.op = null; });
  if (op.type === 'CL') { if (op.lin.parts.length && !btn.dataset.sure) { btn.dataset.sure = 1; btn.textContent = 'Удалить вместе с деталями?'; return; } return change(() => { P.linear = P.linear.filter(l => l !== op.lin); ui.op = null; }); }
  if (op.type === 'O') { if ((P.extras || []).length && !btn.dataset.sure) { btn.dataset.sure = 1; btn.textContent = 'Удалить все позиции?'; return; } return change(() => { P.extras = []; P.showExtras = false; ui.op = null; }); }
  const n = op.m ? core.partsOf(P, op.m).length : P.parts.filter(p => Object.values(p.edges).includes(op.ref)).length;
  if (n && !btn.dataset.sure) { btn.dataset.sure = 1; btn.textContent = `Удалить вместе с ${n} дет.?`; return; }
  change(() => {
    if (op.m) { P.parts = P.parts.filter(p => p.material !== op.m.id); P.materials = P.materials.filter(m => m !== op.m); }
    else { delete P.bands[op.ref]; P.parts.forEach(p => { for (const s of 'tblr') if (p.edges[s] === op.ref) p.edges[s] = null; }); }
    ui.op = null;
  });
}

/* --- Панель выбранной операции --- */
function opPanel(op) {
  const subs = SUBS[op.type]; if (!subs.some(s => s[0] === ui.sub)) ui.sub = subs[0][0];
  let head = '';
  if (op.m) { const x = resOf(op.m), r = x.r;
    head = `<span class="chip">${op.m.L}×${op.m.W}</span><span class="chip">${r.fullCount} лист.</span>${r.stockUsed.length ? `<span class="chip good">остатков со склада: ${r.stockUsed.length}</span>` : ''}
      <span class="chip ${r.util >= .75 ? 'good' : r.util < .55 ? 'bad' : ''}">заполнение ${fmt(r.util * 100, 1)} %</span>${r.tooBig.length ? `<span class="chip bad">не влезают: ${r.tooBig.length}</span>` : ''}${r.unplaced.length ? `<span class="chip bad">не разложено: ${r.unplaced.length}</span>` : ''}${r.errors.length ? `<span class="chip bad">ошибки на картах: ${r.errors.length}</span>` : ''}`; }
  const body = (op.m ? problemsBox(resOf(op.m)) : '') + ({ params: subParams, parts: subParts, sheets: subSheets, cut: subCut })[ui.sub](op);
  return `<div class="op-head"><span class="tag t-${op.type}">${op.type}</span><h2>${esc(TYPE_NAME[op.type])}: ${esc(op.name)}</h2>${head}</div>
    <div class="tabs sub" role="tablist">${subs.map(([k, n]) => `<button class="tab" role="tab" data-sub="${k}" aria-selected="${k === ui.sub}">${n}</button>`).join('')}</div>
    <div class="view">${body}</div>`;
}
function bindOpPanel(op) {
  const pan = $('#opPanel');
  pan.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => setUi({ sub: b.dataset.sub }));
  ({ params: bindParams, parts: bindParts, sheets: bindSheets, cut: bindCut })[ui.sub](op, pan);
}

/* Параметры: таблица свойств, сгруппированная по разделам */
function fieldValue(f, op) {
  const [k, , , where, , baseKey] = f;
  if (where === 'm') return op.m[k] ?? (k === 'op' ? 'CS' : '');
  if (where === 'p') { const mo = core.matOpts(op.m, eff()); return { own: op.m.params?.[k], eff: mo[k] ?? mo[baseKey] }; }
  if (where === 'b') return { own: op.band[k], eff: op.band[k] ?? eff()[baseKey ?? k] };
  if (where === 'g') return op.groove[k] ?? '';
  if (where === 'l') return op.lin[k] ?? '';
  return eff()[k];
}
function propsTable(fields, valOf, idPrefix) {
  return `<table class="props"><tbody>${fields.map(f => {
    if (f.length === 1) return `<tr class="ph"><th colspan="2">${esc(f[0])}</th></tr>`;
    const [k, label, type, where, step] = f; const v = valOf(f); const own = v && typeof v === 'object';
    const cur = own ? (v.own ?? '') : v, eff = own ? v.eff : v;
    const fid = idPrefix + k; let input;
    if (type === 'sel') input = `<select class="inp" data-k="${k}" data-w="${where}" data-fid="${fid}">${own ? `<option value="" ${cur === '' ? 'selected' : ''}>как в настройках (${esc((SEL[k].find(o => o[0] === eff) || [, eff])[1])})</option>` : ''}${SEL[k].map(([o, n]) => `<option value="${o}" ${String(cur) === o ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
    else if (type === 'chk') input = `<input type="checkbox" data-k="${k}" data-w="${where}" data-fid="${fid}" ${eff ? 'checked' : ''}>`;
    else input = `<input class="inp ${type === 'text' ? 't' : ''}" data-k="${k}" data-w="${where}" data-fid="${fid}" ${type === 'num' ? `type="number" step="${step || 1}"` : ''} value="${esc(cur)}" ${own ? `placeholder="${esc(eff)}"` : ''}>`;
    return `<tr><td><label>${esc(label)}</label>${own && cur !== '' && cur != null ? ' <span class="own" title="Своё значение у этой операции">●</span>' : ''}</td><td>${input}</td></tr>`;
  }).join('')}</tbody></table>`;
}
function subParams(op) {
  const own = op.m ? Object.keys(op.m.params || {}).length : 0;
  return `<div class="params">${propsTable(F[op.type], f => fieldValue(f, op), op.key + ':')}
    <div class="note">${catalogBox(op)}${op.type === 'XNC' ? 'Отверстия и фрезеровка берутся из программ деталей в проекте (Базис, GibLab).' : ['GR', 'CL'].includes(op.type) ? '' :
      `Пустое поле — значение из «Настроек» (серым). ● — своё значение этой операции.${own ? ' <button class="btn sm" id="resetParams">Сбросить к настройкам</button>' : ''}`}
      ${op.type === 'CN' ? '<p><span class="badge">черновик</span> Режимы резания и G-код ещё не сверены с вашим станком.</p>' : ''}</div></div>`;
}
/** Свой каталог и прайс сайта одним списком. У кромки с сайта цена — это материал за метр. */
function pickList(kind) {
  const own = catalog[kind];
  if (!siteCat) return own;
  const extra = kind === 'materials' ? (siteCat.sheets || []).map(x => ({ name: x.name, code: x.code, t: x.t, L: x.L, W: x.W, price: x.price, site: 1 }))
    : (siteCat.bands || []).map(x => ({ name: x.name, code: x.code, t: x.t, w: x.w, matPrice: x.price, site: 1 }));
  return [...own, ...extra];
}
function catalogBox(op) {
  const kind = op.m ? 'materials' : op.type === 'EL' ? 'bands' : null; if (!kind) return '';
  const list = pickList(kind);
  return `<div class="catbox"><b>Каталог</b><div class="row"><select class="inp" id="catPick" aria-label="Взять из каталога"><option value="">— взять из каталога —</option>${list.map((c, i) => `<option value="${i}">${c.site ? 'сайт · ' : ''}${esc(c.name)}${c.t && !String(c.name).includes(c.t + ' мм') ? ' ' + c.t + ' мм' : ''}${c.price ?? c.matPrice ? ' · ' + fmt(c.price ?? c.matPrice) + ' сом' : ''}</option>`).join('')}</select>
    <button class="btn sm" id="catSave">Сохранить в каталог</button></div></div>`;
}
function bindCatalog(op) {
  const kind = op.m ? 'materials' : op.type === 'EL' ? 'bands' : null; if (!kind) return;
  const target = op.m || op.band;
  const keys = kind === 'materials' ? ['name', 'code', 't', 'L', 'W', 'price', 'priceM2'] : ['name', 'code', 't', 'w', 'matPrice', 'price'];
  $('#catPick').onchange = e => { const c = pickList(kind)[+e.target.value]; if (!c) return; change(() => { keys.forEach(k => { if (c[k] != null && c[k] !== '') target[k] = c[k]; }); }); toast('Взято из каталога: ' + c.name); };
  $('#catSave').onclick = () => { const c = {}; keys.forEach(k => { if (target[k] != null && target[k] !== '') c[k] = target[k]; });
    const i = catalog[kind].findIndex(x => x.name === c.name && (x.t ?? '') === (c.t ?? '')); if (i >= 0) catalog[kind][i] = c; else catalog[kind].push(c);
    store.set('catalog', catalog); toast('Сохранено в каталог'); render(); };
}
function bindParams(op, pan) {
  if (pan.querySelector('#catPick')) bindCatalog(op);
  pan.querySelector('.props').addEventListener('change', e => {
    const el = e.target, k = el.dataset.k, w = el.dataset.w; if (!k) return;
    const raw = el.type === 'checkbox' ? el.checked : el.value;
    const num = el.type === 'number';
    const val = raw === '' ? undefined : num ? +raw : raw;
    if (w === 'base') { base[k] = val ?? core.DEFAULTS[k]; store.set('base', base); recalc(); renderSoon(); return; }
    change(() => {
      if (w === 'm') { if (val === undefined && k !== 'price') return; op.m[k] = val; }
      else if (w === 'p') { op.m.params = op.m.params || {}; if (val === undefined) delete op.m.params[k]; else op.m.params[k] = val; }
      else if (w === 'g' || w === 'l') { const o = w === 'g' ? op.groove : op.lin; if (val === undefined) { if (['name', 'len'].includes(k)) return; delete o[k]; } else o[k] = val; }
      else if (w === 'b') { if (val === undefined) { if (['name', 't', 'w'].includes(k)) return; delete op.band[k]; } else op.band[k] = val; }
    });
  });
  const rp = $('#resetParams'); if (rp) rp.onclick = () => change(() => { op.m.params = {}; });
}

/* Детали операции */
function subParts(op) {
  if (op.type === 'EL') {
    const list = P.parts.filter(p => Object.values(p.edges).includes(op.ref));
    return `<div class="tbl"><table><thead><tr><th>№</th><th>Наименование</th><th>Материал</th><th class="r">Длина</th><th class="r">Ширина</th><th class="r">Кол</th><th>Стороны</th><th class="r">Обклейка, м</th></tr></thead><tbody>
      ${list.map(p => { const sides = [...'tblr'].filter(s => p.edges[s] === op.ref); const len = sides.reduce((a, s) => a + (s === 't' || s === 'b' ? p.l : p.w), 0) * p.count / 1000;
        return `<tr><td class="n">${p.id}</td><td>${esc(p.name)}</td><td>${esc(P.materials.find(m => m.id === p.material)?.name || '—')}</td><td class="n">${p.l}</td><td class="n">${p.w}</td><td class="n">${p.count}</td>
        <td class="mono">${['t', 'b', 'l', 'r'].map((s, i) => p.edges[s] === op.ref ? 'ВНЛП'[i] : '·').join(' ')}</td><td class="n">${fmt(len, 2)}</td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">Эта кромка ещё не назначена ни одной детали. Назначьте её во вкладке «Детали» листового раскроя.</td></tr>'}
      </tbody></table></div>`;
  }
  if (op.type === 'GR') {
    const len = R.grooves[op.ref]?.len || 0;
    return `<p class="note">Отметьте стороны деталей, где нужен этот паз. Паз идёт по всей стороне. Всего: ${fmt(len, 2)} м.</p>
      <div class="tbl"><table class="grp"><thead><tr><th>№</th><th>Наименование</th><th>Материал</th><th class="r">Длина</th><th class="r">Ширина</th><th class="r">Кол</th><th>Верх</th><th>Низ</th><th>Лево</th><th>Право</th></tr></thead><tbody>
      ${P.parts.map(p => `<tr data-id="${p.id}"><td class="n">${p.id}</td><td>${esc(p.name)}</td><td>${esc(P.materials.find(m => m.id === p.material)?.name || '—')}</td><td class="n">${p.l}</td><td class="n">${p.w}</td><td class="n">${p.count}</td>
        ${['t', 'b', 'l', 'r'].map(sd => `<td><input type="checkbox" data-gs="${sd}" aria-label="Паз" ${p.gr?.[sd] === op.ref ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`;
  }
  if (op.type === 'CL') {
    const r = R.lin.find(x => x.l === op.lin).r;
    return `<div class="row bar2"><button class="btn sm primary" id="addLin">Добавить деталь</button><span class="note">Длина детали в мм. Хлыст ${op.lin.len} мм.</span></div>
      <div class="tbl"><table class="linp"><thead><tr><th>№</th><th>Наименование</th><th class="r">Длина</th><th class="r">Кол</th><th></th></tr></thead><tbody>
      ${op.lin.parts.map((p, i) => `<tr data-i="${i}"><td class="n">${p.id}</td><td><input class="cell name" data-lf="name" data-fid="l${p.id}name" value="${esc(p.name)}" aria-label="Наименование"></td>
        <td><input class="cell" data-lf="l" data-fid="l${p.id}l" type="number" value="${p.l}" aria-label="Длина"></td><td><input class="cell" data-lf="count" type="number" min="0" value="${p.count}" style="width:56px" aria-label="Количество"></td>
        <td><button class="btn xs" data-ldel aria-label="Удалить">✕</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Добавьте детали: столешницы, планки, профиль.</td></tr>'}
      </tbody></table></div>${r.tooLong.length ? `<p class="note warn">Длиннее хлыста: ${r.tooLong.map(p => esc(p.name) + ' ' + p.l).join(', ')}</p>` : ''}`;
  }
  if (op.type === 'O') {
    const ex = P.extras || [];
    return `<div class="row bar2"><button class="btn sm primary" id="addEx">Добавить позицию</button><span class="note">Фурнитура, доставка, сборка, монтаж — всё, что входит в заказ.</span></div>
      <div class="tbl"><table class="ex"><thead><tr><th>Наименование</th><th>Вид</th><th class="r">Кол-во</th><th>Ед.</th><th class="r">Цена, сом</th><th class="r">Сумма, сом</th><th></th></tr></thead><tbody>
      ${ex.map((e, i) => `<tr data-i="${i}"><td><input class="cell name" data-xf="name" data-fid="x${i}name" value="${esc(e.name)}" aria-label="Наименование"></td>
        <td><select class="cell" data-xf="kind" aria-label="Вид"><option value="mat" ${e.kind !== 'work' ? 'selected' : ''}>товар</option><option value="work" ${e.kind === 'work' ? 'selected' : ''}>работа</option></select></td>
        <td><input class="cell" data-xf="qty" type="number" value="${e.qty}" style="width:60px" aria-label="Количество"></td><td><input class="cell" data-xf="unit" value="${esc(e.unit || 'шт')}" style="width:48px;text-align:left" aria-label="Единица"></td>
        <td><input class="cell" data-xf="price" type="number" value="${e.price}" aria-label="Цена"></td><td class="n">${fmt((+e.qty || 0) * (+e.price || 0))}</td><td><button class="btn xs" data-xdel aria-label="Удалить">✕</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Пока пусто.</td></tr>'}
      </tbody></table></div>`;
  }
  if (op.type === 'XNC') {
    const list = P.parts.filter(p => p.holes.length || p.mill || p.id === ui.xp);
    return `<p class="note">Присадку любой детали можно задать во вкладке «Детали» листового раскроя, кнопкой в колонке «Отв.».</p>
      <div class="tbl"><table class="xnc"><thead><tr><th>№</th><th>Наименование</th><th>Материал</th><th class="r">Размер</th><th class="r">Кол</th><th class="r">Отв. в пласть</th><th class="r">Отв. в торец</th><th class="r">Фрезеровка, м</th><th></th></tr></thead><tbody>
      ${list.map(p => `<tr data-id="${p.id}" ${p.id === ui.xp ? 'aria-selected="true"' : ''}><td class="n">${p.id}</td><td>${esc(p.name)}</td><td>${esc(P.materials.find(m => m.id === p.material)?.name || '—')}</td><td class="n">${p.l}×${p.w}</td><td class="n">${p.count}</td>
        <td class="n">${p.holes.filter(h => h.side === 'face').length}</td><td class="n">${p.holes.filter(h => h.side !== 'face').length}</td><td class="n">${fmt(p.mill / 1000, 2)}</td><td><button class="btn xs" data-xp>Изменить</button></td></tr>`).join('')}
      </tbody></table></div>${partEditor()}`;
  }
  const parts = P.parts.filter(p => p.material === op.m.id), placed = core.placedCounts(R), x = resOf(op.m);
  const bandOpts = sel => `<option value="">—</option>` + Object.entries(P.bands).map(([k, b]) => `<option value="${esc(k)}" ${k === sel ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
  const matOpts = sel => P.materials.map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.name)} ${m.t}</option>`).join('');
  const total = parts.reduce((a, p) => a + p.count, 0), area = parts.reduce((a, p) => a + p.l * p.w * p.count, 0) / 1e6;
  const modeName = { 0: 'пильные', 1: 'чистовые, с кромкой', 2: 'после прифуговки' }[+(x.o.sizeMode ?? 1)];
  const nSel = parts.filter(p => sel.has(p.id)).length;
  return `<div class="row bar2"><button class="btn sm primary" id="addPart">Добавить деталь</button><button class="btn sm" id="showPaste">Вставить из Excel</button>
      <span class="note">Размеры ${modeName} (меняется в «Параметрах»). Деталей: ${fmt(total)} шт · площадь ${fmt(area, 2)} м²</span></div>
    <div class="row bar2 bulk" ${nSel ? '' : 'hidden'}><b>Выбрано: ${nSel}</b>
      <button class="btn sm" data-bulk="grainOn">Поставить текстуру</button><button class="btn sm" data-bulk="grainOff">Снять текстуру</button>
      <button class="btn sm" data-bulk="swap">Поменять Д и Ш</button>
      <select class="inp" id="bulkBand" aria-label="Кромка по периметру">${bandOpts('')}</select><button class="btn sm" data-bulk="band">Кромка по периметру</button>
      <select class="inp" id="bulkMat" aria-label="Перенести в материал">${matOpts(op.m.id)}</select><button class="btn sm" data-bulk="move">Перенести</button>
      <button class="btn sm" data-bulk="dup">Копировать</button><button class="btn sm" data-bulk="del">Удалить</button><button class="btn sm" data-bulk="none">Снять выделение</button></div>
    <div id="pasteBox" ${ui.paste ? '' : 'hidden'} class="pastebox">
      <p class="note">Скопируйте из Excel столбцы: <b>Длина, Ширина, Кол-во, Текстура (1/0), Кромка верх, низ, лево, право, Наименование</b>. В колонках кромки — название кромки или 1 (первая кромка проекта).</p>
      <textarea class="paste" id="pasteText" placeholder="720	560	2	1	ПВХ 2 Белый		ПВХ 0,4 Белый	ПВХ 0,4 Белый	Бок"></textarea>
      <div class="row" style="margin-top:8px"><button class="btn sm primary" id="doPaste">Добавить строки в «${esc(op.m.name)}»</button>
        <label class="btn sm" for="xlsFile">Взять из файла Excel (.xlsx, .csv)…</label><input type="file" id="xlsFile" accept=".xlsx,.csv,.txt" hidden>
        <span class="note">В файле колонки узнаются по заголовкам: Длина, Ширина, Кол-во, Наименование, Кромка…</span></div></div>
    <div class="tbl"><table class="parts"><thead><tr><th><input type="checkbox" id="selAll" aria-label="Выбрать все" ${nSel && nSel === parts.length ? 'checked' : ''}></th><th>№</th><th>Наименование</th><th class="r">Длина</th><th class="r">Ширина</th><th class="r">Кол</th><th title="Текстура">Ткт</th><th title="Кромка верх">ОВ</th><th title="Кромка низ">ОН</th><th title="Кромка лево">ОЛ</th><th title="Кромка право">ОП</th><th class="r">Пильный</th><th class="r">Отв.</th><th class="r" title="Разложено в раскрое">В раскрое</th><th>Операция</th><th></th></tr></thead><tbody>
    ${parts.map(p => { const s = core.sawSize(P, p, x.o), pl = placed.get(p.id) || 0; return `<tr data-id="${p.id}" ${sel.has(p.id) ? 'aria-selected="true"' : ''}>
      <td><input type="checkbox" data-sel aria-label="Выбрать деталь" ${sel.has(p.id) ? 'checked' : ''}></td><td class="n">${p.id}</td><td><input class="cell name" data-f="name" data-fid="p${p.id}name" value="${esc(p.name)}" aria-label="Наименование"></td>
      <td><input class="cell" data-f="l" data-fid="p${p.id}l" type="number" value="${p.l}" aria-label="Длина"></td><td><input class="cell" data-f="w" data-fid="p${p.id}w" type="number" value="${p.w}" aria-label="Ширина"></td>
      <td><input class="cell" data-f="count" data-fid="p${p.id}count" type="number" min="0" value="${p.count}" style="width:52px" aria-label="Количество"></td>
      <td><input type="checkbox" data-f="grain" data-fid="p${p.id}grain" ${p.grain ? 'checked' : ''} aria-label="Текстура"></td>
      ${['t', 'b', 'l', 'r'].map(e => `<td><select class="cell" data-e="${e}" data-fid="p${p.id}e${e}" aria-label="Кромка">${bandOpts(p.edges[e])}</select></td>`).join('')}
      <td class="n">${s.l}×${s.w}</td><td><button class="btn xs ${core.badHoles(p).length ? 'warnb' : ''}" data-xp title="Присадка и фрезеровка детали">${p.holes.length || '+'}${p.mill ? ' ф' : ''}</button></td><td class="n ${pl < p.count ? 'warn' : ''}">${pl} из ${p.count}</td>
      <td><select class="cell" data-f="material" aria-label="Перенести в операцию">${matOpts(p.material)}</select></td>
      <td class="acts"><button class="btn xs" data-swap title="Поменять длину и ширину" aria-label="Поменять длину и ширину">⇄</button><button class="btn xs" data-del aria-label="Удалить деталь">✕</button></td></tr>`; }).join('')}
    </tbody></table></div>
    ${partEditor()}
`;
}
function bindParts(op, pan) {
  if (op.type === 'XNC') { pan.querySelectorAll('table.xnc [data-xp]').forEach(b => b.onclick = () => { const id = +b.closest('tr').dataset.id; ui.xp = ui.xp === id ? null : id; render(); }); bindPartEditor(pan); return; }
  if (op.type === 'GR') { pan.querySelector('table.grp').addEventListener('change', e => { const el = e.target; const p = P.parts.find(q => q.id === +el.closest('tr').dataset.id);
    change(() => { p.gr = p.gr || { t: null, b: null, l: null, r: null }; p.gr[el.dataset.gs] = el.checked ? op.ref : null; }); }); return; }
  if (op.type === 'CL') {
    pan.querySelector('table.linp').addEventListener('change', e => { const el = e.target, tr = el.closest('tr'); if (!tr?.dataset.i) return; const p = op.lin.parts[+tr.dataset.i];
      change(() => { p[el.dataset.lf] = el.dataset.lf === 'name' ? el.value : Math.max(0, +el.value); }); });
    pan.querySelectorAll('[data-ldel]').forEach(b => b.onclick = () => change(() => { op.lin.parts.splice(+b.closest('tr').dataset.i, 1); }));
    $('#addLin').onclick = () => change(() => { const id = op.lin.parts.reduce((a, p) => Math.max(a, p.id), 0) + 1; op.lin.parts.push({ id, name: 'Деталь', l: 1000, count: 1 }); setTimeout(() => document.querySelector(`[data-fid="l${id}name"]`)?.focus(), 30); });
    return;
  }
  if (op.type === 'O') {
    const t = pan.querySelector('table.ex');
    t.addEventListener('change', e => { const el = e.target, tr = el.closest('tr'); if (!tr?.dataset.i) return; const x = P.extras[+tr.dataset.i];
      change(() => { const f = el.dataset.xf; x[f] = ['qty', 'price'].includes(f) ? +el.value : el.value; }); });
    pan.querySelectorAll('[data-xdel]').forEach(b => b.onclick = () => change(() => { P.extras.splice(+b.closest('tr').dataset.i, 1); }));
    $('#addEx').onclick = () => change(() => { P.extras = P.extras || []; P.extras.push({ name: 'Петля с доводчиком', kind: 'mat', qty: 1, unit: 'шт', price: 0 }); const i = P.extras.length - 1; setTimeout(() => document.querySelector(`[data-fid="x${i}name"]`)?.focus(), 30); });
    return;
  }
  if (!op.m) return;
  const tb = pan.querySelector('table.parts tbody');
  tb.addEventListener('change', e => {
    const tr = e.target.closest('tr'), el = e.target; const p = P.parts.find(q => q.id === +tr.dataset.id); if (!p) return;
    if (el.dataset.sel !== undefined) { if (el.checked) sel.add(p.id); else sel.delete(p.id); return render(); }
    change(() => {
      if (el.dataset.f) { const f = el.dataset.f; p[f] = f === 'grain' ? el.checked : (f === 'name' || f === 'material') ? el.value : Math.max(0, +el.value); }
      if (el.dataset.e) p.edges[el.dataset.e] = el.value || null;
    });
  });
  tb.addEventListener('click', e => {
    const tr = e.target.closest('tr'); if (!tr) return; const id = +tr.dataset.id;
    if (e.target.closest('[data-del]')) change(() => { P.parts = P.parts.filter(q => q.id !== id); });
    if (e.target.closest('[data-xp]')) { ui.xp = ui.xp === id ? null : id; render(); setTimeout(() => $('#xedit')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30); return; }
    if (e.target.closest('[data-swap]')) change(() => { const p = P.parts.find(q => q.id === id); [p.l, p.w] = [p.w, p.l]; [p.edges.t, p.edges.b, p.edges.l, p.edges.r] = [p.edges.l, p.edges.r, p.edges.t, p.edges.b]; });
  });
  bindPartEditor(pan);
  $('#selAll').onchange = e => { P.parts.filter(p => p.material === op.m.id).forEach(p => e.target.checked ? sel.add(p.id) : sel.delete(p.id)); render(); };
  pan.querySelectorAll('[data-bulk]').forEach(b => b.onclick = () => {
    const a = b.dataset.bulk, list = P.parts.filter(p => p.material === op.m.id && sel.has(p.id));
    if (a === 'none') { sel.clear(); return render(); }
    change(() => {
      if (a === 'grainOn' || a === 'grainOff') list.forEach(p => { p.grain = a === 'grainOn'; });
      if (a === 'swap') list.forEach(p => { [p.l, p.w] = [p.w, p.l]; [p.edges.t, p.edges.b, p.edges.l, p.edges.r] = [p.edges.l, p.edges.r, p.edges.t, p.edges.b]; });
      if (a === 'band') { const k = $('#bulkBand').value || null; list.forEach(p => { p.edges = { t: k, b: k, l: k, r: k }; }); }
      if (a === 'move') { const mid = $('#bulkMat').value; list.forEach(p => { p.material = mid; }); sel.clear(); }
      if (a === 'dup') { list.forEach(p => { const id = core.nextId(P); P.parts.push({ ...JSON.parse(JSON.stringify(p)), id }); }); }
      if (a === 'del') { P.parts = P.parts.filter(p => !list.includes(p)); sel.clear(); }
    });
  });
  $('#addPart').onclick = () => change(() => { const id = core.nextId(P); P.parts.push({ id, name: 'Деталь', l: 600, w: 400, count: 1, grain: true, edges: { t: null, b: null, l: null, r: null }, material: op.m.id, holes: [], mill: 0, product: '' }); setTimeout(() => document.querySelector(`[data-fid="p${id}name"]`)?.focus(), 30); });
  $('#showPaste').onclick = () => { ui.paste = !ui.paste; $('#pasteBox').hidden = !ui.paste; if (ui.paste) $('#pasteText').focus(); };
  $('#xlsFile').onchange = e => { const f = e.target.files[0]; if (f) f.arrayBuffer().then(b => importTable(b, f.name, op.m.id)); e.target.value = ''; };
  $('#doPaste').onclick = () => { let n = 0; change(() => { n = core.pasteRows(P, $('#pasteText').value, op.m.id); }); ui.paste = false; toast('Добавлено строк: ' + n); };
}

/* Листы и остатки */
/* --- Присадка детали: отверстия, типовые наборы, фрезеровка, загрузка DXF --- */
const XTPL = { hinge: 'Петли Ø35', pins: 'Полкодержатели Ø5, шаг 32', join: 'Крепёж в пласть Ø5 (под конфирмат)', edge: 'Конфирмат в торец Ø7', dowel: 'Шканты в торец Ø8' };
const SIDES4 = { t: 'верх', b: 'низ', l: 'лево', r: 'право' };
function partSvg(p) {
  const pad = Math.max(30, Math.max(p.l, p.w) * 0.04), bad = new Set(core.badHoles(p));
    const holes = p.holes.map((h, i) => h.side === 'face'
    ? `<circle cx="${h.x}" cy="${h.y}" r="${Math.max(h.d / 2, 3)}" fill="${bad.has(h) ? 'var(--warn)' : 'var(--accent)'}" fill-opacity=".85"><title>${i + 1}: Ø${h.d} глуб. ${h.dp} — X ${h.x}, Y ${h.y}</title></circle>`
    : h.x == null ? '' : (() => { // отверстие в торец рисуем как канал на глубину сверления
      const a = +h.x, d = h.d, dp = Math.min(h.dp || 10, h.side === 'bt' || h.side === 'bb' ? p.w : p.l);
      const [x, y, w, hh] = h.side === 'bt' ? [a - d / 2, 0, d, dp] : h.side === 'bb' ? [a - d / 2, p.w - dp, d, dp] : h.side === 'bl' ? [0, a - d / 2, dp, d] : [p.l - dp, a - d / 2, dp, d];
      return `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="var(--warn)" fill-opacity=".8"><title>${i + 1}: ${core.SIDE_NAME[h.side]} Ø${h.d} глуб. ${h.dp}</title></rect>`;
    })()).join('');
  const mill = (p.millPaths || []).map(m => m.circle ? `<circle cx="${m.x}" cy="${m.y}" r="${m.r}" fill="none" stroke="var(--ink)" stroke-width="3" stroke-dasharray="10 6"/>`
    : `<polyline points="${m.pts.map(q => q.x + ',' + q.y).join(' ')}${m.closed ? ' ' + m.pts[0].x + ',' + m.pts[0].y : ''}" fill="none" stroke="var(--ink)" stroke-width="3" stroke-dasharray="10 6"/>`).join('');
  const fs = Math.max(14, Math.max(p.l, p.w) / 40);
  return `<svg class="map partmap" viewBox="${-pad} ${-pad} ${p.l + 2 * pad} ${p.w + 2 * pad}" role="img" aria-label="Деталь ${p.l}×${p.w} с отверстиями">
    <rect x="0" y="0" width="${p.l}" height="${p.w}" fill="var(--board)" stroke="var(--board-line)" stroke-width="3"/>
    <text x="${p.l / 2}" y="${-pad / 3}" font-size="${fs}" text-anchor="middle">${p.l} (верх)</text><text x="${-pad / 3}" y="${p.w / 2}" font-size="${fs}" text-anchor="middle" transform="rotate(-90 ${-pad / 3} ${p.w / 2})">${p.w} (лево)</text>
    ${mill}${holes}</svg>`;
}
function partEditor() {
  const p = P.parts.find(q => q.id === ui.xp); if (!p) return '';
  const t = P.materials.find(m => m.id === p.material)?.t || 16, bad = core.badHoles(p);
  const sideOpts = v => Object.entries(core.SIDE_NAME).map(([k, n]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${n}</option>`).join('');
  return `<div class="xedit" id="xedit"><div class="row" style="justify-content:space-between"><h3>Присадка: №${p.id} ${esc(p.name)} · ${p.l}×${p.w}×${t}</h3><button class="btn sm" id="xClose">Закрыть</button></div>
    <div class="split"><div>${partSvg(p)}<p class="note">Начало координат — левый верхний угол детали: X вдоль длины, Y вдоль ширины. У отверстия в торец X — место вдоль торца, Z — от лицевой пласти.</p>
      ${bad.length ? `<p class="note warn">Выходят за деталь: ${bad.length} отв. Проверьте координаты.</p>` : ''}</div>
    <div><div class="tbl"><table class="holes"><thead><tr><th>№</th><th>Где</th><th class="r">X</th><th class="r">Y / Z</th><th class="r">Ø</th><th class="r">Глуб.</th><th></th></tr></thead><tbody>
      ${p.holes.map((h, i) => `<tr data-i="${i}"><td class="n">${i + 1}</td><td><select class="cell" data-hk="side" aria-label="Где">${sideOpts(h.side)}</select></td>
        <td><input class="cell" data-hk="x" type="number" step="0.1" value="${h.x ?? ''}" style="width:84px" aria-label="X"></td>
        <td><input class="cell" data-hk="${h.side === 'face' ? 'y' : 'z'}" type="number" step="0.1" value="${(h.side === 'face' ? h.y : h.z) ?? ''}" style="width:84px" aria-label="${h.side === 'face' ? 'Y' : 'Z'}"></td>
        <td><input class="cell" data-hk="d" type="number" step="0.5" value="${h.d}" style="width:56px" aria-label="Диаметр"></td><td><input class="cell" data-hk="dp" type="number" step="0.5" value="${h.dp}" style="width:56px" aria-label="Глубина"></td>
        <td><button class="btn xs" data-hdel aria-label="Удалить отверстие">✕</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Отверстий нет.</td></tr>'}
      </tbody></table></div>
      <div class="row bar2"><button class="btn sm" id="xAdd">Добавить отверстие</button>${p.holes.length ? '<button class="btn sm" id="xClear">Удалить все отверстия</button>' : ''}</div>
      <div class="row bar2"><select class="inp" id="xTpl" aria-label="Типовая присадка">${Object.entries(XTPL).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
        <select class="inp" id="xSide" aria-label="Край детали">${Object.entries(SIDES4).map(([k, n]) => `<option value="${k}" ${k === 'l' ? 'selected' : ''}>${n}</option>`).join('')}</select><button class="btn sm" id="xTplAdd">Добавить набор</button></div>
      <div class="row bar2"><label class="note">Фрезеровка, мм <input class="inp" id="xMill" type="number" value="${p.mill || 0}" style="width:90px"></label>
        <label class="btn sm" for="xDxf">Загрузить чертёж DXF…</label><input type="file" id="xDxf" accept=".dxf" hidden>
        <label class="note"><input type="checkbox" id="xDxfSize" checked> размер детали по контуру</label></div>
      <p class="note">Из DXF окружности до Ø35 становятся отверстиями (глубина из имени слоя, например D12), остальные линии считаются фрезеровкой, внешний контур задаёт размер.</p></div></div></div>`;
}
function bindPartEditor(pan) {
  const p = P.parts.find(q => q.id === ui.xp), box = pan.querySelector('#xedit'); if (!p || !box) return;
  const t = P.materials.find(m => m.id === p.material)?.t || 16;
  box.querySelector('#xClose').onclick = () => { ui.xp = null; render(); };
  box.querySelector('table.holes').addEventListener('change', e => {
    const el = e.target, i = +el.closest('tr').dataset.i, h = p.holes[i], k = el.dataset.hk; if (!h || !k) return;
    change(() => {
      if (k === 'side') { h.side = el.value; if (h.side === 'face') { h.y = h.y ?? Math.round(p.w / 2); delete h.z; } else { h.z = h.z ?? t / 2; delete h.y; } }
      else h[k] = +el.value;
    });
  });
  box.querySelectorAll('[data-hdel]').forEach(b => b.onclick = () => change(() => { p.holes.splice(+b.closest('tr').dataset.i, 1); }));
  box.querySelector('#xAdd').onclick = () => change(() => { p.holes.push({ side: 'face', x: 50, y: 50, d: 5, dp: 12 }); });
  const cl = box.querySelector('#xClear'); if (cl) cl.onclick = () => { if (!cl.dataset.sure) { cl.dataset.sure = 1; cl.textContent = 'Точно удалить все?'; return; } change(() => { p.holes = []; }); };
  box.querySelector('#xTplAdd').onclick = () => {
    const k = box.querySelector('#xTpl').value, edge = box.querySelector('#xSide').value;
    const add = { hinge: () => core.hingeHoles(p, { edge }), pins: () => core.shelfPinHoles(p), join: () => core.faceJoinHoles(p, { edge, t }),
      edge: () => core.edgeHoles(p, { edge, t, d: 7, dp: 50 }), dowel: () => core.edgeHoles(p, { edge, t, d: 8, dp: 30, from: 32 }) }[k]();
    change(() => { p.holes.push(...add); if (!p.xnc?.length) p.xnc = []; });
    toast(`Добавлено отверстий: ${add.length}`);
  };
  box.querySelector('#xMill').onchange = e => change(() => { p.mill = Math.max(0, +e.target.value); if (!p.mill) delete p.millPaths; });
  box.querySelector('#xDxf').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    f.arrayBuffer().then(buf => {
      try {
        const d = core.dxfToPart(core.parseDxf(core.decodeText(buf))), size = box.querySelector('#xDxfSize').checked && d.contour;
        change(() => { if (size) { p.l = d.l; p.w = d.w; } p.holes.push(...d.holes); p.mill = (p.mill || 0) + d.mill; p.millPaths = [...(p.millPaths || []), ...d.paths]; });
        toast(`Из чертежа: отверстий ${d.holes.length}, фрезеровка ${fmt(d.mill / 1000, 2)} м${size ? `, размер ${d.l}×${d.w}` : ''}`);
      } catch (err) { toast('Не удалось прочитать DXF: ' + err.message); }
    });
  };
}
function subSheets(op) {
  const x = resOf(op.m), m = op.m, key = core.matKey(m);
  const mine = stock.filter(s => s.mat === key), used = new Set(x.r.stockUsed.map(s => s.stock.id));
  return `<div class="tbl"><table><thead><tr><th>Наименование</th><th class="r">Длина</th><th class="r">Ширина</th><th class="r">Торцовка</th><th class="r">Площадь, м²</th><th class="r">На складе</th><th class="r">В раскрое</th><th></th></tr></thead><tbody>
    <tr><td>Лист (основной формат)</td><td><input class="cell" data-sheet="L" data-fid="sL" type="number" value="${m.L}" aria-label="Длина листа"></td><td><input class="cell" data-sheet="W" data-fid="sW" type="number" value="${m.W}" aria-label="Ширина листа"></td>
      <td class="n">${x.o.trimL ?? x.o.trim}/${x.o.trimW ?? x.o.trim}</td><td class="n">${fmt(m.L * m.W / 1e6, 3)}</td><td class="n">без ограничения</td><td class="n">${x.r.mainCount}${x.r.charged !== x.r.mainCount ? ` (оплата ${fmt(x.r.charged, 2)})` : ''}</td><td></td></tr>
    ${(m.formats || []).map((f, i) => `<tr data-fmt="${i}"><td>Доп. формат</td><td><input class="cell" data-ff="l" type="number" value="${f.l}" aria-label="Длина"></td><td><input class="cell" data-ff="w" type="number" value="${f.w}" aria-label="Ширина"></td>
      <td class="n">${x.o.trimL ?? x.o.trim}/${x.o.trimW ?? x.o.trim}</td><td class="n">${fmt(f.l * f.w / 1e6, 3)}</td><td><input class="cell" data-ff="qty" type="number" min="0" value="${f.qty}" style="width:56px" aria-label="Количество на складе"></td>
      <td class="n">${x.r.formatsUsed.filter(s => s.format.id === f.id).length}</td><td class="acts"><input class="cell" data-ff="price" type="number" value="${f.price ?? ''}" placeholder="цена" style="width:70px" aria-label="Цена листа этого формата"><button class="btn xs" data-rmfmt="${i}" aria-label="Убрать формат">✕</button></td></tr>`).join('')}
    ${mine.map(s => `<tr><td>Остаток${s.from ? ' · ' + esc(s.from) : ''}</td><td class="n">${s.l}</td><td class="n">${s.w}</td><td class="n">0</td><td class="n">${fmt(s.l * s.w / 1e6, 3)}</td><td class="n">1</td><td class="n">${used.has(s.id) ? '<span class="chip good">да</span>' : '—'}</td>
      <td><button class="btn xs" data-rmstock="${esc(s.id)}" aria-label="Убрать остаток со склада">✕</button></td></tr>`).join('')}
    </tbody></table></div>
    <div class="row bar2"><span class="note">Добавить формат листа:</span><input class="inp" id="fmtL" type="number" placeholder="длина" aria-label="Длина формата"><input class="inp" id="fmtW" type="number" placeholder="ширина" aria-label="Ширина формата"><input class="inp" id="fmtQ" type="number" placeholder="кол-во" aria-label="Количество листов"><button class="btn sm" id="addFmt">Добавить</button></div>
    <div class="row bar2"><span class="note">Добавить остаток вручную:</span><input class="inp" id="offL" type="number" placeholder="длина" aria-label="Длина остатка"><input class="inp" id="offW" type="number" placeholder="ширина" aria-label="Ширина остатка"><button class="btn sm" id="addOff">Добавить на склад</button></div>
    <p class="note">${x.o.useStock ? 'Остатки со склада заполняются раньше новых листов.' : 'Остатки со склада сейчас не используются (см. «Параметры»).'} Склад общий для всех заказов в этом браузере.</p>`;
}
function bindSheets(op, pan) {
  pan.querySelectorAll('[data-sheet]').forEach(el => el.onchange = () => change(() => { op.m[el.dataset.sheet] = +el.value || op.m[el.dataset.sheet]; }));
  pan.querySelectorAll('[data-rmstock]').forEach(b => b.onclick = () => { stock = stock.filter(s => String(s.id) !== b.dataset.rmstock); store.set('stock', stock); recalc(); render(); });
  pan.querySelectorAll('[data-ff]').forEach(el => el.onchange = () => change(() => { const f = op.m.formats[+el.closest('[data-fmt]').dataset.fmt]; const v = el.value === '' ? undefined : +el.value; if (el.dataset.ff === 'price') { if (v === undefined) delete f.price; else f.price = v; } else f[el.dataset.ff] = Math.max(0, v || 0); }));
  pan.querySelectorAll('[data-rmfmt]').forEach(b => b.onclick = () => change(() => { op.m.formats.splice(+b.dataset.rmfmt, 1); }));
  $('#addFmt').onclick = () => { const l = +$('#fmtL').value, w = +$('#fmtW').value, qty = +$('#fmtQ').value || 1; if (!(l > 0 && w > 0)) return toast('Укажите длину и ширину формата');
    change(() => { op.m.formats = op.m.formats || []; op.m.formats.push({ id: Date.now(), l, w, qty }); }); };
  $('#addOff').onclick = () => { const l = +$('#offL').value, w = +$('#offW').value; if (!(l > 0 && w > 0)) return toast('Укажите длину и ширину остатка');
    stock.push({ id: Date.now(), mat: core.matKey(op.m), name: op.m.name, t: op.m.t, l, w, from: 'вручную' }); store.set('stock', stock); recalc(); render(); };
}

/** Все проблемы раскроя материала: деталь больше листа, не разложена, ошибка геометрии карты. */
function problemsOf(x) {
  if (!x) return [];
  const r = x.r, out = [];
  for (const t of r.tooBig) out.push(`№${t.p.id} «${t.p.name}» ${t.l}×${t.w}: ${t.why || 'больше листа'}`);
  for (const u of r.unplaced) out.push(`№${u.p.id} «${u.p.name}» ${u.l}×${u.w}: ${u.why || 'не разложена (ручная карта)'}`);
  for (const e of r.errors) out.push(`Карта ${e.sheet + 1}, №${e.p.id} «${e.p.name}»: ${e.msg}`);
  return out;
}
function problemsBox(x) {
  const list = problemsOf(x); if (!list.length) return '';
  return `<div class="printbox bad"><b>Раскрой нельзя выпускать в работу, пока не исправлено:</b><ul>${list.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    Проверьте размеры и текстуру деталей, количество дополнительных листов во вкладке «Листы и остатки» или поправьте карту вручную.</div>`;
}

/* Раскрой: одна карта за раз, листалка, таблица резов или G-код */
const sameMaps = (sheets, stack) => core.cutGroups(sheets, stack); // одинаковые карты подряд — одна карта с количеством
function linCut(op) {
  const { r } = R.lin.find(x => x.l === op.lin), L = op.lin.len;
  if (!r.bars.length) return '<div class="empty">Нет деталей.</div>';
  return `<div class="nav"><span class="chip">хлыстов: ${r.bars.length}</span><span class="chip">резов: ${r.cuts}</span><span class="chip">использование ${fmt(r.util * 100, 1)} %</span></div>
    <div class="bars">${r.bars.map((b, i) => `<div class="barrow"><span class="mono">${i + 1}</span><svg viewBox="0 0 ${L} 120" preserveAspectRatio="none" role="img" aria-label="Хлыст ${i + 1}">
      <rect x="0" y="0" width="${L}" height="120" fill="var(--waste)" stroke="var(--muted)" stroke-width="4"/>
      ${b.items.map(it => `<g><title>№${it.p.id} ${esc(it.p.name)} ${it.l}</title><rect x="${it.x}" y="8" width="${it.l}" height="104" fill="var(--board)" stroke="var(--board-line)" stroke-width="4"/></g>`).join('')}</svg>
      <span class="mono small">${b.items.map(it => it.l).join(' + ')} · ост. ${fmt(b.rest)}</span></div>`).join('')}</div>`;
}
function subCut(op) {
  if (op.type === 'CL') return linCut(op);
  const x = resOf(op.m), r = x.r, cnc = x.mode === 'cnc';
  if (!r.sheets.length) return `<div class="empty">Нет деталей для раскроя. Добавьте их во вкладке «Детали».</div>`;
  const groups = mapsOf(x); if (ui.sheet >= groups.length) ui.sheet = 0;
  const g = groups[ui.sheet], s = g.s, fill = s.items.reduce((a, it) => a + it.l * it.w, 0) / (s.L * s.W) * 100;
  const edit = ui.edit === op.key && r.manual;
  const it0 = edit ? s.items.find(it => it.qi === ui.qi) : null;
  const canRot = it => x.o.grain === 'off' || !it.p.grain;
  const side = edit ? `<h3>Ручная правка</h3>
      <p class="note">Перетащите деталь мышкой или пальцем: она притянется к краю листа или соседней детали с учётом пропила ${fmt(r.k, 1)} мм. Нажмите на деталь, чтобы выбрать её.</p>
      ${it0 ? `<div class="editbox"><b>№${it0.p.id} ${esc(it0.p.name)}</b> <span class="note">${it0.l}×${it0.w}${it0.rot ? ', повёрнута' : ''}</span>
        <div class="row" style="margin-top:6px"><button class="btn sm" id="eRot" ${canRot(it0) ? '' : 'disabled title="У детали задана текстура"'}>Повернуть</button><button class="btn sm" id="eOff">Убрать с карты</button>
        ${groups.length > 1 ? `<select class="inp" id="eTo" aria-label="На какую карту">${groups.map((q, i) => i === ui.sheet ? '' : `<option value="${i}">на карту ${i + 1}</option>`).join('')}</select><button class="btn sm" id="eMove">Перенести</button>` : ''}</div></div>`
        : '<p class="note">Деталь не выбрана.</p>'}
      <h3 style="margin-top:12px">Не разложено${r.unplaced.length ? ': ' + r.unplaced.length : ''}</h3>
      ${r.unplaced.length ? `<div class="tbl"><table><tbody>${r.unplaced.map((u, i) => `<tr><td class="n">№${u.p.id}</td><td>${esc(u.p.name)}</td><td class="n">${u.l}×${u.w}</td><td><button class="btn xs" data-put="${i}">На эту карту</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Все детали на картах.</p>'}
      <div class="row" style="margin-top:10px"><button class="btn sm" id="eSheet">Добавить пустой лист</button>${!s.items.length ? '<button class="btn sm" id="eDelSheet">Убрать пустой лист</button>' : ''}<button class="btn sm primary" id="eDone">Готово</button></div>`
    : cnc ? (base.cncDraft ? `<div class="row" style="justify-content:space-between"><h3>Черновик программы NCStudio</h3></div>
      <textarea class="code" id="gcode" readonly aria-label="Черновик G-кода">${esc(core.gcode(P.name, op.m, s, g.i, x.o))}</textarea>
      <p class="note warn"><span class="badge">черновик</span> Только для сверки. На станке не запускать, пока постпроцессор не сверен с вашим файлом .nc.</p>`
      : `<h3>Программа для ЧПУ</h3><p class="note">Выгрузка на Excitech появится после сверки с образцом файла .nc со станка. Каждый лист показан отдельно, со своей присадкой. Черновик кода для сверки включается в «Настройках».</p>`)
    : `<h3>Таблица резов</h3><div class="tbl cuts"><table><thead><tr><th>№</th><th>Рез</th><th class="r">От</th><th class="r">Длина</th></tr></thead><tbody>
      ${s.cuts.map((c, i) => `<tr><td class="n">${i + 1}</td><td>${c.d === 'T' ? 'Торцовка' : c.d === 'H' ? 'Продольный' : 'Поперечный'}</td><td class="n">${c.d === 'T' ? '' : c.d === 'H' ? 'Y ' + fmt(c.y + s.ty, 1) : 'X ' + fmt(c.x + s.tx, 1)}</td><td class="n">${fmt(c.len, 1)}${c.d === 'T' ? ' ×2' : ''}</td></tr>`).join('')}
      </tbody></table></div><p class="note">Продольный — рез вдоль длины листа, поперечный — поперёк. Координата от края листа, мм. Выгрузка на пилу Homag появится после образца файла с пилы.</p>`;
  const onMap = {}; s.items.forEach(it => { const k = it.p.id; onMap[k] = onMap[k] || { p: it.p, n: 0, l: it.l, w: it.w }; onMap[k].n++; });
  return `<div class="nav"><button class="btn sm" data-sheetnav="-1" aria-label="Предыдущая карта">‹</button><b>Карта ${ui.sheet + 1} из ${groups.length}</b><button class="btn sm" data-sheetnav="1" aria-label="Следующая карта">›</button>
      <span class="chip">${s.stock ? 'остаток ' : ''}${s.L}×${s.W}</span><span class="chip">таких листов: ${g.n}</span>${!cnc && x.o.stack > 1 ? `<span class="chip">пакетом по ${x.o.stack}: ${g.passes} прох.</span>` : ''}${s.format ? '<span class="chip">доп. формат</span>' : ''}<span class="chip">деталей: ${s.items.length}</span>
      <span class="chip">рез ${fmt(s.cut / 1000, 2)} м</span><span class="chip ${fill >= 75 ? 'good' : fill < 55 ? 'bad' : ''}">заполнение ${fmt(fill, 1)} %</span>
      ${stockBtn(op.m, r)}</div>
    <div class="row bar2">${edit ? '<span class="chip good">режим правки</span>' : `<button class="btn sm" id="eStart">Править карту вручную</button>`}
      ${r.manual ? '<span class="chip">карта правлена вручную</span><button class="btn sm" id="eReset">Вернуть автоматический раскрой</button>' : ''}
      ${r.unplaced.length ? `<span class="chip bad">не разложено деталей: ${r.unplaced.length}</span>` : ''}
      ${r.manual && !cnc && !s.guillotine ? '<span class="chip bad">эту карту нельзя порезать сквозными резами на пиле</span>' : ''}
      ${r.stale ? '<span class="note">Детали или параметры изменились, поэтому ручные правки не действуют и карта рассчитана заново.</span><button class="btn sm" id="eReset">Убрать старые правки</button>' : ''}</div>
    <div class="cutview"><div>${sheetSvg(s, x.o, cnc, false, edit ? ui.qi : undefined)}
      <div class="tbl onmap"><table><thead><tr><th>№</th><th>Деталь на карте</th><th class="r">Размер</th><th class="r">Шт</th></tr></thead><tbody>
      ${Object.values(onMap).map(o => `<tr><td class="n">${o.p.id}</td><td>${esc(o.p.name)}</td><td class="n">${o.l}×${o.w}</td><td class="n">${o.n}</td></tr>`).join('')}</tbody></table></div></div>
      <div>${side}</div></div>`;
}
/** Карты для навигации: одинаковые подряд объединяются, а в режиме правки каждый лист отдельно. */
const mapsOf = x => ((ui.edit === 'm:' + x.m.id && x.r.manual) || x.mode === 'cnc' ? x.r.sheets.map((s, i) => ({ s, i, n: 1, passes: 1 })) : sameMaps(x.r.sheets, x.o.stack));
function bindCut(op, pan) {
  if (!op.m) return;
  const x = resOf(op.m);
  pan.querySelectorAll('[data-sheetnav]').forEach(b => b.onclick = () => { const n = mapsOf(x).length; ui.qi = null; setUi({ sheet: (ui.sheet + +b.dataset.sheetnav + n) % n }); });
  bindEdit(op, pan, x);
  const so = $('#saveOff'); if (so) so.onclick = () => saveOffcuts(x.r);
}
function sheetSvg(s, o, cnc, small, selQi) {
  const tx = s.tx ?? s.trim, ty = s.ty ?? s.trim, L = s.L, W = s.W, edit = selQi !== undefined;
  const rects = s.items.map(it => {
    const x = it.x + tx, y = it.y + ty, fs = Math.max(28, Math.min(70, Math.min(it.l, it.w) / 4));
    const label = it.l > 260 && it.w > 110 ? `<text x="${x + it.l / 2}" y="${y + it.w / 2 - (small ? 0 : fs * .35)}" font-size="${fs}" text-anchor="middle" dominant-baseline="middle">${it.l}×${it.w}</text>${small ? '' : `<text x="${x + it.l / 2}" y="${y + it.w / 2 + fs * .75}" font-size="${fs * .7}" text-anchor="middle" dominant-baseline="middle" class="pn">№${it.p.id}${it.rot ? ' ↻' : ''}</text>`}`
      : it.l > 140 && it.w > 70 ? `<text x="${x + it.l / 2}" y="${y + it.w / 2}" font-size="28" text-anchor="middle" dominant-baseline="middle">${it.l}</text>` : '';
    const holes = cnc ? core.holePoints(it).map(h => `<circle cx="${h.X + tx}" cy="${h.Y + ty}" r="${Math.max(h.d / 2, 6)}" fill="var(--accent)"/>`).join('') : '';
    const on = edit && it.qi === selQi;
    return `<g ${edit ? `data-qi="${it.qi}" class="drag"` : ''}><title>№${it.p.id} ${esc(it.p.name)} — ${it.p.l}×${it.p.w}${it.rot ? ' (повёрнута)' : ''}</title><rect x="${x}" y="${y}" width="${it.l}" height="${it.w}" fill="var(--board)" stroke="${on ? 'var(--accent)' : 'var(--board-line)'}" stroke-width="${on ? 14 : 4}"/>${label}${holes}</g>`;
  }).join('');
  const offs = s.free.filter(f => Math.max(f.w, f.h) >= o.offMin1 && Math.min(f.w, f.h) >= o.offMin2).map(f =>
    `<g><title>Деловой остаток ${Math.floor(f.w)}×${Math.floor(f.h)}</title><rect x="${f.x + tx}" y="${f.y + ty}" width="${f.w}" height="${f.h}" fill="none" stroke="var(--accent)" stroke-width="5" stroke-dasharray="24 16"/></g>`).join('');
  return `<svg class="map${edit ? ' editing' : ''}" viewBox="0 0 ${L} ${W}" role="img" aria-label="Карта раскроя ${L}×${W}"><rect x="0" y="0" width="${L}" height="${W}" fill="${s.stock ? 'var(--stock)' : 'var(--waste)'}" stroke="var(--muted)" stroke-width="6"/>${rects}${offs}</svg>`;
}
/* Ручная правка карты: все действия меняют m.manual через change(), поэтому работают «Отменить/Вернуть». */
function bindEdit(op, pan, x) {
  const r = x.r, m = op.m, groups = mapsOf(x), g = groups[ui.sheet];
  const tx = x.o.trimL ?? x.o.trim ?? 0, ty = x.o.trimW ?? x.o.trim ?? 0;
  const on = (id, fn) => { const el = pan.querySelector('#' + id); if (el) el.onclick = fn; };
  const ms = () => m.manual.sheets[g.s.mi];
  const tidy = () => { m.manual.sheets = m.manual.sheets.filter(q => q.items.length || q.keep); };
  pan.querySelectorAll('#eReset').forEach(b => b.onclick = () => { ui.edit = null; change(() => { delete m.manual; }); });
  on('eStart', () => { ui.edit = op.key; ui.qi = null; ui.sheet = r.manual ? ui.sheet : 0; if (r.manual) return render(); change(() => { m.manual = core.snapshotManual(r); }); });
  on('eDone', () => { ui.qi = null; setUi({ edit: null, sheet: 0 }); });
  if (ui.edit !== op.key || !r.manual || !g) return;
  const sel = () => ms().items[ui.qi];
  on('eRot', () => {
    const q = sel(); if (!q) return;
    const s = ms(), l = q.w, w = q.l, idx = ui.qi;
    if (core.canPlace(s, q.x, q.y, l, w, r.k, idx)) return change(() => { Object.assign(q, { l, w, rot: !q.rot }); });
    const others = { ...s, items: s.items.filter((_, i) => i !== idx) }, p = core.findSpot(others, l, w, r.k);
    if (!p) return toast('Повёрнутая деталь не помещается на этой карте');
    change(() => { Object.assign(q, { x: p.x, y: p.y, l, w, rot: !q.rot }); });
  });
  on('eOff', () => { const idx = ui.qi; ui.qi = null; change(() => { ms().items.splice(idx, 1); tidy(); }); });
  on('eMove', () => {
    const to = groups[+pan.querySelector('#eTo').value], q = sel(); if (!q || !to) return;
    const t = m.manual.sheets[to.s.mi], p = core.findSpot(t, q.l, q.w, r.k);
    if (!p) return toast('На той карте нет места для этой детали');
    const idx = ui.qi; ui.qi = null;
    change(() => { ms().items.splice(idx, 1); t.items.push({ ...q, x: p.x, y: p.y }); tidy(); });
  });
  pan.querySelectorAll('[data-put]').forEach(b => b.onclick = () => {
    const u = r.unplaced[+b.dataset.put], s = ms(), p = core.findSpot(s, u.l, u.w, r.k, u.rot);
    if (!p) return toast('На этой карте нет места. Добавьте пустой лист');
    change(() => { s.items.push({ id: u.p.id, x: p.x, y: p.y, l: p.rot ? u.w : u.l, w: p.rot ? u.l : u.w, rot: p.rot }); ui.qi = s.items.length - 1; });
  });
  on('eSheet', () => change(() => { m.manual.sheets.push({ L: m.L, W: m.W, tx, ty, items: [], keep: true }); ui.sheet = r.sheets.length; ui.qi = null; }));
  on('eDelSheet', () => change(() => { m.manual.sheets.splice(g.s.mi, 1); ui.sheet = Math.max(0, ui.sheet - 1); }));
  // Перетаскивание детали по карте
  const svg = pan.querySelector('svg.map.editing'); if (!svg) return;
  let drag = null;
  const pt = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  svg.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-qi]'); if (!el) return;
    e.preventDefault(); svg.setPointerCapture(e.pointerId);
    drag = { el, qi: +el.dataset.qi, p0: pt(e), dx: 0, dy: 0 };
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return; const p = pt(e); drag.dx = p.x - drag.p0.x; drag.dy = p.y - drag.p0.y;
    drag.el.setAttribute('transform', `translate(${drag.dx} ${drag.dy})`);
  });
  const end = () => {
    if (!drag) return; const d = drag; drag = null;
    if (Math.hypot(d.dx, d.dy) < 15) { ui.qi = d.qi; return render(); }
    const s = ms(), q = s.items[d.qi], to = core.snapPos(s, d.qi, q.x + d.dx, q.y + d.dy, r.k);
    if (!core.canPlace(s, to.x, to.y, q.l, q.w, r.k, d.qi)) { toast('Здесь деталь не помещается: мешает край листа или соседняя деталь'); return render(); }
    ui.qi = d.qi; change(() => { q.x = to.x; q.y = to.y; });
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', () => { drag = null; render(); });
}
/** Кнопка склада: оприходовать остатки карты один раз; если карта изменилась — заменить прежние остатки заказа. */
function stockBtn(m, r) {
  const st = core.stockOpState(ledger, r, P.uid, m.id), d = t => new Date(t).toLocaleDateString('ru-RU');
  if (!r.offcuts.length && !r.stockUsed.length && st.state === 'none') return '';
  if (problemsOf(resOf(m)).length) return '<button class="btn sm" disabled title="Сначала исправьте ошибки раскроя">Остатки на склад</button>';
  if (st.state === 'done') return `<button class="btn sm" disabled>Остатки на складе с ${d(st.op.at)}</button>`;
  if (st.state === 'blocked') return `<button class="btn sm" disabled title="Остатки прежней карты этого заказа уже взяты в раскрой: ${esc(st.by.map(o => o.from || 'другой заказ').join(', '))}. Сначала верните их на склад в том заказе.">Склад не обновить: остатки уже взял ${esc(st.by[0].from || 'другой заказ')}</button>`;
  const what = `+${r.offcuts.length}${r.stockUsed.length ? `, списать ${r.stockUsed.length}` : ''}`;
  return st.state === 'changed'
    ? `<button class="btn sm" id="saveOff" title="Карта изменилась после ${d(st.op.at)}: прежние остатки этого заказа уберутся со склада">Обновить склад по новой карте (${what})</button>`
    : `<button class="btn sm" id="saveOff">Остатки раскроя на склад (${what})</button>`;
}
function saveOffcuts(r) {
  if (problemsOf(resOf(r.m)).length) return toast('Сначала исправьте ошибки раскроя');
  const res = core.applyStockOp(stock, ledger, r, { uid: P.uid, matId: r.m.id, from: P.name || 'заказ', newId: () => Date.now() + Math.random() });
  if (res.blocked) return toast(`Остатки прежней карты уже взял в раскрой ${res.blocked[0].from || 'другой заказ'}. Склад не изменён.`);
  if (!res.done) return toast('Остатки этой карты уже на складе');
  if (P.fresh) { delete P.fresh; saveProject(P); } // проект попадает в список, чтобы операция склада была привязана к нему
  stock = res.stock; ledger = res.ledger; store.set('stock', stock); store.set('stockops', ledger);
  toast(res.replaced ? 'Склад обновлён по новой карте' : `На склад: +${r.offcuts.length}${r.stockUsed.length ? `, списано ${r.stockUsed.length}` : ''}`);
  recalc(); render();
}
function copyText(ta) { (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => toast('Скопировано')).catch(() => { ta.focus(); ta.select(); toast('Выделено, нажмите Ctrl+C'); }); }

/* --- Другие экраны --- */
const screenHead = (title, extra = '') => `<div class="bar"><h2>${title}</h2>${extra}</div>`;
/* Все проекты: слева папки, справа статусы, поиск и список. Пустые папки хранятся в rk_folders. */
const madeFolders = () => store.get('folders', []);
const allFolders = () => core.folders(libIndex(), madeFolders());
function renderProjects(main) {
  const idx = libIndex(), f = ui.lib || {}, list = core.filterProjects(idx, f), today = new Date().toISOString().slice(0, 10);
  const when = t => new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  const inFolder = idx.filter(x => !f.folder || (f.folder === '-' ? !x.folder : x.folder === f.folder));
  const cnt = s => inFolder.filter(x => x.status === s).length, fc = core.folderCounts(idx), fl = allFolders();
  const stOpts = v => core.STATUSES.map(s => `<option ${s === v ? 'selected' : ''}>${s}</option>`).join('');
  const flOpts = v => `<option value="">без папки</option>` + fl.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const fItem = (key, name, n) => `<button class="fitem" data-folder="${esc(key)}" aria-current="${(f.folder || '') === key}"><span>${name}</span><b>${n || 0}</b></button>`;
  const curName = f.folder && f.folder !== '-' ? f.folder : '';
  main.innerHTML = `<section class="panel">${screenHead('Все проекты', `<button class="btn sm primary" id="libNew">Новый проект${curName ? ' в «' + esc(curName) + '»' : ''}</button>`)}
   <div class="libgrid"><nav class="folders" aria-label="Папки">
      ${fItem('', 'Все проекты', idx.length)}${fItem('-', 'Без папки', fc[''])}
      <div class="mh">Папки</div>
      ${fl.map(x => fItem(x, '📁 ' + esc(x), fc[x])).join('') || '<p class="note">Папок пока нет.</p>'}
      ${siteNav(f)}
      <div class="newf"><input class="inp t" id="fName" placeholder="Название папки" aria-label="Название новой папки"><button class="btn sm" id="fAdd">+ Папка</button></div>
      ${curName ? `<div class="newf"><input class="inp t" id="fRen" value="${esc(curName)}" aria-label="Переименовать папку"><button class="btn sm" id="fRenB">Переименовать</button></div>
        <button class="btn sm" id="fDel">Удалить папку</button><p class="note">Проекты из удалённой папки останутся в «Без папки».</p>` : ''}
    </nav>
    <div style="min-width:0">${(f.folder || '').startsWith('site') ? `<div class="row bar2"><input class="inp t" id="libQ" placeholder="Поиск: номер заявки, клиент, материал" value="${esc(f.q || '')}" style="flex:1;min-width:180px" aria-label="Поиск"><button class="btn sm" id="siteReload">Обновить список</button></div>${siteTable(f)}
      <p class="note">Заявки на распил с сайта. Открытая заявка сохраняется на сайт сама при каждом изменении, а в заявку записываются число листов и метраж кромки. Стадию заявки меняют операторы в сменах, как раньше.</p></div></div></section>` : `
      <div class="stabs" role="tablist"><button class="stab" data-status="" aria-selected="${!f.status}">Все <b>${inFolder.length}</b></button>${core.STATUSES.map((s, i) => `<button class="stab st${i}" data-status="${s}" aria-selected="${f.status === s}">${s} <b>${cnt(s)}</b></button>`).join('')}</div>
      <div class="row bar2"><input class="inp t" id="libQ" placeholder="Поиск: название или заказчик" value="${esc(f.q || '')}" style="flex:1;min-width:180px" aria-label="Поиск"></div>
      ${list.length ? `<div class="tbl"><table><thead><tr><th>Наименование</th><th>Заказчик</th><th>Папка</th><th>Статус</th><th>Готовность</th><th class="r">Деталей</th><th>Изменён</th><th></th></tr></thead><tbody>
      ${list.map(x => `<tr data-uid="${x.uid}" ${x.uid === P.uid ? 'aria-selected="true"' : ''}><td><a href="#" data-open>${esc(x.name)}</a>${x.uid === P.uid ? ' <span class="note">открыт</span>' : ''}</td><td>${esc(x.order)}</td>
        <td><select class="cell" data-lf="folder" aria-label="Папка">${flOpts(x.folder)}</select></td>
        <td><select class="cell st st${core.STATUSES.indexOf(x.status)}" data-lf="status" aria-label="Статус">${stOpts(x.status)}</select></td>
        <td class="${x.due && x.due < today && x.status !== 'Готов' ? 'late' : ''}">${x.due ? new Date(x.due).toLocaleDateString('ru-RU') : ''}</td><td class="n">${fmt(x.parts)}</td><td class="note">${when(x.updated)}</td>
        <td style="white-space:nowrap"><button class="btn xs" data-copy>Копия</button><button class="btn xs" data-del>Удалить</button></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">Здесь пока нет проектов.</div>'}
      <p class="note">Проекты сохраняются сами при каждом изменении. Красная дата готовности: срок прошёл, а заказ не готов.</p></div></div></section>`}`;
  main.querySelectorAll('[data-sopen]').forEach(b => b.onclick = () => { const id = b.closest('tr').dataset.sid; if (P.site?.id === id) return setUi({ screen: 'project' }); openSiteOrder(id); });
  const sr = $('#siteReload'); if (sr) sr.onclick = async () => { sr.disabled = true; siteState = await site.checkSite(); render(); toast('Список заявок обновлён'); };
  const setF = patch => setUi({ lib: { ...f, ...patch } });
  main.querySelectorAll('[data-folder]').forEach(b => b.onclick = () => setF({ folder: b.dataset.folder }));
  main.querySelectorAll('[data-status]').forEach(b => b.onclick = () => setF({ status: b.dataset.status }));
  $('#libQ').oninput = e => { clearTimeout(renderProjects.t); renderProjects.t = setTimeout(() => { setF({ q: e.target.value }); const q = $('#libQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); };
  const addF = () => { const n = $('#fName').value.trim(); if (!n) return $('#fName').focus(); if (!fl.includes(n)) store.set('folders', [...madeFolders(), n]); setF({ folder: n }); toast('Папка «' + n + '» создана'); };
  $('#fAdd').onclick = addF; $('#fName').onkeydown = e => { if (e.key === 'Enter') addF(); };
  // Переименование и удаление папки меняют папку у всех её проектов
  const moveAll = (from, to) => {
    idx.filter(x => x.folder === from).forEach(x => { const Q = x.uid === P.uid ? P : store.get('p_' + x.uid, null); if (Q) { Q.folder = to; saveProject(Q); } });
    store.set('folders', [...new Set(madeFolders().filter(x => x !== from).concat(to ? [to] : []))]);
  };
  const rb = $('#fRenB'); if (rb) rb.onclick = () => { const n = $('#fRen').value.trim(); if (!n || n === curName) return; moveAll(curName, n); renderHeader(); setF({ folder: n }); toast('Папка переименована'); };
  const db = $('#fDel'); if (db) db.onclick = () => { if (!db.dataset.sure) { db.dataset.sure = 1; db.textContent = 'Точно удалить папку?'; return; } moveAll(curName, ''); renderHeader(); setF({ folder: '' }); toast('Папка удалена, проекты перенесены в «Без папки»'); };
  $('#libNew').onclick = () => { saveProject(P); openProject({ ...core.newProject(), folder: curName, fresh: true }); };
  const body = uid => (uid === P.uid ? P : store.get('p_' + uid, null));
  main.querySelectorAll('tr[data-uid]').forEach(tr => {
    const uid = tr.dataset.uid;
    tr.querySelector('[data-open]').onclick = e => { e.preventDefault(); if (uid === P.uid) return setUi({ screen: 'project' }); const Q = body(uid); if (!Q) return toast('Проект не найден в памяти браузера'); saveProject(P); openProject(Q); };
    tr.querySelectorAll('[data-lf]').forEach(el => el.onchange = () => {
      const k = el.dataset.lf;
      if (uid === P.uid) return change(() => { P[k] = el.value.trim(); });
      const Q = body(uid); if (Q) { Q[k] = el.value.trim(); saveProject(Q); render(); }
    });
    tr.querySelector('[data-copy]').onclick = () => { const Q = body(uid); if (!Q) return; const c = { ...JSON.parse(JSON.stringify(Q)), uid: core.newUid(), name: Q.name + ' (копия)', status: core.STATUSES[0] }; delete c.fresh;
      // Копия — отдельный проект: без связи с заявкой (иначе автосохранение запишет её в оригинал), без выпуска и утверждённого КП.
      delete c.site; delete c.releases; delete c.kp; saveProject(c); render(); toast('Сделана копия'); };
    tr.querySelector('[data-del]').onclick = e => {
      const b = e.target; if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Точно удалить?'; return; }
      store.del('p_' + uid); store.set('projects', libIndex().filter(x => x.uid !== uid));
      if (uid === P.uid) { const next = libIndex()[0]; openProject((next && store.get('p_' + next.uid, null)) || { ...core.newProject(), fresh: true }); ui.screen = 'projects'; }
      render(); toast('Проект удалён');
    };
  });
}
function renderStock(main) {
  main.innerHTML = `<section class="panel">${screenHead('Склад остатков')}
   <p class="note">Деловые остатки из прошлых заказов. В операции раскроя они видны во вкладке «Листы и остатки» и заполняются раньше новых листов.</p>
   ${stock.length ? `<div class="tbl"><table><thead><tr><th>Материал</th><th class="r">Толщ.</th><th class="r">Длина</th><th class="r">Ширина</th><th class="r">Площадь, м²</th><th>Откуда</th><th></th></tr></thead><tbody>
   ${stock.map((s, i) => `<tr><td>${esc(s.name)}</td><td class="n">${s.t}</td><td class="n">${s.l}</td><td class="n">${s.w}</td><td class="n">${fmt(s.l * s.w / 1e6, 2)}</td><td>${esc(s.from)}</td><td><button class="btn xs" data-rm="${i}" aria-label="Убрать остаток">✕</button></td></tr>`).join('')}
   </tbody></table></div><button class="btn sm" id="clearStock" style="margin-top:8px">Очистить склад</button>` : '<div class="empty">Склад пуст. На вкладке «Раскрой» нажмите «Остатки раскроя на склад».</div>'}
   <p class="note">Сейчас склад хранится в этом браузере. Дальше он будет общим для всех компьютеров и сайта.</p></section>`;
  main.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { stock.splice(+b.dataset.rm, 1); store.set('stock', stock); recalc(); render(); });
  const c = $('#clearStock'); if (c) c.onclick = () => { if (c.dataset.sure) { stock = []; store.set('stock', stock); recalc(); render(); } else { c.dataset.sure = 1; c.textContent = 'Точно очистить?'; } };
}
function renderCatalog(main) {
  const cols = { materials: [['name', 'Наименование', 't'], ['code', 'Код', 't'], ['t', 'Толщ.'], ['L', 'Длина'], ['W', 'Ширина'], ['price', 'Цена листа'], ['priceM2', 'Цена м²']],
    bands: [['name', 'Наименование', 't'], ['code', 'Код', 't'], ['t', 'Толщ.'], ['w', 'Ширина'], ['matPrice', 'Материал за м'], ['price', 'Кромкование за м']] };
  const table = kind => `<div class="tbl"><table data-cat="${kind}"><thead><tr>${cols[kind].map(c => `<th${c[2] ? '' : ' class="r"'}>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>
    ${catalog[kind].map((c, i) => `<tr data-i="${i}">${cols[kind].map(([k, , t]) => `<td><input class="cell ${t ? 'name' : ''}" data-ck="${k}" ${t ? '' : 'type="number" step="any"'} value="${esc(c[k] ?? '')}" aria-label="${k}"></td>`).join('')}<td><button class="btn xs" data-cdel aria-label="Удалить">✕</button></td></tr>`).join('') || `<tr><td colspan="9" class="empty">Пусто. Добавьте строку или сохраните материал из операции кнопкой «Сохранить в каталог».</td></tr>`}
    </tbody></table></div><button class="btn sm" data-cadd="${kind}" style="margin-top:6px">Добавить</button>`;
  main.innerHTML = `<section class="panel">${screenHead('Каталог материалов')}<p class="note">Свои материалы и кромки с ценами. В операции во вкладке «Параметры» выберите из каталога, и цены с размерами подставятся сами.</p>
    <h3>Листовые материалы</h3>${table('materials')}<h3 style="margin-top:16px">Кромка</h3>${table('bands')}</section>`;
  main.querySelectorAll('[data-cat]').forEach(t => t.addEventListener('change', e => { const el = e.target, kind = t.dataset.cat, c = catalog[kind][+el.closest('tr').dataset.i];
    c[el.dataset.ck] = el.type === 'number' ? (el.value === '' ? undefined : +el.value) : el.value; store.set('catalog', catalog); }));
  main.querySelectorAll('[data-cdel]').forEach(b => b.onclick = () => { const kind = b.closest('[data-cat]').dataset.cat; catalog[kind].splice(+b.closest('tr').dataset.i, 1); store.set('catalog', catalog); render(); });
  main.querySelectorAll('[data-cadd]').forEach(b => b.onclick = () => { const k = b.dataset.cadd; catalog[k].push(k === 'materials' ? { name: 'ЛДСП', t: 16, L: 2750, W: 1830 } : { name: 'ПВХ 0,4', t: 0.4, w: 19 }); store.set('catalog', catalog); render(); });
}
function renderLabels(main) {
  const tpl = ui.lblTpl || 'NESTING', what = ui.lblWhat || 'all', layout = ui.lblLayout || 'sheet';
  const list = [];
  R.mats.forEach(x => {
    if (what !== 'all' && what !== 'off' && what !== 'm:' + x.m.id) return;
    if (what !== 'off') x.r.sheets.forEach((s, si) => s.items.forEach(it => list.push(partLabelData(P, it, x.m, { sheet: si + 1 }))));
    if (ui.lblOff || what === 'off') x.r.offcuts.forEach(o => list.push(offcutLabelData(P, o, x.m)));
  });
  const show = list.slice(0, 200), now = new Date();
  main.innerHTML = `${releaseBanner()}<section class="panel">${screenHead('Этикетки', '<div class="row"><button class="btn sm primary" id="pdfL">Скачать PDF</button><button class="btn sm" id="printL">Печать</button></div>')}
    <div class="row bar2"><label class="note">Шаблон <select class="inp" id="lblTpl">${Object.entries(TEMPLATES).map(([k, t]) => `<option value="${k}" ${k === tpl ? 'selected' : ''}>${t.title} ${t.w}×${t.h}</option>`).join('')}</select></label>
      <label class="note">Что печатать <select class="inp" id="lblWhat"><option value="all">все детали</option>${R.mats.filter(x => x.r.sheets.length).map(x => `<option value="m:${x.m.id}" ${what === 'm:' + x.m.id ? 'selected' : ''}>${esc(x.m.name)} ${x.m.t}</option>`).join('')}<option value="off" ${what === 'off' ? 'selected' : ''}>только остатки</option></select></label>
      <label class="note"><input type="checkbox" id="lblOff" ${ui.lblOff ? 'checked' : ''}> и деловые остатки</label>
      <label class="note">Печать <select class="inp" id="lblLayout"><option value="sheet" ${layout === 'sheet' ? 'selected' : ''}>листом 2×4 (A4)</option><option value="roll" ${layout === 'roll' ? 'selected' : ''}>по одной (принтер этикеток)</option></select></label></div>
    <p class="note">Наклеек: ${list.length}${list.length > show.length ? `, показаны первые ${show.length}` : ''}. QR «СБОРКА» ведёт на artisan.shop.kg/dg с проектом и позицией детали, второй QR — код программы ЧПУ, если он есть в проекте.</p>
    <div class="lblgrid ${layout}">${show.map(d => labelSvg(d, tpl, { now })).join('')}</div></section>`;
  const set = (k, v) => setUi({ [k]: v });
  $('#lblTpl').onchange = e => set('lblTpl', e.target.value); $('#lblWhat').onchange = e => set('lblWhat', e.target.value);
  $('#lblLayout').onchange = e => set('lblLayout', e.target.value); $('#lblOff').onchange = e => set('lblOff', e.target.checked);
  $('#printL').onclick = () => doPrint('labels', 'Этикетки');
  $('#pdfL').onclick = () => makePdf($('#pdfL'), async () => {
    const t = TEMPLATES[tpl], logo = await logoData();
    return [await labelsPdf(list.map(d => labelSvg(d, tpl, { now, logo })), { w: t.w, h: t.h, layout, onProgress: n => toast(`Наклейки: ${n} из ${list.length}`) }), `Наклейки ${P.name || ''}.pdf`];
  });
}
function renderReport(main) {
  const d = v => v ? new Date(v).toLocaleDateString('ru-RU') : '—';
  const RO = { need: 'Требование на склад', cost: 'Стоимость', parts: 'Детали', maps: 'Карты раскроя', cuts: 'Таблицы резов' };
  const ro = { need: true, cost: true, parts: true, maps: true, cuts: false, ...(ui.rep || {}) };
  main.innerHTML = `${releaseBanner()}<section class="panel report">${screenHead('Отчёт по заказу', '<div class="row"><button class="btn sm primary" id="pdfR">Скачать PDF</button><button class="btn sm" id="printR">Печать</button></div>')}
    <div class="row bar2 noprint">${Object.entries(RO).map(([k, n]) => `<label class="note"><input type="checkbox" data-ro="${k}" ${ro[k] ? 'checked' : ''}> ${n}</label>`).join('')}</div>
    <div class="rep-head"><div><b>${esc(P.name)}</b> · ${esc(relLabel())}</div><div>Заказчик: ${esc(P.order || '—')}</div><div>Дата заказа: ${d(P.date)} · готовность: ${d(P.due)}</div>${P.note ? `<div>${esc(P.note)}</div>` : ''}</div>
    ${ro.need ? `<h3>Требование на склад</h3><div class="tbl"><table><thead><tr><th>Материал</th><th>Код</th><th class="r">Кол-во</th><th class="r">Площадь, м²</th></tr></thead><tbody>
      ${R.mats.filter(x => x.r.fullCount).map(x => `<tr><td>${esc(x.m.name)} ${x.m.t} мм</td><td>${esc(x.m.code)}</td><td class="n">${x.r.fullCount} лист.</td><td class="n">${fmt(x.r.fullCount * x.m.L * x.m.W / 1e6, 2)}</td></tr>`).join('')}
      ${R.edges.map(e => `<tr><td>${esc(e.name)}</td><td>${esc(e.code)}</td><td class="n">${fmt(e.mat, 1)} м</td><td></td></tr>`).join('')}
      ${R.lin.filter(x => x.r.bars.length).map(x => `<tr><td>${esc(x.l.name)}</td><td>${esc(x.l.code)}</td><td class="n">${x.r.bars.length} шт × ${x.l.len}</td><td></td></tr>`).join('')}
      ${(P.extras || []).filter(e => e.kind !== 'work').map(e => `<tr><td>${esc(e.name)}</td><td></td><td class="n">${e.qty} ${esc(e.unit || 'шт')}</td><td></td></tr>`).join('')}</tbody></table></div>` : ''}
    ${ro.cost ? `<h3>Стоимость</h3><div class="tbl"><table><thead><tr><th>Операция</th><th class="r">Кол-во</th><th class="r">Материал</th><th class="r">Работа</th><th class="r">Итого, сом</th></tr></thead><tbody>
      ${C.ops.map(r => `<tr><td>${r.type} · ${esc(r.name)}</td><td class="n">${fmt(r.qty, r.unit === 'м' ? 1 : 0)} ${r.unit}</td><td class="n">${fmt(r.mat)}</td><td class="n">${fmt(r.work)}</td><td class="n">${fmt(r.total)}</td></tr>`).join('')}
      <tr><td><b>Итого</b></td><td></td><td class="n">${fmt(C.mat)}</td><td class="n">${fmt(C.work)}</td><td class="n"><b>${fmt(C.total)}</b></td></tr></tbody></table></div>` : ''}
    ${R.mats.filter(x => x.r.sheets.length).map(x => `<h3>${x.mode === 'cnc' ? 'CN' : 'CS'} · ${esc(x.m.name)} ${x.m.t} мм</h3>
      ${ro.parts ? `<div class="tbl"><table><thead><tr><th>№</th><th>Деталь</th><th class="r">Длина</th><th class="r">Ширина</th><th class="r">Кол</th><th>Кромка В Н Л П</th></tr></thead><tbody>
      ${core.partsOf(P, x.m).map(p => `<tr><td class="n">${p.id}</td><td>${esc(p.name)}</td><td class="n">${p.l}</td><td class="n">${p.w}</td><td class="n">${p.count}</td><td>${['t', 'b', 'l', 'r'].map(s => esc(bandName(p.edges[s])) || '—').join(' / ')}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${ro.maps || ro.cuts ? `<div class="rep-maps">${sameMaps(x.r.sheets, x.o.stack).map((g, i) => `<figure>${ro.maps ? sheetSvg(g.s, x.o, false, true) : ''}<figcaption>Карта ${i + 1} · ${g.s.L}×${g.s.W} · ${g.n} шт · ${g.s.items.length} дет.</figcaption>
        ${ro.cuts && x.mode !== 'cnc' ? `<ol class="cutlist">${g.s.cuts.map(c => `<li>${c.d === 'T' ? 'Торцовка ' + c.len + ' ×2' : (c.d === 'H' ? 'Продольный Y ' + fmt(c.y + g.s.ty, 1) : 'Поперечный X ' + fmt(c.x + g.s.tx, 1)) + ', ' + fmt(c.len, 1)}</li>`).join('')}</ol>` : ''}</figure>`).join('')}</div>` : ''}`).join('')}
  </section>`;
  main.querySelectorAll('[data-ro]').forEach(c => c.onchange = () => setUi({ rep: { ...ro, [c.dataset.ro]: c.checked } }));
  $('#printR').onclick = () => doPrint('report', 'Отчёт');
  $('#pdfR').onclick = () => makePdf($('#pdfR'), async () => [await reportPdf(reportModel(ro)), `Отчёт ${P.name || ''}.pdf`]);
}
/** Содержимое отчёта для PDF — те же разделы, что на экране. */
function reportModel(ro) {
  const d = v => v ? new Date(v).toLocaleDateString('ru-RU') : '—', blocks = [];
  if (ro.need) blocks.push({ h: 'Требование на склад' }, { table: { cols: [{ t: 'Материал', w: 90 }, { t: 'Код', w: 30 }, { t: 'Кол-во', w: 35, r: 1 }, { t: 'Площадь, м²', w: 25, r: 1 }],
    rows: [...R.mats.filter(x => x.r.fullCount).map(x => [`${x.m.name} ${x.m.t} мм`, x.m.code || '', `${x.r.fullCount} лист.`, fmt(x.r.fullCount * x.m.L * x.m.W / 1e6, 2)]),
      ...R.edges.map(e => [e.name, e.code || '', fmt(e.mat, 1) + ' м', '']), ...R.lin.filter(x => x.r.bars.length).map(x => [x.l.name, x.l.code || '', `${x.r.bars.length} шт × ${x.l.len}`, '']),
      ...(P.extras || []).filter(e => e.kind !== 'work').map(e => [e.name, '', `${e.qty} ${e.unit || 'шт'}`, ''])] } });
  if (ro.cost) blocks.push({ h: 'Стоимость, сом' }, { table: { cols: [{ t: 'Операция', w: 80 }, { t: 'Кол-во', w: 28, r: 1 }, { t: 'Материал', w: 24, r: 1 }, { t: 'Работа', w: 24, r: 1 }, { t: 'Итого', w: 24, r: 1 }],
    rows: C.ops.map(r => [`${r.type} · ${r.name}`, `${fmt(r.qty, r.unit === 'м' ? 1 : 0)} ${r.unit}`, fmt(r.mat), fmt(r.work), fmt(r.total)]), total: ['Итого', '', fmt(C.mat), fmt(C.work), fmt(C.total)] } });
  R.mats.filter(x => x.r.sheets.length).forEach(x => {
    blocks.push({ h: `${x.mode === 'cnc' ? 'CN' : 'CS'} · ${x.m.name} ${x.m.t} мм · ${x.r.fullCount} лист. ${x.m.L}×${x.m.W}` });
    if (ro.parts) blocks.push({ table: { cols: [{ t: '№', w: 10, r: 1 }, { t: 'Деталь', w: 50 }, { t: 'Длина', w: 18, r: 1 }, { t: 'Ширина', w: 18, r: 1 }, { t: 'Кол', w: 12, r: 1 }, { t: 'Кромка: верх / низ / лево / право', w: 72 }],
      rows: core.partsOf(P, x.m).map(p => [p.id, p.name, p.l, p.w, p.count, ['t', 'b', 'l', 'r'].map(s => bandName(p.edges[s]) || '—').join(' / ')]) } });
    if (ro.maps || ro.cuts) blocks.push({ maps: sameMaps(x.r.sheets, x.o.stack).map((g, i) => ({ s: g.s, offMin1: x.o.offMin1, offMin2: x.o.offMin2,
      caption: `Карта ${i + 1} · ${g.s.L}×${g.s.W} · ${g.n} шт · деталей ${g.s.items.length}`,
      cuts: ro.cuts && x.mode !== 'cnc' ? g.s.cuts.map(c => c.d === 'T' ? `Торцовка ${c.len} ×2` : (c.d === 'H' ? 'Продольный Y ' + fmt(c.y + g.s.ty, 1) : 'Поперечный X ' + fmt(c.x + g.s.tx, 1)) + ', ' + fmt(c.len, 1)) : null })) });
  });
  return { title: `Отчёт: ${P.name || 'проект'} · ${relLabel()}`, head: [`Заказчик: ${P.order || '—'}`, `Дата заказа: ${d(P.date)} · готовность: ${d(P.due)}`, ...(P.note ? [P.note] : [])], blocks };
}
let logoCache = null;
async function logoData() {
  if (logoCache) return logoCache;
  try { const b = await (await fetch('icons/artisan-logo.png')).blob(); logoCache = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); }); } catch (e) { logoCache = ''; }
  return logoCache;
}
async function makePdf(btn, build) {
  const text = btn.textContent; btn.disabled = true; btn.textContent = 'Готовлю PDF…';
  try {
    const [blob, name] = await build();
    const how = await saveFile(blob, name.replace(/[\\/:*?"<>|]+/g, ' ').trim());
    toast(how === 'saved' ? 'PDF сохранён' : 'PDF скачан');
  } catch (e) { toast(e?.code === 'declined' ? 'Сохранение отменено' : 'Не удалось сделать PDF: ' + (e?.message || e)); }
  finally { btn.disabled = false; btn.textContent = text; }
}
/* Печать. Внутри окна предпросмотра (claude.ai) браузер запрещает окно печати, поэтому, если оно не открылось,
   предлагаем открыть страницу для печати отдельно или скачать её файлом. На своём сайте печать идёт сразу. */
function doPrint(kind, title) {
  document.body.dataset.print = kind;
  const t0 = Date.now();
  try { window.print(); } catch (e) {}
  const blocked = Date.now() - t0 < 250;
  setTimeout(() => delete document.body.dataset.print, 500);
  if (blocked) printFallback(kind, title);
}
function printFallback(kind, title) {
  const sec = $('#main section'); if (!sec || $('#printBox')) return;
  const box = document.createElement('div'); box.id = 'printBox'; box.className = 'printbox noprint';
  box.innerHTML = `<b>Окно печати здесь не открывается.</b> В окне предпросмотра браузер запрещает печать. Нажмите «Скачать PDF», откройте файл и распечатайте его. На вашем сайте кнопка «Печать» будет работать сразу.`;
  sec.querySelector('.bar').after(box);
}
/* --- Смета и КП клиенту --- */
/* --- Выпуск в работу: проверка и фиксация версии, по которой готовятся карты, этикетки и файлы --- */
const machineLimits = () => ({ sawL: +base.sawMaxL || 0, sawW: +base.sawMaxW || 0, cncL: +base.cncMaxL || 0, cncW: +base.cncMaxW || 0 });
function releaseBanner() {
  const st = core.releaseState(P, R); if (!st.last) return '';
  const d = new Date(st.last.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return st.changed
    ? `<div class="printbox bad relbar">${st.why === 'maps' ? 'Карты раскроя пересчитались после выпуска' : 'Заказ изменён после выпуска'} версии ${st.last.n} (${d})${st.why === 'maps' ? ': изменились настройки раскроя или склад остатков' : ''}. В цехе карты и этикетки версии ${st.last.n}. Выпустите заново, чтобы цех работал по новой версии. <button class="btn xs" data-relopen>Выпустить заново</button></div>`
    : `<div class="printbox good relbar">В работе версия ${st.last.n} от ${d}${st.last.by ? ', выпустил ' + esc(st.last.by) : ''}: ${st.last.sheets} лист., ${st.last.parts} дет.</div>`;
}
function releasePanel() {
  const chk = core.releaseCheck(P, R, C, E, machineLimits()), n = (P.releases || []).reduce((a, x) => Math.max(a, x.n), 0) + 1;
  return `<section class="panel" id="relPanel"><div class="bar"><h2>Выпуск в работу: версия ${n}</h2><button class="btn sm" id="relClose">Закрыть</button></div>
    ${chk.errors.length ? `<div class="printbox bad"><b>Выпустить нельзя, сначала исправьте (${chk.errors.length}):</b><ul>${chk.errors.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`
      : '<p class="note">Комплектность, геометрия карт и ограничения станков в порядке.</p>'}
    ${chk.warnings.length ? `<div class="printbox"><b>Обратите внимание:</b><ul>${chk.warnings.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    <p class="note">После выпуска версия фиксируется: в отчёте будет её номер, а если заказ изменят, программа покажет, что в цехе другая версия.</p>
    <div class="row"><button class="btn sm primary" id="relDo" ${chk.errors.length ? 'disabled' : ''}>Выпустить версию ${n}</button></div></section>`;
}
function bindRelease(main) {
  main.querySelectorAll('#relOpen,[data-relopen]').forEach(b => b.onclick = () => setUi({ rel: true, screen: 'project' }));
  const c = main.querySelector('#relClose'); if (c) c.onclick = () => setUi({ rel: false });
  const d = main.querySelector('#relDo'); if (d) d.onclick = () => {
    if (core.releaseCheck(P, R, C, E, machineLimits()).errors.length) return render();
    const rel = core.makeRelease(P, R, C, { by: siteState?.user || '' });
    ui.rel = false;
    change(() => { P.releases = [...(P.releases || []), rel]; if (core.STATUSES.indexOf(P.status) < core.STATUSES.indexOf('В работе')) P.status = 'В работе'; });
    toast(`Версия ${rel.n} выпущена в работу`);
  };
}
const relLabel = () => { const st = core.releaseState(P, R); return st.last ? `версия ${st.last.n}${st.changed ? (st.why === 'maps' ? ' (карты пересчитаны после выпуска)' : ' (изменён после выпуска)') : ''}` : 'не выпущен в работу'; };

function renderEstimate(main) {
  const e = E.e, G = core.GROUP_NAME;
  const num = (k, label, suf = '%') => `<label class="note">${label} <input class="inp n" style="width:64px" type="number" min="0" data-est="${k}" value="${e[k] || 0}"> ${suf}</label>`;
  const chk = (k, label) => `<label class="note"><input type="checkbox" data-est="${k}" ${e[k] ? 'checked' : ''}> ${label}</label>`;
  const line = l => `<tr><td>${esc(l.name)}${l.missing ? ' <span class="chip bad">нет цены</span>' : ''}</td><td class="n">${fmt(l.qty, l.unit === 'м' ? 1 : 0)} ${esc(l.unit)}</td><td class="n">${fmt(l.price, l.price % 1 ? 2 : 0)}</td><td class="n">${fmt(l.sum)}</td></tr>`;
  const sec = g => E.groups[g].length ? `<tr class="grp"><th colspan="4">${G[g]}</th></tr>${E.groups[g].map(line).join('')}<tr class="sub"><td colspan="3">Итого ${G[g].toLowerCase()}</td><td class="n"><b>${fmt(E.totals[g])}</b></td></tr>` : '';
  const items = siteCat?.items || [];
  const empty = !E.groups.mat.length && !E.groups.work.length && !E.groups.kit.length;
  const kp = P.kp, kd = core.kpDiff(kp, E), dd = t => new Date(t).toLocaleDateString('ru-RU');
  const btns = !kp ? `<button class="btn sm" id="pdfDraft">Черновик КП (PDF)</button><button class="btn sm primary" id="kpOk" ${E.missing.length || empty ? 'disabled title="Сначала заполните цены"' : ''}>Утвердить КП</button>`
    : `<button class="btn sm primary" id="pdfK">КП №${kp.n} (PDF)</button>${kd.changed ? '<button class="btn sm" id="pdfDraft">Черновик по текущей смете</button><button class="btn sm" id="kpOk">Утвердить заново</button>' : ''}`;
  const kpBar = !kp ? (E.missing.length ? '<p class="note warn">Клиентское КП можно утвердить, когда у всех позиций есть цена. Черновик можно скачать уже сейчас.</p>' : '')
    : kd.changed ? `<div class="printbox bad">КП №${kp.n} утверждено ${dd(kp.at)} на ${fmt(kp.total)} сом. Смета с тех пор изменилась: сейчас ${fmt(E.total)} сом (${kd.diff > 0 ? '+' : ''}${fmt(kd.diff)}). Клиенту действует утверждённая сумма, пока вы не утвердите КП заново.</div>`
    : `<div class="printbox good">КП №${kp.n} утверждено ${dd(kp.at)}: ${fmt(kp.total)} сом. Обновление прайса эту сумму не меняет.</div>`;
  main.innerHTML = `<section class="panel">${screenHead('Смета и КП', `<div class="row">${btns}</div>`)}${kpBar}
    <div class="row bar2">${chk('ownSheets', 'Плита заказчика')}${chk('ownBands', 'Кромка заказчика')}${num('markupMat', 'Наценка на материалы')}${num('markupWork', 'Наценка на работы')}${num('discount', 'Скидка')}${num('validDays', 'КП действует', 'дн.')}</div>
    <p class="note">${siteCat ? `Цены материалов и работ берутся из прайса сайта (плит ${fmt(siteCat.sheets?.length)}, кромок ${fmt(siteCat.bands?.length)}, товаров ${fmt(items.length)}). Цена, указанная в операции, важнее прайса.`
      : 'Цены работ берутся из «Настроек», цены материалов указываются в операции или в «Каталоге материалов». Когда программа открыта на сайте, цены подтягиваются из прайса сайта.'}</p>
    ${E.missing.length ? `<div class="printbox"><b>Нет цены у ${E.missing.length} поз.:</b> ${E.missing.map(l => esc(l.name)).join(', ')}. Укажите цену в операции (вкладка «Параметры»), выберите материал из каталога или отметьте «Плита заказчика» / «Кромка заказчика».</div>` : ''}
    <div class="tbl"><table class="est"><thead><tr><th>Позиция</th><th class="r">Кол-во</th><th class="r">Цена, сом</th><th class="r">Сумма, сом</th></tr></thead><tbody>
      ${empty ? '<tr><td colspan="4" class="empty">В проекте пока нечего считать. Добавьте детали или откройте заявку.</td></tr>' : sec('mat') + sec('work') + sec('kit')}</tbody></table></div>
    <div class="esttot">
      <div><span>По прайсу</span><b>${fmt(E.byPrice)}</b></div>
      ${E.markup ? `<div><span>Наценка</span><b>+${fmt(E.markup)}</b></div>` : ''}
      ${E.discount ? `<div><span>Скидка ${e.discount}%</span><b>−${fmt(E.discount)}</b></div>` : ''}
      <div class="total"><span>К оплате</span><b>${fmt(E.total)} сом</b></div></div>
    <h3>Добавить фурнитуру или услугу</h3>
    <div class="row"><input class="inp t" id="kitQ" list="kitList" placeholder="${items.length ? 'Начните вводить название из прайса сайта или своё' : 'Название, например «Петля с доводчиком»'}" style="flex:1;min-width:200px">
      <select class="inp" id="kitK" aria-label="Вид"><option value="mat">товар</option><option value="work">работа</option></select>
      <input class="inp n" id="kitN" type="number" min="0" value="1" style="width:70px" aria-label="Количество"><input class="inp n" id="kitP" type="number" min="0" placeholder="цена" style="width:90px" aria-label="Цена">
      <button class="btn sm" id="kitAdd">Добавить</button></div>
    <datalist id="kitList">${items.map(x => `<option value="${esc(x.name)}">${fmt(x.price)} сом · ${esc(x.group)}</option>`).join('')}</datalist>
    <p class="note">Добавленные позиции можно изменить или удалить в операции «Комплектация» на экране «Операции проекта».</p></section>`;
  main.querySelectorAll('[data-est]').forEach(el => el.onchange = () => change(() => {
    P.est = { ...(P.est || {}), [el.dataset.est]: el.type === 'checkbox' ? el.checked : Math.max(0, +el.value || 0) };
  }));
  const q = $('#kitQ'), byName = new Map(items.map(x => [x.name, x]));
  q.oninput = () => { const x = byName.get(q.value); if (x) $('#kitP').value = x.price; };
  $('#kitAdd').onclick = () => {
    const name = q.value.trim(); if (!name) { q.focus(); return; }
    const x = byName.get(name);
    change(() => { P.extras = P.extras || []; P.extras.push({ name, code: x?.code || '', kind: $('#kitK').value, qty: +$('#kitN').value || 1, unit: 'шт', price: +$('#kitP').value || 0 }); });
    toast('Добавлено: ' + name);
  };
  const pk = $('#pdfK'); if (pk) pk.onclick = () => makePdf(pk, async () => [await reportPdf(kpModel(P.kp, false)), `КП ${P.kp.n} ${P.order || P.name || ''}.pdf`]);
  const pd = $('#pdfDraft'); if (pd) pd.onclick = () => makePdf(pd, async () => [await reportPdf(kpModel(E, true)), `Черновик КП ${P.order || P.name || ''}.pdf`]);
  const ok = $('#kpOk'); if (ok) ok.onclick = () => {
    if (E.missing.length) return toast('Сначала заполните цены у всех позиций');
    const n = (P.kp?.n || 0) + 1;
    change(() => { P.kp = core.freezeKp(E, { n }); });
    toast(`КП №${n} утверждено: ${fmt(E.total)} сом`);
  };
}
/** КП клиенту: позиции с ценами (уже с наценкой), без себестоимости и карт раскроя. */
function kpModel(E, draft) {
  const d = v => v ? new Date(v).toLocaleDateString('ru-RU') : '—', G = core.GROUP_NAME, today = draft ? new Date() : new Date(E.at);
  const until = new Date(today.getTime() + (+E.e.validDays || 7) * 864e5);
  const cols = [{ t: '№', w: 9, r: 1 }, { t: 'Наименование', w: 101 }, { t: 'Кол-во', w: 24, r: 1 }, { t: 'Цена, сом', w: 24, r: 1 }, { t: 'Сумма, сом', w: 26, r: 1 }];
  const blocks = []; let n = 0;
  for (const g of ['mat', 'work', 'kit']) if (E.groups[g].length) blocks.push({ h: G[g] }, { table: { cols,
    rows: E.groups[g].map(l => [++n, l.name, `${fmt(l.qty, l.unit === 'м' ? 1 : 0)} ${l.unit}`, fmt(l.price, l.price % 1 ? 2 : 0), fmt(l.sum)]), total: ['', 'Итого ' + G[g].toLowerCase(), '', '', fmt(E.totals[g])] } });
  const tot = [['По прайсу', fmt(E.byPrice)]];
  if (E.markup) tot.push(['Наценка', '+' + fmt(E.markup)]);
  if (E.discount) tot.push([`Скидка ${E.e.discount}%`, '−' + fmt(E.discount)]);
  blocks.push({ h: 'Итого' }, { table: { cols: [{ t: '', w: 150 }, { t: 'сом', w: 34, r: 1 }], rows: tot, total: ['К оплате', fmt(E.total)] } });
  const own = [E.e.ownSheets && 'плита', E.e.ownBands && 'кромка'].filter(Boolean);
  return { title: draft ? 'Черновик коммерческого предложения' : `Коммерческое предложение №${E.n}`, head: [
    'Artisan, мебельный цех · artisan.shop.kg',
    `Заказчик: ${P.order || '—'}${P.name ? ' · ' + P.name : ''}`,
    `Дата: ${today.toLocaleDateString('ru-RU')} · действует до ${until.toLocaleDateString('ru-RU')}${P.due ? ' · готовность: ' + d(P.due) : ''}`,
    ...(own.length ? [`Материал заказчика: ${own.join(' и ')} (в стоимость не входит)`] : []),
    ...(draft ? ['ЧЕРНОВИК: цены не утверждены и могут измениться'] : [])], blocks };
}
function renderSettings(main) {
  main.innerHTML = `<section class="panel">${screenHead('Настройки')}
    <p class="note">Значения по умолчанию для всех операций. У каждой операции во вкладке «Параметры» можно задать своё.</p>
    ${siteCat ? `<p class="printbox">Распил, кромкование, присадка, фрезеровка и пазы считаются по прайсу сайта (страница «Прайс работ» в админке). Изменить их можно там, здесь значения ниже не действуют.</p>` : ''}
    <div class="params">${propsTable(F_BASE, f => base[f[0]], 'base:')}
    <h3>Присадка по диаметрам, сом за отверстие</h3><div class="row holes">${Object.entries(base.holePrices || {}).map(([d, v]) => `<label class="note">Ø${d} <input class="inp n" type="number" step="0.5" style="width:64px" data-hp="${d}" value="${v}"></label>`).join('')}</div>
    <div class="note"><button class="btn sm" id="resetBase">Вернуть заводские</button></div></div></section>`;
  main.querySelectorAll('[data-hp]').forEach(el => el.onchange = () => { base.holePrices = { ...base.holePrices, [el.dataset.hp]: +el.value || 0 }; store.set('base', base); recalc(); renderSoon(); });
  main.querySelector('.props').addEventListener('change', e => { const el = e.target, k = el.dataset.k; if (!k) return;
    base[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value; store.set('base', base); recalc(); renderSoon(); });
  $('#resetBase').onclick = () => { base = { ...core.DEFAULTS }; store.set('base', base); recalc(); render(); };
}
function renderExport(main) {
  const xml = core.toProjectXml(P, eff(), m => core.matOpts(m, eff())), csv = core.toCsv(P, eff());
  main.innerHTML = `<section class="panel">${screenHead('Экспорт')}<div class="split">
    <div><div class="row" style="justify-content:space-between;margin-bottom:6px"><h3>Проект для GibLab (.project)</h3><div class="row"><button class="btn sm" id="dlX">Скачать</button><button class="btn sm" id="cpX">Скопировать</button></div></div>
      <textarea class="code" id="xmlOut" readonly aria-label="XML проекта">${esc(xml)}</textarea><p class="note">Детали, материалы и кромка переносятся.</p></div>
    <div><div class="row" style="justify-content:space-between;margin-bottom:6px"><h3>Список деталей для Excel (CSV)</h3><button class="btn sm" id="cpC">Скопировать</button></div>
      <textarea class="code" id="csvOut" readonly aria-label="CSV">${esc(csv)}</textarea><p class="note">Разделитель — точка с запятой.</p></div></div>
    <p class="note">Выгрузка на пилу Homag (CadMatic) появится, когда пришлёте образец файла с пилы.</p></section>`;
  $('#cpX').onclick = () => copyText($('#xmlOut')); $('#cpC').onclick = () => copyText($('#csvOut'));
  $('#dlX').onclick = () => { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml' })); a.download = (P.name || 'проект') + '.project'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); } catch (e) { copyText($('#xmlOut')); } };
}

/* ===== События ===== */
function load(buf, name) {
  if (/\.(xlsx|csv|txt)$/i.test(name)) return importTable(buf, name);
  try { const np = core.parseProject(core.decode(buf), name); saveProject(P); openProject(np); toast('Открыт проект «' + P.name + '»'); }
  catch (e) { toast(e.message); }
}
/** Таблица деталей из Excel: колонки узнаём по заголовкам, детали идут в выбранный листовой материал. */
async function importTable(buf, name, matId) {
  try {
    const rows = /\.xlsx$/i.test(name) ? await core.readXlsx(buf) : core.readCsv(core.decodeText(buf));
    let m = P.materials.find(x => x.id === matId) || curOp()?.m || P.materials[0];
    let n = 0; change(() => {
      if (!m) { m = { id: 'm' + Date.now(), name: 'Материал из Excel', code: '', t: 16, L: 2750, W: 1830, op: 'CS', params: {} }; P.materials.push(m); }
      n = core.pasteRows(P, core.rowsToPaste(rows), m.id); ui.screen = 'project'; ui.op = 'm:' + m.id; ui.sub = 'parts'; ui.paste = false; });
    toast(n ? `Из «${name}» добавлено строк: ${n} в «${m.name}»` : 'В таблице не нашлось строк с длиной и шириной');
  } catch (e) { toast('Не удалось прочитать таблицу: ' + e.message); }
}
$('#file').addEventListener('change', e => { const f = e.target.files[0]; if (f) f.arrayBuffer().then(b => load(b, f.name)); e.target.value = ''; });
const drop = $('#drop');
['dragover', 'dragenter'].forEach(t => document.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => document.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
document.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) f.arrayBuffer().then(b => load(b, f.name)); });
document.querySelectorAll('[data-screen]').forEach(b => b.onclick = () => setUi({ screen: b.dataset.screen }));
document.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
  const a = b.dataset.act;
  if (a === 'new') { saveProject(P); openProject({ ...core.newProject(), fresh: true }); toast('Новый проект. Прежний сохранён во «Всех проектах»'); }
  if (a === 'undo') stepHistory(undo, redo);
  if (a === 'redo') stepHistory(redo, undo);
  if (a === 'paste') { let m = curOp()?.m || P.materials[0];
    if (!m) { m = { id: 'm' + Date.now(), name: 'Новый материал', code: '', t: 16, L: 2750, W: 1830, op: 'CS', params: {} }; change(() => { P.materials.push(m); }); }
    setUi({ screen: 'project', top: 'ops', op: 'm:' + m.id, sub: 'parts', paste: true }); setTimeout(() => $('#pasteText')?.focus(), 30); }
});
document.querySelectorAll('[data-h]').forEach(el => el.addEventListener('change', () => change(() => { P[el.dataset.h] = el.value; })));
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); stepHistory(undo, redo); }
  else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); stepHistory(redo, undo); }
});

const saved = store.get('project', null);
P = saved && saved.parts ? { date: '', due: '', note: '', ...saved } : { ...core.newProject(), fresh: true };
recalc(); render();
site.checkSite().then(async st => {
  siteState = st; if (!st) return;
  if (P.site) siteStatus('Заявка с сайта');
  try { const cat = await site.loadCatalog(); if (cat) { siteCat = cat; store.set('sitecat', cat); recalc(); } } catch (e) { /* остаётся прежний прайс */ }
  render();
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
