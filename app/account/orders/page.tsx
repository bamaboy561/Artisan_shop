import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { DataTable } from "@/components/ui/table";
import { hasDatabaseUrl } from "@/lib/db";
import { getAccountOrders, getAccountUser } from "@/lib/server/account-data";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KGS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default async function AccountOrdersPage() {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="История заказов откроется после подключения базы данных"
        description="Здесь будут все ваши заказы, статусы, суммы и начисления баллов по завершённым сделкам."
        steps={[
          "Добавьте DATABASE_URL в .env.",
          "Примените Prisma-схему через prisma db push или prisma migrate dev.",
          "После первого реального заказа история появится здесь автоматически.",
        ]}
      />
    );
  }

  const user = await getAccountUser();

  if (!user) {
    return null;
  }

  const orders = await getAccountOrders(user.id);

  const rows = orders.map((order) => ({
    order: (
      <div className="space-y-1">
        <p className="font-semibold text-[var(--foreground)]">
          {order.number ?? order.id.slice(0, 8)}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {formatDate(order.createdAt)}
        </p>
      </div>
    ),
    delivery: (
      <div className="space-y-1">
        <p>{order.deliveryMethod?.name ?? "Самовывоз"}</p>
        <p className="text-xs text-[var(--muted)]">
          Скидка: {formatCurrency(order.discountTotal)}
        </p>
        {order.appliedPromoCode || order.loyaltyRedemptionTotal > 0 ? (
          <p className="text-xs text-[var(--muted)]">
            {order.appliedPromoCode
              ? `Промокод: ${order.appliedPromoCode}`
              : "Без промокода"}
            {order.loyaltyRedemptionTotal > 0
              ? ` · Списано баллов: ${formatCurrency(order.loyaltyRedemptionTotal)}`
              : ""}
          </p>
        ) : null}
      </div>
    ),
    status: <StatusBadge tone="accent">{order.status}</StatusBadge>,
    total: (
      <div className="space-y-1">
        <p>{formatCurrency(order.total)}</p>
        <p className="text-xs text-[var(--muted)]">
          Баллы: +
          {order.loyaltyTransactions.reduce(
            (sum, transaction) => sum + Math.max(0, transaction.points),
            0,
          )}
        </p>
      </div>
    ),
    updated: formatDate(order.updatedAt),
  }));

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="История заказов"
          description="Все оформленные заказы, суммы, доставка и начисленные баллы по программе лояльности."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-2xl text-sm leading-7"
        />
      </section>

      <DataTable
        columns={[
          { key: "order", label: "Заказ" },
          { key: "delivery", label: "Доставка и скидка" },
          { key: "status", label: "Статус" },
          { key: "total", label: "Сумма и баллы" },
          { key: "updated", label: "Обновлён" },
        ]}
        rows={rows}
        caption="Заказы"
        emptyMessage="После первого оформления заказа история появится здесь."
      />
    </div>
  );
}
