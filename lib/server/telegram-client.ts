import "server-only";

import { createHash, randomBytes } from "node:crypto";

import {
  LoyaltyTransactionStatus,
  LoyaltyTransactionType,
  OrderStatus,
  PaymentStatus,
  RequestStatus,
} from "@/generated/prisma";
import { formatPrice } from "@/lib/commerce";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { getLoyaltyProgramConfig } from "@/lib/server/loyalty-settings";
import { absoluteUrl } from "@/lib/seo";
import {
  getEffectiveDiscountPercent,
  getLoyaltyProgress,
  getLoyaltyTierLabel,
} from "@/lib/server/pricing";

type TelegramChat = {
  id: number | string;
  type?: string;
};

type TelegramUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramMessage = {
  text?: string;
  chat?: TelegramChat;
  from?: TelegramUser;
};

export type TelegramUpdate = {
  message?: TelegramMessage;
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramWebhookInfo = {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
};

type TelegramReplyMarkup = {
  keyboard: string[][];
  resize_keyboard: boolean;
  is_persistent?: boolean;
  input_field_placeholder?: string;
};

type SendTelegramDirectMessageOptions = {
  replyMarkup?: TelegramReplyMarkup;
};

const linkLifetimeMs = 30 * 60 * 1000;

const orderStatusLabels: Record<OrderStatus, string> = {
  NEW: "Новый",
  CONFIRMED: "Подтвержден",
  IN_PRODUCTION: "В производстве",
  READY_FOR_PICKUP: "Готов к выдаче",
  SHIPPED: "Отгружен",
  COMPLETED: "Завершен",
  CANCELED: "Отменен",
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  WAITING_PAYMENT: "Ждет оплату",
  PAID: "Оплачен",
  PARTIAL: "Частично оплачен",
  REFUNDED: "Возврат",
  CANCELED: "Оплата отменена",
};

const requestStatusLabels: Record<RequestStatus, string> = {
  NEW: "Новая",
  IN_REVIEW: "На расчете",
  QUOTE_SENT: "КП отправлено",
  WAITING_FOR_CLIENT: "Ждем клиента",
  IN_PROGRESS: "В работе",
  COMPLETED: "Завершена",
  CANCELED: "Отменена",
};

function hashTelegramToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getBotUsername() {
  return (
    process.env.TELEGRAM_BOT_USERNAME ??
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ??
    "artisan_sales_bot"
  )
    .trim()
    .replace(/^@/, "");
}

function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

function getTelegramWebhookSecret() {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
}

function getTelegramWebhookUrl() {
  return absoluteUrl("/api/telegram");
}

function getTelegramChatId(chat: TelegramChat) {
  return String(chat.id);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
  );
}

function getCommand(text: string) {
  const [rawCommand, ...args] = text.trim().split(/\s+/);
  const command = rawCommand.toLowerCase().split("@")[0];

  return {
    command,
    args,
    normalizedText: text.trim().toLowerCase(),
  };
}

function getClientMenuKeyboard(): TelegramReplyMarkup {
  return {
    keyboard: [
      ["Мои бонусы", "Мои заказы"],
      ["Мои заявки", "Помощь"],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: "Выберите раздел",
  };
}

function buildHelpMessage() {
  return [
    "Artisan бот подключен к вашему личному кабинету.",
    "",
    "Выберите нужный раздел кнопками ниже:",
    "Мои бонусы - баллы, уровень и скидка",
    "Мои заказы - последние покупки и статусы",
    "Мои заявки - расчеты и распил",
  ].join("\n");
}

export async function sendTelegramDirectMessage(
  chatId: string,
  text: string,
  options: SendTelegramDirectMessageOptions = {},
) {
  const token = getTelegramBotToken();

  if (!token) {
    return { ok: false, message: "TELEGRAM_BOT_TOKEN is not configured." };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
          reply_markup: options.replyMarkup ?? getClientMenuKeyboard(),
        }),
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        message: `Telegram API error: ${response.status} ${await response.text()}`,
      };
    }

    return { ok: true, message: "sent" };
  } catch (error) {
    return {
      ok: false,
      message: `Telegram request failed: ${getErrorMessage(error)}`,
    };
  }
}

