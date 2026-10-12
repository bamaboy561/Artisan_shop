import "server-only";

import {
  CategoryKind,
  LoyaltyTier,
  NotificationChannel,
  NotificationStatus,
  OrderStatus,
  RoleCode,
  type Prisma,
} from "@/generated/prisma";
import { formatPrice } from "@/lib/commerce";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { sendClientDirectMessage } from "@/lib/server/client-notifications";
import { getLoyaltyProgramConfig } from "@/lib/server/loyalty-settings";
import {
  getHighestLoyaltyTier,
  getLoyaltyTierBenefits,
  getLoyaltyTierForPurchaseTotal,
  getLoyaltyTierLabel,
} from "@/lib/server/pricing";

const loyaltyReviewSettingPrefix = "loyalty.monthly-review.";
const loyaltyTimezoneOffsetMs = 6 * 60 * 60 * 1000;

export type LoyaltyReviewPeriod = {
  key: string;
  start: Date;
  end: Date;
  label: string;
};

export type LoyaltyPurchaseBreakdown = {
  total: number;
  plateMaterialTotal: number;
  fittingsTotal: number;
  otherTotal: number;
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

function createEmptyPurchaseBreakdown(): LoyaltyPurchaseBreakdown {
  return {
    total: 0,
    plateMaterialTotal: 0,
    fittingsTotal: 0,
    otherTotal: 0,
  };
}

function addPurchaseBreakdown(
  target: LoyaltyPurchaseBreakdown,
  source: LoyaltyPurchaseBreakdown,
) {
  target.total += source.total;
  target.plateMaterialTotal += source.plateMaterialTotal;
  target.fittingsTotal += source.fittingsTotal;
  target.otherTotal += source.otherTotal;

  return target;
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

function calculatePurchaseBreakdown(input: {
  subtotal: number | null;
  discountTotal: number | null;
  loyaltyRedemptionTotal: number | null;
  items: Array<{
    quantity: number;
    unitPrice: number;
    total: number;
    snapshotCategoryKind: CategoryKind | null;
    product: {
      category: {
        kind: CategoryKind;
      };
    } | null;
  }>;
}) {
  const total = calculatePurchaseTotal(input);
  const subtotal =
    input.subtotal ??
    input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const ratio = subtotal > 0 ? total / subtotal : 0;
  const breakdown = createEmptyPurchaseBreakdown();

  breakdown.total = total;

  for (const item of input.items) {
    const lineTotal = Math.max(0, item.unitPrice * item.quantity);
    const adjustedLineTotal = lineTotal * ratio;
    const categoryKind =
      item.snapshotCategoryKind ?? item.product?.category.kind;

    if (categoryKind === CategoryKind.PLATE) {
      breakdown.plateMaterialTotal += adjustedLineTotal;
    } else if (categoryKind === CategoryKind.FITTINGS) {
      breakdown.fittingsTotal += adjustedLineTotal;
    } else {
      breakdown.otherTotal += adjustedLineTotal;
    }
  }

  return {
    total: Math.round(breakdown.total),
    plateMaterialTotal: Math.round(breakdown.plateMaterialTotal),
    fittingsTotal: Math.round(breakdown.fittingsTotal),
    otherTotal: Math.round(breakdown.otherTotal),
  };
}

export async function getUserLoyaltyPurchaseTotal(
  userId: string,
  period: LoyaltyReviewPeriod,
) {
  return (await getUserLoyaltyPurchaseBreakdown(userId, period)).total;
}

export async function getUserLoyaltyPurchaseBreakdown(
  userId: string,
  period: LoyaltyReviewPeriod,
) {
  if (!hasDatabaseUrl()) {
    return createEmptyPurchaseBreakdown();
  }

  const orders = await getDb().order.findMany({
    where: {
      userId,
      status: {
        in: [
          OrderStatus.CONFIRMED,
          OrderStatus.PAID,
          OrderStatus.IN_PRODUCTION,
          OrderStatus.READY_FOR_PICKUP,
          OrderStatus.SHIPPED,
          OrderStatus.COMPLETED,
        ],
      },
      createdAt: {
        lt: period.end,
      },
    },
    select: {
      subtotal: true,
      discountTotal: true,
      loyaltyRedemptionTotal: true,
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          total: true,
          snapshotCategoryKind: true,
          product: {
            select: {
              category: {
                select: {
                  kind: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return orders.reduce(
    (sum, order) =>
      addPurchaseBreakdown(sum, calculatePurchaseBreakdown(order)),
    createEmptyPurchaseBreakdown(),
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
  purchaseBreakdown: LoyaltyPurchaseBreakdown;
  previousTier: LoyaltyTier;
  nextTier: LoyaltyTier;
  previousPlateMaterialTier: LoyaltyTier;
  nextPlateMaterialTier: LoyaltyTier;
  previousFittingsTier: LoyaltyTier;
  nextFittingsTier: LoyaltyTier;
  config: Awaited<ReturnType<typeof getLoyaltyProgramConfig>>;
}) {
  const previousLabel = getLoyaltyTierLabel(params.previousTier, params.config);
  const nextLabel = getLoyaltyTierLabel(params.nextTier, params.config);
  const previousPlateLabel = getLoyaltyTierLabel(
    params.previousPlateMaterialTier,
    params.config,
  );
  const nextPlateLabel = getLoyaltyTierLabel(
    params.nextPlateMaterialTier,
    params.config,
  );
  const previousFittingsLabel = getLoyaltyTierLabel(
    params.previousFittingsTier,
    params.config,
  );
  const nextFittingsLabel = getLoyaltyTierLabel(
    params.nextFittingsTier,
    params.config,
  );
  const plateBenefits = getLoyaltyTierBenefits(
    params.nextPlateMaterialTier,
    params.config,
  );
  const fittingsBenefits = getLoyaltyTierBenefits(
    params.nextFittingsTier,
    params.config,
  );
  const changed =
    params.previousTier !== params.nextTier ||
    params.previousPlateMaterialTier !== params.nextPlateMaterialTier ||
    params.previousFittingsTier !== params.nextFittingsTier;

  return [
    changed ? "Ваш статус Artisan обновлен." : "Ежемесячный итог Artisan.",
    `Клиент: ${params.displayName}`,
    `Расчет на конец периода: ${params.period.label}`,
    `Накопленный оборот: ${formatPrice(params.purchaseBreakdown.total)}`,
    `Плитные материалы: ${formatPrice(params.purchaseBreakdown.plateMaterialTotal)}`,
    `Фурнитура: ${formatPrice(params.purchaseBreakdown.fittingsTotal)}`,
    changed
      ? `Общий статус: ${previousLabel} -> ${nextLabel}`
      : `Общий статус: ${nextLabel}`,
    params.previousPlateMaterialTier !== params.nextPlateMaterialTier
      ? `Статус плит: ${previousPlateLabel} -> ${nextPlateLabel}`
      : `Статус плит: ${nextPlateLabel}`,
    params.previousFittingsTier !== params.nextFittingsTier
      ? `Статус фурнитуры: ${previousFittingsLabel} -> ${nextFittingsLabel}`
      : `Статус фурнитуры: ${nextFittingsLabel}`,
    `Начисление: плитные материалы ${plateBenefits.plateMaterialAccrualPercent}%, фурнитура ${fittingsBenefits.fittingsAccrualPercent}%.`,
    "Новый пересчет пройдет в начале следующего месяца.",
  ].join("\n");
}

export async function runMonthlyLoyaltyReview(
  options: {
    now?: Date;
    force?: boolean;
    notify?: boolean;
  } = {},
) {
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

    const reviewValue = existingReview?.value;
    const previousFailures =
      reviewValue &&
      typeof reviewValue === "object" &&
      !Array.isArray(reviewValue) &&
      "failedNotifications" in reviewValue &&
      typeof reviewValue.failedNotifications === "number"
        ? reviewValue.failedNotifications
        : 0;

    if (existingReview && previousFailures === 0) {
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

  const [config, users, orderSums, sentReceipts] = await Promise.all([
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
        plateMaterialLoyaltyTier: true,
        fittingsLoyaltyTier: true,
        telegramChatId: true,
        telegramNotifyLoyalty: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.order.findMany({
      where: {
        userId: { not: null },
        status: {
          in: [
            OrderStatus.CONFIRMED,
            OrderStatus.PAID,
            OrderStatus.IN_PRODUCTION,
            OrderStatus.READY_FOR_PICKUP,
            OrderStatus.SHIPPED,
            OrderStatus.COMPLETED,
          ],
        },
        createdAt: {
          lt: period.end,
        },
      },
      select: {
        userId: true,
        subtotal: true,
        discountTotal: true,
        loyaltyRedemptionTotal: true,
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            total: true,
            snapshotCategoryKind: true,
            product: {
              select: {
                category: {
                  select: {
                    kind: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.loyaltyMonthlyReviewReceipt.findMany({
      where: {
        periodKey: period.key,
        status: NotificationStatus.SENT,
      },
      select: { userId: true },
    }),
  ]);

  const purchaseByUserId = new Map<string, LoyaltyPurchaseBreakdown>();

  for (const order of orderSums) {
    if (!order.userId) {
      continue;
    }

    const current =
      purchaseByUserId.get(order.userId) ?? createEmptyPurchaseBreakdown();
    const next = addPurchaseBreakdown(
      current,
      calculatePurchaseBreakdown(order),
    );

    purchaseByUserId.set(order.userId, next);
  }

  let changed = 0;
  let notified = 0;
  let failedNotifications = 0;
  const notify = options.notify ?? true;
  const notifiedUserIds = new Set(sentReceipts.map(({ userId }) => userId));

  for (const user of users) {
    const purchaseBreakdown =
      purchaseByUserId.get(user.id) ?? createEmptyPurchaseBreakdown();
    const nextPlateMaterialTier = getLoyaltyTierForPurchaseTotal(
      purchaseBreakdown.plateMaterialTotal,
      config,
      "plateMaterial",
    );
    const nextFittingsTier = getLoyaltyTierForPurchaseTotal(
      purchaseBreakdown.fittingsTotal,
      config,
      "fittings",
    );
    const nextTier = getHighestLoyaltyTier([
      nextPlateMaterialTier,
      nextFittingsTier,
    ]);
    const previousTier = user.loyaltyTier;
    const previousPlateMaterialTier =
      user.plateMaterialLoyaltyTier ?? previousTier;
    const previousFittingsTier = user.fittingsLoyaltyTier ?? previousTier;
    const tierChanged =
      previousTier !== nextTier ||
      previousPlateMaterialTier !== nextPlateMaterialTier ||
      previousFittingsTier !== nextFittingsTier;

    if (tierChanged) {
      changed += 1;

      await db.user.update({
        where: { id: user.id },
        data: {
          loyaltyTier: nextTier,
          plateMaterialLoyaltyTier: nextPlateMaterialTier,
          fittingsLoyaltyTier: nextFittingsTier,
        },
      });
    }

    if (
      !notify ||
      (!tierChanged && notifiedUserIds.has(user.id)) ||
      (!tierChanged && purchaseBreakdown.total <= 0)
    ) {
      continue;
    }

    const title = tierChanged
      ? "Статус Artisan обновлен"
      : "Ежемесячный итог Artisan";
    const message = buildLoyaltyReviewMessage({
      displayName: getUserDisplayName(user),
      period,
      purchaseBreakdown,
      previousTier,
      nextTier,
      previousPlateMaterialTier,
      nextPlateMaterialTier,
      previousFittingsTier,
      nextFittingsTier,
      config,
    });
    const payload = {
      source: "loyalty.monthlyReview",
      periodKey: period.key,
      purchaseTotal: purchaseBreakdown.total,
      plateMaterialTotal: purchaseBreakdown.plateMaterialTotal,
      fittingsTotal: purchaseBreakdown.fittingsTotal,
      previousTier,
      nextTier,
      previousPlateMaterialTier,
      nextPlateMaterialTier,
      previousFittingsTier,
      nextFittingsTier,
    } as Prisma.InputJsonValue;

    const delivery = await sendClientDirectMessage(user.id, {
      title,
      category: "loyalty",
      lines: message.split(/\r?\n/).filter(Boolean),
      actions: [{ text: "Открыть бонусы", url: "/account" }],
    });
    const delivered = delivery.telegramSent || delivery.push.sent > 0;
    const deliveryFailed = delivery.telegramFailed || delivery.push.failed > 0;

    if (!delivered && !deliveryFailed) {
      continue;
    }

    if (delivery.telegramSent) {
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
    }

    if (delivered) {
      notified += 1;
      await db.loyaltyMonthlyReviewReceipt.upsert({
        where: {
          periodKey_userId: { periodKey: period.key, userId: user.id },
        },
        create: {
          periodKey: period.key,
          userId: user.id,
          status: NotificationStatus.SENT,
          sentAt: new Date(),
        },
        update: {
          status: NotificationStatus.SENT,
          error: null,
          sentAt: new Date(),
        },
      });
    } else {
      failedNotifications += 1;
      const errorMessage = "Не удалось доставить уведомление клиенту.";

      if (delivery.telegramFailed) {
        await db.notification.create({
          data: {
            userId: user.id,
            channel: NotificationChannel.TELEGRAM,
            status: NotificationStatus.FAILED,
            title,
            message: errorMessage,
            payload,
          },
        });
      }
      await db.loyaltyMonthlyReviewReceipt.upsert({
        where: {
          periodKey_userId: { periodKey: period.key, userId: user.id },
        },
        create: {
          periodKey: period.key,
          userId: user.id,
          status: NotificationStatus.FAILED,
          error: errorMessage,
        },
        update: {
          status: NotificationStatus.FAILED,
          error: errorMessage,
          sentAt: null,
        },
      });
    }
  }

  const [totalNotified, totalFailedNotifications] = await Promise.all([
    db.loyaltyMonthlyReviewReceipt.count({
      where: { periodKey: period.key, status: NotificationStatus.SENT },
    }),
    db.loyaltyMonthlyReviewReceipt.count({
      where: { periodKey: period.key, status: NotificationStatus.FAILED },
    }),
  ]);

  await db.siteSetting.upsert({
    where: { key: settingKey },
    create: {
      key: settingKey,
      value: {
        periodKey: period.key,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        calculationBasis: "lifetime-through-period-end",
        reviewed: users.length,
        changed,
        notified: totalNotified,
        failedNotifications: totalFailedNotifications,
      } as Prisma.InputJsonValue,
      description: "Monthly review of loyalty status by cumulative turnover.",
    },
    update: {
      value: {
        periodKey: period.key,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        calculationBasis: "lifetime-through-period-end",
        reviewed: users.length,
        changed,
        notified: totalNotified,
        failedNotifications: totalFailedNotifications,
      } as Prisma.InputJsonValue,
      description: "Monthly review of loyalty status by cumulative turnover.",
    },
  });

  return {
    ok: true,
    message: `Loyalty review for ${period.key} completed.`,
    period,
    reviewed: users.length,
    changed,
    notified: totalNotified,
    failedNotifications: totalFailedNotifications,
    notifiedThisRun: notified,
    failedThisRun: failedNotifications,
  };
}
