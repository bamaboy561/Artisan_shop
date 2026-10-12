import "server-only";

import { importPKCS8, SignJWT } from "jose";

import {
  DiscountType,
  NotificationChannel,
  NotificationStatus,
  ProductStatus,
  PromotionStatus,
  PromotionTargetType,
  type Prisma,
} from "@/generated/prisma";
import { formatPrice } from "@/lib/commerce";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";
import { ensurePushDeviceSchema } from "@/lib/server/push-device-schema";

export type PushNotificationCategory =
  | "orders"
  | "requests"
  | "loyalty"
  | "promotions"
  | "manual";

export type PushDirectPayload = {
  title: string;
  lines: string[];
  category: PushNotificationCategory;
  actions?: Array<{ text: string; url: string }>;
};

export type PushSendResult = {
  configured: boolean;
  sent: number;
  failed: number;
  skipped: number;
};

type FirebaseServerConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

type CachedAccessToken = {
  value: string;
  expiresAt: number;
};

class FcmRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FcmRequestError";
  }
}

let cachedAccessToken: CachedAccessToken | null = null;

function getFirebaseServerConfig(): FirebaseServerConfig | null {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim().replace(
    /\\n/g,
    "\n",
  );

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return { projectId, clientEmail, privateKey };
}

export function isPushConfigured() {
  return Boolean(getFirebaseServerConfig());
}

async function getFirebaseAccessToken(config: FirebaseServerConfig) {
  const now = Math.floor(Date.now() / 1000);

  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.value;
  }

  const key = await importPKCS8(config.privateKey, "RS256");
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(config.clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const responseBody = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  } | null;

  if (!response.ok || !responseBody?.access_token) {
    throw new Error(
      responseBody?.error_description ||
        `Firebase OAuth error: ${response.status}`,
    );
  }

  cachedAccessToken = {
    value: responseBody.access_token,
    expiresAt: now + (responseBody.expires_in ?? 3600),
  };

  return cachedAccessToken.value;
}

function truncate(value: string, maxLength: number) {
  const normalized = value.trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getNotificationUrl(payload: PushDirectPayload) {
  const actionUrl = payload.actions?.find((action) => action.url)?.url;
  return absoluteUrl(actionUrl || "/account");
}

async function postFcmMessage(
  config: FirebaseServerConfig,
  installationId: string,
  payload: PushDirectPayload,
) {
  const accessToken = await getFirebaseAccessToken(config);
  const body = truncate(payload.lines.filter(Boolean).join("\n"), 900);
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        message: {
          fid: installationId,
          notification: {
            title: truncate(payload.title, 120),
            body,
          },
          data: {
            url: getNotificationUrl(payload),
            category: payload.category,
          },
          android: {
            priority: "high",
            notification: {
              channel_id: "artisan_updates",
            },
          },
        },
      }),
    },
  );

  if (response.status === 401) {
    cachedAccessToken = null;
  }

  if (!response.ok) {
    const responseText = await response.text();
    throw new FcmRequestError(
      `FCM error ${response.status}: ${truncate(responseText, 500)}`,
      response.status,
    );
  }
}

async function writePushNotification(params: {
  userId: string;
  payload: PushDirectPayload;
  status: NotificationStatus;
  sent: number;
  failed: number;
  error?: string;
}) {
  const db = getDb();
  await ensurePushDeviceSchema(db);
  await db.notification.create({
    data: {
      userId: params.userId,
      channel: NotificationChannel.PUSH,
      status: params.status,
      title: params.payload.title,
      message: params.error || params.payload.lines.filter(Boolean).join("\n"),
      payload: {
        category: params.payload.category,
        url: getNotificationUrl(params.payload),
        sentDevices: params.sent,
        failedDevices: params.failed,
      } as Prisma.InputJsonValue,
      sentAt: params.status === NotificationStatus.SENT ? new Date() : null,
    },
  });
}

