import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  NotificationChannel,
  NotificationStatus,
  Prisma,
} from "@/generated/prisma";
import { formatPrice } from "@/lib/commerce";
import { getDb, hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";
import { sendTelegramDirectMessage } from "@/lib/server/telegram-bot";

type TelegramMessagePayload = {
  title: string;
  lines: string[];
  threadKey?: "requests" | "orders" | "cutting";
  actions?: Array<{
    label: string;
    url: string;
  }>;
};

export type TelegramThreadKey = NonNullable<
  TelegramMessagePayload["threadKey"]
>;

type OneCEventPayload = {
  event:
    | "request.created"
    | "request.updated"
    | "order.created"
    | "order.updated";
  entityType: "request" | "order";
  entityId: string;
  payload: Record<string, unknown>;
};

type ManagerSnapshot = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

type IntegrationLogRecord = {
  id: string;
  channel: "telegram" | "1c";
  status: "sent" | "skipped" | "failed";
  title: string;
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
  error?: string;
};

type RequestIntegrationInput = {
  id: string;
  userId?: string | null;
  number: string | null;
  requestType?: string | null;
  subject: string;
  status: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  messengerType?: string | null;
  messengerHandle?: string | null;
  material?: string | null;
  edgeOption?: string | null;
  estimatedBudget?: number | null;
  deliveryNeeded?: boolean;
  message?: string | null;
  createdAt?: string;
  product?: {
    name: string;
    sku?: string | null;
  } | null;
  manager?: ManagerSnapshot | null;
  previousStatus?: string | null;
  previousManager?: ManagerSnapshot | null;
};

type OrderIntegrationInput = {
  id: string;
  userId?: string | null;
  number: string | null;
  status: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  companyName?: string | null;
  comment?: string | null;
  deliveryMethod?: string | null;
  total: number;
  subtotal?: number;
  discountTotal?: number;
  deliveryTotal?: number;
  loyaltyPointsDelta?: number | null;
  createdAt?: string;
  manager?: ManagerSnapshot | null;
  previousStatus?: string | null;
  previousManager?: ManagerSnapshot | null;
  items: Array<{
    name: string;
    sku?: string | null;
    brand?: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
};

const runtimeDirectory = path.join(process.cwd(), ".artisan-runtime");
const integrationLogPath = path.join(
  runtimeDirectory,
  "integration-events.json",
);

const requestStatusLabels: Record<string, string> = {
  NEW: "Новая",
  IN_REVIEW: "На расчете",
  QUOTE_SENT: "КП отправлено",
  WAITING_FOR_CLIENT: "Ждем клиента",
  IN_PROGRESS: "В работе",
  COMPLETED: "Завершена",
  CANCELED: "Отменена",
};

const orderStatusLabels: Record<string, string> = {
  NEW: "Новый",
  CONFIRMED: "Подтвержден",
  IN_PRODUCTION: "В производстве",
  READY_FOR_PICKUP: "Готов к выдаче",
  SHIPPED: "Отгружен",
  COMPLETED: "Завершен",
  CANCELED: "Отменен",
};

const messengerTypeLabels: Record<string, string> = {
  PHONE: "Телефон",
  WHATSAPP: "WhatsApp",
  TELEGRAM: "Telegram",
  EMAIL: "Email",
};

function isTelegramEnabled() {
  return (
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED === "true" &&
    Boolean(process.env.TELEGRAM_BOT_TOKEN) &&
    Boolean(process.env.TELEGRAM_CHAT_ID)
  );
}

function getTelegramMissingEnv() {
  return [
    [
      "TELEGRAM_NOTIFICATIONS_ENABLED",
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED,
    ],
    ["TELEGRAM_BOT_TOKEN", process.env.TELEGRAM_BOT_TOKEN],
    ["TELEGRAM_CHAT_ID", process.env.TELEGRAM_CHAT_ID],
  ]
    .filter(([, value]) => !String(value ?? "").trim())
    .map(([key]) => key);
}

function parseTelegramThreadId(value?: string) {
  const rawValue = value?.trim();

  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function getTelegramThreadId() {
  return parseTelegramThreadId(process.env.TELEGRAM_MESSAGE_THREAD_ID);
}

function getTypedTelegramThreadId(
  threadKey?: TelegramMessagePayload["threadKey"],
) {
  const specificValue =
    threadKey === "cutting"
      ? process.env.TELEGRAM_CUTTING_THREAD_ID
      : threadKey === "orders"
        ? process.env.TELEGRAM_ORDERS_THREAD_ID
        : threadKey === "requests"
          ? process.env.TELEGRAM_REQUESTS_THREAD_ID
          : null;

  const specificThreadId = parseTelegramThreadId(specificValue ?? undefined);

  if (specificThreadId) {
    return specificThreadId;
  }

  return getTelegramThreadId();
}

export function getTelegramConfigurationStatus() {
  const missingEnv = getTelegramMissingEnv();
  const specificThreadIds = {
    requests: parseTelegramThreadId(process.env.TELEGRAM_REQUESTS_THREAD_ID),
    cutting: parseTelegramThreadId(process.env.TELEGRAM_CUTTING_THREAD_ID),
    orders: parseTelegramThreadId(process.env.TELEGRAM_ORDERS_THREAD_ID),
  };
  const threadIds = {
    requests: getTypedTelegramThreadId("requests"),
    cutting: getTypedTelegramThreadId("cutting"),
    orders: getTypedTelegramThreadId("orders"),
  };

  return {
    enabled: isTelegramEnabled(),
    missingEnv,
    chatConfigured: Boolean(process.env.TELEGRAM_CHAT_ID?.trim()),
    hasDefaultThread: Boolean(getTelegramThreadId()),
    threadIds,
    specificThreadIds,
    threadsConfigured: {
      requests: Boolean(specificThreadIds.requests),
      cutting: Boolean(specificThreadIds.cutting),
      orders: Boolean(specificThreadIds.orders),
    },
  };
}

function isOneCEnabled() {
  return (
    process.env.ONE_C_SYNC_ENABLED === "true" &&
    Boolean(process.env.ONE_C_WEBHOOK_URL)
  );
}

async function ensureRuntimeDirectory() {
  await mkdir(runtimeDirectory, { recursive: true });
}

async function appendIntegrationLog(record: IntegrationLogRecord) {
  if (!isDemoModeEnabled()) {
    return;
  }

  await ensureRuntimeDirectory();

  let existing: IntegrationLogRecord[] = [];

  try {
    const content = await readFile(integrationLogPath, "utf8");
    existing = JSON.parse(content) as IntegrationLogRecord[];
  } catch {
    existing = [];
  }

  existing.unshift(record);

  await writeFile(
    integrationLogPath,
    JSON.stringify(existing.slice(0, 100), null, 2),
    "utf8",
  );
}

async function persistNotification(params: {
  channel: NotificationChannel;
  title: string;
  message: string;
  payload: Record<string, unknown>;
}) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await getDb().notification.create({
    data: {
      channel: params.channel,
      title: params.title,
      message: params.message,
      payload: params.payload as Prisma.InputJsonValue,
      status: NotificationStatus.SENT,
      sentAt: new Date(),
    },
  });
}

function buildManagerLabel(manager?: ManagerSnapshot | null) {
  if (!manager) {
    return "Не назначен";
  }

  const fullName = [manager.firstName, manager.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || manager.email || "Не назначен";
}

function hasManager(manager?: ManagerSnapshot | null) {
  return buildManagerLabel(manager) !== "Не назначен";
}

function areManagersEqual(
  left?: ManagerSnapshot | null,
  right?: ManagerSnapshot | null,
) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    (left.email ?? null) === (right.email ?? null) &&
    (left.firstName ?? null) === (right.firstName ?? null) &&
    (left.lastName ?? null) === (right.lastName ?? null)
  );
}

function buildMessengerLine(input: RequestIntegrationInput) {
  const channelLabel = input.messengerType
    ? (messengerTypeLabels[input.messengerType] ?? input.messengerType)
    : null;

  if (channelLabel && input.messengerHandle) {
    return `Связь: ${channelLabel} · ${input.messengerHandle}`;
  }

  if (channelLabel) {
    return `Связь: ${channelLabel}`;
  }

  if (input.messengerHandle) {
    return `Связь: ${input.messengerHandle}`;
  }

  return "";
}

function isUrgentRequest(input: RequestIntegrationInput) {
  const normalizedText =
    `${input.subject} ${input.message ?? ""}`.toLowerCase();
  return (
    normalizedText.includes("сроч") ||
    normalizedText.includes("urgent") ||
    normalizedText.includes("asap")
  );
}

function isCuttingRequest(input: RequestIntegrationInput) {
  if (input.requestType === "CUTTING_SERVICE") {
    return true;
  }

  const normalizedText =
    `${input.subject} ${input.message ?? ""}`.toLowerCase();
  return normalizedText.includes("распил");
}

function extractSummaryValue(
  message: string | null | undefined,
  label: string,
) {
  if (!message) {
    return null;
  }

  const line = message
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${label}:`));

  if (!line) {
    return null;
  }

  return line.slice(label.length + 1).trim() || null;
}

function extractClientComment(message: string | null | undefined) {
  if (!message) {
    return null;
  }

  const lines = message.split("\n");
  const commentIndex = lines.findIndex(
    (line) => line.trim() === "Комментарий клиента:",
  );

  if (commentIndex === -1) {
    return null;
  }

  const comment = lines
    .slice(commentIndex + 1)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" · ");

  return comment || null;
}

function buildRequestTelegramMessage(
  input: RequestIntegrationInput,
): TelegramMessagePayload {
  const urgent = isUrgentRequest(input);
  const cutting = isCuttingRequest(input);
  const formatLabel = extractSummaryValue(input.message, "Формат листа");
  const positionsLabel = extractSummaryValue(input.message, "Позиций");
  const piecesLabel = extractSummaryValue(input.message, "Деталей");
  const sheetsLabel = extractSummaryValue(input.message, "Листов по карте");
  const kimLabel = extractSummaryValue(input.message, "КИМ");
  const clientComment = extractClientComment(input.message);

  return {
    title: `${urgent ? "Срочная заявка" : cutting ? "Новая заявка на распил" : "Новая заявка"} ${input.number ?? input.id}`,
    threadKey: cutting ? "cutting" : "requests",
    actions: [
      {
        label: "Открыть заявку",
        url: absoluteUrl(`/admin/requests/${input.id}`),
      },
    ],
    lines: [
      `Тип: ${input.subject}`,
      `Клиент: ${input.contactName}`,
      `Телефон: ${input.contactPhone}`,
      input.contactEmail ? `Email: ${input.contactEmail}` : "",
      buildMessengerLine(input),
      input.material ? `Материал: ${input.material}` : "",
      formatLabel ? `Формат листа: ${formatLabel}` : "",
      positionsLabel ? `Позиций: ${positionsLabel}` : "",
      piecesLabel ? `Деталей: ${piecesLabel}` : "",
      input.edgeOption ? `Кромка: ${input.edgeOption}` : "",
      sheetsLabel ? `Листов по карте: ${sheetsLabel}` : "",
      kimLabel ? `КИМ: ${kimLabel}` : "",
      input.estimatedBudget
        ? `Ориентир: ${formatPrice(Math.round(input.estimatedBudget))}`
        : "",
      urgent ? "Приоритет: быстрый ответ менеджера" : "",
      input.deliveryNeeded ? "Доставка: нужна" : "",
      clientComment
        ? `Комментарий: ${clientComment}`
        : !cutting && input.message
          ? `Комментарий: ${input.message.split("\n").slice(0, 4).join(" · ")}`
          : "",
      "Раздел: /admin/requests",
    ].filter(Boolean),
  };
}

function buildOrderTelegramMessage(
  input: OrderIntegrationInput,
): TelegramMessagePayload {
  return {
    title: `Новый заказ ${input.number ?? input.id}`,
    threadKey: "orders",
    actions: [
      {
        label: "Открыть заказ",
        url: absoluteUrl(`/admin/orders/${input.id}`),
      },
    ],
    lines: [
      `Клиент: ${input.contactName}`,
      `Телефон: ${input.contactPhone}`,
      input.contactEmail ? `Email: ${input.contactEmail}` : "",
      input.companyName ? `Компания: ${input.companyName}` : "",
      `Сумма: ${formatPrice(Math.round(input.total))}`,
      input.discountTotal
        ? `Скидка: ${formatPrice(Math.round(input.discountTotal))}`
        : "",
      input.deliveryMethod ? `Доставка: ${input.deliveryMethod}` : "",
      `Позиций: ${input.items.length}`,
      ...input.items
        .slice(0, 5)
        .map(
          (item) =>
            `• ${item.name} · ${item.quantity} шт. · ${formatPrice(Math.round(item.total))}`,
        ),
      input.comment
        ? `Комментарий: ${input.comment.split("\n").slice(0, 3).join(" · ")}`
        : "",
      "Раздел: /admin/orders",
    ].filter(Boolean),
  };
}

function buildRequestStatusTelegramMessage(
  input: RequestIntegrationInput,
): TelegramMessagePayload | null {
  const statusChanged =
    typeof input.previousStatus === "string" &&
    input.previousStatus !== input.status;
  const managerChanged =
    input.previousManager !== undefined &&
    !areManagersEqual(input.previousManager, input.manager);
  const managerAssigned =
    !hasManager(input.previousManager) && hasManager(input.manager);
  const managerReassigned =
    hasManager(input.previousManager) &&
    hasManager(input.manager) &&
    !areManagersEqual(input.previousManager, input.manager);
  const managerRemoved =
    hasManager(input.previousManager) && !hasManager(input.manager);

  if (
    (input.previousStatus !== undefined ||
      input.previousManager !== undefined) &&
    !statusChanged &&
    !managerChanged
  ) {
    return null;
  }

  let title = `Artisan · заявка ${input.number ?? input.id} обновлена`;

  if (managerAssigned) {
    title = `Artisan · заявка ${input.number ?? input.id} назначена менеджеру`;
  } else if (managerReassigned) {
    title = `Artisan · заявка ${input.number ?? input.id} передана менеджеру`;
  } else if (managerRemoved) {
    title = `Artisan · заявка ${input.number ?? input.id} снята с менеджера`;
  } else if (statusChanged && input.status === "QUOTE_SENT") {
    title = `Artisan · по заявке ${input.number ?? input.id} отправлено КП`;
  } else if (statusChanged && input.status === "IN_PROGRESS") {
    title = `Artisan · заявка ${input.number ?? input.id} взята в работу`;
  } else if (statusChanged && input.status === "COMPLETED") {
    title = `Artisan · заявка ${input.number ?? input.id} завершена`;
  } else if (statusChanged && input.status === "CANCELED") {
    title = `Artisan · заявка ${input.number ?? input.id} отменена`;
  }

  return {
    title,
    threadKey: isCuttingRequest(input) ? "cutting" : "requests",
    actions: [
      {
        label: "Открыть заявку",
        url: absoluteUrl(`/admin/requests/${input.id}`),
      },
    ],
    lines: [
      `Статус: ${requestStatusLabels[input.status] ?? input.status}`,
      `Клиент: ${input.contactName}`,
      `Телефон: ${input.contactPhone}`,
      buildMessengerLine(input),
      input.material ? `Материал: ${input.material}` : "",
      input.edgeOption ? `Кромка: ${input.edgeOption}` : "",
      `Менеджер: ${buildManagerLabel(input.manager)}`,
      "Раздел: /admin/requests",
    ].filter(Boolean),
  };
}

function buildOrderStatusTelegramMessage(
  input: OrderIntegrationInput,
): TelegramMessagePayload | null {
  const statusChanged =
    typeof input.previousStatus === "string" &&
    input.previousStatus !== input.status;
  const managerChanged =
    input.previousManager !== undefined &&
    !areManagersEqual(input.previousManager, input.manager);
  const managerAssigned =
    !hasManager(input.previousManager) && hasManager(input.manager);
  const managerReassigned =
    hasManager(input.previousManager) &&
    hasManager(input.manager) &&
    !areManagersEqual(input.previousManager, input.manager);
  const managerRemoved =
    hasManager(input.previousManager) && !hasManager(input.manager);

  if (
    (input.previousStatus !== undefined ||
      input.previousManager !== undefined) &&
    !statusChanged &&
    !managerChanged
  ) {
    return null;
  }

  let title = `Artisan · заказ ${input.number ?? input.id} обновлен`;

  if (statusChanged && input.status === "READY_FOR_PICKUP") {
    title = `Artisan · заказ ${input.number ?? input.id} готов к выдаче`;
  } else if (statusChanged && input.status === "SHIPPED") {
    title = `Artisan · заказ ${input.number ?? input.id} передан в доставку`;
  } else if (statusChanged && input.status === "COMPLETED") {
    title = `Artisan · заказ ${input.number ?? input.id} завершен`;
  } else if (statusChanged && input.status === "CANCELED") {
    title = `Artisan · заказ ${input.number ?? input.id} отменен`;
  } else if (managerAssigned) {
    title = `Artisan · заказ ${input.number ?? input.id} назначен менеджеру`;
  } else if (managerReassigned) {
    title = `Artisan · заказ ${input.number ?? input.id} передан менеджеру`;
  } else if (managerRemoved) {
    title = `Artisan · заказ ${input.number ?? input.id} снят с менеджера`;
  }

  return {
    title,
    threadKey: "orders",
    actions: [
      {
        label: "Открыть заказ",
        url: absoluteUrl(`/admin/orders/${input.id}`),
      },
    ],
    lines: [
      `Статус: ${orderStatusLabels[input.status] ?? input.status}`,
      `Клиент: ${input.contactName}`,
      `Телефон: ${input.contactPhone}`,
      `Сумма: ${formatPrice(Math.round(input.total))}`,
      `Менеджер: ${buildManagerLabel(input.manager)}`,
      input.deliveryMethod ? `Доставка: ${input.deliveryMethod}` : "",
      "Раздел: /admin/orders",
    ].filter(Boolean),
  };
}

async function sendTelegramMessage(payload: TelegramMessagePayload) {
  if (!isTelegramEnabled()) {
    await appendIntegrationLog({
      id: `telegram-skip-${Date.now()}`,
      channel: "telegram",
      status: "skipped",
      title: payload.title,
      message: payload.lines.join("\n"),
      payload,
      createdAt: new Date().toISOString(),
      error: "Telegram env vars are not configured.",
    });
    return;
  }

  const text = [`${payload.title}`, ...payload.lines].join("\n");
  const threadId = getTypedTelegramThreadId(payload.threadKey);

  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text,
        disable_web_page_preview: true,
        ...(payload.actions?.length
          ? {
              reply_markup: {
                inline_keyboard: payload.actions.map((action) => [
                  { text: action.label, url: action.url },
                ]),
              },
            }
          : {}),
        ...(threadId ? { message_thread_id: threadId } : {}),
      }),
    },
  );

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Telegram API error: ${response.status} ${responseText}`);
  }

  await persistNotification({
    channel: NotificationChannel.TELEGRAM,
    title: payload.title,
    message: text,
    payload,
  });

  await appendIntegrationLog({
    id: `telegram-${Date.now()}`,
    channel: "telegram",
    status: "sent",
    title: payload.title,
    message: text,
    payload,
    createdAt: new Date().toISOString(),
  });
}

