import {
  OrderStatus,
  ProductStatus,
  PromotionStatus,
  RequestStatus,
} from "@/generated/prisma";
import {
  brands as publicBrands,
  catalogCategories,
  catalogProducts,
  partnerBrands,
} from "@/features/catalog/data";
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

export async function getAdminDashboardMetrics() {
  if (!hasDatabaseUrl() && isDemoModeEnabled()) {
    const [orders, requests] = await Promise.all([
      getOrderInbox(),
      getRequestInbox(),
    ]);

    const uniqueContacts = new Set(
      [...orders, ...requests].map((item) =>
        `${item.contactPhone}|${item.contactName}|${"contactEmail" in item ? item.contactEmail ?? "" : ""}`,
      ),
    );

    return {
      productsTotal: catalogProducts.length,
      activeProducts: catalogProducts.length,
      categoriesTotal: catalogCategories.length,
      brandsTotal: publicBrands.length + partnerBrands.length,
      usersTotal: uniqueContacts.size,
      openOrders: orders.filter((order) => activeOrderStatuses.has(order.status))
        .length,
      openRequests: requests.filter((request) =>
        activeRequestStatuses.has(request.status),
      ).length,
      activePromotions: 0,
    };
  }

  const db = getDb();

  const [
    productsTotal,
    activeProducts,
    categoriesTotal,
    brandsTotal,
    usersTotal,
    openOrders,
    openRequests,
    activePromotions,
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
  ]);

  return {
    productsTotal,
    activeProducts,
    categoriesTotal,
    brandsTotal,
    usersTotal,
    openOrders,
    openRequests,
    activePromotions,
  };
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
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
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
