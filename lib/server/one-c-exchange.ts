import "server-only";

import { getUnpaidReservedQuantities } from "@/lib/server/inventory-reservations";
import crypto from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  InventoryStatus,
  LoyaltyTransactionStatus,
  LoyaltyTransactionType,
  NotificationChannel,
  NotificationStatus,
  OrderStatus,
  ProductStatus,
  type Prisma,
} from "@/generated/prisma";
import { formatPrice } from "@/lib/commerce";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { syncOrderInventoryReservation } from "@/lib/server/inventory-reservations";
import { cancelOrderLoyaltyTransactions } from "@/lib/server/order-loyalty-cancellation";
import { logOperationEvent } from "@/lib/server/operation-events";
import { applyApprovedLoyaltyDelta } from "@/lib/server/loyalty-ledger";
import { sendTelegramDirectMessage } from "@/lib/server/telegram-bot";

const nullableIntSchema = z
  .union([z.coerce.number().int().nonnegative(), z.null()])
  .optional();

// Остаток из 1С бывает дробным (метры кромки): сайт хранит целое,
// поэтому округляем вниз.
const nullableStockSchema = z
  .union([
    z.coerce
      .number()
      .nonnegative()
      .transform((value) => Math.floor(value)),
    z.null(),
  ])
  .optional();

const productStatusSchema = z
  .enum(Object.values(ProductStatus) as [ProductStatus, ...ProductStatus[]])
  .nullable()
  .optional();

const inventoryStatusSchema = z
  .enum(
    Object.values(InventoryStatus) as [InventoryStatus, ...InventoryStatus[]],
  )
  .nullable()
  .optional();

const orderStatusSchema = z
  .enum(Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]])
  .optional();

export const oneCProductSyncSchema = z.object({
  source: z.string().trim().optional(),
  products: z
    .array(
      z
        .object({
          sku: z.string().trim().min(1),
          name: z.string().trim().min(1).optional(),
          price: nullableIntSchema,
          compareAtPrice: nullableIntSchema,
          stockQuantity: nullableStockSchema,
          stock: nullableStockSchema,
          quantity: nullableStockSchema,
          inventoryStatus: inventoryStatusSchema,
          status: productStatusSchema,
        })
        .passthrough(),
    )
    .min(1)
    .max(1000),
});

export const oneCOrderStatusSyncSchema = z.object({
  source: z.string().trim().optional(),
  orders: z
    .array(
      z
        .object({
          id: z.string().trim().min(1).optional(),
          number: z.string().trim().min(1).optional(),
          status: orderStatusSchema,
          oneCNumber: z.string().trim().min(1).optional(),
          paidTotal: nullableIntSchema,
          comment: z.string().trim().optional(),
        })
        .refine((item) => item.id || item.number, {
          message: "Order id or number is required.",
        }),
    )
    .min(1)
    .max(500),
});

export const oneCLoyaltySyncSchema = z.object({
  source: z.string().trim().optional(),
  operations: z
    .array(
      z
        .object({
          userId: z.string().trim().min(1).optional(),
          email: z.string().trim().email().optional(),
          phone: z.string().trim().min(3).optional(),
          pointsDelta: z.coerce.number().int(),
          title: z.string().trim().min(1).optional(),
          description: z.string().trim().optional(),
          externalId: z.string().trim().optional(),
        })
        .refine((item) => item.userId || item.email || item.phone, {
          message: "User id, email or phone is required.",
        }),
    )
    .min(1)
    .max(500),
});

