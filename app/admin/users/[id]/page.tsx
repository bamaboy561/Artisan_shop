import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { LoyaltyTransactionStatus } from "@/generated/prisma";
import { MetricCard } from "@/components/admin/metric-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { DataTable } from "@/components/ui/table";
import {
  activeOrderStatuses,
  activeRequestStatuses,
  orderStatusLabels,
  requestStatusLabels,
  requestTypeLabels,
} from "@/features/admin/operations-filters";
import { requireAdminSession } from "@/lib/auth/dal";
import { formatPrice } from "@/lib/commerce";
import { hasDatabaseUrl } from "@/lib/db";
import { revenueOrderStatuses } from "@/lib/server/admin-data";
import { getLoyaltyProgramConfig } from "@/lib/server/loyalty-settings";
import { getLoyaltyTierLabel } from "@/lib/server/pricing";
import { getAdminUserProfile } from "@/lib/server/users-admin";

export const dynamic = "force-dynamic";

type AdminUserProfilePageProps = {
  params: Promise<{ id: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const loyaltyStatusLabels: Record<LoyaltyTransactionStatus, string> = {
  [LoyaltyTransactionStatus.PENDING]: "Ожидает",
  [LoyaltyTransactionStatus.APPROVED]: "Проведено",
  [LoyaltyTransactionStatus.CANCELED]: "Отменено",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export default async function AdminUserProfilePage({
  params,
}: AdminUserProfilePageProps) {
  await requireAdminSession("/login?next=/admin/users", "/admin/users");

  const { id } = await params;
  const user = hasDatabaseUrl() ? await getAdminUserProfile(id) : null;

  if (!user) {
    notFound();
  }

  const loyaltyConfig = await getLoyaltyProgramConfig();
  const clientName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const paidOrders = user.orders.filter((order) =>
    revenueOrderStatuses.has(order.status),
  );
  const spentTotal = paidOrders.reduce((sum, order) => sum + order.total, 0);
  const averageOrder =
    paidOrders.length > 0 ? Math.round(spentTotal / paidOrders.length) : 0;
  const lastOrder = user.orders[0];
  const activeCount =
    user.orders.filter((order) => activeOrderStatuses.has(order.status))
      .length +
    user.requests.filter((request) => activeRequestStatuses.has(request.status))
      .length;

  return (
    <div className="grid gap-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="size-4" /> Все клиенты
      </Link>

      <SectionHeading
        title={clientName}
        description={[
          user.companyName,
          user.phone,
          user.email,
          user.telegramChatId
            ? user.telegramUsername
              ? `Telegram @${user.telegramUsername}`
              : "Telegram привязан"
            : "Telegram не привязан",
        ]
          .filter(Boolean)
          .join(" · ")}
        titleClassName="text-3xl sm:text-4xl"
      />

      <div className="flex flex-wrap gap-2">
        <StatusBadge tone="neutral">{user.role.name}</StatusBadge>
        <StatusBadge tone="accent">
          {getLoyaltyTierLabel(user.loyaltyTier, loyaltyConfig)}
        </StatusBadge>
        {user.personalDiscountPercent ? (
          <StatusBadge tone="success">
            Личная скидка {user.personalDiscountPercent}%
          </StatusBadge>
        ) : null}
        <StatusBadge tone="neutral">
          Клиент с {dateFormatter.format(user.createdAt)}
        </StatusBadge>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <MetricCard
          label="Покупки"
          value={formatPrice(spentTotal)}
          detail={`Подтверждённых заказов: ${paidOrders.length} из ${user._count.orders}`}
        />
        <MetricCard
          label="Средний заказ"
          value={formatPrice(averageOrder)}
          detail={
            lastOrder
              ? `Последний заказ ${dateFormatter.format(lastOrder.createdAt)}`
              : "Заказов пока нет"
          }
          tone="neutral"
        />
        <MetricCard
          label="Сейчас в работе"
          value={activeCount}
          detail={`Заявок всего: ${user._count.requests}`}
          tone={activeCount > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Бонусы"
          value={formatNumber(user.loyaltyPointsBalance)}
          detail={`Накоплено за всё время: ${formatNumber(user.loyaltyPointsLifetime)}`}
          tone="success"
        />
      </div>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Заказы
        </h2>
        <DataTable
          emptyMessage="У клиента пока нет заказов."
          columns={[
            { key: "number", label: "Заказ" },
            { key: "date", label: "Дата" },
            { key: "items", label: "Позиций" },
            { key: "total", label: "Сумма" },
            { key: "status", label: "Статус" },
          ]}
          rows={user.orders.map((order) => ({
            number: (
              <Link
                href={`/admin/orders/${order.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {order.number ?? "Без номера"}
              </Link>
            ),
            date: dateFormatter.format(order.createdAt),
            items: order._count.items,
            total: formatPrice(order.total),
            status: (
              <StatusBadge
                tone={
                  activeOrderStatuses.has(order.status) ? "warning" : "neutral"
                }
              >
                {orderStatusLabels[order.status]}
              </StatusBadge>
            ),
          }))}
        />
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Заявки и распил
        </h2>
        <DataTable
          emptyMessage="У клиента пока нет заявок."
          columns={[
            { key: "number", label: "Заявка" },
            { key: "date", label: "Дата" },
            { key: "type", label: "Тип" },
            { key: "total", label: "Сумма" },
            { key: "status", label: "Статус" },
          ]}
          rows={user.requests.map((request) => ({
            number: (
              <Link
                href={`/admin/requests/${request.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {request.number ?? request.subject}
              </Link>
            ),
            date: dateFormatter.format(request.createdAt),
            type: requestTypeLabels[request.type],
            total:
              typeof request.quotedTotal === "number"
                ? formatPrice(request.quotedTotal)
                : "—",
            status: (
              <StatusBadge
                tone={
                  activeRequestStatuses.has(request.status)
                    ? "warning"
                    : "neutral"
                }
              >
                {requestStatusLabels[request.status]}
              </StatusBadge>
            ),
          }))}
        />
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Бонусные операции
        </h2>
        <DataTable
          emptyMessage="Операций по баллам пока нет."
          columns={[
            { key: "date", label: "Дата" },
            { key: "title", label: "Операция" },
            { key: "points", label: "Баллы" },
            { key: "balance", label: "Баланс после" },
            { key: "status", label: "Статус" },
          ]}
          rows={user.loyaltyTransactions.map((transaction) => ({
            date: dateFormatter.format(transaction.createdAt),
            title: transaction.title,
            points: `${transaction.points > 0 ? "+" : ""}${formatNumber(transaction.points)}`,
            balance: formatNumber(transaction.balanceAfter),
            status: loyaltyStatusLabels[transaction.status],
          }))}
        />
      </section>
    </div>
  );
}
