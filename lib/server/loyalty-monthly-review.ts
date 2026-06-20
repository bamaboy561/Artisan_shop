import "server-only";

import {
  LoyaltyTier,
  NotificationChannel,
  NotificationStatus,
  OrderStatus,
  RoleCode,
  type Prisma,
} from "@/generated/prisma";
import { formatPrice } from "@/lib/commerce";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { getLoyaltyProgramConfig } from "@/lib/server/loyalty-settings";
import {
  getLoyaltyTierBenefits,
  getLoyaltyTierForMonthlyPurchaseTotal,
  getLoyaltyTierLabel,
} from "@/lib/server/pricing";
import { sendBotMessage } from "@/lib/server/telegram-bot";

const loyaltyReviewSettingPrefix = "loyalty.monthly-review.";
const loyaltyTimezoneOffsetMs = 6 * 60 * 60 * 1000;

export type LoyaltyReviewPeriod = {
  key: string;
  start: Date;
  end: Date;
  label: string;
};

function padMonth(value: number) {
  return String(value).padStart(2, "0");
}

function getLocalMonthParts(date: Date) {
  const shifted = new Date(date.getTime() + loyaltyTimezoneOffsetMs);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
  };
}

function buildLoyaltyPeriod(year: number, month: number): LoyaltyReviewPeriod {
  const start = new Date(Date.UTC(year, month, 1) - loyaltyTimezoneOffsetMs);
  const end = new Date(Date.UTC(year, month + 1, 1) - loyaltyTimezoneOffsetMs);
  const localMonth = new Date(Date.UTC(year, month, 1));
  const key = `${localMonth.getUTCFullYear()}-${padMonth(
    localMonth.getUTCMonth() + 1,
  )}`;
  const label = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(localMonth);

  return { key, start, end, label };
}

export function getCurrentLoyaltyReviewPeriod(now = new Date()) {
  const { year, month } = getLocalMonthParts(now);

  return buildLoyaltyPeriod(year, month);
}

export function getPreviousLoyaltyReviewPeriod(now = new Date()) {
  const { year, month } = getLocalMonthParts(now);

  return buildLoyaltyPeriod(year, month - 1);
}

function calculatePurchaseTotal(input: {
  subtotal: number | null;
  discountTotal: number | null;
  loyaltyRedemptionTotal: number | null;
}) {
  return Math.max(
    0,
    (input.subtotal ?? 0) -
      (input.discountTotal ?? 0) -
      (input.loyaltyRedemptionTotal ?? 0),
  );
}

export async function getUserLoyaltyPurchaseTotal(
  userId: string,
  period: LoyaltyReviewPeriod,
) {
  if (!hasDatabaseUrl()) {
    return 0;
  }

  const orders = await getDb().order.findMany({
    where: {
      userId,
      status: { not: OrderStatus.CANCELED },
      createdAt: {
        gte: period.start,
        lt: period.end,
      },
    },
    select: {
      subtotal: true,
      discountTotal: true,
      loyaltyRedemptionTotal: true,
    },
  });

  return orders.reduce(
    (sum, order) => sum + calculatePurchaseTotal(order),
    0,
  );
}

function getUserDisplayName(user: {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string;
}) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.companyName ||
    user.email
  );
}

function buildLoyaltyReviewMessage(params: {
  displayName: string;
  period: LoyaltyReviewPeriod;
  purchaseTotal: number;
  previousTier: LoyaltyTier;
  nextTier: LoyaltyTier;
  config: Awaited<ReturnType<typeof getLoyaltyProgramConfig>>;
}) {
  const benefits = getLoyaltyTierBenefits(params.nextTier, params.config);
  const previousLabel = getLoyaltyTierLabel(params.previousTier, params.config);
  const nextLabel = getLoyaltyTierLabel(params.nextTier, params.config);
  const changed = params.previousTier !== params.nextTier;

  return [
    changed ? "Ваш статус Artisan обновлен." : "Ежемесячный итог Artisan.",
    `Клиент: ${params.displayName}`,
    `Период: ${params.period.label}`,
    `Сумма закупок: ${formatPrice(params.purchaseTotal)}`,
    changed
      ? `Статус: ${previousLabel} -> ${nextLabel}`
      : `Статус: ${nextLabel}`,
    `Начисление: плитные материалы ${benefits.plateMaterialAccrualPercent}%, фурнитура ${benefits.fittingsAccrualPercent}%.`,
    "Новый пересчет пройдет в начале следующего месяца.",
  ].join("\n");
}