export function getOneCAuthError(request: Request) {
  const expectedToken = (
    process.env.ONE_C_INBOUND_API_KEY || process.env.ONE_C_API_KEY
  )?.trim();

  if (!expectedToken) {
    return {
      status: 503,
      body: {
        ok: false,
        message: "ONE_C_API_KEY or ONE_C_INBOUND_API_KEY is not configured.",
      },
    };
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const headerToken = request.headers.get("x-artisan-1c-key")?.trim();
  const incomingToken = bearerToken || headerToken || "";

  if (!timingSafeEqual(incomingToken, expectedToken)) {
    return {
      status: 401,
      body: {
        ok: false,
        message: "Invalid 1C API key.",
      },
    };
  }

  return null;
}

export function getOneCDatabaseError() {
  if (hasDatabaseUrl()) {
    return null;
  }

  return {
    status: 503,
    body: {
      ok: false,
      message: "Database is not configured.",
    },
  };
}

export async function parseOneCBody<T extends z.ZodType>(
  request: Request,
  schema: T,
) {
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return {
      ok: false as const,
      error: {
        status: 400,
        body: {
          ok: false,
          message: "Invalid 1C payload.",
          issues: z.treeifyError(parsed.error),
        },
      },
    };
  }

  return {
    ok: true as const,
    data: parsed.data as z.output<T>,
  };
}

export async function getOneCProducts(params: {
  updatedSince?: Date | null;
  take?: number;
}) {
  const db = getDb();
  const products = await db.product.findMany({
    where: params.updatedSince
      ? {
          updatedAt: {
            gte: params.updatedSince,
          },
        }
      : undefined,
    take: params.take ?? 500,
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      sku: true,
      slug: true,
      name: true,
      status: true,
      inventoryStatus: true,
      price: true,
      compareAtPrice: true,
      stockQuantity: true,
      updatedAt: true,
      category: {
        select: {
          slug: true,
          name: true,
        },
      },
      brand: {
        select: {
          name: true,
        },
      },
    },
  });

  return products.map((product) => ({
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    category: product.category,
    brand: product.brand?.name ?? null,
    status: product.status,
    inventoryStatus: product.inventoryStatus,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    stockQuantity: product.stockQuantity,
    updatedAt: product.updatedAt.toISOString(),
  }));
}

export async function syncOneCProducts(
  input: z.output<typeof oneCProductSyncSchema>,
) {
  const db = getDb();
  const skuKeys = input.products.map((product) =>
    product.sku.trim().toLocaleLowerCase("ru-RU"),
  );
  const existingProducts = await db.product.findMany({
    where: {
      sku: {
        in: input.products.map((product) => product.sku),
      },
    },
    select: {
      id: true,
      sku: true,
      slug: true,
      category: {
        select: {
          slug: true,
        },
      },
    },
  });
  const productBySku = new Map(
    existingProducts.map((product) => [
      product.sku.trim().toLocaleLowerCase("ru-RU"),
      product,
    ]),
  );

  const reservedByProduct = await getUnpaidReservedQuantities(
    db,
    existingProducts.map((product) => product.id),
  );

  let updated = 0;
  let skipped = 0;
  const missingSkus: string[] = [];

  for (const item of input.products) {
    const skuKey = item.sku.trim().toLocaleLowerCase("ru-RU");
    const product = productBySku.get(skuKey);

    if (!product) {
      skipped += 1;
      missingSkus.push(item.sku);
      continue;
    }

    const updateData: Prisma.ProductUpdateInput = {};
    const stockQuantity = item.stockQuantity ?? item.stock ?? item.quantity;

    if (item.name !== undefined) updateData.name = item.name;
    if (item.price !== undefined) updateData.price = item.price;
    if (item.compareAtPrice !== undefined) {
      updateData.compareAtPrice = item.compareAtPrice;
    }
    if (stockQuantity !== undefined) {
      // Остаток из 1С минус то, что держат неоплаченные заказы сайта.
      const availableQuantity =
        stockQuantity === null
          ? null
          : Math.max(
              0,
              stockQuantity - (reservedByProduct.get(product.id) ?? 0),
            );

      updateData.stockQuantity = availableQuantity;
      updateData.inventoryStatus =
        item.inventoryStatus ?? getInventoryStatusFromStock(availableQuantity);
    } else if (item.inventoryStatus) {
      updateData.inventoryStatus = item.inventoryStatus;
    }
    if (item.status) updateData.status = item.status;

    if (Object.keys(updateData).length === 0) {
      skipped += 1;
      continue;
    }

    await db.product.update({
      where: { id: product.id },
      data: updateData,
    });
    updated += 1;

    revalidatePath(`/product/${product.slug}`);
    revalidatePath(`/catalog/${product.category.slug}`);
  }

  if (updated > 0) {
    revalidatePath("/");
    revalidatePath("/catalog");
    revalidatePath("/admin");
    revalidatePath("/admin/products");
  }

  await logOneCNotification({
    title: "1C products sync",
    message: `Products updated: ${updated}; skipped: ${skipped}.`,
    payload: {
      source: input.source ?? null,
      received: input.products.length,
      updated,
      skipped,
      missingSkus: missingSkus.slice(0, 50),
      skuKeys,
    },
  });

  return {
    updated,
    skipped,
    missingSkus,
  };
}

