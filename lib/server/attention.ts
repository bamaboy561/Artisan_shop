import "server-only";

import {
  CategoryKind,
  OrderStatus,
  ProductStatus,
  RequestStatus,
} from "@/generated/prisma";
import {
  ATTENTION_RULES,
  formatAge,
  type AttentionGroup,
  type AttentionSummary,
} from "@/features/admin/attention";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import {
  DEFAULT_STOCK_THRESHOLDS,
  getStockThresholds,
} from "@/lib/server/stock-thresholds";

const ITEMS_PER_GROUP = 5;
const BISHKEK_OFFSET_MS = 6 * 60 * 60 * 1000;

const hoursAgo = (now: Date, hours: number) =>
  new Date(now.getTime() - hours * 3_600_000);

// Границы вчерашнего дня по времени Бишкека (UTC+6, без перевода часов).
function yesterdayRange(now: Date) {
  const local = new Date(now.getTime() + BISHKEK_OFFSET_MS);
  const todayStart =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
    BISHKEK_OFFSET_MS;

  return {
    gte: new Date(todayStart - 24 * 3_600_000),
    lt: new Date(todayStart),
  };
}

const requestLabel = (item: { number: string | null; contactName: string }) =>
  `${item.number ?? "Заявка"} · ${item.contactName}`;
const orderLabel = (item: { number: string | null; contactName: string }) =>
  `${item.number ?? "Заказ"} · ${item.contactName}`;

