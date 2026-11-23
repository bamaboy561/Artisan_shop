/* Папки станков на этом компьютере: программа сама кладёт файлы в сетевые папки станков, как это делал GibLab.
   Работает в Chrome и Edge на компьютере (File System Access API): папку выбирают один раз, браузер её запоминает,
   при новом запуске один раз спрашивает разрешение на запись. Где это не поддерживается, остаётся скачивание архива. */

export const MACHINES = {
  nesting: { title: 'Нестинг Excitech', hint: 'например, nesting_work' },
  holzma: { title: 'Пила Holzma', hint: 'например, HolzmaKroy' },
  drill: { title: 'Сверлилка Excitech', hint: 'например, drill_work' },
};

export const canUseFolders = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window && window.isSecureContext && window.top === window.self;

const DB = 'rk_machines', ST = 'dirs';
function db() {
  return new Promise((ok, bad) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((ok, bad) => { const t = d.transaction(ST, mode), q = fn(t.objectStore(ST)); t.oncomplete = () => ok(q?.result); t.onerror = () => bad(t.error); });
}
export const getDir = key => tx('readonly', s => s.get(key)).catch(() => null);
export const forgetDir = key => tx('readwrite', s => s.delete(key));

/** Выбрать папку станка (нужен клик пользователя). */
export async function pickDir(key) {
  const h = await window.showDirectoryPicker({ id: 'rk-' + key, mode: 'readwrite' });
  await tx('readwrite', s => s.put(h, key));
  return h;
}

/** Имена выбранных папок для экрана настроек. */
export async function dirNames() {
  const out = {};
  for (const k of Object.keys(MACHINES)) { try { const h = await getDir(k); out[k] = h ? h.name : ''; } catch (e) { out[k] = ''; } }
  return out;
}

/** Разрешение на запись (спрашивается один раз за запуск браузера, нужен клик пользователя). */
async function writable(h) {
  const o = { mode: 'readwrite' };
  if (!h.queryPermission) return true; // папка без проверки разрешений (например, внутренняя папка браузера)
  if ((await h.queryPermission(o)) === 'granted') return true;
  return (await h.requestPermission?.(o)) === 'granted';
}

/**
 * Записать файлы в папку станка. sub — подпапка заказа (пусто — прямо в папку станка).
 * confirmReplace(names) вызывается, если такие файлы уже есть; вернуть false — ничего не писать.
 * Возвращает { ok, dir, written } или { ok: false, reason: 'nodir' | 'denied' | 'cancel' }.
 */
export async function sendToMachine(key, files, { sub = '', confirmReplace = async () => true, stale = null, confirmClean = async () => true } = {}) {
  const root = await getDir(key);
  if (!root) return { ok: false, reason: 'nodir' };
  if (!(await writable(root))) return { ok: false, reason: 'denied' };
  const dir = sub ? await root.getDirectoryHandle(sub, { create: true }) : root;
  const exist = [];
  for (const f of files) { try { await dir.getFileHandle(f.name); exist.push(f.name); } catch (e) { /* файла нет */ } }
  if (exist.length && !(await confirmReplace(exist))) return { ok: false, reason: 'cancel' };
  // Программы прошлого заказа с теми же именами (F3_3.anc при новом заказе на 2 листа) остались бы в папке
  // и их можно по ошибке запустить: предлагаем убрать.
  let removed = 0;
  if (stale && dir.values) {
    const mine = new Set(files.map(f => f.name.toLowerCase())), old = [];
    for await (const h of dir.values()) if (h.kind === 'file' && stale(h.name) && !mine.has(h.name.toLowerCase())) old.push(h.name);
    if (old.length && (await confirmClean(old))) for (const n of old) { try { await dir.removeEntry(n); removed++; } catch (e) { /* файл занят станком */ } }
  }
  for (const f of files) {
    const w = await (await dir.getFileHandle(f.name, { create: true })).createWritable();
    await w.write(f.data); await w.close();
  }
  return { ok: true, dir: sub ? `${root.name}\\${sub}` : root.name, written: files.length, removed };
}