export async function runMonthlyLoyaltyReview(options: {
  now?: Date;
  force?: boolean;
  notify?: boolean;
} = {}) {
  if (!hasDatabaseUrl()) {
    return {
      ok: false,
      message: "DATABASE_URL is not configured.",
      reviewed: 0,
      changed: 0,
      notified: 0,
      failedNotifications: 0,
    };
  }

  const db = getDb();
  const period = getPreviousLoyaltyReviewPeriod(options.now ?? new Date());
  const settingKey = `${loyaltyReviewSettingPrefix}${period.key}`;

  if (!options.force) {
    const existingReview = await db.siteSetting.findUnique({
      where: { key: settingKey },
      select: { value: true },
    });

    if (existingReview) {
      return {
        ok: true,
        message: `Loyalty review for ${period.key} was already completed.`,
        period,
        reviewed: 0,
        changed: 0,
        notified: 0,
        failedNotifications: 0,
        alreadyReviewed: true,
      };
    }
  }

  const [config, users, orderSums] = await Promise.all([
    getLoyaltyProgramConfig(),
    db.user.findMany({
      where: {
        isActive: true,
        role: {
          code: {
            in: [RoleCode.CUSTOMER, RoleCode.DEALER],
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        loyaltyTier: true,
        telegramChatId: true,
        telegramNotifyLoyalty: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.order.groupBy({
      by: ["userId"],
      where: {
        userId: { not: null },
        status: { not: OrderStatus.CANCELED },
        createdAt: {
          gte: period.start,
          lt: period.end,
        },
      },
      _sum: {
        subtotal: true,
        discountTotal: true,
        loyaltyRedemptionTotal: true,
      },
    }),
  ]);

  const purchaseByUserId = new Map<string, number>();

  for (const row of orderSums) {
    if (!row.userId) {
      continue;
    }

    purchaseByUserId.set(
      row.userId,
      calculatePurchaseTotal({
        subtotal: row._sum.subtotal ?? 0,
        discountTotal: row._sum.discountTotal ?? 0,
        loyaltyRedemptionTotal: row._sum.loyaltyRedemptionTotal ?? 0,
      }),
    );
  }

  let changed = 0;
  let notified = 0;
  let failedNotifications = 0;
  const notify = options.notify ?? true;

  for (const user of users) {
    const purchaseTotal = purchaseByUserId.get(user.id) ?? 0;
    const nextTier = getLoyaltyTierForMonthlyPurchaseTotal(
      purchaseTotal,
      config,
    );
    const previousTier = user.loyaltyTier;
    const tierChanged = previousTier !== nextTier;

    if (tierChanged) {
      changed += 1;

      await db.user.update({
        where: { id: user.id },
        data: { loyaltyTier: nextTier },
      });
    }

    if (
      !notify ||
      !user.telegramChatId ||
      !user.telegramNotifyLoyalty ||
      (!tierChanged && purchaseTotal <= 0)
    ) {
      continue;
    }

    const title = tierChanged
      ? "Статус Artisan обновлен"
      : "Ежемесячный итог Artisan";
    const message = buildLoyaltyReviewMessage({
      displayName: getUserDisplayName(user),
      period,
      purchaseTotal,
      previousTier,
      nextTier,
      config,
    });
    const payload = {
      source: "loyalty.monthlyReview",
      periodKey: period.key,
      purchaseTotal,
      previousTier,
      nextTier,
    } as Prisma.InputJsonValue;

    try {
      await sendBotMessage(user.telegramChatId, message);
      notified += 1;

      await db.notification.create({
        data: {
          userId: user.id,
          channel: NotificationChannel.TELEGRAM,
          status: NotificationStatus.SENT,
          title,
          message,
          payload,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      failedNotifications += 1;

      await db.notification.create({
        data: {
          userId: user.id,
          channel: NotificationChannel.TELEGRAM,
          status: NotificationStatus.FAILED,
          title,
          message: error instanceof Error ? error.message : String(error),
          payload,
        },
      });
    }
  }

  await db.siteSetting.upsert({
    where: { key: settingKey },
    create: {
      key: settingKey,
      value: {
        periodKey: period.key,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        reviewed: users.length,
        changed,
        notified,
        failedNotifications,
      } as Prisma.InputJsonValue,
      description: "Monthly loyalty status review.",
    },
    update: {
      value: {
        periodKey: period.key,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        reviewed: users.length,
        changed,
        notified,
        failedNotifications,
      } as Prisma.InputJsonValue,
      description: "Monthly loyalty status review.",
    },
  });

  return {
    ok: true,
    message: `Loyalty review for ${period.key} completed.`,
    period,
    reviewed: users.length,
    changed,
    notified,
    failedNotifications,
  };
}
