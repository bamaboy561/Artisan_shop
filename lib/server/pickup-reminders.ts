import "server-only";

import { CuttingStage, OrderStatus, RequestStatus } from "@/generated/prisma";
import { ATTENTION_RULES } from "@/features/admin/attention";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { sendClientDirectMessage } from "@/lib/server/client-notifications";
import { logOperationEvent } from "@/lib/server/operation-events";

// Напоминание клиенту: заказ или распил готов и ждёт выдачи дольше трёх
// дней. По каждому заказу напоминаем один раз; отметка об этом лежит в
// настройках сайта, отдельная таблица не нужна.
const KEY_PREFIX = "pickup-reminder:";
const MAX_PER_RUN = 50;

type Candidate = {
  key: string;
  entityType: "order" | "request";
  id: string;
  userId: string | null;
  title: string;
  accountPath: string;
};

export async function sendPickupReminders(now = new Date()) {
  const result = { sent: 0, unreachable: 0 };

  if (!hasDatabaseUrl()) {
    return result;
  }

  const db = getDb();
  const cutoff = new Date(
    now.getTime() - ATTENTION_RULES.uncollectedOrderHours * 3_600_000,
  );
  const [orders, requests] = await Promise.all([
    db.order.findMany({
      where: {
        status: OrderStatus.READY_FOR_PICKUP,
        updatedAt: { lt: cutoff },
      },
      orderBy: { updatedAt: "asc" },
      take: MAX_PER_RUN,
      select: { id: true, number: true, userId: true },
    }),
    db.request.findMany({
      where: {
        cuttingStage: CuttingStage.READY_FOR_PICKUP,
        cuttingStageUpdatedAt: { lt: cutoff },
        status: { notIn: [RequestStatus.COMPLETED, RequestStatus.CANCELED] },
      },
      orderBy: { cuttingStageUpdatedAt: "asc" },
      take: MAX_PER_RUN,
      select: { id: true, number: true, userId: true },
    }),
  ]);
  const candidates: Candidate[] = [
    ...orders.map((order) => ({
      key: `${KEY_PREFIX}order:${order.id}`,
      entityType: "order" as const,
      id: order.id,
      userId: order.userId,
      title: `Заказ ${order.number ?? ""} ждёт вас`.replace("  ", " "),
      accountPath: "/account/orders",
    })),
    ...requests.map((request) => ({
      key: `${KEY_PREFIX}request:${request.id}`,
      entityType: "request" as const,
      id: request.id,
      userId: request.userId,
      title: `Распил ${request.number ?? ""} ждёт вас`.replace("  ", " "),
      accountPath: "/account/requests",
    })),
  ];

  if (candidates.length === 0) {
    return result;
  }

  const alreadyReminded = new Set(
    (
      await db.siteSetting.findMany({
        where: { key: { in: candidates.map((item) => item.key) } },
        select: { key: true },
      })
    ).map((item) => item.key),
  );

  for (const item of candidates) {
    if (alreadyReminded.has(item.key)) continue;

    let delivered = false;

    if (item.userId) {
      const delivery = await sendClientDirectMessage(item.userId, {
        title: item.title,
        category: item.entityType === "order" ? "orders" : "requests",
        lines: [
          "Он готов и лежит на выдаче уже несколько дней.",
          "Заберите его, пожалуйста, в рабочее время.",
        ],
        actions: [{ text: "Открыть", url: item.accountPath }],
      });

      delivered = Boolean(delivery.telegramSent) || delivery.push.sent > 0;
    }

    // Отметку ставим в любом случае, чтобы не пытаться каждый день заново.
    await db.siteSetting.upsert({
      where: { key: item.key },
      create: {
        key: item.key,
        value: { remindedAt: now.toISOString(), delivered },
        description: "Напоминание клиенту о готовом заказе",
      },
      update: { value: { remindedAt: now.toISOString(), delivered } },
    });

    await logOperationEvent({
      entityType: item.entityType,
      entityId: item.id,
      eventType: "system",
      title: delivered
        ? "Клиенту отправлено напоминание забрать заказ"
        : "Напомнить клиенту не удалось: у него нет Telegram и уведомлений сайта",
      description: null,
      actorName: "Сайт",
      isVisibleToClient: false,
    }).catch((error) => console.error("[pickup-reminder:log]", error));

    if (delivered) {
      result.sent += 1;
    } else {
      result.unreachable += 1;
    }
  }

  return result;
}
