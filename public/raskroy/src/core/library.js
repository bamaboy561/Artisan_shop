// Список проектов цеха: папки, статусы заказа, поиск.
export const STATUSES = ['Не заказан', 'Заказан', 'Утверждён', 'В работе', 'Готов'];

export const newUid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Короткая запись о проекте для списка (сам проект хранится отдельно). */
export function projectMeta(P, now = Date.now()) {
  return { uid: P.uid, name: P.name || 'Без названия', order: P.order || '', folder: P.folder || '', status: P.status || STATUSES[0],
    date: P.date || '', due: P.due || '', parts: (P.parts || []).reduce((s, p) => s + (+p.count || 0), 0), updated: now };
}

/** Обновляет запись в списке, новые проекты встают наверх. */
export function upsertMeta(index, meta) {
  const i = index.findIndex(x => x.uid === meta.uid);
  if (i >= 0) index[i] = meta; else index.unshift(meta);
  return index;
}

/** Папки: созданные вручную (даже пустые) и те, что указаны у проектов. */
export const folders = (index, made = []) => [...new Set([...made, ...index.map(x => x.folder)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));

export const folderCounts = index => index.reduce((c, x) => { const k = x.folder || ''; c[k] = (c[k] || 0) + 1; return c; }, {});

export function filterProjects(index, { folder = '', status = '', q = '' } = {}) {
  q = q.trim().toLowerCase();
  return index.filter(x => (!folder || (folder === '-' ? !x.folder : x.folder === folder)) && (!status || x.status === status)
    && (!q || `${x.name} ${x.order}`.toLowerCase().includes(q)))
    .sort((a, b) => b.updated - a.updated);
}
