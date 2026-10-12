import "server-only";

import crypto from "node:crypto";

import {
  CuttingStage,
  DiscountType,
  NotificationChannel,
  NotificationStatus,
  OrderStatus,
  ProductStatus,
  PromotionStatus,
  PromotionTargetType,
  type Prisma,
  RequestStatus,
} from "@/generated/prisma";
import { cuttingStageLabels } from "@/features/cutting/progress";
import { formatPrice } from "@/lib/commerce";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { absoluteUrl, getSiteUrl } from "@/lib/seo";
import { getCustomerOrderWhere } from "@/lib/server/customer-order-scope";
import {
  getLoyaltyTierBenefits,
  getLoyaltyTierLabel,
} from "@/lib/server/pricing";
import { getLoyaltyProgramConfig } from "@/lib/server/loyalty-settings";

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
  parameters?: {
    retry_after?: number;
  };
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

type TelegramDirectCategory =
  | "orders"
  | "requests"
  | "loyalty"
  | "promotions"
  | "manual";

type TelegramDirectPayload = {
  title: string;
  lines: string[];
  category: TelegramDirectCategory;
  actions?: TelegramInlineButton[];
};

function maskTelegramChatId(chatId: string | number | null | undefined) {
  const value = String(chatId ?? "");

  if (!value) {
    return "missing";
  }

  return value.length <= 4 ? "****" : `***${value.slice(-4)}`;
}

function maskUserId(userId: string | null | undefined) {
  if (!userId) {
    return "missing";
  }

  return userId.length <= 8
    ? "****"
    : `${userId.slice(0, 4)}...${userId.slice(-4)}`;
}

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
  const secret =
    process.env.TELEGRAM_LINK_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "TELEGRAM_LINK_SECRET or SESSION_SECRET is required for Telegram account links.",
    );
  }

  return secret;
}

function signTelegramPayload(payload: string) {
  return crypto
    .createHmac("sha256", getTelegramLinkSecret())
    .update(payload)
    .digest("base64url");
}

export function createTelegramLinkToken(userId: string) {
  const expiresAt = Date.now() + 14 * 24 * 60 * 60 * 1000;
  const expiresAtBase36 = expiresAt.toString(36);
  const payload = `${userId}_${expiresAtBase36}`;
  const signature = signTelegramPayload(payload).slice(0, 22);

  return `t_${payload}_${signature}`;
}

function verifyTelegramLinkToken(token: string) {
  if (token.startsWith("t_")) {
    const [, userId, expiresAtBase36, ...signatureParts] = token.split("_");
    const signature = signatureParts.join("_");

    if (!userId || !expiresAtBase36 || !signature) {
      return null;
    }

    const payload = `${userId}_${expiresAtBase36}`;
    const expectedSignature = signTelegramPayload(payload).slice(0, 22);
    const signatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedSignatureBuffer.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
      return null;
    }

    const expiresAt = Number.parseInt(expiresAtBase36, 36);

    if (!userId || Number.isNaN(expiresAt) || expiresAt < Date.now()) {
      return null;
    }

    return { userId };
  }

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
  return `https://t.me/${getTelegramBotUsername()}?start=${encodeURIComponent(createTelegramLinkToken(userId))}`;
}