async function callTelegramApi<T>(
  method: string,
  payload?: Record<string, unknown>,
) {
  const token = getTelegramBotToken();

  if (!token) {
    return {
      ok: false,
      description: "TELEGRAM_BOT_TOKEN is not configured.",
    } satisfies TelegramApiResponse<T>;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload ?? {}),
      },
    );
    const data = (await response
      .json()
      .catch(() => null)) as TelegramApiResponse<T> | null;

    if (!response.ok || !data?.ok) {
      return {
        ok: false,
        description:
          data?.description ??
          `Telegram API error: ${response.status} ${response.statusText}`,
      } satisfies TelegramApiResponse<T>;
    }

    return data;
  } catch (error) {
    return {
      ok: false,
      description: `Telegram request failed: ${getErrorMessage(error)}`,
    } satisfies TelegramApiResponse<T>;
  }
}

export async function getTelegramWebhookStatus() {
  const expectedUrl = getTelegramWebhookUrl();
  const response = await callTelegramApi<TelegramWebhookInfo>("getWebhookInfo");

  if (!response.ok || !response.result) {
    return {
      ok: false,
      expectedUrl,
      currentUrl: "",
      isConfigured: false,
      pendingUpdateCount: 0,
      lastErrorMessage:
        response.description ?? "Telegram webhook is unavailable.",
      hasSecret: Boolean(getTelegramWebhookSecret()),
    };
  }

  return {
    ok: true,
    expectedUrl,
    currentUrl: response.result.url,
    isConfigured: response.result.url === expectedUrl,
    pendingUpdateCount: response.result.pending_update_count,
    lastErrorMessage: response.result.last_error_message ?? null,
    hasSecret: Boolean(getTelegramWebhookSecret()),
  };
}

export async function configureTelegramWebhook() {
  const webhookUrl = getTelegramWebhookUrl();
  const secret = getTelegramWebhookSecret();
  const response = await callTelegramApi<boolean>("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message"],
    drop_pending_updates: false,
    ...(secret ? { secret_token: secret } : {}),
  });

  if (response.ok) {
    await callTelegramApi<boolean>("setMyCommands", {
      commands: [
        {
          command: "bonus",
          description: "Мои бонусы, уровень и скидка",
        },
        {
          command: "orders",
          description: "Мои заказы и покупки",
        },
        {
          command: "requests",
          description: "Мои заявки и распил",
        },
        {
          command: "help",
          description: "Показать меню",
        },
      ],
    });
  }

  return {
    ok: response.ok,
    webhookUrl,
    message: response.ok
      ? "Telegram webhook настроен."
      : (response.description ?? "Не удалось настроить Telegram webhook."),
  };
}

export async function createTelegramLinkForUser(userId: string) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashTelegramToken(token);
  const expiresAt = new Date(Date.now() + linkLifetimeMs);

  await getDb().user.update({
    where: { id: userId },
    data: {
      telegramLinkTokenHash: tokenHash,
      telegramLinkTokenExpiresAt: expiresAt,
    },
  });

  return {
    url: `https://t.me/${getBotUsername()}?start=${token}`,
    expiresAt,
  };
}

export async function disconnectTelegramForUser(userId: string) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await getDb().user.update({
    where: { id: userId },
    data: {
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkedAt: null,
      telegramLinkTokenHash: null,
      telegramLinkTokenExpiresAt: null,
    },
  });
}

async function consumeTelegramLinkToken(params: {
  token: string;
  chatId: string;
  username?: string | null;
}) {
  const tokenHash = hashTelegramToken(params.token);
  const db = getDb();
  const user = await db.user.findFirst({
    where: {
      telegramLinkTokenHash: tokenHash,
      telegramLinkTokenExpiresAt: {
        gt: new Date(),
      },
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    return null;
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      telegramChatId: params.chatId,
      telegramUsername: params.username ?? null,
      telegramLinkedAt: new Date(),
      telegramLinkTokenHash: null,
      telegramLinkTokenExpiresAt: null,
    },
  });

  return user;
}

