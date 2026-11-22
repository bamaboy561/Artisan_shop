/* Связь с сайтом artisan.shop.kg: программа открыта по адресу /raskroy, сотрудник вошёл на сайт,
   и запросы идут с его входом (cookie). Заявки на распил открываются как проекты, проект сохраняется обратно. */

const API = '/api/raskroy/orders';
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const STAGE_NAME = { ACCEPTED: 'Принят', CUTTING: 'Распил', EDGING: 'Кромка', DRILLING: 'Присадка', READY_FOR_PICKUP: 'Готов к выдаче' };
export const STATUS_NAME = { NEW: 'Новая', IN_REVIEW: 'На рассмотрении', QUOTE_SENT: 'Отправлен расчёт', WAITING_FOR_CLIENT: 'Ждём клиента', IN_PROGRESS: 'В работе', COMPLETED: 'Выполнена', CANCELED: 'Отменена' };

async function call(url, opts = {}) {
  const r = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) }, ...opts });
  const type = r.headers.get('content-type') || '';
  if (!type.includes('json')) return { status: r.status, data: null };
  return { status: r.status, data: await r.json() };
}

/** Есть ли рядом сайт: {orders, user} — да, {login: true} — нужно войти, null — программа открыта не на сайте. */
export async function checkSite() {
  if (!/^https?:$/.test(location.protocol)) return null;
  try {
    const { status, data } = await call(API);
    if (status === 401 && data) return { login: true };
    if (data?.ok) return { orders: data.orders || [], user: data.user || '' };
  } catch (e) { /* не сайт */ }
  return null;
}

export async function openOrder(id) {
  const { status, data } = await call(`${API}/${encodeURIComponent(id)}`);
  if (status === 401) throw new Error('Войдите на сайт заново');
  if (!data?.ok) throw new Error(status === 404 ? 'Заявка не найдена' : 'Сайт не ответил');
  return data.order;
}

export async function saveOrder(id, body) {
  const { status, data } = await call(`${API}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
  if (status === 401) throw new Error('Войдите на сайт заново');
  if (status === 413) throw new Error('Проект слишком большой');
  if (!data?.ok) throw new Error('Сайт не сохранил проект');
  return data.savedAt;
}

/** Папка заявки как у GibLab в цеху: год и месяц по дате заявки (время Бишкека). */
export function orderMonth(iso) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bishkek', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const g = t => p.find(x => x.type === t)?.value || '';
  return { key: `${g('year')}-${g('month')}`, name: `${MONTHS[+g('month') - 1]} ${g('year')}`, day: `${g('day')}-${g('month')}` };
}

/** base64 → байты файла .project. */
export const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