function buildClientRequestCreatedMessage(input: RequestIntegrationInput) {
  const cutting = isCuttingRequest(input);

  return {
    title: cutting
      ? `Заявка на распил ${input.number ?? input.id} принята`
      : `Заявка ${input.number ?? input.id} принята`,
    lines: [
      `Статус: ${requestStatusLabels[input.status] ?? input.status}`,
      input.material ? `Материал: ${input.material}` : "",
      input.edgeOption ? `Кромка: ${input.edgeOption}` : "",
      input.estimatedBudget
        ? `Ориентир: ${formatPrice(Math.round(input.estimatedBudget))}`
        : "",
      "Менеджер проверит данные и обновит статус в личном кабинете.",
    ].filter(Boolean),
    actions: [
      {
        text: "Открыть заявки",
        url: absoluteUrl("/account/requests"),
      },
    ],
  };
}

function buildClientRequestStatusMessage(input: RequestIntegrationInput) {
  return {
    title: `Статус заявки ${input.number ?? input.id} обновлен`,
    lines: [
      `Теперь: ${requestStatusLabels[input.status] ?? input.status}`,
      `Менеджер: ${buildManagerLabel(input.manager)}`,
      input.estimatedBudget
        ? `Ориентир: ${formatPrice(Math.round(input.estimatedBudget))}`
        : "",
    ].filter(Boolean),
    actions: [
      {
        text: "Открыть заявку",
        url: absoluteUrl("/account/requests"),
      },
    ],
  };
}

