import Link from "next/link";
import { notFound } from "next/navigation";

import {
  approveLoyaltyTransactionAction,
  cancelLoyaltyTransactionAction,
  createOfflineLoyaltyPurchaseAction,
} from "@/app/admin/actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  LoyaltyTransactionStatus,
  LoyaltyTransactionType,
} from "@/generated/prisma";
import { requireAdminPermission } from "@/lib/auth/dal";
import { formatPrice } from "@/lib/commerce";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { getLoyaltyProgramConfig } from "@/lib/server/loyalty-settings";
import {
  estimateLoyaltyPoints,
  getEffectiveDiscountPercent,
  getLoyaltyTierBenefits,
  getLoyaltyTierLabel,
} from "@/lib/server/pricing";

export const dynamic = "force-dynamic";

type AdminUserDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function getTransactionStatusTone(status: LoyaltyTransactionStatus) {
  if (status === LoyaltyTransactionStatus.APPROVED) {
    return "success" as const;
  }

  if (status === LoyaltyTransactionStatus.PENDING) {
    return "warning" as const;
  }

  return "neutral" as const;
}

function getTransactionStatusLabel(status: LoyaltyTransactionStatus) {
  const labels: Record<LoyaltyTransactionStatus, string> = {
    [LoyaltyTransactionStatus.PENDING]: "Ожидает подтверждения",
    [LoyaltyTransactionStatus.APPROVED]: "Подтверждено",
    [LoyaltyTransactionStatus.CANCELED]: "Отменено",
  };

  return labels[status];
}

function getTransactionTypeLabel(type: LoyaltyTransactionType) {
  const labels: Record<LoyaltyTransactionType, string> = {
    [LoyaltyTransactionType.ORDER_ACCRUAL]: "За заказ",
    [LoyaltyTransactionType.BONUS_ACCRUAL]: "Бонус",
    [LoyaltyTransactionType.REDEMPTION]: "Списание",
    [LoyaltyTransactionType.MANUAL_ADJUSTMENT]: "Корректировка",
  };

  return labels[type];
}