function buildMenuKeyboard(): TelegramReplyMarkup {
  return {
    keyboard: [
      [{ text: "Мои заказы" }, { text: "Мои заявки" }],
      [{ text: "Акции" }, { text: "Баллы и статусы" }],
      [{ text: "Открыть кабинет" }, { text: "Каталог" }],
      [{ text: "Помощь" }],
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
        url: action.url.startsWith("http")
          ? action.url
          : absoluteUrl(action.url),
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

  const url = `https://api.telegram.org/bot${token}/${method}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12_000),
    });
    const json = (await response
      .json()
      .catch(() => null)) as TelegramApiResponse<T> | null;

    if (response.ok && json?.ok) {
      return json.result as T;
    }

    const canRetry =
      attempt === 0 &&
      (response.status === 429 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504);

    if (!canRetry) {
      throw new Error(
        json?.description ?? `Telegram API ${method} error: ${response.status}`,
      );
    }

    const retryAfterMs = Math.min(
      Math.max(json?.parameters?.retry_after ?? 1, 1) * 1000,
      3000,
    );
    await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
  }

  throw new Error(`Telegram API ${method} request failed.`);
}

export async function sendBotMessage(
  chatId: string | number,
  text: string,
  options: {
    parseMode?: "HTML";
    replyMarkup?: TelegramReplyMarkup;
  } = {},
) {
  await sendTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(options.parseMode ? { parse_mode: options.parseMode } : {}),
    ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
  });
}

function escapeTelegramHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function truncateTelegramLine(value: string, maxLength = 120) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function splitTelegramLines(lines: string[], maxLength = 3800) {
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;

    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    current = line.slice(0, maxLength);
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
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
      plateMaterialLoyaltyTier: true,
      fittingsLoyaltyTier: true,
      loyaltyPointsBalance: true,
      loyaltyPointsLifetime: true,
      personalDiscountPercent: true,
      telegramNotifyOrders: true,
      telegramNotifyRequests: true,
      telegramNotifyLoyalty: true,
      telegramNotifyPromotions: true,
    },
  });
}

async function linkTelegramAccount(
  userId: string,
  chatId: string,
  username?: string | null,
) {
  const db = getDb();
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
        telegramNotifyPromotions: true,
      },
    }),
  ]);

  return user;
}

async function replyWithOrders(chatId: string, userId: string) {
  const db = getDb();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
    },
  });

  if (!user) {
    await sendBotMessage(
      chatId,
      "Аккаунт не найден. Откройте кабинет и подключите Telegram заново.",
      {
        replyMarkup: buildMenuKeyboard(),
      },
    );
    return;
  }

  const orders = await db.order.findMany({
    where: getCustomerOrderWhere(user),
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      createdAt: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          quantity: true,
          unitPrice: true,
          discountAmount: true,
          total: true,
          snapshotName: true,
          snapshotSku: true,
          snapshotBrand: true,
        },
      },
    },
  });

  if (orders.length === 0) {
    await sendBotMessage(
      chatId,
      "Заказов пока нет. Когда заказ появится, я пришлю статус сюда.",
      {
        replyMarkup: buildMenuKeyboard(),
      },
    );
    return;
  }

  const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const lines = orders.flatMap((order) => {
    const itemLines =
      order.items.length > 0
        ? order.items.flatMap((item) => {
            const meta = [
              item.snapshotBrand,
              item.snapshotSku ? `арт. ${item.snapshotSku}` : "",
            ]
              .filter(Boolean)
              .join(" · ");
            const discount =
              item.discountAmount > 0
                ? ` · скидка ${formatPrice(item.discountAmount)}`
                : "";

            return [
              `• ${truncateTelegramLine(item.snapshotName)}`,
              truncateTelegramLine(
                `  ${meta ? `${meta} · ` : ""}${item.quantity} шт. x ${formatPrice(item.unitPrice)}${discount} · ${formatPrice(item.total)}`,
              ),
            ];
          })
        : ["• Состав заказа уточняется менеджером."];
    return [
      `${order.number ?? order.id}`,
      `Дата: ${dateFormatter.format(order.createdAt)}`,
      `Статус: ${orderStatusLabels[order.status] ?? order.status}`,
      "Состав:",
      ...itemLines,
      `Сумма: ${formatPrice(order.total)}`,
      "",
    ].filter(Boolean);
  });

  const chunks = splitTelegramLines(["Последние заказы:", "", ...lines]);

  for (const [index, chunk] of chunks.entries()) {
    await sendBotMessage(chatId, chunk, {
      replyMarkup:
        index === chunks.length - 1
          ? buildActionMarkup([
              {
                text: "Открыть кабинет",
                url: absoluteUrl("/account/orders"),
              },
            ])
          : undefined,
    });
  }
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
      cuttingStage: true,
      cuttingPickupCell: true,
      quotedTotal: true,
      createdAt: true,
    },
  });

  if (requests.length === 0) {
    await sendBotMessage(
      chatId,
      "Заявок пока нет. Заявка на распил появится здесь после отправки формы.",
      {
        replyMarkup: buildMenuKeyboard(),
      },
    );
    return;
  }

  const lines = requests.flatMap((request) => [
    `${request.number ?? request.id}`,
    request.subject,
    `Статус: ${requestStatusLabels[request.status] ?? request.status}`,
    request.cuttingStage
      ? `Этап распила: ${cuttingStageLabels[request.cuttingStage]}`
      : "",
    request.cuttingStage === CuttingStage.READY_FOR_PICKUP &&
    request.cuttingPickupCell
      ? `Ячейка выдачи: № ${request.cuttingPickupCell}`
      : "",
    request.quotedTotal ? `Сумма: ${formatPrice(request.quotedTotal)}` : "",
    "",
  ]);

  await sendBotMessage(
    chatId,
    ["Последние заявки:", "", ...lines.filter(Boolean)].join("\n"),
    {
      replyMarkup: buildActionMarkup([
        { text: "Открыть заявки", url: absoluteUrl("/account/requests") },
      ]),
    },
  );
}

async function replyWithLoyalty(
  chatId: string,
  user: NonNullable<Awaited<ReturnType<typeof getLinkedUserByChatId>>>,
) {
  const loyaltyConfig = await getLoyaltyProgramConfig();
  const plateMaterialTier = user.plateMaterialLoyaltyTier ?? user.loyaltyTier;
  const fittingsTier = user.fittingsLoyaltyTier ?? user.loyaltyTier;
  const plateMaterialBenefits = getLoyaltyTierBenefits(
    plateMaterialTier,
    loyaltyConfig,
  );
  const fittingsBenefits = getLoyaltyTierBenefits(fittingsTier, loyaltyConfig);
  const lines = [
    `Клиент: ${getUserDisplayName(user)}`,
    `Уровень: ${getLoyaltyTierLabel(user.loyaltyTier, loyaltyConfig)}`,
    `Плиты: ${getLoyaltyTierLabel(plateMaterialTier, loyaltyConfig)}`,
    `Фурнитура: ${getLoyaltyTierLabel(fittingsTier, loyaltyConfig)}`,
    `Баланс: ${user.loyaltyPointsBalance} баллов`,
    `Накоплено: ${user.loyaltyPointsLifetime} баллов`,
    `Начисление: плитные материалы ${plateMaterialBenefits.plateMaterialAccrualPercent}%, фурнитура ${fittingsBenefits.fittingsAccrualPercent}%`,
    "",
    "Баллы начисляются после подтверждения менеджером и сразу видны в кабинете.",
  ];

  await sendBotMessage(chatId, lines.join("\n"), {
    replyMarkup: buildActionMarkup([
      { text: "Открыть кабинет", url: absoluteUrl("/account") },
    ]),
  });
}

function formatPromotionOffer(params: {
  discountType: DiscountType;
  discountValue: number;
}) {
  if (params.discountType === DiscountType.FIXED_AMOUNT) {
    return `-${formatPrice(params.discountValue)}`;
  }

  if (params.discountType === DiscountType.FIXED_PRICE) {
    return `Цена ${formatPrice(params.discountValue)}`;
  }

  return `-${params.discountValue}%`;
}

function getPromotionHref(promotion: {
  targetType: PromotionTargetType;
  products: Array<{ product: { slug: string; status: ProductStatus } }>;
  categories: Array<{ category: { slug: string } }>;
}) {
  const product = promotion.products.find(
    (item) => item.product.status === ProductStatus.ACTIVE,
  )?.product;

  if (promotion.targetType === PromotionTargetType.PRODUCT && product) {
    return `/product/${product.slug}`;
  }

  const category = promotion.categories[0]?.category;

  if (promotion.targetType === PromotionTargetType.CATEGORY && category) {
    return `/catalog/${category.slug}`;
  }

  return "/catalog";
}

async function replyWithPromotions(chatId: string) {
  const now = new Date();
  const promotions = await getDb().promotion.findMany({
    where: {
      status: PromotionStatus.ACTIVE,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: [
      { isHighlighted: "desc" },
      { endsAt: "asc" },
      { updatedAt: "desc" },
    ],
    take: 5,
    select: {
      name: true,
      description: true,
      badgeText: true,
      promoCode: true,
      discountType: true,
      discountValue: true,
      endsAt: true,
      targetType: true,
      products: {
        take: 1,
        select: {
          product: {
            select: {
              slug: true,
              status: true,
            },
          },
        },
      },
      categories: {
        take: 1,
        select: {
          category: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  });

  if (promotions.length === 0) {
    await sendBotMessage(
      chatId,
      "Активных акций сейчас нет. Когда появится новое предложение, я пришлю уведомление сюда.",
      { replyMarkup: buildMenuKeyboard() },
    );
    return;
  }

  const lines = promotions.flatMap((promotion) => [
    `${promotion.badgeText ?? "Акция"} · ${formatPromotionOffer(promotion)}`,
    promotion.name,
    promotion.promoCode ? `Промокод: ${promotion.promoCode}` : "",
    promotion.endsAt
      ? `До ${new Intl.DateTimeFormat("ru-RU", {
          day: "2-digit",
          month: "long",
        }).format(promotion.endsAt)}`
      : "",
    "",
  ]);

  await sendBotMessage(
    chatId,
    ["Актуальные акции Artisan:", "", ...lines.filter(Boolean)].join("\n"),
    {
      replyMarkup: buildActionMarkup(
        promotions.slice(0, 3).map((promotion) => ({
          text: promotion.badgeText ?? "Смотреть акцию",
          url: absoluteUrl(getPromotionHref(promotion)),
        })),
      ),
    },
  );
}

function isPromotionLive(params: {
  status: PromotionStatus;
  startsAt: Date | null;
  endsAt: Date | null;
}) {
  const now = new Date();

  return (
    params.status === PromotionStatus.ACTIVE &&
    (!params.startsAt || params.startsAt <= now) &&
    (!params.endsAt || params.endsAt >= now)
  );
}

function formatPromotionDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export async function sendTelegramPromotionBroadcast(promotionId: string) {
  if (!promotionId || !hasDatabaseUrl()) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      skipped: 0,
      message: "База данных недоступна.",
    };
  }

  if (!isTelegramBotConfigured()) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      skipped: 0,
      message: "TELEGRAM_BOT_TOKEN не настроен.",
    };
  }

  const db = getDb();
  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      status: true,
      badgeText: true,
      promoCode: true,
      discountType: true,
      discountValue: true,
      minOrderTotal: true,
      startsAt: true,
      endsAt: true,
      targetType: true,
      products: {
        take: 1,
        select: {
          product: {
            select: {
              slug: true,
              status: true,
            },
          },
        },
      },
      categories: {
        take: 1,
        select: {
          category: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!promotion) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      skipped: 0,
      message: "Акция не найдена.",
    };
  }

  if (!isPromotionLive(promotion)) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      skipped: 0,
      message: "Рассылка доступна только для активной акции в текущем периоде.",
    };
  }

  const [eligibleUsers, linkedCount] = await Promise.all([
    db.user.findMany({
      where: {
        isActive: true,
        telegramChatId: { not: null },
        telegramNotifyPromotions: true,
      },
      select: {
        id: true,
        telegramChatId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.user.count({
      where: {
        isActive: true,
        telegramChatId: { not: null },
      },
    }),
  ]);

  const title = `Artisan · ${promotion.badgeText ?? "акция"}: ${promotion.name}`;
  const href = absoluteUrl(getPromotionHref(promotion));
  const lines = [
    `🎁 <b>${escapeTelegramHtml(formatPromotionOffer(promotion))}</b>`,
    promotion.description
      ? `✨ ${escapeTelegramHtml(promotion.description)}`
      : "",
    promotion.promoCode
      ? `🏷 Промокод: <code>${escapeTelegramHtml(promotion.promoCode)}</code>`
      : "",
    promotion.minOrderTotal
      ? `🛒 Для заказов от <b>${escapeTelegramHtml(formatPrice(promotion.minOrderTotal))}</b>`
      : "",
    promotion.endsAt
      ? `⏳ Действует до ${escapeTelegramHtml(formatPromotionDate(promotion.endsAt))}`
      : "",
    "Нажмите кнопку ниже, чтобы посмотреть детали на сайте.",
  ].filter(Boolean);
  const text = [
    `🔥 <b>Artisan · ${escapeTelegramHtml(promotion.badgeText ?? "акция")}</b>`,
    `<b>${escapeTelegramHtml(promotion.name)}</b>`,
    "",
    ...lines,
  ].join("\n");
  const payload = {
    source: "admin.promotions.telegramBroadcast",
    promotionId: promotion.id,
    promotionSlug: promotion.slug,
    href,
  };

  let sent = 0;
  let failed = 0;

  for (const user of eligibleUsers) {
    try {
      await sendBotMessage(user.telegramChatId!, text, {
        parseMode: "HTML",
        replyMarkup: buildActionMarkup([
          { text: "🔥 Смотреть акцию", url: href },
        ]),
      });
      sent += 1;

      await db.notification
        .create({
          data: {
            userId: user.id,
            channel: NotificationChannel.TELEGRAM,
            status: NotificationStatus.SENT,
            title,
            message: text,
            payload: payload as Prisma.InputJsonValue,
            sentAt: new Date(),
          },
        })
        .catch((error) => console.error("[telegram:promotion-log]", error));
    } catch (error) {
      failed += 1;

      await db.notification
        .create({
          data: {
            userId: user.id,
            channel: NotificationChannel.TELEGRAM,
            status: NotificationStatus.FAILED,
            title,
            message: error instanceof Error ? error.message : String(error),
            payload: {
              ...payload,
              error: error instanceof Error ? error.message : String(error),
            } as Prisma.InputJsonValue,
          },
        })
        .catch((logError) =>
          console.error("[telegram:promotion-log-failed]", logError),
        );
    }
  }

  const skipped = Math.max(0, linkedCount - eligibleUsers.length);

  return {
    ok: failed === 0,
    sent,
    failed,
    skipped,
    message:
      eligibleUsers.length === 0
        ? "Нет клиентов с подключенным Telegram для промо-рассылки."
        : `Отправлено: ${sent}. Ошибок: ${failed}. Отключили промо: ${skipped}.`,
  };
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
    console.info("[telegram:update:ignored]", {
      hasChatId: Boolean(chatId),
      hasText: Boolean(text),
      hasCallbackQuery: Boolean(update.callback_query),
    });
    return;
  }

  if (!hasDatabaseUrl()) {
    console.warn("[telegram:update:no-db]", {
      chatId: maskTelegramChatId(chatId),
    });
    await sendBotMessage(
      chatId,
      "База данных сайта пока не подключена, поэтому кабинет Telegram временно недоступен.",
    );
    return;
  }

  const normalizedText = normalizeTelegramCommand(text);
  const isStartCommand = normalizedText.startsWith("/start");

  console.info("[telegram:update]", {
    chatId: maskTelegramChatId(chatId),
    command: isStartCommand ? "/start" : normalizedText.slice(0, 80),
    hasStartPayload:
      isStartCommand &&
      text.replace(/^\/start(?:@\w+)?\s*/i, "").trim().length > 0,
    username: message?.from?.username ?? null,
  });

  if (isStartCommand) {
    const token = text.replace(/^\/start(?:@\w+)?\s*/i, "").trim();

    if (token) {
      const payload = verifyTelegramLinkToken(token);

      if (!payload) {
        console.warn("[telegram:link:invalid-token]", {
          chatId: maskTelegramChatId(chatId),
          tokenLength: token.length,
          tokenPrefix: token.slice(0, 2),
        });
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
        console.warn("[telegram:link:user-not-found]", {
          chatId: maskTelegramChatId(chatId),
          userId: maskUserId(payload.userId),
        });
        await sendBotMessage(
          chatId,
          "Не удалось найти активный аккаунт. Проверьте вход в личный кабинет.",
        );
        return;
      }

      console.info("[telegram:link:success]", {
        chatId: maskTelegramChatId(chatId),
        userId: maskUserId(linkedUser.id),
      });
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
    console.info("[telegram:link:missing]", {
      chatId: maskTelegramChatId(chatId),
      command: normalizedText.slice(0, 80),
    });
    await replyWithHelp(chatId, false);
    return;
  }

  if (
    normalizedText === "/start" ||
    normalizedText === "помощь" ||
    normalizedText === "/help"
  ) {
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
    normalizedText === "баллы и статусы" ||
    normalizedText === "баллы и скидка" ||
    normalizedText === "/bonus" ||
    normalizedText === "/bonuses"
  ) {
    await replyWithLoyalty(chatId, linkedUser);
    return;
  }

  if (normalizedText === "акции" || normalizedText === "/promotions") {
    await replyWithPromotions(chatId);
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
  if (!userId) {
    console.info("[telegram:direct:skipped]", {
      reason: "missing-user-id",
      category: payload.category,
    });
    return false;
  }

  if (!hasDatabaseUrl()) {
    console.warn("[telegram:direct:skipped]", {
      reason: "database-unavailable",
      userId: maskUserId(userId),
      category: payload.category,
    });
    return false;
  }

  if (!isTelegramBotConfigured()) {
    console.warn("[telegram:direct:skipped]", {
      reason: "bot-token-missing",
      userId: maskUserId(userId),
      category: payload.category,
    });
    return false;
  }

  const db = getDb();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      telegramChatId: true,
      telegramNotifyOrders: true,
      telegramNotifyRequests: true,
      telegramNotifyLoyalty: true,
      telegramNotifyPromotions: true,
    },
  });

  if (!user?.telegramChatId) {
    console.info("[telegram:direct:skipped]", {
      reason: "telegram-not-linked",
      userId: maskUserId(userId),
      category: payload.category,
    });
    return false;
  }

  if (payload.category === "orders" && !user.telegramNotifyOrders) {
    console.info("[telegram:direct:skipped]", {
      reason: "orders-disabled",
      userId: maskUserId(userId),
      chatId: maskTelegramChatId(user.telegramChatId),
    });
    return false;
  }

  if (payload.category === "requests" && !user.telegramNotifyRequests) {
    console.info("[telegram:direct:skipped]", {
      reason: "requests-disabled",
      userId: maskUserId(userId),
      chatId: maskTelegramChatId(user.telegramChatId),
    });
    return false;
  }

  if (payload.category === "loyalty" && !user.telegramNotifyLoyalty) {
    console.info("[telegram:direct:skipped]", {
      reason: "loyalty-disabled",
      userId: maskUserId(userId),
      chatId: maskTelegramChatId(user.telegramChatId),
    });
    return false;
  }

  if (payload.category === "promotions" && !user.telegramNotifyPromotions) {
    console.info("[telegram:direct:skipped]", {
      reason: "promotions-disabled",
      userId: maskUserId(userId),
      chatId: maskTelegramChatId(user.telegramChatId),
    });
    return false;
  }

  await sendBotMessage(
    user.telegramChatId,
    [payload.title, ...payload.lines].filter(Boolean).join("\n"),
    {
      replyMarkup: buildActionMarkup(payload.actions),
    },
  );

  console.info("[telegram:direct:sent]", {
    userId: maskUserId(userId),
    chatId: maskTelegramChatId(user.telegramChatId),
    category: payload.category,
  });

  return true;
}

export async function configureTelegramWebhook() {
  const webhookUrl = `${getSiteUrl()}/api/telegram/webhook`;
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  if (!secretToken) {
    throw new Error(
      "TELEGRAM_WEBHOOK_SECRET is required before configuring the webhook.",
    );
  }

  await sendTelegramApi("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
    secret_token: secretToken,
  });

  await sendTelegramApi("setMyCommands", {
    commands: [
      { command: "orders", description: "Мои заказы" },
      { command: "requests", description: "Мои заявки" },
      { command: "promotions", description: "Акции" },
      { command: "bonus", description: "Баллы и статусы" },
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