function buildClientOrderCreatedMessage(input: OrderIntegrationInput) {
  return {
    title: `Заказ ${input.number ?? input.id} принят`,
    lines: [
      `Статус: ${orderStatusLabels[input.status] ?? input.status}`,
      `Сумма: ${formatPrice(Math.round(input.total))}`,
      input.loyaltyPointsDelta
        ? `Баллы к начислению: ${input.loyaltyPointsDelta}`
        : "Баллы начисляются после подтверждения менеджером.",
    ].filter(Boolean),
    actions: [
      {
        text: "Открыть заказы",
        url: absoluteUrl("/account/orders"),
      },
    ],
  };
}

function buildClientOrderStatusMessage(input: OrderIntegrationInput) {
  return {
    title: `Статус заказа ${input.number ?? input.id} обновлен`,
    lines: [
      `Теперь: ${orderStatusLabels[input.status] ?? input.status}`,
      `Сумма: ${formatPrice(Math.round(input.total))}`,
      `Менеджер: ${buildManagerLabel(input.manager)}`,
    ],
    actions: [
      {
        text: "Открыть заказ",
        url: absoluteUrl("/account/orders"),
      },
    ],
  };
}

export async function sendTelegramTestNotification(
  threadKey: TelegramThreadKey,
) {
  const config = getTelegramConfigurationStatus();

  if (!config.enabled) {
    return {
      ok: false,
      message: `Telegram не настроен: ${config.missingEnv.join(", ") || "проверьте env"}.`,
    };
  }

  try {
    await sendTelegramMessage({
      title: `Artisan · тест Telegram (${threadKey})`,
      threadKey,
      lines: [
        "Проверка уведомлений с сайта Artisan.",
        threadKey === "cutting"
          ? "Канал: заявки на распил."
          : threadKey === "orders"
            ? "Канал: онлайн-покупки и заказы."
            : "Канал: общие заявки.",
        "Если сообщение пришло в правильную тему, настройка работает.",
      ],
    });

    return { ok: true, message: "Тестовое сообщение отправлено." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Telegram вернул неизвестную ошибку.",
    };
  }
}

