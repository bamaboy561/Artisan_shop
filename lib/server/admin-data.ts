import {
  CategoryKind,
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

const revenueOrderStatuses = new Set<OrderStatus>([
  OrderStatus.CONFIRMED,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.SHIPPED,
  OrderStatus.COMPLETED,
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

export const adminReportPeriodKeys = ["today", "7d", "30d", "month"] as const;

export type AdminReportPeriodKey = (typeof adminReportPeriodKeys)[number];

type ReportPeriod = {
  key: AdminReportPeriodKey;
  label: string;
  shortLabel: string;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
};

type ReportOrderItem = {
  quantity: number;
  total: number;
  snapshotName: string;
  snapshotSku: string | null;
  snapshotBrand: string | null;
  product?: {
    brand: { name: string } | null;
    category: { name: string; kind: CategoryKind } | null;
  } | null;
};

type ReportOrder = {
  id: string;
  number: string | null;
  status: OrderStatus;
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  companyName?: string | null;
  userId?: string | null;
  user?: {
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    email: string;
  } | null;
  subtotal: number;
  discountTotal: number;
  loyaltyRedemptionTotal: number;
  deliveryTotal: number;
  total: number;
  createdAt: Date;
  items: ReportOrderItem[];
};

type ReportRequest = {
  id: string;
  type: RequestType;
  status: RequestStatus;
  quotedTotal: number | null;
  estimatedBudget: number | null;
  createdAt: Date;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getPreviousMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

export function normalizeAdminReportPeriod(
  value: string | null | undefined,
): AdminReportPeriodKey {
  return adminReportPeriodKeys.includes(value as AdminReportPeriodKey)
    ? (value as AdminReportPeriodKey)
    : "month";
}

export function getAdminReportPeriod(
  key: AdminReportPeriodKey = "month",
): ReportPeriod {
  const now = new Date();
  const today = getStartOfToday();

  if (key === "today") {
    return {
      key,
      label: "Сегодня",
      shortLabel: "День",
      start: today,
      end: now,
      previousStart: addDays(today, -1),
      previousEnd: today,
    };
  }

  if (key === "7d") {
    const start = addDays(today, -6);

    return {
      key,
      label: "Последние 7 дней",
      shortLabel: "7 дней",
      start,
      end: now,
      previousStart: addDays(start, -7),
      previousEnd: start,
    };
  }

  if (key === "30d") {
    const start = addDays(today, -29);

    return {
      key,
      label: "Последние 30 дней",
      shortLabel: "30 дней",
      start,
      end: now,
      previousStart: addDays(start, -30),
      previousEnd: start,
    };
  }

  const start = getStartOfMonth(now);

  return {
    key: "month",
    label: "Текущий месяц",
    shortLabel: "Месяц",
    start,
    end: now,
    previousStart: getPreviousMonthStart(now),
    previousEnd: start,
  };
}

function percentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return Math.round(((current - previous) / previous) * 100);
}

function getClientName(order: ReportOrder) {
  const userName = order.user
    ? [order.user.firstName, order.user.lastName].filter(Boolean).join(" ")
    : "";

  return (
    order.companyName ||
    order.user?.companyName ||
    userName ||
    order.contactName ||
    order.user?.email ||
    "Клиент без имени"
  );
}

function getClientKey(order: ReportOrder) {
  return (
    order.userId ||
    [order.contactPhone, order.contactEmail, order.contactName]
      .filter(Boolean)
      .join("|") ||
    order.id
  );
}

function getRevenueCategory(item: ReportOrderItem) {
  const category = item.product?.category;

  if (category?.kind === CategoryKind.PLATE) {
    return "Плитные материалы";
  }

  if (category?.kind === CategoryKind.FITTINGS) {
    return "Фурнитура";
  }

  return category?.name ?? "Без категории";
}

function buildReportFromRecords({
  period,
  orders,
  requests,
  totalClients,
  newClients,
  telegramLinkedClients,
  loyaltyBalance,
  loyaltyLifetime,
  previousRevenue,
  previousOrderCount,
  previousNewClients,
}: {
  period: ReportPeriod;
  orders: ReportOrder[];
  requests: ReportRequest[];
  totalClients: number;
  newClients: number;
  telegramLinkedClients: number;
  loyaltyBalance: number;
  loyaltyLifetime: number;
  previousRevenue: number;
  previousOrderCount: number;
  previousNewClients: number;
}) {
  const paidOrders = orders.filter((order) =>
    revenueOrderStatuses.has(order.status),
  );
  const activeOrders = orders.filter((order) =>
    activeOrderStatuses.has(order.status),
  );
  const completedOrders = orders.filter(
    (order) => order.status === OrderStatus.COMPLETED,
  );
  const canceledOrders = orders.filter(
    (order) => order.status === OrderStatus.CANCELED,
  );
  const revenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
  const subtotal = paidOrders.reduce((sum, order) => sum + order.subtotal, 0);
  const discounts = paidOrders.reduce(
    (sum, order) => sum + order.discountTotal,
    0,
  );
  const loyaltyRedemptionTotal = paidOrders.reduce(
    (sum, order) => sum + order.loyaltyRedemptionTotal,
    0,
  );
  const itemsSold = paidOrders.reduce(
    (sum, order) =>
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );

  const topClientMap = new Map<
    string,
    {
      name: string;
      orders: number;
      revenue: number;
      lastOrderAt: Date;
    }
  >();

  const categoryMap = new Map<string, { revenue: number; quantity: number }>();
  const productMap = new Map<
    string,
    {
      name: string;
      sku: string | null;
      brand: string | null;
      quantity: number;
      revenue: number;
      orderIds: Set<string>;
    }
  >();
  const brandMap = new Map<
    string,
    {
      name: string;
      quantity: number;
      revenue: number;
      productKeys: Set<string>;
      orderIds: Set<string>;
    }
  >();

  for (const order of paidOrders) {
    const clientKey = getClientKey(order);
    const existingClient = topClientMap.get(clientKey);

    if (existingClient) {
      existingClient.orders += 1;
      existingClient.revenue += order.total;
      if (order.createdAt > existingClient.lastOrderAt) {
        existingClient.lastOrderAt = order.createdAt;
      }
    } else {
      topClientMap.set(clientKey, {
        name: getClientName(order),
        orders: 1,
        revenue: order.total,
        lastOrderAt: order.createdAt,
      });
    }

    const merchandiseLinesTotal = order.items.reduce(
      (sum, item) => sum + item.total,
      0,
    );
    const merchandiseRevenue = Math.max(0, order.total - order.deliveryTotal);
    const merchandiseRevenueRatio =
      merchandiseLinesTotal > 0
        ? merchandiseRevenue / merchandiseLinesTotal
        : 0;

    for (const item of order.items) {
      const itemRevenue = Math.round(item.total * merchandiseRevenueRatio);
      const categoryName = getRevenueCategory(item);
      const category = categoryMap.get(categoryName) ?? {
        revenue: 0,
        quantity: 0,
      };
      category.revenue += itemRevenue;
      category.quantity += item.quantity;
      categoryMap.set(categoryName, category);

      const brandName = item.snapshotBrand ?? item.product?.brand?.name ?? null;
      const productKey =
        item.snapshotSku ||
        [brandName, item.snapshotName].filter(Boolean).join("|");
      const product = productMap.get(productKey) ?? {
        name: item.snapshotName,
        sku: item.snapshotSku,
        brand: brandName,
        quantity: 0,
        revenue: 0,
        orderIds: new Set<string>(),
      };
      product.quantity += item.quantity;
      product.revenue += itemRevenue;
      product.orderIds.add(order.id);
      productMap.set(productKey, product);

      const normalizedBrandName = brandName ?? "Без бренда";
      const brand = brandMap.get(normalizedBrandName) ?? {
        name: normalizedBrandName,
        quantity: 0,
        revenue: 0,
        productKeys: new Set<string>(),
        orderIds: new Set<string>(),
      };
      brand.quantity += item.quantity;
      brand.revenue += itemRevenue;
      brand.productKeys.add(productKey);
      brand.orderIds.add(order.id);
      brandMap.set(normalizedBrandName, brand);
    }
  }

  const topClients = [...topClientMap.values()]
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 6);
  const repeatClients = [...topClientMap.values()].filter(
    (client) => client.orders > 1,
  ).length;
  const revenueByCategory = [...categoryMap.entries()]
    .map(([name, value]) => ({
      name,
      revenue: value.revenue,
      quantity: value.quantity,
      share: revenue > 0 ? Math.round((value.revenue / revenue) * 100) : 0,
    }))
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 6);
  const soldProducts = [...productMap.values()]
    .map((product) => ({
      name: product.name,
      sku: product.sku,
      brand: product.brand,
      quantity: product.quantity,
      revenue: product.revenue,
      orders: product.orderIds.size,
      averagePrice:
        product.quantity > 0
          ? Math.round(product.revenue / product.quantity)
          : 0,
      share: revenue > 0 ? Math.round((product.revenue / revenue) * 100) : 0,
    }))
    .sort((left, right) => right.revenue - left.revenue);
  const topProducts = soldProducts.slice(0, 6);
  const revenueByBrand = [...brandMap.values()]
    .map((brand) => ({
      name: brand.name,
      quantity: brand.quantity,
      revenue: brand.revenue,
      products: brand.productKeys.size,
      orders: brand.orderIds.size,
      share: revenue > 0 ? Math.round((brand.revenue / revenue) * 100) : 0,
      averagePrice:
        brand.quantity > 0 ? Math.round(brand.revenue / brand.quantity) : 0,
    }))
    .sort((left, right) => right.revenue - left.revenue);

  const ordersByStatus = Object.values(OrderStatus).map((status) => ({
    status,
    count: orders.filter((order) => order.status === status).length,
    revenue: paidOrders
      .filter((order) => order.status === status)
      .reduce((sum, order) => sum + order.total, 0),
  }));
  const requestsByStatus = Object.values(RequestStatus).map((status) => ({
    status,
    count: requests.filter((request) => request.status === status).length,
  }));
  const requestsByType = Object.values(RequestType).map((type) => ({
    type,
    count: requests.filter((request) => request.type === type).length,
  }));

  return {
    generatedAt: new Date(),
    period,
    sales: {
      revenue,
      subtotal,
      discounts,
      loyaltyRedemptionTotal,
      orderCount: paidOrders.length,
      allOrderCount: orders.length,
      activeOrders: activeOrders.length,
      completedOrders: completedOrders.length,
      canceledOrders: canceledOrders.length,
      averageOrderTotal:
        paidOrders.length > 0 ? Math.round(revenue / paidOrders.length) : 0,
      itemsSold,
      previousRevenue,
      revenueDeltaPercent: percentChange(revenue, previousRevenue),
      previousOrderCount,
      orderDeltaPercent: percentChange(paidOrders.length, previousOrderCount),
    },
    clients: {
      total: totalClients,
      new: newClients,
      activeBuying: topClientMap.size,
      repeat: repeatClients,
      telegramLinked: telegramLinkedClients,
      loyaltyBalance,
      loyaltyLifetime,
      previousNew: previousNewClients,
      newDeltaPercent: percentChange(newClients, previousNewClients),
    },
    requests: {
      total: requests.length,
      active: requests.filter((request) =>
        activeRequestStatuses.has(request.status),
      ).length,
      completed: requests.filter(
        (request) => request.status === RequestStatus.COMPLETED,
      ).length,
      cutting: requests.filter(
        (request) => request.type === RequestType.CUTTING_SERVICE,
      ).length,
      quotedTotal: requests.reduce(
        (sum, request) => sum + (request.quotedTotal ?? 0),
        0,
      ),
      estimatedBudget: requests.reduce(
        (sum, request) => sum + (request.estimatedBudget ?? 0),
        0,
      ),
    },
    breakdown: {
      ordersByStatus,
      requestsByStatus,
      requestsByType,
      revenueByBrand,
      revenueByCategory,
      soldProducts,
      topClients,
      topProducts,
    },
  };
}

export async function getAdminExecutiveReport(
  periodKey: AdminReportPeriodKey = "month",
) {
  const period = getAdminReportPeriod(periodKey);

  if (!hasDatabaseUrl() && isDemoModeEnabled()) {
    const [orders, requests] = await Promise.all([
      getOrderInbox(),
      getRequestInbox(),
    ]);
    const periodOrders: ReportOrder[] = orders
      .filter(
        (order) =>
          order.createdAt >= period.start && order.createdAt < period.end,
      )
      .map((order) => ({
        id: order.id,
        number: order.number,
        status: order.status,
        contactName: order.contactName,
        contactPhone: order.contactPhone,
        contactEmail: order.contactEmail,
        companyName: order.companyName,
        userId: order.userId,
        subtotal: order.total,
        discountTotal: 0,
        loyaltyRedemptionTotal: 0,
        deliveryTotal: order.deliveryTotal,
        total: order.total,
        createdAt: order.createdAt,
        items: [],
      }));
    const periodRequests: ReportRequest[] = requests
      .filter(
        (request) =>
          request.createdAt >= period.start && request.createdAt < period.end,
      )
      .map((request) => ({
        id: request.id,
        type: request.type,
        status: request.status,
        quotedTotal: null,
        estimatedBudget: request.estimatedBudget,
        createdAt: request.createdAt,
      }));
    const previousOrders = orders.filter(
      (order) =>
        order.createdAt >= period.previousStart &&
        order.createdAt < period.previousEnd &&
        revenueOrderStatuses.has(order.status),
    );
    const uniqueContacts = new Set(
      [...orders, ...requests].map((item) =>
        [item.contactPhone, item.contactName].filter(Boolean).join("|"),
      ),
    );

    return buildReportFromRecords({
      period,
      orders: periodOrders,
      requests: periodRequests,
      totalClients: uniqueContacts.size,
      newClients: uniqueContacts.size,
      telegramLinkedClients: 0,
      loyaltyBalance: 0,
      loyaltyLifetime: 0,
      previousRevenue: previousOrders.reduce(
        (sum, order) => sum + order.total,
        0,
      ),
      previousOrderCount: previousOrders.length,
      previousNewClients: 0,
    });
  }

  const db = getDb();
  const [
    orders,
    requests,
    totalClients,
    newClients,
    telegramLinkedClients,
    loyaltyTotals,
    previousOrders,
    previousNewClients,
  ] = await Promise.all([
    db.order.findMany({
      where: {
        createdAt: { gte: period.start, lt: period.end },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        status: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        companyName: true,
        userId: true,
        subtotal: true,
        discountTotal: true,
        loyaltyRedemptionTotal: true,
        deliveryTotal: true,
        total: true,
        createdAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            companyName: true,
            email: true,
          },
        },
        items: {
          select: {
            quantity: true,
            total: true,
            snapshotName: true,
            snapshotSku: true,
            snapshotBrand: true,
            product: {
              select: {
                brand: { select: { name: true } },
                category: { select: { name: true, kind: true } },
              },
            },
          },
        },
      },
    }),
    db.request.findMany({
      where: {
        createdAt: { gte: period.start, lt: period.end },
      },
      select: {
        id: true,
        type: true,
        status: true,
        quotedTotal: true,
        estimatedBudget: true,
        createdAt: true,
      },
    }),
    db.user.count(),
    db.user.count({
      where: { createdAt: { gte: period.start, lt: period.end } },
    }),
    db.user.count({ where: { telegramChatId: { not: null } } }),
    db.user.aggregate({
      _sum: {
        loyaltyPointsBalance: true,
        loyaltyPointsLifetime: true,
      },
    }),
    db.order.aggregate({
      where: {
        createdAt: { gte: period.previousStart, lt: period.previousEnd },
        status: { in: [...revenueOrderStatuses] },
      },
      _count: { _all: true },
      _sum: { total: true },
    }),
    db.user.count({
      where: {
        createdAt: { gte: period.previousStart, lt: period.previousEnd },
      },
    }),
  ]);

  return buildReportFromRecords({
    period,
    orders,
    requests,
    totalClients,
    newClients,
    telegramLinkedClients,
    loyaltyBalance: loyaltyTotals._sum.loyaltyPointsBalance ?? 0,
    loyaltyLifetime: loyaltyTotals._sum.loyaltyPointsLifetime ?? 0,
    previousRevenue: previousOrders._sum.total ?? 0,
    previousOrderCount: previousOrders._count._all,
    previousNewClients,
  });
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
        .filter((order) => revenueOrderStatuses.has(order.status))
        .reduce((sum, order) => sum + order.total, 0),
      averageOrderTotal:
        orders.filter((order) => revenueOrderStatuses.has(order.status))
          .length > 0
          ? Math.round(
              orders
                .filter((order) => revenueOrderStatuses.has(order.status))
                .reduce((sum, order) => sum + order.total, 0) /
                orders.filter((order) => revenueOrderStatuses.has(order.status))
                  .length,
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
    db.order.count({ where: { status: { in: [...revenueOrderStatuses] } } }),
    db.order.aggregate({
      where: { status: { in: [...revenueOrderStatuses] } },
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
