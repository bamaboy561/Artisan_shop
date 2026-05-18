import Link from "next/link";

import { MetricCard } from "@/components/admin/metric-card";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { DataTable } from "@/components/ui/table";
import { OrderStatus, RequestStatus } from "@/generated/prisma";
import { requireAdminSession } from "@/lib/auth/dal";
import { formatPrice } from "@/lib/commerce";
import { getDb, hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getOrderTone(status: OrderStatus) {
  if (status === OrderStatus.COMPLETED) return "success" as const;
  if (status === OrderStatus.CANCELED) return "warning" as const;
  if (
    status === OrderStatus.CONFIRMED ||
    status === OrderStatus.IN_PRODUCTION ||
    status === OrderStatus.READY_FOR_PICKUP
  ) {
    return "accent" as const;
  }
  return "neutral" as const;
}

function getRequestTone(status: RequestStatus) {
  if (status === RequestStatus.COMPLETED) return "success" as const;
  if (status === RequestStatus.CANCELED) return "warning" as const;
  if (
    status === RequestStatus.IN_REVIEW ||
    status === RequestStatus.QUOTE_SENT ||
    status === RequestStatus.IN_PROGRESS
  ) {
    return "accent" as const;
  }
  return "neutral" as const;
}

export default async function AdminMyPage() {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Кабинет менеджера заработает после подключения базы"
        description="Здесь менеджер увидит свои заказы, заявки и быстрый доступ к продаже в зале."
        steps={[
          "Подключите DATABASE_URL.",
          "Создайте менеджеров в админке.",
          "Назначайте заказы и заявки ответственным.",
        ]}
      />
    );
  }

  const session = await requireAdminSession("/login?next=/admin/my");
  const db = getDb();
  const [orders, requests, todaySales] = await Promise.all([
    db.order.findMany({
      where: {
        managerId: session.userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 8,
      select: {
        id: true,
        number: true,
        status: true,
        contactName: true,
        total: true,
        updatedAt: true,
      },
    }),
    db.request.findMany({
      where: {
        managerId: session.userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 8,
      select: {
        id: true,
        number: true,
        status: true,
        subject: true,
        contactName: true,
        updatedAt: true,
      },
    }),
    db.order.aggregate({
      where: {
        managerId: session.userId,
        completedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      _sum: {
        total: true,
      },
      _count: true,
    }),
  ]);
  const activeOrders = orders.filter(
    (order) =>
      order.status !== OrderStatus.COMPLETED &&
      order.status !== OrderStatus.CANCELED,
  );
  const activeRequests = requests.filter(
    (request) =>
      request.status !== RequestStatus.COMPLETED &&
      request.status !== RequestStatus.CANCELED,
  );

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-[color:var(--line)] bg-[#111111] p-5 text-white shadow-[0_22px_58px_rgba(17,17,17,0.16)] sm:p-7">
        <p className="font-mono text-[10px] tracking-[0.22em] text-white/42 uppercase">
          Рабочее место менеджера
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Мой кабинет
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
              Ваши заказы, заявки и быстрый сценарий продажи в зале с привязкой
              к клиентскому QR.
            </p>
          </div>
          <Link
            href="/admin/sales"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 font-mono text-[10px] font-semibold tracking-[0.14em] text-[#111111] uppercase transition hover:bg-white/86"
          >
            Открыть продажу в зале
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Активные заказы"
          value={activeOrders.length}
          detail="Назначены на вас и требуют движения по статусам"
        />
        <MetricCard
          label="Активные заявки"
          value={activeRequests.length}
          detail="Расчеты, консультации и распил в вашей работе"
        />
        <MetricCard
          label="Продажи сегодня"
          value={formatPrice(todaySales._sum.total ?? 0)}
          detail={`${todaySales._count} покупок привязано к клиентам`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DataTable
          columns={[
            { key: "order", label: "Заказ" },
            { key: "client", label: "Клиент" },
            { key: "status", label: "Статус" },
            { key: "total", label: "Сумма" },
          ]}
          rows={orders.map((order) => ({
            order: (
              <Link
                href={`/admin/orders/${order.id}`}
                className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
              >
                {order.number ?? order.id.slice(0, 8)}
              </Link>
            ),
            client: (
              <span className="text-sm text-[var(--muted)]">
                {order.contactName}
                <span className="mt-1 block text-xs">
                  {formatDate(order.updatedAt)}
                </span>
              </span>
            ),
            status: (
              <StatusBadge tone={getOrderTone(order.status)}>
                {order.status}
              </StatusBadge>
            ),
            total: formatPrice(order.total),
          }))}
          caption="Мои заказы"
          emptyMessage="На вас пока нет заказов."
        />

        <DataTable
          columns={[
            { key: "request", label: "Заявка" },
            { key: "client", label: "Клиент" },
            { key: "status", label: "Статус" },
          ]}
          rows={requests.map((request) => ({
            request: (
              <Link
                href={`/admin/requests/${request.id}`}
                className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
              >
                {request.number ?? request.subject}
              </Link>
            ),
            client: (
              <span className="text-sm text-[var(--muted)]">
                {request.contactName}
                <span className="mt-1 block text-xs">
                  {formatDate(request.updatedAt)}
                </span>
              </span>
            ),
            status: (
              <StatusBadge tone={getRequestTone(request.status)}>
                {request.status}
              </StatusBadge>
            ),
          }))}
          caption="Мои заявки"
          emptyMessage="На вас пока нет заявок."
        />
      </section>
    </div>
  );
}