async function getTelegramUserByChatId(chatId: string) {
  return getDb().user.findUnique({
    where: { telegramChatId: chatId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      loyaltyTier: true,
      loyaltyPointsBalance: true,
      loyaltyPointsLifetime: true,
      personalDiscountPercent: true,
      orders: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          number: true,
          status: true,
          total: true,
          createdAt: true,
        },
      },
      requests: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          number: true,
          status: true,
          subject: true,
          createdAt: true,
        },
      },
    },
  });
}

async function buildBonusMessage(chatId: string) {
  const [user, loyaltyConfig] = await Promise.all([
    getTelegramUserByChatId(chatId),
    getLoyaltyProgramConfig(),
  ]);

  if (!user) {
    return "Telegram пока не привязан. Откройте личный кабинет Artisan и нажмите «Подключить Telegram».";
  }

  const progress = getLoyaltyProgress(
    user.loyaltyPointsLifetime,
    user.loyaltyTier,
    loyaltyConfig,
  );
  const nextTier = progress.nextTier
    ? getLoyaltyTierLabel(progress.nextTier, loyaltyConfig)
    : "максимальный уровень";

  return [
    `Личный кабинет Artisan: ${getDisplayName(user)}`,
    `Уровень: ${getLoyaltyTierLabel(user.loyaltyTier, loyaltyConfig)}`,
    `Баланс: ${user.loyaltyPointsBalance} баллов`,
    `Накоплено: ${user.loyaltyPointsLifetime} баллов`,
    `Скидка: ${getEffectiveDiscountPercent(user, loyaltyConfig)}%`,
    progress.nextTier
      ? `До уровня ${nextTier}: ${progress.pointsToNext} баллов`
      : "Вы уже на максимальном уровне.",
  ].join("\n");
}

async function buildOrdersMessage(chatId: string) {
  const user = await getTelegramUserByChatId(chatId);

  if (!user) {
    return "Telegram пока не привязан. Подключите его в личном кабинете Artisan.";
  }

  if (user.orders.length === 0) {
    return "У вас пока нет заказов в личном кабинете.";
  }

  return [
    "Последние заказы Artisan:",
    ...user.orders.map((order) =>
      [
        `${order.number ?? "Без номера"} - ${orderStatusLabels[order.status]}`,
        `Сумма: ${formatPrice(order.total)}`,
      ].join("\n"),
    ),
  ].join("\n\n");
}

async function buildRequestsMessage(chatId: string) {
  const user = await getTelegramUserByChatId(chatId);

  if (!user) {
    return "Telegram пока не привязан. Подключите его в личном кабинете Artisan.";
  }

  if (user.requests.length === 0) {
    return "У вас пока нет заявок на расчет или распил.";
  }

  return [
    "Последние заявки Artisan:",
    ...user.requests.map((request) =>
      [
        `${request.number ?? "Без номера"} - ${requestStatusLabels[request.status]}`,
        request.subject,
      ].join("\n"),
    ),
  ].join("\n\n");
}

