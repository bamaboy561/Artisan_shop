import {
  InventoryStatus,
  ProductOrderMode,
  ProductStatus,
  type Prisma,
} from "@/generated/prisma";

export type InventoryReservationItem = {
  productId: string | null;
  quantity: number;
  name: string;
};

type ReservationOptions = {
  requireOnlineAvailability?: boolean;
};

export class InventoryAvailabilityError extends Error {
  constructor(
    public readonly productName: string,
    public readonly requestedQuantity: number,
    public readonly availableQuantity: number,
  ) {
    super(
      availableQuantity > 0
        ? `Недостаточно товара «${productName}». Доступно ${availableQuantity} шт., запрошено ${requestedQuantity} шт.`
        : `Товар «${productName}» закончился. Удалите его из корзины или свяжитесь с менеджером.`,
    );
    this.name = "InventoryAvailabilityError";
  }
}

function aggregateItems(items: InventoryReservationItem[]) {
  const result = new Map<
    string,
    { productId: string; quantity: number; name: string }
  >();

  for (const item of items) {
    if (!item.productId || item.quantity <= 0) {
      continue;
    }

    const existing = result.get(item.productId);
    result.set(item.productId, {
      productId: item.productId,
      quantity: (existing?.quantity ?? 0) + item.quantity,
      name: existing?.name ?? item.name,
    });
  }

  return result;
}

function getInventoryStatus(stockQuantity: number) {
  if (stockQuantity <= 0) {
    return InventoryStatus.OUT_OF_STOCK;
  }

  return stockQuantity <= 5
    ? InventoryStatus.LIMITED
    : InventoryStatus.IN_STOCK;
}

async function syncProductInventoryStatus(
  tx: Prisma.TransactionClient,
  productId: string,
) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { stockQuantity: true, inventoryStatus: true },
  });

  if (product?.stockQuantity === null || product?.stockQuantity === undefined) {
    return;
  }

  const inventoryStatus = getInventoryStatus(product.stockQuantity);
  if (inventoryStatus !== product.inventoryStatus) {
    await tx.product.update({
      where: { id: productId },
      data: { inventoryStatus },
    });
  }
}

export async function reserveInventoryItems(
  tx: Prisma.TransactionClient,
  items: InventoryReservationItem[],
  options: ReservationOptions = {},
) {
  for (const item of aggregateItems(items).values()) {
    const availabilityWhere = options.requireOnlineAvailability
      ? {
          status: ProductStatus.ACTIVE,
          orderMode: ProductOrderMode.CART,
        }
      : {
          status: { not: ProductStatus.ARCHIVED },
        };
    const reserved = await tx.product.updateMany({
      where: {
        id: item.productId,
        ...availabilityWhere,
        stockQuantity: { gte: item.quantity },
      },
      data: {
        stockQuantity: { decrement: item.quantity },
      },
    });

    if (reserved.count === 0) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: {
          name: true,
          stockQuantity: true,
          status: true,
          orderMode: true,
        },
      });
      const isAvailableForChannel =
        product &&
        product.status !== ProductStatus.ARCHIVED &&
        (!options.requireOnlineAvailability ||
          (product.status === ProductStatus.ACTIVE &&
            product.orderMode === ProductOrderMode.CART));

      // A null stock value means that this product is not quantity-tracked.
      if (isAvailableForChannel && product.stockQuantity === null) {
        continue;
      }

      throw new InventoryAvailabilityError(
        product?.name ?? item.name,
        item.quantity,
        Math.max(0, product?.stockQuantity ?? 0),
      );
    }

    await syncProductInventoryStatus(tx, item.productId);
  }
}

export async function releaseInventoryItems(
  tx: Prisma.TransactionClient,
  items: InventoryReservationItem[],
) {
  for (const item of aggregateItems(items).values()) {
    const released = await tx.product.updateMany({
      where: {
        id: item.productId,
        stockQuantity: { not: null },
      },
      data: {
        stockQuantity: { increment: item.quantity },
      },
    });

    if (released.count > 0) {
      await syncProductInventoryStatus(tx, item.productId);
    }
  }
}

export async function adjustInventoryReservation(
  tx: Prisma.TransactionClient,
  previousItems: InventoryReservationItem[],
  nextItems: InventoryReservationItem[],
) {
  const previous = aggregateItems(previousItems);
  const next = aggregateItems(nextItems);
  const productIds = new Set([...previous.keys(), ...next.keys()]);
  const additions: InventoryReservationItem[] = [];
  const releases: InventoryReservationItem[] = [];

  for (const productId of productIds) {
    const previousItem = previous.get(productId);
    const nextItem = next.get(productId);
    const delta = (nextItem?.quantity ?? 0) - (previousItem?.quantity ?? 0);

    if (delta > 0) {
      additions.push({
        productId,
        quantity: delta,
        name: nextItem?.name ?? previousItem?.name ?? productId,
      });
    } else if (delta < 0) {
      releases.push({
        productId,
        quantity: Math.abs(delta),
        name: previousItem?.name ?? nextItem?.name ?? productId,
      });
    }
  }

  // Reserve additions first. Any shortage rolls back the entire order edit.
  await reserveInventoryItems(tx, additions);
  await releaseInventoryItems(tx, releases);
}

export async function syncOrderInventoryReservation(
  tx: Prisma.TransactionClient,
  orderId: string,
  shouldReserve: boolean,
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      inventoryReservedAt: true,
      items: {
        select: {
          productId: true,
          quantity: true,
          snapshotName: true,
        },
      },
    },
  });

  if (!order || Boolean(order.inventoryReservedAt) === shouldReserve) {
    return false;
  }

  const claimed = await tx.order.updateMany({
    where: {
      id: orderId,
      inventoryReservedAt: shouldReserve ? null : { not: null },
    },
    data: {
      inventoryReservedAt: shouldReserve ? new Date() : null,
    },
  });

  if (claimed.count === 0) {
    return false;
  }

  if (shouldReserve) {
    await reserveInventoryItems(
      tx,
      order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        name: item.snapshotName,
      })),
    );
  } else {
    await releaseInventoryItems(
      tx,
      order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        name: item.snapshotName,
      })),
    );
  }

  return true;
}