function getOneCAuthorizationHeader() {
  if (process.env.ONE_C_API_KEY) {
    return `Bearer ${process.env.ONE_C_API_KEY}`;
  }

  if (process.env.ONE_C_USERNAME && process.env.ONE_C_PASSWORD) {
    const token = Buffer.from(
      `${process.env.ONE_C_USERNAME}:${process.env.ONE_C_PASSWORD}`,
      "utf8",
    ).toString("base64");

    return `Basic ${token}`;
  }

  return null;
}

async function pushOneCEvent(event: OneCEventPayload) {
  if (!isOneCEnabled()) {
    await appendIntegrationLog({
      id: `onec-skip-${Date.now()}`,
      channel: "1c",
      status: "skipped",
      title: event.event,
      message: `${event.entityType} ${event.entityId}`,
      payload: event.payload,
      createdAt: new Date().toISOString(),
      error: "1C env vars are not configured.",
    });
    return;
  }

  const authorizationHeader = getOneCAuthorizationHeader();
  const response = await fetch(process.env.ONE_C_WEBHOOK_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
      "X-Artisan-Event": event.event,
    },
    body: JSON.stringify({
      source: "artisan",
      occurredAt: new Date().toISOString(),
      event: event.event,
      entityType: event.entityType,
      entityId: event.entityId,
      payload: event.payload,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`1C sync error: ${response.status} ${responseText}`);
  }

  await persistNotification({
    channel: NotificationChannel.INTERNAL,
    title: `1C ${event.event}`,
    message: `${event.entityType} ${event.entityId}`,
    payload: event.payload,
  });

  await appendIntegrationLog({
    id: `onec-${Date.now()}`,
    channel: "1c",
    status: "sent",
    title: event.event,
    message: `${event.entityType} ${event.entityId}`,
    payload: event.payload,
    createdAt: new Date().toISOString(),
  });
}

