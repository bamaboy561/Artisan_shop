import "server-only";

import { CuttingStage, OrderStatus, RequestStatus } from "@/generated/prisma";
import { ATTENTION_RULES } from "@/features/admin/attention";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";
import { sendClientDirectMessage } from "@/lib/server/client-notifications";
import { sendCustomerEmail } from "@/lib/server/customer-email";
import { logOperationEvent } from "@/lib/server/operation-events";

// Напоминание клиенту: заказ или распил готов и ждёт выдачи дольше трёх
// дней. По каждому заказу напоминаем один раз; отметка об этом лежит в
// настройках сайта, отдельная таблица не нужна. Заказы, готовые дольше двух
// недель, не трогаем: иначе первый запуск напомнит о давно забытых статусах,
// а уже напомненные старые заказы займут всю выборку и новые не попадут в неё.
const KEY_PREFIX = "pickup-reminder:";
const MAX_PER_RUN = 200;
const SKIP_OLDER_THAN_HOURS = 14 * 24;

type Candidate = {
  key: string;
  entityType: "order" | "request";
  id: string;
  userId: string | null;
  contactName: string;
  contactEmail: string | null;
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
  const oldest = new Date(now.getTime() - SKIP_OLDER_THAN_HOURS * 3_600_000);
  const readyWindow = { lt: cutoff, gte: oldest };
  const [orders, requests] = await Promise.all([
    db.order.findMany({
      where: {
        status: OrderStatus.READY_FOR_PICKUP,
        OR: [
          { readyAt: readyWindow },
          { readyAt: null, updatedAt: readyWindow },
        ],
      },
      orderBy: { updatedAt: "asc" },
      take: MAX_PER_RUN,
      select: {
        id: true,
        number: true,
        userId: true,
        contactName: true,
        contactEmail: true,
      },
    }),
    db.request.findMany({
      where: {
        cuttingStage: CuttingStage.READY_FOR_PICKUP,
        cuttingStageUpdatedAt: readyWindow,
        status: { notIn: [RequestStatus.COMPLETED, RequestStatus.CANCELED] },
      },
      orderBy: { cuttingStageUpdatedAt: "asc" },
      take: MAX_PER_RUN,
      select: {
        id: true,
        number: true,
        userId: true,
        contactName: true,
        contactEmail: true,
      },
    }),
  ]);
  const candidates: Candidate[] = [
    ...orders.map((order) => ({
      key: `${KEY_PREFIX}order:${order.id}`,
      entityType: "order" as const,
      id: order.id,
      userId: order.userId,
      contactName: order.contactName,
      contactEmail: order.contactEmail,
      title: `Заказ ${order.number ?? ""} ждёт вас`.replace("  ", " "),
      accountPath: "/account/orders",
    })),
    ...requests.map((request) => ({
      key: `${KEY_PREFIX}request:${request.id}`,
      entityType: "request" as const,
      id: request.id,
      userId: request.userId,
      contactName: request.contactName,
      contactEmail: request.contactEmail,
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

    // Гостю без Telegram и уведомлений пишем на email, если он его оставил.
    if (!delivered && item.contactEmail) {
      try {
        delivered = await sendCustomerEmail({
          to: item.contactEmail,
          subject: item.title,
          greeting: `Здравствуйте, ${item.contactName}!`,
          lines: [
            "Ваш заказ готов и лежит на выдаче уже несколько дней.",
            "Заберите его, пожалуйста, в рабочее время.",
          ],
          action: { text: "Открыть", url: absoluteUrl(item.accountPath) },
        });
      } catch (error) {
        console.error("[pickup-reminder:email]", error);
      }
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
        : "Напомнить клиенту не удалось: у него нет Telegram, уведомлений сайта и email",
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
