import "server-only";

import crypto from "node:crypto";

import { OrderStatus, RequestStatus } from "@/generated/prisma";
import { formatPrice } from "@/lib/commerce";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { absoluteUrl, getSiteUrl } from "@/lib/seo";
import {
  getEffectiveDiscountPercent,
  getLoyaltyTierLabel,
} from "@/lib/server/pricing";
import { ensureTelegramUserColumns } from "@/lib/server/telegram-user-schema";

type TelegramKeyboardButton = {
  text: string;
};

type TelegramInlineButton = {
  text: string;
  url: string;
};

type TelegramReplyMarkup = {
  keyboard?: TelegramKeyboardButton[][];
  inline_keyboard?: TelegramInlineButton[][];
  resize_keyboard?: boolean;
  is_persistent?: boolean;
};

type TelegramApiResponse<T = unknown> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramUpdate = {
  message?: {
    text?: string;
    chat: {
      id: number | string;
      type?: string;
    };
    from?: {
      id?: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
  };
  callback_query?: {
    id: string;
    data?: string;
    from?: {
      id?: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    message?: {
      chat: {
        id: number | string;
      };
    };
  };
};

type TelegramDirectCategory = "orders" | "requests" | "loyalty";

type TelegramDirectPayload = {
  title: string;
  lines: string[];
  category: TelegramDirectCategory;
  actions?: TelegramInlineButton[];
};

const orderStatusLabels: Record<OrderStatus | string, string> = {
  NEW: "Новый",
  CONFIRMED: "Подтвержден",
  IN_PRODUCTION: "В производстве",
  READY_FOR_PICKUP: "Готов к выдаче",
  SHIPPED: "Отгружен",
  COMPLETED: "Завершен",
  CANCELED: "Отменен",
};

const requestStatusLabels: Record<RequestStatus | string, string> = {
  NEW: "Новая",
  IN_REVIEW: "На расчете",
  QUOTE_SENT: "КП отправлено",
  WAITING_FOR_CLIENT: "Ждем клиента",
  IN_PROGRESS: "В работе",
  COMPLETED: "Завершена",
  CANCELED: "Отменена",
};

function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

function isTelegramBotConfigured() {
  return Boolean(getTelegramBotToken());
}

export function getTelegramBotUsername() {
  return (
    process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ||
    "artisan_sales_bot"
  );
}

function getTelegramLinkSecret() {
  return (
    process.env.TELEGRAM_LINK_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ||
    getTelegramBotToken() ||
    "artisan-local-telegram-link-secret"
  );
}

function signTelegramPayload(payload: string) {
  return crypto
    .createHmac("sha256", getTelegramLinkSecret())
    .update(payload)
    .digest("base64url");
}

export function createTelegramLinkToken(userId: string) {
  const payload = Buffer.from(`${userId}:${Date.now()}`, "utf8").toString(
    "base64url",
  );
  const signature = signTelegramPayload(payload);

  return `${payload}.${signature}`;
}

function verifyTelegramLinkToken(token: string) {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signTelegramPayload(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedSignatureBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
    return null;
  }

  const decodedPayload = Buffer.from(payload, "base64url").toString("utf8");
  const [userId, timestampValue] = decodedPayload.split(":");
  const timestamp = Number.parseInt(timestampValue ?? "", 10);
  const maxAgeMs = 14 * 24 * 60 * 60 * 1000;

  if (!userId || Number.isNaN(timestamp) || Date.now() - timestamp > maxAgeMs) {
    return null;
  }

  return { userId };
}

export function buildTelegramStartLink(userId: string) {
  return `https://t.me/${getTelegramBotUsername()}?start=${createTelegramLinkToken(userId)}`;
}

function buildMenuKeyboard(): TelegramReplyMarkup {
  return {
    keyboard: [
      [{ text: "Мои заказы" }, { text: "Мои заявки" }],
      [{ text: "Баллы и скидка" }, { text: "Открыть кабинет" }],
      [{ text: "Каталог" }, { text: "Помощь" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function buildInlineKeyboard(actions?: TelegramInlineButton[]) {
  if (!actions?.length) {
    return undefined;
  }

  return {
    inline_keyboard: actions.map((action) => [
      {
        text: action.text,
        url: action.url.startsWith("http") ? action.url : absoluteUrl(action.url),
      },
    ]),
  };
}

function buildActionMarkup(actions?: TelegramInlineButton[]) {
  return buildInlineKeyboard(actions) ?? buildMenuKeyboard();
}

async function sendTelegramApi<T>(
  method: string,
  payload: Record<string, unknown>,
) {
  const token = getTelegramBotToken();

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = (await response.json().catch(() => null)) as
    | TelegramApiResponse<T>
    | null;

  if (!response.ok || !json?.ok) {
    throw new Error(
      json?.description ?? `Telegram API ${method} error: ${response.status}`,
    );
  }

  return json.result as T;
}

export async function sendBotMessage(
  chatId: string | number,
  text: string,
  options: {
    replyMarkup?: TelegramReplyMarkup;
  } = {},
) {
  await sendTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
  });
}

function normalizeTelegramCommand(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^\/([^@\s]+)@\w+/i, "/$1")
    .toLowerCase();
}

function getUserDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  email: string;
}) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.companyName ||
    user.email
  );
}

