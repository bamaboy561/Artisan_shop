import {
  OrderStatus,
  ProductStatus,
  PromotionStatus,
  RequestType,
  RequestStatus,
} from "@/generated/prisma";
import { getDb, hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import { getOrderInbox } from "@/lib/server/order-inbox";
import { getRequestInbox } from "@/lib/server/request-inbox";

const activeOrderStatuses = new Set<OrderStatus>([
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.SHIPPED,
]);

const activeRequestStatuses = new Set<RequestStatus>([
  RequestStatus.NEW,
  RequestStatus.IN_REVIEW,
  RequestStatus.QUOTE_SENT,
  RequestStatus.WAITING_FOR_CLIENT,
  RequestStatus.IN_PROGRESS,
]);

function getStartOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getAdminDashboardMetrics() {
  if (!hasDatabaseUrl() && isDemoModeEnabled()) {
    const [orders, requests] = await Promise.all([
      getOrderInbox(),
      getRequestInbox(),
    ]);

    const uniqueContacts = new Set(
      [...orders, ...requests].map(
        (item) =>
          `${item.contactPhone}|${item.contactName}|${"contactEmail" in item ? (item.contactEmail ?? "") : ""}`,
      ),
    );

    return {
      productsTotal: 0,
      activeProducts: 0,
      categoriesTotal: 0,
      brandsTotal: 0,
      usersTotal: uniqueContacts.size,
      openOrders: orders.filter((order) =>
        activeOrderStatuses.has(order.status),
      ).length,
      openRequests: requests.filter((request) =>
        activeRequestStatuses.has(request.status),
      ).length,
      activePromotions: 0,
      ordersRevenue: orders
        .filter((order) => order.status !== OrderStatus.CANCELED)
        .reduce((sum, order) => sum + order.total, 0),
      averageOrderTotal:
        orders.length > 0
          ? Math.round(
              orders.reduce((sum, order) => sum + order.total, 0) /
                orders.length,
            )
          : 0,
      cuttingRequestsToday: requests.filter(
        (request) =>
          request.type === RequestType.CUTTING_SERVICE &&
          request.createdAt >= getStartOfToday(),
      ).length,
      readyForPickupOrders: orders.filter(
        (order) => order.status === OrderStatus.READY_FOR_PICKUP,
      ).length,
      shippedToday: orders.filter(
        (order) =>
          order.status === OrderStatus.SHIPPED &&
          order.updatedAt >= getStartOfToday(),
      ).length,
    };
  }

  const db = getDb();
  const startOfToday = getStartOfToday();

  const [
    productsTotal,
    activeProducts,
    categoriesTotal,
    brandsTotal,
    usersTotal,
    openOrders,
    openRequests,
    activePromotions,
    ordersTotal,
    orderRevenue,
    cuttingRequestsToday,
    readyForPickupOrders,
    shippedToday,
  ] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { status: ProductStatus.ACTIVE } }),
    db.category.count(),
    db.brand.count(),
    db.user.count(),
    db.order.count({
      where: {
        status: {
          in: [
            OrderStatus.NEW,
            OrderStatus.CONFIRMED,
            OrderStatus.IN_PRODUCTION,
            OrderStatus.READY_FOR_PICKUP,
            OrderStatus.SHIPPED,
          ],
        },
      },
    }),
    db.request.count({
      where: {
        status: {
          in: [
            RequestStatus.NEW,
            RequestStatus.IN_REVIEW,
            RequestStatus.QUOTE_SENT,
            RequestStatus.WAITING_FOR_CLIENT,
            RequestStatus.IN_PROGRESS,
          ],
        },
      },
    }),
    db.promotion.count({ where: { status: PromotionStatus.ACTIVE } }),
    db.order.count({ where: { status: { not: OrderStatus.CANCELED } } }),
    db.order.aggregate({
      where: { status: { not: OrderStatus.CANCELED } },
      _sum: { total: true },
    }),
    db.request.count({
      where: {
        type: RequestType.CUTTING_SERVICE,
        createdAt: { gte: startOfToday },
      },
    }),
    db.order.count({ where: { status: OrderStatus.READY_FOR_PICKUP } }),
    db.order.count({
      where: {
        status: OrderStatus.SHIPPED,
        updatedAt: { gte: startOfToday },
      },
    }),
  ]);

  const ordersRevenue = orderRevenue._sum.total ?? 0;

  return {
    productsTotal,
    activeProducts,
    categoriesTotal,
    brandsTotal,
    usersTotal,
    openOrders,
    openRequests,
    activePromotions,
    ordersRevenue,
    averageOrderTotal:
      ordersTotal > 0 ? Math.round(ordersRevenue / ordersTotal) : 0,
    cuttingRequestsToday,
    readyForPickupOrders,
    shippedToday,
  };
}

export async function getAdminStockMaterials(limit = 5) {
  if (!hasDatabaseUrl() && isDemoModeEnabled()) {
    return [];
  }

  const db = getDb();

  return db.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      stockQuantity: { not: null },
    },
    orderBy: [{ stockQuantity: "desc" }, { updatedAt: "desc" }],
    take: limit,
    select: {
      id: true,
      name: true,
      format: true,
      stockQuantity: true,
      updatedAt: true,
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: { url: true },
      },
    },
  });
}

export async function getAdminOperationalQueues(limit = 5) {
  if (!hasDatabaseUrl() && isDemoModeEnabled()) {
    const [orders, requests] = await Promise.all([
      getOrderInbox(),
      getRequestInbox(),
    ]);

    return {
      recentOrders: orders
        .slice()
        .sort(
          (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
        )
        .slice(0, limit)
        .map((order) => ({
          id: order.id,
          number: order.number,
          status: order.status,
          contactName: order.contactName,
          total: order.total,
          createdAt: order.createdAt,
        })),
      recentRequests: requests
        .slice()
        .sort(
          (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
        )
        .slice(0, limit)
        .map((request) => ({
          id: request.id,
          number: request.number,
          type: request.type,
          status: request.status,
          contactName: request.contactName,
          createdAt: request.createdAt,
        })),
    };
  }

  const db = getDb();

  const [recentOrders, recentRequests] = await Promise.all([
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        number: true,
        status: true,
        contactName: true,
        total: true,
        createdAt: true,
      },
    }),
    db.request.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        number: true,
        type: true,
        status: true,
        contactName: true,
        createdAt: true,
      },
    }),
  ]);

  return { recentOrders, recentRequests };
}