export async function handleTelegramClientUpdate(update: TelegramUpdate) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const message = update.message;

  if (!message?.chat || !message.text) {
    return;
  }

  const chatId = getTelegramChatId(message.chat);

  if (message.chat.type && message.chat.type !== "private") {
    return;
  }

  const { command, args, normalizedText } = getCommand(message.text);

  if (command === "/start" && args[0]) {
    const linkedUser = await consumeTelegramLinkToken({
      token: args[0],
      chatId,
      username: message.from?.username ?? null,
    });

    await sendTelegramDirectMessage(
      chatId,
      linkedUser
        ? `Telegram подключен к кабинету Artisan: ${getDisplayName(linkedUser)}.\n\n${await buildBonusMessage(chatId)}`
        : "Ссылка для подключения устарела или уже использована. Создайте новую ссылку в личном кабинете Artisan.",
    );
    return;
  }

  if (
    command === "/start" ||
    command === "/help" ||
    normalizedText.includes("помощ")
  ) {
    await sendTelegramDirectMessage(chatId, buildHelpMessage());
    return;
  }

  if (
    command === "/bonus" ||
    command === "/status" ||
    normalizedText.includes("бонус")
  ) {
    await sendTelegramDirectMessage(chatId, await buildBonusMessage(chatId));
    return;
  }

  if (command === "/orders" || normalizedText.includes("заказ")) {
    await sendTelegramDirectMessage(chatId, await buildOrdersMessage(chatId));
    return;
  }

  if (command === "/requests" || normalizedText.includes("заявк")) {
    await sendTelegramDirectMessage(chatId, await buildRequestsMessage(chatId));
    return;
  }

  await sendTelegramDirectMessage(chatId, buildHelpMessage());
}

export async function notifyTelegramClientOrderCreated(orderId: string) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const order = await getDb().order.findUnique({
    where: { id: orderId },
    select: {
      number: true,
      status: true,
      paymentStatus: true,
      total: true,
      items: {
        select: {
          quantity: true,
          snapshotName: true,
          snapshotSku: true,
          total: true,
        },
        take: 10,
      },
      loyaltyTransactions: {
        where: {
          points: {
            gt: 0,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          points: true,
          status: true,
        },
      },
      user: {
        select: {
          telegramChatId: true,
        },
      },
    },
  });

  if (!order?.user?.telegramChatId) {
    return;
  }

  const itemLines = order.items.slice(0, 8).map((item, i) =>
    `${i + 1}. ${item.snapshotName} × ${item.quantity} — ${formatPrice(Math.round(item.total))}`
  );

  await sendTelegramDirectMessage(
    order.user.telegramChatId,
    [
      order.status === OrderStatus.COMPLETED
        ? `Покупка ${order.number ?? ""} сохранена в личном кабинете.`
        : `Заказ ${order.number ?? ""} принят.`,
      `Статус: ${orderStatusLabels[order.status]}`,
      `Оплата: ${paymentStatusLabels[order.paymentStatus]}`,
      "",
      `Состав заказа (${order.items.length} поз.):`,
      ...itemLines,
      order.items.length > 8 ? `и ещё ${order.items.length - 8} поз.` : "",
      "",
      `Сумма: ${formatPrice(order.total)}`,
      order.loyaltyTransactions[0]
        ? `Бонусы: +${order.loyaltyTransactions[0].points} ${order.loyaltyTransactions[0].status === LoyaltyTransactionStatus.APPROVED ? "начислены" : "ожидают подтверждения"}`
        : "",
      "Нажмите «Мои заказы» или «Мои бонусы» в меню ниже.",
    ].filter(Boolean).join("\n"),
  );
}

export async function notifyTelegramClientOrderStatus(orderId: string) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const order = await getDb().order.findUnique({
    where: { id: orderId },
    select: {
      number: true,
      status: true,
      paymentStatus: true,
      total: true,
      user: {
        select: {
          telegramChatId: true,
        },
      },
    },
  });

  if (!order?.user?.telegramChatId) {
    return;
  }

  await sendTelegramDirectMessage(
    order.user.telegramChatId,
    [
      `Статус заказа ${order.number ?? ""} изменился.`,
      `Теперь: ${orderStatusLabels[order.status]}`,
      `Оплата: ${paymentStatusLabels[order.paymentStatus]}`,
      `Сумма: ${formatPrice(order.total)}`,
      order.status === OrderStatus.READY_FOR_PICKUP
        ? "Заказ готов к выдаче. Менеджер подскажет детали получения."
        : "",
      order.status === OrderStatus.COMPLETED
        ? "Заказ завершен. Бонусы будут доступны после подтверждения."
        : "",
    ].join("\n"),
  );
}