async function getLinkedUserByChatId(chatId: string) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const db = getDb();
  await ensureTelegramUserColumns(db);

  return db.user.findUnique({
    where: { telegramChatId: chatId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      companyName: true,
      loyaltyTier: true,
      loyaltyPointsBalance: true,
      loyaltyPointsLifetime: true,
      personalDiscountPercent: true,
      telegramNotifyOrders: true,
      telegramNotifyRequests: true,
      telegramNotifyLoyalty: true,
    },
  });
}

async function linkTelegramAccount(
  userId: string,
  chatId: string,
  username?: string | null,
) {
  const db = getDb();
  await ensureTelegramUserColumns(db);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      companyName: true,
      isActive: true,
    },
  });

  if (!user?.isActive) {
    return null;
  }

  await db.$transaction([
    db.user.updateMany({
      where: {
        telegramChatId: chatId,
        id: { not: userId },
      },
      data: {
        telegramChatId: null,
        telegramUsername: null,
        telegramLinkedAt: null,
      },
    }),
    db.user.update({
      where: { id: userId },
      data: {
        telegramChatId: chatId,
        telegramUsername: username ?? null,
        telegramLinkedAt: new Date(),
        telegramNotifyOrders: true,
        telegramNotifyRequests: true,
        telegramNotifyLoyalty: true,
      },
    }),
  ]);

  return user;
}

async function replyWithOrders(chatId: string, userId: string) {
  const db = getDb();
  const orders = await db.order.findMany({
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
  });

  if (orders.length === 0) {
    await sendBotMessage(chatId, "Заказов пока нет. Когда заказ появится, я пришлю статус сюда.", {
      replyMarkup: buildMenuKeyboard(),
    });
    return;
  }

  const lines = orders.flatMap((order) => [
    `${order.number ?? order.id}`,
    `Статус: ${orderStatusLabels[order.status] ?? order.status}`,
    `Сумма: ${formatPrice(order.total)}`,
    "",
  ]);

  await sendBotMessage(chatId, ["Последние заказы:", "", ...lines].join("\n"), {
    replyMarkup: buildActionMarkup([
      { text: "Открыть кабинет", url: absoluteUrl("/account/orders") },
    ]),
  });
}

async function replyWithRequests(chatId: string, userId: string) {
  const db = getDb();
  const requests = await db.request.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      number: true,
      subject: true,
      status: true,
      quotedTotal: true,
      createdAt: true,
    },
  });

  if (requests.length === 0) {
    await sendBotMessage(chatId, "Заявок пока нет. Заявка на распил появится здесь после отправки формы.", {
      replyMarkup: buildMenuKeyboard(),
    });
    return;
  }

  const lines = requests.flatMap((request) => [
    `${request.number ?? request.id}`,
    request.subject,
    `Статус: ${requestStatusLabels[request.status] ?? request.status}`,
    request.quotedTotal ? `Сумма: ${formatPrice(request.quotedTotal)}` : "",
    "",
  ]);

  await sendBotMessage(chatId, ["Последние заявки:", "", ...lines.filter(Boolean)].join("\n"), {
    replyMarkup: buildActionMarkup([
      { text: "Открыть заявки", url: absoluteUrl("/account/requests") },
    ]),
  });
}

async function replyWithLoyalty(
  chatId: string,
  user: NonNullable<Awaited<ReturnType<typeof getLinkedUserByChatId>>>,
) {
  const discount = getEffectiveDiscountPercent(user);
  const lines = [
    `Клиент: ${getUserDisplayName(user)}`,
    `Уровень: ${getLoyaltyTierLabel(user.loyaltyTier)}`,
    `Баланс: ${user.loyaltyPointsBalance} баллов`,
    `Накоплено: ${user.loyaltyPointsLifetime} баллов`,
    `Скидка: ${discount}%`,
    "",
    "Баллы начисляются после подтверждения менеджером и сразу видны в кабинете.",
  ];

  await sendBotMessage(chatId, lines.join("\n"), {
    replyMarkup: buildActionMarkup([
      { text: "Открыть кабинет", url: absoluteUrl("/account") },
    ]),
  });
}

