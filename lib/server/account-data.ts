import { OrderStatus, RequestFileKind, RequestStatus } from "@/generated/prisma";
import { getEffectiveProductPrice } from "@/features/catalog/bundle-pricing";

import { verifySession } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { getClientOperationEvents } from "@/lib/server/operation-events";
import { ensureProductBundleItemsTable } from "@/lib/server/product-bundle-schema";
import { ensureTelegramUserColumns } from "@/lib/server/telegram-user-schema";

const activeOrderStatuses = [
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.SHIPPED,
];

const activeRequestStatuses = [
  RequestStatus.NEW,
  RequestStatus.IN_REVIEW,
  RequestStatus.QUOTE_SENT,
  RequestStatus.WAITING_FOR_CLIENT,
  RequestStatus.IN_PROGRESS,
];

export async function getAccountUser() {
  const db = getDb();
  const session = await verifySession("/login?next=/account");
  await ensureTelegramUserColumns(db);

  return db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      companyName: true,
      telegramUsername: true,
      telegramLinkedAt: true,
      telegramNotifyOrders: true,
      telegramNotifyRequests: true,
      telegramNotifyLoyalty: true,
      loyaltyTier: true,
      loyaltyPointsBalance: true,
      loyaltyPointsLifetime: true,
      personalDiscountPercent: true,
      role: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });
}

export async function getAccountSummary(userId: string) {
  const db = getDb();

  const [
    ordersCount,
    activeOrdersCount,
    requestsCount,
    activeRequestsCount,
    favoritesCount,
    recentOrders,
    recentRequests,
    recentTransactions,
  ] = await Promise.all([
    db.order.count({ where: { userId } }),
    db.order.count({
      where: {
        userId,
        status: {
          in: activeOrderStatuses,
        },
      },
    }),
    db.request.count({ where: { userId } }),
    db.request.count({
      where: {
        userId,
        status: {
          in: activeRequestStatuses,
        },
      },
    }),
    db.favorite.count({ where: { userId } }),
    db.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        createdAt: true,
      },
    }),
    db.request.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        number: true,
        type: true,
        status: true,
        createdAt: true,
      },
    }),
    db.loyaltyTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        type: true,
        points: true,
        balanceAfter: true,
        title: true,
        description: true,
        createdAt: true,
        order: {
          select: {
            number: true,
          },
        },
      },
    }),
  ]);

  return {
    ordersCount,
    activeOrdersCount,
    requestsCount,
    activeRequestsCount,
    favoritesCount,
    recentOrders,
    recentRequests,
    recentTransactions,
  };
}

export async function getAccountOrders(userId: string) {
  const db = getDb();

  const orders = await db.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      discountTotal: true,
      promotionDiscountTotal: true,
      loyaltyRedemptionTotal: true,
      appliedPromoCode: true,
      productionDueAt: true,
      readyAt: true,
      completedAt: true,
      fulfillmentComment: true,
      createdAt: true,
      updatedAt: true,
      deliveryMethod: {
        select: {
          name: true,
        },
      },
      loyaltyTransactions: {
        select: {
          points: true,
        },
      },
      managerNotes: {
        where: {
          isVisibleToClient: true,
        },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          body: true,
          authorName: true,
          createdAt: true,
        },
      },
    },
  });

  const events = await getClientOperationEvents(
    "order",
    orders.map((order) => order.id),
  );

  return orders.map((order) => ({
    ...order,
    history: events.filter((event) => event.entityId === order.id),
  }));
}

export async function getAccountRequests(userId: string) {
  const db = getDb();

  const requests = await db.request.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      type: true,
      status: true,
      subject: true,
      quotedTotal: true,
      productionComment: true,
      createdAt: true,
      manager: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      files: {
        where: {
          OR: [
            {
              kind: RequestFileKind.MANAGER_RESULT,
              isVisibleToClient: true,
            },
            {
              kind: RequestFileKind.CLIENT_UPLOAD,
              isVisibleToClient: true,
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          kind: true,
          fileName: true,
          fileUrl: true,
          note: true,
          createdAt: true,
        },
      },
      managerNotes: {
        where: {
          isVisibleToClient: true,
        },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          body: true,
          authorName: true,
          createdAt: true,
        },
      },
    },
  });

  const events = await getClientOperationEvents(
    "request",
    requests.map((request) => request.id),
  );

  return requests.map((request) => ({
    ...request,
    history: events.filter((event) => event.entityId === request.id),
  }));
}

export async function getAccountFavorites(userId: string) {
  const db = getDb();
  await ensureProductBundleItemsTable(db);

  const favorites = await db.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          sku: true,
          price: true,
          bundleItems: {
            select: {
              quantity: true,
              componentProduct: {
                select: {
                  price: true,
                },
              },
            },
          },
          orderMode: true,
          brand: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return favorites.map((favorite) => ({
    ...favorite,
    product: {
      ...favorite.product,
      price: getEffectiveProductPrice(favorite.product),
    },
  }));
}
