// «Требует внимания»: заказы и заявки, которые зависли. Один и тот же набор
// показывается на главной админки и уходит утренней сводкой в Telegram.

// Пороги в часах. Меняются здесь, в одном месте.
export const ATTENTION_RULES = {
  // Новая заявка, которую никто не тронул.
  staleRequestHours: 24,
  // Заказ создан, но не оплачен.
  unpaidOrderHours: 72,
  // Заказ готов, но его не забрали.
  uncollectedOrderHours: 72,
  // Остаток, при котором товар считается заканчивающимся.
  lowStockQuantity: 5,
} as const;

export type AttentionItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
};

export type AttentionGroup = {
  key:
    | "unassignedRequests"
    | "staleRequests"
    | "overdueOrders"
    | "unpaidOrders"
    | "uncollectedOrders"
    | "lowStock";
  title: string;
  hint: string;
  href: string;
  count: number;
  items: AttentionItem[];
};

export type AttentionSummary = {
  groups: AttentionGroup[];
  yesterday: {
    orders: number;
    ordersTotal: number;
    requests: number;
  };
};

export function formatAge(from: Date, now: Date) {
  const hours = Math.max(
    0,
    Math.floor((now.getTime() - from.getTime()) / 3_600_000),
  );

  if (hours < 1) return "меньше часа";
  if (hours < 48) return `${hours} ч`;

  return `${Math.floor(hours / 24)} дн.`;
}

const moneyFormatter = new Intl.NumberFormat("ru-RU");

// Текст утренней сводки для рабочего чата. Группы без записей пропускаем,
// чтобы сообщение читалось за несколько секунд.
export function buildStaffDigest(summary: AttentionSummary, siteUrl: string) {
  const active = summary.groups.filter((group) => group.count > 0);
  const lines = [
    `Вчера: заказов ${summary.yesterday.orders} на ${moneyFormatter.format(summary.yesterday.ordersTotal)} сом, заявок ${summary.yesterday.requests}`,
    "",
  ];

  if (active.length === 0) {
    lines.push("Зависших заказов и заявок нет.");
  }

  for (const group of active) {
    lines.push(`${group.title}: ${group.count}`);

    for (const item of group.items.slice(0, 3)) {
      lines.push(`  • ${item.label} · ${item.detail}`);
    }

    if (group.count > 3) {
      lines.push(`  … и ещё ${group.count - 3}`);
    }

    lines.push(`  ${siteUrl}${group.href}`);
    lines.push("");
  }

  while (lines.at(-1) === "") lines.pop();

  return { title: "Сводка на утро", lines };
}