export async function getOneCOrders(params: {
  updatedSince?: Date | null;
  status?: OrderStatus | null;
  take?: number;
}) {
  const db = getDb();
  const orders = await db.order.findMany({
    where: {
      ...(params.updatedSince
        ? {
            updatedAt: {
              gte: params.updatedSince,
            },
          }
        : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    take: params.take ?? 200,
    orderBy: { updatedAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          loyaltyTier: true,
          plateMaterialLoyaltyTier: true,
          fittingsLoyaltyTier: true,
          loyaltyPointsBalance: true,
        },
      },
      deliveryMethod: {
        select: {
          code: true,
          name: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              sku: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      loyaltyTransactions: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    number: order.number,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    customer: {
      userId: order.userId,
      name: order.contactName,
      phone: order.contactPhone,
      email: order.contactEmail,
      companyName: order.companyName,
      account: order.user,
    },
    delivery: {
      method: order.deliveryMethod,
      total: order.deliveryTotal,
    },
    totals: {
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      promotionDiscountTotal: order.promotionDiscountTotal,
      loyaltyRedemptionTotal: order.loyaltyRedemptionTotal,
      deliveryTotal: order.deliveryTotal,
      total: order.total,
    },
    loyalty: {
      redeemed: order.loyaltyRedemptionTotal,
      accrued: order.loyaltyTransactions
        .filter(
          (transaction) =>
            transaction.type === LoyaltyTransactionType.ORDER_ACCRUAL,
        )
        .reduce((sum, transaction) => sum + transaction.points, 0),
      operations: order.loyaltyTransactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        points: transaction.points,
        balanceAfter: transaction.balanceAfter,
        title: transaction.title,
        createdAt: transaction.createdAt.toISOString(),
      })),
    },
    items: order.items.map((item) => ({
      productId: item.productId,
      sku: item.product?.sku ?? item.snapshotSku,
      name: item.snapshotName,
      brand: item.snapshotBrand,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount,
      total: item.total,
    })),
    comment: order.comment,
  }));
}

const oneCApprovedOrderStatuses = new Set<OrderStatus>([
  OrderStatus.CONFIRMED,
  OrderStatus.PAID,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.SHIPPED,
  OrderStatus.COMPLETED,
]);

function getOrderStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    [OrderStatus.NEW]: "Новый",
    [OrderStatus.RESERVED]: "Бронь",
    [OrderStatus.CONFIRMED]: "Подтвержден",
    [OrderStatus.PAID]: "Оплачено",
    [OrderStatus.IN_PRODUCTION]: "В производстве",
    [OrderStatus.READY_FOR_PICKUP]: "Готов к выдаче",
    [OrderStatus.SHIPPED]: "Отгружен",
    [OrderStatus.COMPLETED]: "Завершен",
    [OrderStatus.CANCELED]: "Отменен",
  };

  return labels[status];
}