async function safelyRunIntegration(
  channel: "telegram" | "1c",
  title: string,
  payload: Record<string, unknown>,
  runner: () => Promise<void>,
) {
  try {
    await runner();
  } catch (error) {
    console.error(`[integrations:${channel}]`, error);
    await appendIntegrationLog({
      id: `${channel}-fail-${Date.now()}`,
      channel,
      status: "failed",
      title,
      message:
        error instanceof Error
          ? error.message
          : `Unknown ${channel} integration error`,
      payload,
      createdAt: new Date().toISOString(),
      error: error instanceof Error ? error.stack : String(error),
    });
  }
}

function buildRequestPayload(input: RequestIntegrationInput) {
  return {
    id: input.id,
    number: input.number,
    requestType: input.requestType ?? null,
    subject: input.subject,
    status: input.status,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    contactEmail: input.contactEmail ?? null,
    messengerType: input.messengerType ?? null,
    messengerHandle: input.messengerHandle ?? null,
    material: input.material ?? null,
    edgeOption: input.edgeOption ?? null,
    estimatedBudget: input.estimatedBudget ?? null,
    deliveryNeeded: input.deliveryNeeded ?? false,
    message: input.message ?? null,
    product: input.product ?? null,
    manager: buildManagerLabel(input.manager),
    createdAt: input.createdAt ?? null,
  };
}

