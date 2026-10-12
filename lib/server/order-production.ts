import { OrderStatus } from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { syncOrderInventoryReservation } from "@/lib/server/inventory-reservations";
import { cancelOrderLoyaltyTransactions } from "@/lib/server/order-loyalty-cancellation";

type ActorSnapshot = {
  userId?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type OrderNoteInput = {
  orderId: string;
  body: string;
  isVisibleToClient: boolean;
  actor: ActorSnapshot;
};

type OrderFulfillmentInput = {
  orderId: string;
  productionDueAt?: Date | null;
  fulfillmentComment?: string | null;
  status?: OrderStatus | null;
  actorId?: string | null;
};

function getActorName(actor: ActorSnapshot) {
  return (
    [actor.firstName, actor.lastName].filter(Boolean).join(" ") ||
    actor.email ||
    "Менеджер Artisan"
  );
}

function getStatusTimestamps(status?: OrderStatus | null) {
  if (!status) {
    return {};
  }

  const now = new Date();

  if (status === OrderStatus.READY_FOR_PICKUP) {
    return { readyAt: now };
  }

  if (status === OrderStatus.COMPLETED) {
    return { completedAt: now };
  }

  return {};
}

export async function addOrderManagerNote(input: OrderNoteInput) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  return getDb().managerNote.create({
    data: {
      entityType: "order",
      entityId: input.orderId,
      orderId: input.orderId,
      body: input.body,
      isVisibleToClient: input.isVisibleToClient,
      authorId: input.actor.userId ?? null,
      authorName: getActorName(input.actor),
    },
  });
}

export async function updateOrderFulfillment(input: OrderFulfillmentInput) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  return getDb().$transaction(async (tx) => {
    await tx.order.update({
      where: { id: input.orderId },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

    const currentOrder = await tx.order.findUniqueOrThrow({
      where: { id: input.orderId },
      select: { status: true },
    });
    let loyaltyCancellation = null;

    if (
      currentOrder.status !== OrderStatus.CANCELED &&
      input.status === OrderStatus.CANCELED
    ) {
      await syncOrderInventoryReservation(tx, input.orderId, false);
      loyaltyCancellation = await cancelOrderLoyaltyTransactions(
        tx,
        input.orderId,
        input.actorId ?? null,
      );
    } else if (
      currentOrder.status === OrderStatus.CANCELED &&
      input.status &&
      input.status !== OrderStatus.CANCELED
    ) {
      await syncOrderInventoryReservation(tx, input.orderId, true);
    }

    const order = await tx.order.update({
      where: { id: input.orderId },
      data: {
        productionDueAt: input.productionDueAt ?? null,
        fulfillmentComment: input.fulfillmentComment ?? null,
        ...(input.status ? { status: input.status } : {}),
        ...getStatusTimestamps(input.status),
      },
      select: {
        id: true,
        number: true,
        status: true,
        productionDueAt: true,
        readyAt: true,
        completedAt: true,
        fulfillmentComment: true,
      },
    });

    return { ...order, loyaltyCancellation };
  });
}
