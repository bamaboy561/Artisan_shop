import Link from "next/link";
import type { ReactNode } from "react";
import {
  Archive,
  Box,
  Calculator,
  FilePlus2,
  FileStack,
  Layers3,
  PackagePlus,
  ReceiptText,
  TrendingUp,
  Users2,
  type LucideIcon,
} from "lucide-react";

import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { DataTable } from "@/components/ui/table";
import {
  orderStatusLabels,
  requestStatusLabels,
} from "@/features/admin/operations-filters";
import { OrderStatus, RequestStatus } from "@/generated/prisma";
import { hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import {
  getAdminDashboardMetrics,
  getAdminOperationalQueues,
  getAdminStockMaterials,
} from "@/lib/server/admin-data";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KGS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function getOrderStatusTone(status: OrderStatus) {
  switch (status) {
    case OrderStatus.CONFIRMED:
    case OrderStatus.COMPLETED:
      return "success" as const;
    case OrderStatus.IN_PRODUCTION:
    case OrderStatus.READY_FOR_PICKUP:
    case OrderStatus.SHIPPED:
      return "accent" as const;
    case OrderStatus.CANCELED:
      return "neutral" as const;
    case OrderStatus.NEW:
    default:
      return "warning" as const;
  }
}

function getRequestStatusTone(status: RequestStatus) {
  switch (status) {
    case RequestStatus.COMPLETED:
      return "success" as const;
    case RequestStatus.IN_REVIEW:
    case RequestStatus.QUOTE_SENT:
    case RequestStatus.IN_PROGRESS:
      return "accent" as const;
    case RequestStatus.WAITING_FOR_CLIENT:
      return "warning" as const;
    case RequestStatus.CANCELED:
      return "neutral" as const;
    case RequestStatus.NEW:
    default:
      return "neutral" as const;
  }
}

function MiniChart() {
  return (
    <svg viewBox="0 0 180 44" className="mt-4 h-11 w-full text-[#c65b3a]">
      <path
        d="M4 32 C 22 34, 28 34, 42 31 S 66 20, 83 25 S 108 36, 126 19 S 150 10, 176 13"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
      <path
        d="M4 38 C 22 40, 28 40, 42 37 S 66 26, 83 31 S 108 42, 126 25 S 150 16, 176 19"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeOpacity="0.14"
        strokeWidth="8"
      />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  chart = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  chart?: boolean;
}) {
  return (
    <article className="rounded-xl border border-[#e6e2dc] bg-white p-5 shadow-[0_18px_50px_rgba(30,28,25,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <span className="text-sm text-[#77736c]">{label}</span>
        <Icon className="size-6 text-[#c65b3a]" strokeWidth={1.75} />
      </div>
      <p className="mt-4 text-[26px] leading-none font-semibold tracking-[-0.03em] text-[#24221f]">
        {value}
      </p>
      <p className="mt-3 text-sm text-[#8a857d]">{detail}</p>
      {chart ? <MiniChart /> : null}
    </article>
  );
}

function Panel({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[#e6e2dc] bg-white shadow-[0_18px_50px_rgba(30,28,25,0.04)]">
      <div className="flex items-center justify-between gap-4 border-b border-[#e6e2dc] px-5 py-4">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#24221f]">
          {title}
        </h2>
        {href && linkLabel ? (
          <Link
            href={href}
            className="text-sm font-medium text-[#c65b3a] transition hover:text-[#9f4327]"
          >
            {linkLabel}
          </Link>
        ) : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

export default async function AdminPage() {
  if (!hasDatabaseUrl() && !isDemoModeEnabled()) {
    return (
      <SetupState
        title="Админка заработает после подключения PostgreSQL"
        description="Интерфейс уже готов для каталога, заказов, заявок и клиентов. Чтобы включить живые данные, подключите базу и выполните production bootstrap."
        steps={[
          "Скопируйте .env.example в .env и добавьте рабочий DATABASE_URL.",
          "Примените Prisma-схему через prisma db push или prisma migrate dev.",
          "Запустите npm run prisma:bootstrap, чтобы создать роли, первого администратора и базовые настройки.",
        ]}
      />
    );
  }

  const [metrics, queues, stockMaterials] = await Promise.all([
    getAdminDashboardMetrics(),
    getAdminOperationalQueues(),
    getAdminStockMaterials(),
  ]);

  const orderRows = queues.recentOrders.map((order) => ({
    order: (
      <Link
        href={`/admin/orders/${order.id}`}
        className="font-medium text-[#24221f] transition hover:text-[#c65b3a]"
      >
        {order.number ?? order.id.slice(0, 8)}
      </Link>
    ),
    client: order.contactName,
    status: (
      <StatusBadge tone={getOrderStatusTone(order.status)}>
        {orderStatusLabels[order.status]}
      </StatusBadge>
    ),
    date: formatDate(order.createdAt),
    total: formatCurrency(order.total),
    actions: <span className="text-[#8a857d]">•••</span>,
  }));

  const requestRows = queues.recentRequests.map((request) => ({
    request: (
      <Link
        href={`/admin/requests/${request.id}`}
        className="font-medium text-[#24221f] transition hover:text-[#c65b3a]"
      >
        {request.number ?? request.id.slice(0, 8)}
      </Link>
    ),
    client: request.contactName,
    status: (
      <StatusBadge tone={getRequestStatusTone(request.status)}>
        {requestStatusLabels[request.status]}
      </StatusBadge>
    ),
    created: formatDate(request.createdAt),
    actions: <span className="text-[#8a857d]">•••</span>,
  }));

  const quickActions = [
    { href: "/admin/orders", label: "Новый заказ", icon: FilePlus2 },
    { href: "/admin/requests", label: "Запрос на расчёт", icon: FileStack },
    { href: "/calculator", label: "Раскрой детали", icon: Calculator },
    { href: "/admin/products", label: "Добавить материал", icon: PackagePlus },
    { href: "/admin/categories", label: "Каталог", icon: Layers3 },
    { href: "/admin/users", label: "Добавить клиента", icon: Users2 },
  ];

  const stockMaterialRows = stockMaterials.map((product) => ({
    name: product.name,
    format: product.format ?? "",
    stock: product.stockQuantity ?? 0,
    swatch: product.images[0]?.url ?? "",
    updatedAt: product.updatedAt,
  }));

  const notifications = [
    queues.recentRequests[0]
      ? {
          title: "Последняя заявка",
          detail: queues.recentRequests[0].contactName,
          time: formatDate(queues.recentRequests[0].createdAt),
          icon: FileStack,
          tone: "bg-blue-50 text-blue-700",
        }
      : null,
    queues.recentOrders[0]
      ? {
          title: "Последний заказ",
          detail:
            queues.recentOrders[0].number ?? queues.recentOrders[0].contactName,
          time: formatDate(queues.recentOrders[0].createdAt),
          icon: ReceiptText,
          tone: "bg-orange-50 text-orange-700",
        }
      : null,
    stockMaterialRows[0]
      ? {
          title: "Последний остаток",
          detail: stockMaterialRows[0].name,
          time: formatDate(stockMaterialRows[0].updatedAt),
          icon: Archive,
          tone: "bg-neutral-100 text-neutral-700",
        }
      : null,
  ].filter(
    (
      item,
    ): item is {
      title: string;
      detail: string;
      time: string;
      icon: LucideIcon;
      tone: string;
    } => Boolean(item),
  );

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Выручка по заказам"
          value={formatCurrency(metrics.ordersRevenue)}
          detail="все неотмененные заказы"
          icon={ReceiptText}
        />
        <KpiCard
          label="Заказы в работе"
          value={metrics.openOrders}
          detail="активные производственные статусы"
          icon={PackagePlus}
        />
        <KpiCard
          label="Запросы на расчёт"
          value={metrics.openRequests}
          detail="активные заявки клиентов"
          icon={Calculator}
        />
        <KpiCard
          label="Средний чек"
          value={formatCurrency(metrics.averageOrderTotal)}
          detail="по неотмененным заказам"
          icon={TrendingUp}
        />
        <KpiCard
          label="Клиенты"
          value={formatNumber(metrics.usersTotal)}
          detail="зарегистрированные аккаунты"
          icon={Users2}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_1fr]">
        <Panel
          title="Заказы в работе"
          href="/admin/orders"
          linkLabel="Все заказы"
        >
          <DataTable
            caption="Заказы в работе"
            variant="embedded"
            columns={[
              { key: "order", label: "№ заказа" },
              { key: "client", label: "Клиент" },
              { key: "status", label: "Статус" },
              { key: "date", label: "Срок" },
              { key: "total", label: "Сумма" },
              { key: "actions", label: "" },
            ]}
            rows={orderRows}
            emptyMessage="Первые заказы появятся здесь сразу после оформления через сайт."
          />
        </Panel>

        <Panel
          title="Запросы на расчёт"
          href="/admin/requests"
          linkLabel="Все запросы"
        >
          <DataTable
            caption="Запросы на расчет"
            variant="embedded"
            columns={[
              { key: "request", label: "№ запроса" },
              { key: "client", label: "Клиент" },
              { key: "status", label: "Статус" },
              { key: "created", label: "Создан" },
              { key: "actions", label: "" },
            ]}
            rows={requestRows}
            emptyMessage="Новые заявки и файлы клиентов появятся здесь."
          />
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.35fr_1.1fr]">
        <Panel title="Быстрые действия">
          <div className="grid grid-cols-2 gap-3 p-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex min-h-20 items-center gap-3 rounded-xl border border-[#e6e2dc] bg-white px-4 py-3 text-sm font-medium text-[#24221f] transition hover:border-[#d2ccc4] hover:bg-[#faf8f5]"
                >
                  <Icon className="size-5 text-[#c65b3a]" strokeWidth={1.75} />
                  <span>{action.label}</span>
                </Link>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Остатки материалов"
          href="/admin/products"
          linkLabel="Все товары"
        >
          <div className="divide-y divide-[#ece8e2] px-5">
            {stockMaterialRows.length > 0 ? (
              stockMaterialRows.map((material) => (
                <div
                  key={material.name}
                  className="grid grid-cols-[44px_minmax(0,1fr)_70px_70px] items-center gap-3 py-3.5 text-sm"
                >
                  <span
                    className="size-8 rounded-md border border-[#e6e2dc] bg-cover bg-center"
                    style={{
                      backgroundImage: material.swatch
                        ? `url(${material.swatch})`
                        : undefined,
                    }}
                  />
                  <span className="min-w-0 truncate font-medium text-[#24221f]">
                    {material.name}
                  </span>
                  <span className="truncate text-[#8a857d]">
                    {material.format || "—"}
                  </span>
                  <span className="text-right font-medium text-[#24221f]">
                    {formatNumber(material.stock)} шт.
                  </span>
                </div>
              ))
            ) : (
              <p className="py-5 text-sm text-[#8a857d]">
                Остатки пока не указаны в карточках товаров.
              </p>
            )}
          </div>
        </Panel>

        <Panel
          title="Оперативные уведомления"
          href="/admin/requests"
          linkLabel="Все уведомления"
        >
          <div className="space-y-1 p-4">
            {notifications.length > 0 ? (
              notifications.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={`${item.title}-${item.detail}`}
                    className="grid grid-cols-[38px_minmax(0,1fr)_auto] gap-3 rounded-xl px-2 py-3 text-sm"
                  >
                    <span
                      className={`flex size-9 items-center justify-center rounded-xl ${item.tone}`}
                    >
                      <Icon className="size-4" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-[#24221f]">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[#8a857d]">
                        {item.detail}
                      </span>
                    </span>
                    <span className="text-xs text-[#8a857d]">{item.time}</span>
                  </div>
                );
              })
            ) : (
              <p className="px-2 py-5 text-sm text-[#8a857d]">
                Новые события появятся после заявок, заказов или обновления
                остатков.
              </p>
            )}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="grid overflow-hidden rounded-xl border border-[#e6e2dc] bg-white shadow-[0_18px_50px_rgba(30,28,25,0.04)] md:grid-cols-4">
          {[
            ["Производство", `${metrics.openOrders} заказов в работе`],
            [
              "Заявки на распил сегодня",
              `${metrics.cuttingRequestsToday} заявок`,
            ],
            ["Готово к выдаче", `${metrics.readyForPickupOrders} заказов`],
            ["Отгружено сегодня", `${metrics.shippedToday} заказов`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border-b border-[#e6e2dc] px-5 py-4 last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0"
            >
              <p className="text-sm text-[#8a857d]">{label}</p>
              <p className="mt-2 text-xl font-semibold text-[#24221f]">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[#e6e2dc] bg-white px-5 py-4 shadow-[0_18px_50px_rgba(30,28,25,0.04)]">
          <div>
            <p className="text-sm text-[#8a857d]">Склад</p>
            <p className="mt-2 text-xl font-semibold text-[#24221f]">
              {formatNumber(metrics.activeProducts)} материалов
            </p>
          </div>
          <Box className="size-8 text-[#c65b3a]" strokeWidth={1.6} />
        </div>
      </section>
    </div>
  );
}