function buildOrderPayload(input: OrderIntegrationInput) {
  return {
    id: input.id,
    number: input.number,
    status: input.status,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    contactEmail: input.contactEmail ?? null,
    companyName: input.companyName ?? null,
    comment: input.comment ?? null,
    deliveryMethod: input.deliveryMethod ?? null,
    total: input.total,
    subtotal: input.subtotal ?? null,
    discountTotal: input.discountTotal ?? null,
    deliveryTotal: input.deliveryTotal ?? null,
    manager: buildManagerLabel(input.manager),
    createdAt: input.createdAt ?? null,
    items: input.items,
  };
}

export async function handleCuttingRequestCreated(
  input: RequestIntegrationInput,
) {
  const requestPayload = buildRequestPayload(input);
  const telegramPayload = buildRequestTelegramMessage(input);
  const clientPayload = buildClientRequestCreatedMessage(input);

  await Promise.all([
    safelyRunIntegration(
      "telegram",
      telegramPayload.title,
      requestPayload,
      () => sendTelegramMessage(telegramPayload),
    ),
    ...(input.userId
      ? [
          safelyRunIntegration(
            "telegram",
            clientPayload.title,
            requestPayload,
            () =>
              sendTelegramDirectMessage(input.userId, {
                title: clientPayload.title,
                lines: clientPayload.lines,
                category: "requests",
                actions: clientPayload.actions,
              }).then(() => undefined),
          ),
        ]
      : []),
    safelyRunIntegration("1c", "request.created", requestPayload, () =>
      pushOneCEvent({
        event: "request.created",
        entityType: "request",
        entityId: input.id,
        payload: requestPayload,
      }),
    ),
  ]);
}