export async function getAttentionSummary(
  now = new Date(),
): Promise<AttentionSummary | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const db = getDb();
  const requestSelect = {
    id: true,
    number: true,
    contactName: true,
    createdAt: true,
    updatedAt: true,
  } as const;
  const orderSelect = {
    id: true,
    number: true,
    contactName: true,
    total: true,
    createdAt: true,
    readyAt: true,
    updatedAt: true,
    productionDueAt: true,
  } as const;

  const unassignedRequests = {
    managerId: null,
    status: {
      in: [
        RequestStatus.NEW,
        RequestStatus.IN_REVIEW,
        RequestStatus.QUOTE_SENT,
        RequestStatus.WAITING_FOR_CLIENT,
        RequestStatus.IN_PROGRESS,
      ],
    },
  };
  const staleRequests = {
    status: RequestStatus.NEW,
    updatedAt: { lt: hoursAgo(now, ATTENTION_RULES.staleRequestHours) },
  };
  const overdueOrders = {
    productionDueAt: { lt: now },
    status: {
      in: [
        OrderStatus.NEW,
        OrderStatus.RESERVED,
        OrderStatus.CONFIRMED,
        OrderStatus.PAID,
        OrderStatus.IN_PRODUCTION,
      ],
    },
  };
  const unpaidOrders = {
    createdAt: { lt: hoursAgo(now, ATTENTION_RULES.unpaidOrderHours) },
    status: {
      in: [OrderStatus.NEW, OrderStatus.RESERVED, OrderStatus.CONFIRMED],
    },
  };
  const uncollectedOrders = {
    status: OrderStatus.READY_FOR_PICKUP,
    updatedAt: { lt: hoursAgo(now, ATTENTION_RULES.uncollectedOrderHours) },
  };
  // Порог свой у плит, фурнитуры и остального; задаётся в разделе «Товары».
  const thresholds = await getStockThresholds().catch(
    () => DEFAULT_STOCK_THRESHOLDS,
  );
  const lowStock = {
    status: ProductStatus.ACTIVE,
    OR: Object.values(CategoryKind).map((kind) => ({
      category: { kind },
      stockQuantity: { gt: 0, lte: thresholds[kind] },
    })),
  };
  const yesterday = yesterdayRange(now);
  const notCanceled = { not: OrderStatus.CANCELED };

  const [
    unassignedCount,
    unassignedItems,
    staleCount,
    staleItems,
    overdueCount,
    overdueItems,
    unpaidCount,
    unpaidItems,
    uncollectedCount,
    uncollectedItems,
    lowStockCount,
    lowStockItems,
    yesterdayOrders,
    yesterdayRequests,
  ] = await Promise.all([
    db.request.count({ where: unassignedRequests }),
    db.request.findMany({
      where: unassignedRequests,
      orderBy: { createdAt: "asc" },
      take: ITEMS_PER_GROUP,
      select: requestSelect,
    }),
    db.request.count({ where: staleRequests }),
    db.request.findMany({
      where: staleRequests,
      orderBy: { updatedAt: "asc" },
      take: ITEMS_PER_GROUP,
      select: requestSelect,
    }),
    db.order.count({ where: overdueOrders }),
    db.order.findMany({
      where: overdueOrders,
      orderBy: { productionDueAt: "asc" },
      take: ITEMS_PER_GROUP,
      select: orderSelect,
    }),
    db.order.count({ where: unpaidOrders }),
    db.order.findMany({
      where: unpaidOrders,
      orderBy: { createdAt: "asc" },
      take: ITEMS_PER_GROUP,
      select: orderSelect,
    }),
    db.order.count({ where: uncollectedOrders }),
    db.order.findMany({
      where: uncollectedOrders,
      orderBy: { updatedAt: "asc" },
      take: ITEMS_PER_GROUP,
      select: orderSelect,
    }),
    db.product.count({ where: lowStock }),
    db.product.findMany({
      where: lowStock,
      orderBy: [{ stockQuantity: "asc" }, { name: "asc" }],
      take: ITEMS_PER_GROUP,
      select: { id: true, name: true, stockQuantity: true },
    }),
    db.order.aggregate({
      where: { createdAt: yesterday, status: notCanceled },
      _count: true,
      _sum: { total: true },
    }),
    db.request.count({ where: { createdAt: yesterday } }),
  ]);

  const groups: AttentionGroup[] = [
    {
      key: "unassignedRequests",
      title: "Заявки без менеджера",
      hint: "Никто не назначен ответственным",
      href: "/admin/requests?assignment=unassigned",
      count: unassignedCount,
      items: unassignedItems.map((item) => ({
        id: item.id,
        label: requestLabel(item),
        detail: `ждёт ${formatAge(item.createdAt, now)}`,
        href: `/admin/requests/${item.id}`,
      })),
    },
    {
      key: "staleRequests",
      title: "Новые заявки без ответа",
      hint: `Статус «Новая» дольше ${ATTENTION_RULES.staleRequestHours} часов`,
      href: `/admin/requests?status=${RequestStatus.NEW}`,
      count: staleCount,
      items: staleItems.map((item) => ({
        id: item.id,
        label: requestLabel(item),
        detail: `без движения ${formatAge(item.updatedAt, now)}`,
        href: `/admin/requests/${item.id}`,
      })),
    },
    {
      key: "overdueOrders",
      title: "Заказы с просроченным сроком",
      hint: "Срок готовности прошёл, заказ не готов",
      href: "/admin/orders?due=overdue",
      count: overdueCount,
      items: overdueItems.map((item) => ({
        id: item.id,
        label: orderLabel(item),
        detail: item.productionDueAt
          ? `просрочен на ${formatAge(item.productionDueAt, now)}`
          : "",
        href: `/admin/orders/${item.id}`,
      })),
    },
    {
      key: "unpaidOrders",
      title: "Заказы без оплаты",
      hint: `Не оплачены дольше ${ATTENTION_RULES.unpaidOrderHours / 24} дней, товар в резерве`,
      href: "/admin/orders",
      count: unpaidCount,
      items: unpaidItems.map((item) => ({
        id: item.id,
        label: orderLabel(item),
        detail: `создан ${formatAge(item.createdAt, now)} назад`,
        href: `/admin/orders/${item.id}`,
      })),
    },
    {
      key: "uncollectedOrders",
      title: "Готовые заказы не забрали",
      hint: `Готовы к выдаче дольше ${ATTENTION_RULES.uncollectedOrderHours / 24} дней`,
      href: `/admin/orders?status=${OrderStatus.READY_FOR_PICKUP}`,
      count: uncollectedCount,
      items: uncollectedItems.map((item) => ({
        id: item.id,
        label: orderLabel(item),
        detail: `ждёт ${formatAge(item.readyAt ?? item.updatedAt, now)}`,
        href: `/admin/orders/${item.id}`,
      })),
    },
    {
      key: "lowStock",
      title: "Товары заканчиваются",
      hint: `Остаток не больше: плиты ${thresholds.PLATE}, фурнитура ${thresholds.FITTINGS}, остальное ${thresholds.OTHER}`,
      href: "/admin/products",
      count: lowStockCount,
      items: lowStockItems.map((item) => ({
        id: item.id,
        label: item.name,
        detail: `осталось ${item.stockQuantity ?? 0}`,
        href: `/admin/products/${item.id}`,
      })),
    },
  ];

  return {
    groups,
    yesterday: {
      orders: yesterdayOrders._count,
      ordersTotal: yesterdayOrders._sum.total ?? 0,
      requests: yesterdayRequests,
    },
  };
}