async function replyWithHelp(chatId: string, linked: boolean) {
  const text = linked
    ? [
        "Я бот Artisan для статусов и бонусов.",
        "",
        "Кнопки ниже покажут заказы, заявки на распил, баллы и кабинет.",
        "Уведомления по новым статусам будут приходить автоматически.",
      ].join("\n")
    : [
        "Чтобы подключить Telegram к личному кабинету:",
        "1. Откройте личный кабинет на сайте.",
        "2. Нажмите «Подключить Telegram».",
        "3. Подтвердите запуск бота.",
      ].join("\n");

  await sendBotMessage(chatId, text, {
    replyMarkup: linked ? buildMenuKeyboard() : undefined,
  });
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message;
  const chatId = message?.chat.id ? String(message.chat.id) : "";
  const text = message?.text?.trim() ?? "";

  if (!chatId || !text) {
    return;
  }

  if (!hasDatabaseUrl()) {
    await sendBotMessage(
      chatId,
      "База данных сайта пока не подключена, поэтому кабинет Telegram временно недоступен.",
    );
    return;
  }

  const normalizedText = normalizeTelegramCommand(text);

  if (normalizedText.startsWith("/start")) {
    const token = text.replace(/^\/start(?:@\w+)?\s*/i, "").trim();

    if (token) {
      const payload = verifyTelegramLinkToken(token);

      if (!payload) {
        await sendBotMessage(
          chatId,
          "Ссылка привязки устарела. Откройте личный кабинет и нажмите «Подключить Telegram» еще раз.",
        );
        return;
      }

      const linkedUser = await linkTelegramAccount(
        payload.userId,
        chatId,
        message?.from?.username ?? null,
      );

      if (!linkedUser) {
        await sendBotMessage(
          chatId,
          "Не удалось найти активный аккаунт. Проверьте вход в личный кабинет.",
        );
        return;
      }

      await sendBotMessage(
        chatId,
        `Telegram подключен к кабинету ${getUserDisplayName(linkedUser)}.\nТеперь я буду присылать статусы заказов, распила и бонусов.`,
        { replyMarkup: buildMenuKeyboard() },
      );
      return;
    }
  }

  const linkedUser = await getLinkedUserByChatId(chatId);

  if (!linkedUser) {
    await replyWithHelp(chatId, false);
    return;
  }

  if (normalizedText === "/start" || normalizedText === "помощь" || normalizedText === "/help") {
    await replyWithHelp(chatId, true);
    return;
  }

  if (normalizedText === "мои заказы" || normalizedText === "/orders") {
    await replyWithOrders(chatId, linkedUser.id);
    return;
  }

  if (normalizedText === "мои заявки" || normalizedText === "/requests") {
    await replyWithRequests(chatId, linkedUser.id);
    return;
  }

  if (
    normalizedText === "баллы и скидка" ||
    normalizedText === "/bonus" ||
    normalizedText === "/bonuses"
  ) {
    await replyWithLoyalty(chatId, linkedUser);
    return;
  }

  if (normalizedText === "открыть кабинет" || normalizedText === "/account") {
    await sendBotMessage(chatId, "Личный кабинет Artisan:", {
      replyMarkup: buildActionMarkup([
        { text: "Открыть кабинет", url: absoluteUrl("/account") },
      ]),
    });
    return;
  }

  if (normalizedText === "каталог" || normalizedText === "/catalog") {
    await sendBotMessage(chatId, "Каталог Artisan:", {
      replyMarkup: buildActionMarkup([
        { text: "Открыть каталог", url: absoluteUrl("/catalog") },
      ]),
    });
    return;
  }

  await sendBotMessage(chatId, "Выберите нужное действие кнопками ниже.", {
    replyMarkup: buildMenuKeyboard(),
  });
}

export async function sendTelegramDirectMessage(
  userId: string | null | undefined,
  payload: TelegramDirectPayload,
) {
  if (!userId || !hasDatabaseUrl() || !isTelegramBotConfigured()) {
    return false;
  }

  const db = getDb();
  await ensureTelegramUserColumns(db);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      telegramChatId: true,
      telegramNotifyOrders: true,
      telegramNotifyRequests: true,
      telegramNotifyLoyalty: true,
    },
  });

  if (!user?.telegramChatId) {
    return false;
  }

  if (payload.category === "orders" && !user.telegramNotifyOrders) {
    return false;
  }

  if (payload.category === "requests" && !user.telegramNotifyRequests) {
    return false;
  }

  if (payload.category === "loyalty" && !user.telegramNotifyLoyalty) {
    return false;
  }

  await sendBotMessage(
    user.telegramChatId,
    [payload.title, ...payload.lines].filter(Boolean).join("\n"),
    {
      replyMarkup: buildActionMarkup(payload.actions),
    },
  );

  return true;
}

export async function configureTelegramWebhook() {
  const webhookUrl = `${getSiteUrl()}/api/telegram/webhook`;
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  await sendTelegramApi("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
    ...(secretToken ? { secret_token: secretToken } : {}),
  });

  await sendTelegramApi("setMyCommands", {
    commands: [
      { command: "orders", description: "Мои заказы" },
      { command: "requests", description: "Мои заявки" },
      { command: "bonus", description: "Баллы и скидка" },
      { command: "account", description: "Личный кабинет" },
      { command: "catalog", description: "Каталог" },
      { command: "help", description: "Помощь" },
    ],
  });

  return {
    webhookUrl,
    hasSecret: Boolean(secretToken),
  };
}