export default async function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps) {
  if (!hasDatabaseUrl()) {
    notFound();
  }

  const { id } = await params;
  await requireAdminPermission(
    `/admin/users/${id}`,
    `/login?next=/admin/users/${id}`,
  );

  const db = getDb();
  const [user, loyaltyConfig] = await Promise.all([
    db.user.findUnique({
      where: { id },
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
        createdAt: true,
        role: {
          select: {
            name: true,
          },
        },
        orders: {
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
          select: {
            id: true,
            number: true,
            total: true,
            status: true,
            createdAt: true,
          },
        },
        loyaltyTransactions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
          select: {
            id: true,
            type: true,
            status: true,
            points: true,
            balanceAfter: true,
            title: true,
            description: true,
            createdAt: true,
            order: {
              select: {
                number: true,
              },
            },
          },
        },
      },
    }),
    getLoyaltyProgramConfig(),
  ]);

  if (!user) {
    notFound();
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const tierBenefits = getLoyaltyTierBenefits(user.loyaltyTier, loyaltyConfig);
  const effectiveDiscount = getEffectiveDiscountPercent(user, loyaltyConfig);
  const pendingTransactions = user.loyaltyTransactions.filter(
    (transaction) => transaction.status === LoyaltyTransactionStatus.PENDING,
  );
  const pendingPoints = pendingTransactions.reduce(
    (sum, transaction) => sum + Math.max(0, transaction.points),
    0,
  );
  const examplePurchaseTotal = 10000;
  const examplePoints = estimateLoyaltyPoints(
    examplePurchaseTotal,
    user.loyaltyTier,
    loyaltyConfig,
  );

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading
            title={displayName}
            description="Карточка клиента для привязки офлайн-покупок, подтверждения бонусов и быстрой проверки статуса."
            titleClassName="text-2xl sm:text-3xl"
            descriptionClassName="max-w-3xl text-sm leading-7"
          />
          <Link
            href="/admin/users"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[color:var(--line-strong)] px-4 font-mono text-[10px] font-semibold tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
          >
            Все клиенты
          </Link>
          <Link
            href={`/admin/sales?client=${user.id}`}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--accent)] px-4 font-mono text-[10px] font-semibold tracking-[0.14em] text-white uppercase transition hover:bg-[var(--accent-strong)]"
          >
            Продажа в зале
          </Link>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-4">
          <article className="rounded-[24px] border border-[color:var(--line)] bg-white/92 p-5 shadow-[0_18px_44px_rgba(17,17,17,0.04)]">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="accent">
                {getLoyaltyTierLabel(user.loyaltyTier, loyaltyConfig)}
              </StatusBadge>
              <StatusBadge tone="neutral">{user.role.name}</StatusBadge>
              {pendingPoints > 0 ? (
                <StatusBadge tone="warning">
                  +{formatNumber(pendingPoints)} ожидают
                </StatusBadge>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-[var(--surface)] p-4">
                <p className="text-xs text-[var(--muted)]">Баланс</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                  {formatNumber(user.loyaltyPointsBalance)}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface)] p-4">
                <p className="text-xs text-[var(--muted)]">Накоплено</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                  {formatNumber(user.loyaltyPointsLifetime)}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface)] p-4">
                <p className="text-xs text-[var(--muted)]">Скидка</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                  {effectiveDiscount}%
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface)] p-4">
                <p className="text-xs text-[var(--muted)]">Кэшбэк</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                  {tierBenefits.accrualPercent}%
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
              <p>Email: {user.email}</p>
              <p>Телефон: {user.phone ?? "не указан"}</p>
              <p>Компания: {user.companyName ?? "частный клиент"}</p>
              <p>С нами с: {formatDate(user.createdAt)}</p>
            </div>
          </article>

          <article className="rounded-[24px] border border-[color:var(--line)] bg-white/92 p-5 shadow-[0_18px_44px_rgba(17,17,17,0.04)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
                  Бонусные операции
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                  История и подтверждение
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-[var(--muted)]">
                Pending-начисления не входят в баланс клиента, пока менеджер не
                подтвердит оплату или выдачу заказа.
              </p>
            </div>

            <div className="mt-5 grid gap-2">
              {user.loyaltyTransactions.length > 0 ? (
                user.loyaltyTransactions.map((transaction) => (
                  <article
                    key={transaction.id}
                    className="rounded-[18px] border border-[color:var(--line)] bg-[var(--surface)] p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--foreground)]">
                            {transaction.title}
                          </p>
                          <StatusBadge
                            tone={getTransactionStatusTone(transaction.status)}
                          >
                            {getTransactionStatusLabel(transaction.status)}
                          </StatusBadge>
                          <StatusBadge tone="neutral">
                            {getTransactionTypeLabel(transaction.type)}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                          {formatDate(transaction.createdAt)}
                          {transaction.order?.number
                            ? ` · заказ ${transaction.order.number}`
                            : ""}
                          {transaction.description
                            ? ` · ${transaction.description}`
                            : ""}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-semibold text-[var(--foreground)]">
                            {transaction.points >= 0 ? "+" : ""}
                            {formatNumber(transaction.points)}
                          </p>
                          <p className="text-[11px] text-[var(--muted)]">
                            баланс {formatNumber(transaction.balanceAfter)}
                          </p>
                        </div>

                        {transaction.status ===
                        LoyaltyTransactionStatus.PENDING ? (
                          <div className="flex gap-1">
                            <form action={approveLoyaltyTransactionAction}>
                              <input
                                type="hidden"
                                name="transactionId"
                                value={transaction.id}
                              />
                              <Button type="submit" variant="accent" size="sm">
                                Подтвердить
                              </Button>
                            </form>
                            <form action={cancelLoyaltyTransactionAction}>
                              <input
                                type="hidden"
                                name="transactionId"
                                value={transaction.id}
                              />
                              <Button
                                type="submit"
                                variant="secondary"
                                size="sm"
                              >
                                Отмена
                              </Button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[18px] border border-[color:var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
                  Пока нет бонусных операций.
                </div>
              )}
            </div>
          </article>
        </div>

        <aside className="grid gap-4 self-start">
          <article className="rounded-[24px] border border-[color:var(--line)] bg-[#111111] p-5 text-white shadow-[0_22px_58px_rgba(17,17,17,0.16)]">
            <p className="font-mono text-[10px] tracking-[0.22em] text-white/46 uppercase">
              Быстрое начисление
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
              Покупка без подбора товаров
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/58">
              Используйте этот блок, если нужно быстро начислить бонусы по
              общей сумме. Если менеджер комплектует товары для клиента,
              лучше открыть полноценную продажу в зале.
            </p>
            <Link
              href={`/admin/sales?client=${user.id}`}
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-white px-4 font-mono text-[10px] font-semibold tracking-[0.14em] text-[#111111] uppercase transition hover:bg-white/86"
            >
              Собрать товары
            </Link>

            <form
              action={createOfflineLoyaltyPurchaseAction}
              className="mt-5 grid gap-3"
            >
              <input type="hidden" name="userId" value={user.id} />
              <label className="grid gap-1.5 text-sm">
                Сумма покупки, сом
                <Input
                  name="purchaseTotal"
                  type="number"
                  min="1"
                  placeholder="Например 12500"
                  required
                  className="border-white/10 bg-white text-[#111111]"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                Кассовый чек
                <Input
                  name="receiptNumber"
                  placeholder="Если есть, необязательно"
                  className="border-white/10 bg-white text-[#111111]"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                Комментарий
                <Input
                  name="description"
                  placeholder="Например: фурнитура, самовывоз"
                  className="border-white/10 bg-white text-[#111111]"
                />
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-sm text-white/72">
                <input
                  type="checkbox"
                  name="approveNow"
                  defaultChecked
                  className="mt-1"
                />
                <span>
                  Начислить сразу. Если снять галочку, операция попадет в
                  ожидание подтверждения.
                </span>
              </label>
              <Button type="submit" variant="accent" className="w-full">
                Начислить по сумме
              </Button>
            </form>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-sm text-white/58">
              Пример: с покупки {formatPrice(examplePurchaseTotal)} клиент
              получит примерно{" "}
              <strong className="text-white">
                {formatNumber(examplePoints)}
              </strong>{" "}
              баллов.
            </div>
          </article>

          <article className="rounded-[24px] border border-[color:var(--line)] bg-white/92 p-5">
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
              Последние заказы
            </p>
            <div className="mt-4 grid gap-2">
              {user.orders.length > 0 ? (
                user.orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--foreground)]">
                          {order.number ?? order.id.slice(0, 8)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <StatusBadge tone="neutral">{order.status}</StatusBadge>
                    </div>
                    <p className="mt-2 font-semibold text-[var(--foreground)]">
                      {formatPrice(order.total)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] p-3 text-sm text-[var(--muted)]">
                  Заказов пока нет.
                </p>
              )}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