export async function sendPushDirectMessage(
  userId: string | null | undefined,
  payload: PushDirectPayload,
): Promise<PushSendResult> {
  const config = getFirebaseServerConfig();

  if (!userId || !hasDatabaseUrl()) {
    return { configured: Boolean(config), sent: 0, failed: 0, skipped: 0 };
  }

  const db = getDb();
  await ensurePushDeviceSchema(db);
  const devices = await db.pushDevice.findMany({
    where: { userId, enabled: true },
    select: { id: true, installationId: true },
  });

  if (devices.length === 0) {
    return { configured: Boolean(config), sent: 0, failed: 0, skipped: 0 };
  }

  if (!config) {
    return {
      configured: false,
      sent: 0,
      failed: 0,
      skipped: devices.length,
    };
  }

  let sent = 0;
  let failed = 0;
  let lastError = "";

  await Promise.all(
    devices.map(async (device) => {
      try {
        await postFcmMessage(config, device.installationId, payload);
        sent += 1;
      } catch (error) {
        failed += 1;
        lastError = error instanceof Error ? error.message : String(error);

        if (error instanceof FcmRequestError && error.status === 404) {
          await db.pushDevice
            .update({ where: { id: device.id }, data: { enabled: false } })
            .catch((disableError) =>
              console.error("[push:disable-stale-device]", disableError),
            );
        }
      }
    }),
  );

  await writePushNotification({
    userId,
    payload,
    status: sent > 0 ? NotificationStatus.SENT : NotificationStatus.FAILED,
    sent,
    failed,
    error:
      sent === 0
        ? lastError || "Push notification was not delivered"
        : undefined,
  }).catch((error) => console.error("[push:notification-log]", error));

  return { configured: true, sent, failed, skipped: 0 };
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

function formatPromotionOffer(promotion: {
  discountType: DiscountType;
  discountValue: number;
}) {
  if (promotion.discountType === DiscountType.FIXED_AMOUNT) {
    return `Скидка ${formatPrice(promotion.discountValue)}`;
  }
  if (promotion.discountType === DiscountType.FIXED_PRICE) {
    return `Цена ${formatPrice(promotion.discountValue)}`;
  }
  return `Скидка ${promotion.discountValue}%`;
}

export async function sendPushPromotionBroadcast(promotionId: string) {
  if (!promotionId || !hasDatabaseUrl()) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      skipped: 0,
      message: "База данных недоступна.",
    };
  }

  const db = getDb();
  await ensurePushDeviceSchema(db);
  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    select: {
      name: true,
      description: true,
      status: true,
      badgeText: true,
      promoCode: true,
      discountType: true,
      discountValue: true,
      startsAt: true,
      endsAt: true,
      targetType: true,
      products: {
        take: 1,
        select: { product: { select: { slug: true, status: true } } },
      },
      categories: {
        take: 1,
        select: { category: { select: { slug: true } } },
      },
    },
  });

  const now = new Date();
  if (
    !promotion ||
    promotion.status !== PromotionStatus.ACTIVE ||
    (promotion.startsAt && promotion.startsAt > now) ||
    (promotion.endsAt && promotion.endsAt < now)
  ) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      skipped: 0,
      message: "Push-рассылка доступна только для активной акции.",
    };
  }

  const devices = await db.pushDevice.findMany({
    where: { enabled: true, user: { isActive: true } },
    distinct: ["userId"],
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });
  const payload: PushDirectPayload = {
    title: `${promotion.badgeText ?? "Акция"}: ${promotion.name}`,
    category: "promotions",
    lines: [
      formatPromotionOffer(promotion),
      promotion.description ?? "",
      promotion.promoCode ? `Промокод: ${promotion.promoCode}` : "",
    ].filter(Boolean),
    actions: [{ text: "Смотреть акцию", url: getPromotionHref(promotion) }],
  };

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let offset = 0; offset < devices.length; offset += 10) {
    const batch = devices.slice(offset, offset + 10);
    const results = await Promise.all(
      batch.map((device) => sendPushDirectMessage(device.userId, payload)),
    );
    for (const result of results) {
      sent += result.sent;
      failed += result.failed;
      skipped += result.skipped;
    }
  }

  return {
    ok: failed === 0 && (sent > 0 || devices.length === 0),
    sent,
    failed,
    skipped,
    message:
      devices.length === 0
        ? "Нет клиентов с привязанным Android-приложением."
        : `Android push: отправлено ${sent}, ошибок ${failed}, пропущено ${skipped}.`,
  };
}