async function applyOneCOrderStatus(params: {
  orderId: string;
  nextStatus: OrderStatus;
  source: string;
}) {
  const now = new Date();

  return getDb().$transaction(async (tx) => {
    const lockedOrder = await tx.order.updateMany({
      where: { id: params.orderId },
      data: { updatedAt: now },
    });

    if (lockedOrder.count === 0) {
      return null;
    }

    const order = await tx.order.findUnique({
      where: { id: params.orderId },
      select: {
        id: true,
        number: true,
        status: true,
        userId: true,
        total: true,
        loyaltyTransactions: {
          where: {
            type: {
              in: [
                LoyaltyTransactionType.ORDER_ACCRUAL,
                LoyaltyTransactionType.REDEMPTION,
              ],
            },
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            type: true,
            status: true,
            points: true,
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    const previousStatus = order.status;
    const statusChanged = previousStatus !== params.nextStatus;
    let reopenedOrderReservation = false;

    if (statusChanged) {
      if (
        previousStatus !== OrderStatus.CANCELED &&
        params.nextStatus === OrderStatus.CANCELED
      ) {
        await syncOrderInventoryReservation(tx, order.id, false);
      } else if (
        previousStatus === OrderStatus.CANCELED &&
        params.nextStatus !== OrderStatus.CANCELED
      ) {
        reopenedOrderReservation = await syncOrderInventoryReservation(
          tx,
          order.id,
          true,
        );
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: params.nextStatus,
          ...(params.nextStatus === OrderStatus.READY_FOR_PICKUP
            ? { readyAt: now }
            : {}),
          ...(params.nextStatus === OrderStatus.COMPLETED
            ? { completedAt: now }
            : {}),
        },
      });
    }

    let loyaltyChanged = false;

    if (order.userId && params.nextStatus === OrderStatus.CANCELED) {
      loyaltyChanged = Boolean(
        await cancelOrderLoyaltyTransactions(tx, order.id),
      );
    } else if (order.userId && params.nextStatus !== OrderStatus.CANCELED) {
      const approvedTarget = oneCApprovedOrderStatuses.has(params.nextStatus);
      const pendingAccruals = order.loyaltyTransactions.filter(
        (transaction) =>
          transaction.type === LoyaltyTransactionType.ORDER_ACCRUAL &&
          transaction.status === LoyaltyTransactionStatus.PENDING,
      );
      const canceledAccrual = order.loyaltyTransactions.find(
        (transaction) =>
          transaction.type === LoyaltyTransactionType.ORDER_ACCRUAL &&
          transaction.status === LoyaltyTransactionStatus.CANCELED,
      );
      const canceledRedemption = order.loyaltyTransactions.find(
        (transaction) =>
          transaction.type === LoyaltyTransactionType.REDEMPTION &&
          transaction.status === LoyaltyTransactionStatus.CANCELED,
      );
      const restoreAfterCancellation =
        previousStatus === OrderStatus.CANCELED && reopenedOrderReservation;
      const accrualsToApprove = [
        ...pendingAccruals,
        ...(restoreAfterCancellation && canceledAccrual
          ? [canceledAccrual]
          : []),
      ].filter(
        (transaction, index, list) =>
          list.findIndex((item) => item.id === transaction.id) === index,
      );
      const redemptionsToRestore =
        restoreAfterCancellation && canceledRedemption
          ? [canceledRedemption]
          : [];
      const approvedAccruals = approvedTarget ? accrualsToApprove : [];
      const balanceDelta = [
        ...approvedAccruals,
        ...redemptionsToRestore,
      ].reduce((sum, transaction) => sum + transaction.points, 0);
      const lifetimeDelta = approvedAccruals.reduce(
        (sum, transaction) =>
          transaction.points > 0 ? sum + transaction.points : sum,
        0,
      );
      let balanceAfter: number | null = null;

      if (balanceDelta !== 0 || lifetimeDelta !== 0) {
        const user = await tx.user.update({
          where: { id: order.userId },
          data: {
            loyaltyPointsBalance: { increment: balanceDelta },
            loyaltyPointsLifetime: { increment: lifetimeDelta },
          },
          select: { loyaltyPointsBalance: true },
        });
        balanceAfter = user.loyaltyPointsBalance;
      }

      const approvedTransactionIds = [
        ...approvedAccruals,
        ...redemptionsToRestore,
      ].map(({ id }) => id);

      if (approvedTransactionIds.length > 0) {
        await tx.loyaltyTransaction.updateMany({
          where: { id: { in: approvedTransactionIds } },
          data: {
            status: LoyaltyTransactionStatus.APPROVED,
            ...(balanceAfter !== null ? { balanceAfter } : {}),
            approvedAt: now,
            approvedById: null,
            canceledAt: null,
            canceledById: null,
          },
        });
        loyaltyChanged = true;
      }

      if (restoreAfterCancellation && canceledAccrual && !approvedTarget) {
        await tx.loyaltyTransaction.update({
          where: { id: canceledAccrual.id },
          data: {
            status: LoyaltyTransactionStatus.PENDING,
            approvedAt: null,
            approvedById: null,
            canceledAt: null,
            canceledById: null,
          },
        });
        loyaltyChanged = true;
      }
    }

    return {
      number: order.number,
      userId: order.userId,
      total: order.total,
      previousStatus,
      loyaltyChanged,
      source: params.source,
    };
  });
}

export async function syncOneCOrderStatuses(
  input: z.output<typeof oneCOrderStatusSyncSchema>,
) {
  const db = getDb();
  let updated = 0;
  let skipped = 0;
  const missingOrders: string[] = [];

  for (const item of input.orders) {
    const order = await db.order.findFirst({
      where: item.id ? { id: item.id } : { number: item.number },
      select: { id: true, number: true, status: true, total: true },
    });

    if (!order) {
      skipped += 1;
      missingOrders.push(item.id ?? item.number ?? "unknown");
      continue;
    }

    // 1С сообщила, что заказ оплачен полностью, а статус не прислала:
    // неоплаченный заказ на сайте сам становится «Оплачен».
    const paidInFull =
      !item.status &&
      item.paidTotal !== undefined &&
      item.paidTotal !== null &&
      item.paidTotal >= order.total &&
      order.total > 0 &&
      (order.status === OrderStatus.NEW ||
        order.status === OrderStatus.RESERVED ||
        order.status === OrderStatus.CONFIRMED);
    const nextStatus = item.status ?? (paidInFull ? OrderStatus.PAID : null);

    const descriptionParts = [
      item.oneCNumber ? `Номер в 1С: ${item.oneCNumber}` : "",
      item.paidTotal !== undefined && item.paidTotal !== null
        ? `Оплачено: ${item.paidTotal} сом`
        : "",
      item.comment ? `Комментарий: ${item.comment}` : "",
    ].filter(Boolean);

    if (nextStatus) {
      const transition = await applyOneCOrderStatus({
        orderId: order.id,
        nextStatus,
        source: input.source ?? "1C",
      });

      if (!transition) {
        skipped += 1;
        continue;
      }

      const statusChanged = transition.previousStatus !== nextStatus;

      if (!statusChanged && !transition.loyaltyChanged) {
        if (descriptionParts.length === 0) {
          skipped += 1;
          continue;
        }
      }

      await logOperationEvent({
        entityType: "order",
        entityId: order.id,
        eventType: "status",
        title: `Заказ ${order.number ?? order.id} обновлён из 1С`,
        description: descriptionParts.join("\n") || null,
        fromStatus: transition.previousStatus,
        toStatus: nextStatus,
        actorName: input.source ?? "1C",
        isVisibleToClient: true,
      });

      if (statusChanged && transition.userId) {
        await sendTelegramDirectMessage(transition.userId, {
          title: `Статус заказа ${transition.number ?? order.id} обновлен`,
          category: "orders",
          lines: [
            `Новый статус: ${getOrderStatusLabel(nextStatus)}`,
            `Сумма: ${formatPrice(transition.total)}`,
          ],
          actions: [{ text: "Открыть заказ", url: "/account/orders" }],
        }).catch((error) => console.error("[1c:telegram:order-status]", error));
      }

      updated += 1;
    } else if (descriptionParts.length > 0) {
      await logOperationEvent({
        entityType: "order",
        entityId: order.id,
        eventType: "system",
        title: `1C sync for order ${order.number ?? order.id}`,
        description: descriptionParts.join("\n"),
        actorName: input.source ?? "1C",
        isVisibleToClient: false,
      });
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  if (updated > 0) {
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/account/orders");
  }

  await logOneCNotification({
    title: "1C order status sync",
    message: `Orders updated: ${updated}; skipped: ${skipped}.`,
    payload: {
      source: input.source ?? null,
      received: input.orders.length,
      updated,
      skipped,
      missingOrders: missingOrders.slice(0, 50),
    },
  });

  return {
    updated,
    skipped,
    missingOrders,
  };
}

export async function getOneCLoyaltyProfile(params: {
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const db = getDb();
  const user = await db.user.findFirst({
    where: {
      OR: [
        params.userId ? { id: params.userId } : null,
        params.email ? { email: params.email } : null,
        params.phone ? { phone: params.phone } : null,
      ].filter(Boolean) as Prisma.UserWhereInput[],
    },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      companyName: true,
      loyaltyTier: true,
      plateMaterialLoyaltyTier: true,
      fittingsLoyaltyTier: true,
      loyaltyPointsBalance: true,
      loyaltyPointsLifetime: true,
      personalDiscountPercent: true,
      loyaltyTransactions: {
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          points: true,
          balanceAfter: true,
          title: true,
          description: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  return {
    ...user,
    loyaltyTransactions: user.loyaltyTransactions.map((transaction) => ({
      ...transaction,
      createdAt: transaction.createdAt.toISOString(),
    })),
  };
}

export async function syncOneCLoyalty(
  input: z.output<typeof oneCLoyaltySyncSchema>,
) {
  const db = getDb();
  let updated = 0;
  let skipped = 0;
  const missingUsers: string[] = [];

  for (const operation of input.operations) {
    const externalId = operation.externalId
      ? `1c:${input.source ?? "default"}:${operation.externalId}`
      : null;
    if (externalId) {
      const existingOperation = await db.loyaltyTransaction.findUnique({
        where: { externalId },
        select: { id: true },
      });

      if (existingOperation) {
        skipped += 1;
        continue;
      }
    }

    const user = await db.user.findFirst({
      where: {
        OR: [
          operation.userId ? { id: operation.userId } : null,
          operation.email ? { email: operation.email } : null,
          operation.phone ? { phone: operation.phone } : null,
        ].filter(Boolean) as Prisma.UserWhereInput[],
      },
      select: {
        id: true,
        loyaltyPointsBalance: true,
        loyaltyPointsLifetime: true,
      },
    });

    if (!user) {
      skipped += 1;
      missingUsers.push(
        operation.userId ?? operation.email ?? operation.phone ?? "unknown",
      );
      continue;
    }

    await db.$transaction((tx) =>
      applyApprovedLoyaltyDelta(tx, {
        userId: user.id,
        type: LoyaltyTransactionType.MANUAL_ADJUSTMENT,
        points: operation.pointsDelta,
        externalId,
        title: operation.title ?? "1C loyalty adjustment",
        description:
          operation.description ??
          (operation.externalId
            ? `1C operation: ${operation.externalId}`
            : null),
      }),
    );

    updated += 1;
  }

  if (updated > 0) {
    revalidatePath("/admin/users");
    revalidatePath("/account");
  }

  await logOneCNotification({
    title: "1C loyalty sync",
    message: `Loyalty operations applied: ${updated}; skipped: ${skipped}.`,
    payload: {
      source: input.source ?? null,
      received: input.operations.length,
      updated,
      skipped,
      missingUsers: missingUsers.slice(0, 50),
    },
  });

  return {
    updated,
    skipped,
    missingUsers,
  };
}

export function parseDateParam(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseTakeParam(
  value: string | null,
  fallback: number,
  max: number,
) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export function parseOrderStatusParam(value: string | null) {
  if (!value) {
    return null;
  }

  return Object.values(OrderStatus).includes(value as OrderStatus)
    ? (value as OrderStatus)
    : null;
}

function getInventoryStatusFromStock(stockQuantity: number | null) {
  if (stockQuantity === null) {
    return InventoryStatus.ON_REQUEST;
  }

  if (stockQuantity <= 0) {
    return InventoryStatus.OUT_OF_STOCK;
  }

  return stockQuantity <= 5
    ? InventoryStatus.LIMITED
    : InventoryStatus.IN_STOCK;
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function logOneCNotification(params: {
  title: string;
  message: string;
  payload: Record<string, unknown>;
}) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await getDb()
    .notification.create({
      data: {
        channel: NotificationChannel.INTERNAL,
        status: NotificationStatus.SENT,
        title: params.title,
        message: params.message,
        payload: params.payload as Prisma.InputJsonValue,
        sentAt: new Date(),
      },
    })
    .catch((error) => console.error("[1c:notification]", error));
}