export async function handleRequestUpdated(input: RequestIntegrationInput) {
  const requestPayload = buildRequestPayload(input);
  const telegramPayload = buildRequestStatusTelegramMessage(input);
  const clientPayload = telegramPayload
    ? buildClientRequestStatusMessage(input)
    : null;

  await Promise.all([
    ...(telegramPayload
      ? [
          safelyRunIntegration(
            "telegram",
            telegramPayload.title,
            requestPayload,
            () => sendTelegramMessage(telegramPayload),
          ),
        ]
      : []),
    ...(clientPayload && input.userId
      ? [
          safelyRunIntegration(
            "telegram",
            clientPayload.title,
            requestPayload,
            () =>
              sendTelegramDirectMessage(input.userId, {
                title: clientPayload.title,
                lines: clientPayload.lines,
                category: "requests",
                actions: clientPayload.actions,
              }).then(() => undefined),
          ),
        ]
      : []),
    safelyRunIntegration("1c", "request.updated", requestPayload, () =>
      pushOneCEvent({
        event: "request.updated",
        entityType: "request",
        entityId: input.id,
        payload: requestPayload,
      }),
    ),
  ]);
}

export async function handleOrderCreated(input: OrderIntegrationInput) {
  const orderPayload = buildOrderPayload(input);
  const telegramPayload = buildOrderTelegramMessage(input);
  const clientPayload = buildClientOrderCreatedMessage(input);

  await Promise.all([
    safelyRunIntegration("telegram", telegramPayload.title, orderPayload, () =>
      sendTelegramMessage(telegramPayload),
    ),
    ...(input.userId
      ? [
          safelyRunIntegration(
            "telegram",
            clientPayload.title,
            orderPayload,
            () =>
              sendTelegramDirectMessage(input.userId, {
                title: clientPayload.title,
                lines: clientPayload.lines,
                category: "orders",
                actions: clientPayload.actions,
              }).then(() => undefined),
          ),
        ]
      : []),
    safelyRunIntegration("1c", "order.created", orderPayload, () =>
      pushOneCEvent({
        event: "order.created",
        entityType: "order",
        entityId: input.id,
        payload: orderPayload,
      }),
    ),
  ]);
}

export async function handleOrderUpdated(input: OrderIntegrationInput) {
  const orderPayload = buildOrderPayload(input);
  const telegramPayload = buildOrderStatusTelegramMessage(input);
  const clientPayload = telegramPayload
    ? buildClientOrderStatusMessage(input)
    : null;

  await Promise.all([
    ...(telegramPayload
      ? [
          safelyRunIntegration(
            "telegram",
            telegramPayload.title,
            orderPayload,
            () => sendTelegramMessage(telegramPayload),
          ),
        ]
      : []),
    ...(clientPayload && input.userId
      ? [
          safelyRunIntegration(
            "telegram",
            clientPayload.title,
            orderPayload,
            () =>
              sendTelegramDirectMessage(input.userId, {
                title: clientPayload.title,
                lines: clientPayload.lines,
                category: "orders",
                actions: clientPayload.actions,
              }).then(() => undefined),
          ),
        ]
      : []),
    safelyRunIntegration("1c", "order.updated", orderPayload, () =>
      pushOneCEvent({
        event: "order.updated",
        entityType: "order",
        entityId: input.id,
        payload: orderPayload,
      }),
    ),
  ]);
}
