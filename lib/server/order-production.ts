import { OrderStatus } from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";

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

  return getDb().order.update({
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
}