export async function notifyTelegramClientRequestCreated(requestId: string) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const request = await getDb().request.findUnique({
    where: { id: requestId },
    select: {
      number: true,
      status: true,
      subject: true,
      user: {
        select: {
          telegramChatId: true,
        },
      },
    },
  });

  if (!request?.user?.telegramChatId) {
    return;
  }

  await sendTelegramDirectMessage(
    request.user.telegramChatId,
    [
      `Заявка ${request.number ?? ""} принята.`,
      `Тема: ${request.subject}`,
      `Статус: ${requestStatusLabels[request.status]}`,
      "Нажмите «Мои заявки» в меню ниже, чтобы посмотреть статус.",
    ].join("\n"),
  );
}

export async function notifyTelegramClientRequestStatus(requestId: string) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const request = await getDb().request.findUnique({
    where: { id: requestId },
    select: {
      number: true,
      status: true,
      subject: true,
      quotedTotal: true,
      user: {
        select: {
          telegramChatId: true,
        },
      },
    },
  });

  if (!request?.user?.telegramChatId) {
    return;
  }

  await sendTelegramDirectMessage(
    request.user.telegramChatId,
    [
      `Статус заявки ${request.number ?? ""} изменился.`,
      `Тема: ${request.subject}`,
      `Теперь: ${requestStatusLabels[request.status]}`,
      request.quotedTotal
        ? `Сумма расчета: ${formatPrice(request.quotedTotal)}`
        : "",
      request.status === RequestStatus.QUOTE_SENT
        ? "Коммерческое предложение подготовлено. Проверьте детали у менеджера."
        : "",
      request.status === RequestStatus.COMPLETED ? "Заявка завершена." : "",
      "Нажмите «Мои заявки» в меню ниже, чтобы посмотреть последние обращения.",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function getLoyaltyStatusLabel(status: LoyaltyTransactionStatus) {
  const labels: Record<LoyaltyTransactionStatus, string> = {
    [LoyaltyTransactionStatus.PENDING]: "ожидают подтверждения",
    [LoyaltyTransactionStatus.APPROVED]: "начислены",
    [LoyaltyTransactionStatus.CANCELED]: "отменены",
  };

  return labels[status];
}

function getLoyaltyTypeLabel(type: LoyaltyTransactionType) {
  const labels: Record<LoyaltyTransactionType, string> = {
    [LoyaltyTransactionType.ORDER_ACCRUAL]: "Покупка",
    [LoyaltyTransactionType.BONUS_ACCRUAL]: "Бонус",
    [LoyaltyTransactionType.REDEMPTION]: "Списание",
    [LoyaltyTransactionType.MANUAL_ADJUSTMENT]: "Корректировка",
  };

  return labels[type];
}

export async function notifyTelegramClientLoyaltyTransaction(
  transactionId: string,
) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const transaction = await getDb().loyaltyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      type: true,
      status: true,
      points: true,
      balanceAfter: true,
      title: true,
      description: true,
      order: {
        select: {
          number: true,
        },
      },
      user: {
        select: {
          telegramChatId: true,
        },
      },
    },
  });

  if (!transaction?.user.telegramChatId) {
    return;
  }

  const isRedemption =
    transaction.type === LoyaltyTransactionType.REDEMPTION ||
    transaction.points < 0;
  const pointsText = `${transaction.points > 0 ? "+" : ""}${transaction.points}`;

  await sendTelegramDirectMessage(
    transaction.user.telegramChatId,
    [
      isRedemption ? "Обновление бонусного баланса." : "Бонусы Artisan.",
      `${getLoyaltyTypeLabel(transaction.type)}: ${transaction.title}`,
      `Баллы: ${pointsText}`,
      `Статус: ${getLoyaltyStatusLabel(transaction.status)}`,
      `Баланс после операции: ${transaction.balanceAfter}`,
      transaction.order?.number ? `Продажа: ${transaction.order.number}` : "",
      transaction.description ?? "",
      "Нажмите «Мои бонусы» в меню ниже, чтобы обновить баланс.",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}
