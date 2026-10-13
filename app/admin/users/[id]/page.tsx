import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { LoyaltyTransactionStatus } from "@/generated/prisma";
import { updateClientContactsAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { MetricCard } from "@/components/admin/metric-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { DataTable } from "@/components/ui/table";
import {
  getClientEmailLabel,
  isTechnicalClientEmail,
} from "@/features/admin/client-identity";
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
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const noticeMessages: Record<string, { ok: boolean; text: string }> = {
  created: {
    ok: true,
    text: "Клиент создан. Он уже может покупать в зале и копить баллы.",
  },
  exists: {
    ok: true,
    text: "Клиент с таким телефоном уже есть: открыта его карточка, новый не создан.",
  },
  "contacts-saved": { ok: true, text: "Контакты сохранены." },
  "contacts-invalid": {
    ok: false,
    text: "Не сохранено: проверьте имя, телефон и почту.",
  },
  "email-taken": {
    ok: false,
    text: "Не сохранено: эта почта уже занята другим аккаунтом.",
  },
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
  searchParams,
}: AdminUserProfilePageProps) {
  await requireAdminSession("/login?next=/admin/users", "/admin/users");

  const { id } = await params;
  const user = hasDatabaseUrl() ? await getAdminUserProfile(id) : null;

  if (!user) {
    notFound();
  }

  const noticeParam = (await searchParams)?.notice;
  const notice =
    noticeMessages[
      (Array.isArray(noticeParam) ? noticeParam[0] : noticeParam) ?? ""
    ];
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
          getClientEmailLabel(user.email),
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

      {notice ? (
        <p
          role="status"
          className={`rounded-[14px] border px-4 py-3 text-sm font-medium ${notice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}
        >
          {notice.text}
        </p>
      ) : null}

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

      <section className="rounded-[18px] border border-[color:var(--line)] bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Контакты
        </h2>
        <form
          action={updateClientContactsAction}
          className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1.3fr_auto] lg:items-end"
        >
          <input type="hidden" name="id" value={user.id} />
          <label className="grid gap-1.5 text-xs font-medium text-[var(--foreground)]">
            Имя
            <Input
              name="firstName"
              required
              maxLength={80}
              defaultValue={user.firstName ?? ""}
              className="h-10"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-[var(--foreground)]">
            Фамилия
            <Input
              name="lastName"
              maxLength={80}
              defaultValue={user.lastName ?? ""}
              className="h-10"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-[var(--foreground)]">
            Телефон
            <Input
              name="phone"
              type="tel"
              defaultValue={user.phone ?? ""}
              className="h-10"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-[var(--foreground)]">
            Компания
            <Input
              name="companyName"
              maxLength={120}
              defaultValue={user.companyName ?? ""}
              className="h-10"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-[var(--foreground)]">
            Почта
            <Input
              name="email"
              type="email"
              placeholder="Не указана"
              defaultValue={
                isTechnicalClientEmail(user.email) ? "" : user.email
              }
              className="h-10"
            />
          </label>
          <AdminSubmitButton
            type="submit"
            variant="secondary"
            size="sm"
            className="h-10"
            idleLabel="Сохранить"
            pendingLabel="Сохраняем..."
          />
        </form>
        {isTechnicalClientEmail(user.email) ? (
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            Клиент заведён по телефону, почты нет. В личный кабинет на сайте он
            сможет войти после того, как здесь укажут его настоящую почту и он
            задаст пароль через «Забыли пароль?».
          </p>
        ) : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
