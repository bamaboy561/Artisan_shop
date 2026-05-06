import Link from "next/link";

import { MetricCard } from "@/components/admin/metric-card";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { DataTable } from "@/components/ui/table";
import { hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import {
  getAdminDashboardMetrics,
  getAdminOperationalQueues,
} from "@/lib/server/admin-data";

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

export default async function AdminPage() {
  if (!hasDatabaseUrl() && !isDemoModeEnabled()) {
    return (
      <SetupState
        title="Админка заработает после подключения PostgreSQL"
        description="Интерфейс уже готов для каталога, заказов, заявок и клиентов. Чтобы включить живые данные, подключите базу и загрузите стартовые сущности."
        steps={[
          "Скопируйте .env.example в .env и добавьте рабочий DATABASE_URL.",
          "Примените Prisma-схему через prisma db push или prisma migrate dev.",
          "Запустите prisma db seed, чтобы загрузить роли, каталог и клиентов.",
        ]}
      />
    );
  }

  const [metrics, queues] = await Promise.all([
    getAdminDashboardMetrics(),
    getAdminOperationalQueues(),
  ]);

  const orderRows = queues.recentOrders.map((order) => ({
    order: (
      <div className="space-y-1">
        <p className="font-semibold text-[var(--foreground)]">
          {order.number ?? order.id.slice(0, 8)}
        </p>
        <p className="text-xs text-[var(--muted)]">{formatDate(order.createdAt)}</p>
      </div>
    ),
    client: order.contactName,
    status: <StatusBadge tone="accent">{order.status}</StatusBadge>,
    total: formatCurrency(order.total),
  }));

  const requestRows = queues.recentRequests.map((request) => ({
    request: (
      <div className="space-y-1">
        <p className="font-semibold text-[var(--foreground)]">
          {request.number ?? request.id.slice(0, 8)}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {formatDate(request.createdAt)}
        </p>
      </div>
    ),
    type: request.type,
    status: <StatusBadge tone="warning">{request.status}</StatusBadge>,
    client: request.contactName,
  }));

  const shiftSignals = [
    {
      label: "Открытые задачи",
      value: metrics.openOrders + metrics.openRequests,
      detail: "заказов и заявок требуют движения",
    },
    {
      label: "Каталог",
      value: metrics.activeProducts,
      detail: `активно ${metrics.activeProducts} из ${metrics.productsTotal} карточек`,
    },
    {
      label: "Промо",
      value: metrics.activePromotions,
      detail: "кампаний влияют на витрину",
    },
  ];

  const queueCards = [
    {
      href: "/admin/orders",
      title: "Заказы",
      value: metrics.openOrders,
      detail: "производство, выдача и логистика",
      tone: "accent" as const,
    },
    {
      href: "/admin/requests",
      title: "Заявки",
      value: metrics.openRequests,
      detail: "расчёт, консультации и распил",
      tone: "warning" as const,
    },
    {
      href: "/admin/products",
      title: "Каталог",
      value: `${metrics.activeProducts}/${metrics.productsTotal}`,
      detail: `${metrics.categoriesTotal} категорий и ${metrics.brandsTotal} брендов`,
      tone: "success" as const,
    },
    {
      href: "/admin/users",
      title: "Клиенты",
      value: metrics.usersTotal,
      detail: "уровни, баллы и персональные условия",
      tone: "neutral" as const,
    },
  ];

  const quickModules = [
    {
      href: "/admin/products",
      label: "Товары",
      value: `${metrics.activeProducts}/${metrics.productsTotal}`,
      detail: "активных карточек",
    },
    {
      href: "/admin/orders",
      label: "Заказы",
      value: metrics.openOrders,
      detail: "в активной очереди",
    },
    {
      href: "/admin/requests",
      label: "Заявки",
      value: metrics.openRequests,
      detail: "ждут обработки",
    },
    {
      href: "/admin/promotions",
      label: "Акции",
      value: metrics.activePromotions,
      detail: "в работе сейчас",
    },
  ];

  const recentSignals = [
    ...queues.recentOrders.slice(0, 3).map((order) => ({
      href: "/admin/orders",
      type: "Заказ",
      title: order.number ?? order.id.slice(0, 8),
      meta: `${order.contactName} • ${formatCurrency(order.total)}`,
      badge: order.status,
      tone: "accent" as const,
    })),
    ...queues.recentRequests.slice(0, 3).map((request) => ({
      href: "/admin/requests",
      type: "Заявка",
      title: request.number ?? request.id.slice(0, 8),
      meta: `${request.contactName} • ${request.type}`,
      badge: request.status,
      tone: "warning" as const,
    })),
  ].slice(0, 6);

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.16fr_0.84fr]">
        <article className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--hero)] p-5 text-white">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="font-mono text-[10px] tracking-[0.24em] text-white/44 uppercase">
                  Смена
                </p>
                <h2 className="mt-3 text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] text-balance">
                  Админка должна вести поток, а не мешать команде работать.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
                  Все ключевые контуры Artisan собраны здесь: каталог, входящие
                  обращения, производство, выдача и программа лояльности.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/admin/orders" variant="contrast" icon>
                  Открыть заказы
                </ButtonLink>
                <ButtonLink href="/admin/requests" variant="secondary">
                  Заявки
                </ButtonLink>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {shiftSignals.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[18px] border border-white/10 bg-white/[0.06] px-4 py-4"
                >
                  <p className="font-mono text-[10px] tracking-[0.18em] text-white/44 uppercase">
                    {item.label}
                  </p>
                  <p className="mt-3 text-[1.9rem] font-semibold leading-none text-white">
                    {item.value}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-white/62">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-white/92 p-5">
          <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
            Фокус смены
          </p>
          <div className="mt-4 space-y-3">
            {queueCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="flex items-start justify-between gap-4 rounded-[18px] border border-[color:var(--line)] bg-[var(--surface)] px-4 py-4 transition hover:border-[color:var(--line-strong)] hover:bg-white"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {card.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    {card.detail}
                  </p>
                </div>

                <StatusBadge tone={card.tone}>{card.value}</StatusBadge>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Товары"
          value={metrics.productsTotal}
          detail={`${metrics.activeProducts} активных позиций и ${metrics.categoriesTotal} категорий`}
          tone="success"
        />
        <MetricCard
          label="Бренды"
          value={metrics.brandsTotal}
          detail="подключены к публичному каталогу"
          tone="neutral"
        />
        <MetricCard
          label="Клиенты"
          value={metrics.usersTotal}
          detail="аккаунты и персональные условия"
          tone="accent"
        />
        <MetricCard
          label="Очередь"
          value={metrics.openOrders + metrics.openRequests}
          detail="суммарная рабочая нагрузка по смене"
          tone="warning"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <article className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-white/92 p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
                Быстрые модули
              </p>
              <h3 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                Ключевые контуры без лишних переходов
              </h3>
            </div>

            <ButtonLink href="/admin/products" variant="secondary">
              Весь каталог
            </ButtonLink>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {quickModules.map((module) => (
              <Link
                key={module.href}
                href={module.href}
                className="rounded-[18px] border border-[color:var(--line)] bg-[var(--surface)] px-4 py-4 transition hover:border-[color:var(--line-strong)] hover:bg-white"
              >
                <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
                  {module.label}
                </p>
                <p className="mt-3 text-2xl font-semibold leading-none text-[var(--foreground)]">
                  {module.value}
                </p>
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                  {module.detail}
                </p>
              </Link>
            ))}
          </div>
        </article>

        <article className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-white/92 p-5">
          <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
            Последние сигналы
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
            Что уже вошло в поток
          </h3>

          <div className="mt-4 space-y-3">
            {recentSignals.map((signal, index) => (
              <Link
                key={`${signal.type}-${signal.title}-${index}`}
                href={signal.href}
                className="flex items-start justify-between gap-4 rounded-[18px] border border-[color:var(--line)] bg-[var(--surface)] px-4 py-4 transition hover:border-[color:var(--line-strong)] hover:bg-white"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
                    {signal.type}
                  </p>
                  <p className="mt-2 truncate text-sm font-semibold text-[var(--foreground)]">
                    {signal.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    {signal.meta}
                  </p>
                </div>

                <StatusBadge tone={signal.tone}>{signal.badge}</StatusBadge>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="space-y-3">
          <div className="surface-glow rounded-[22px] border border-[color:var(--line)] bg-white/92 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
                  Очередь заказов
                </p>
                <h3 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                  Последние коммерческие заказы
                </h3>
              </div>
              <ButtonLink href="/admin/orders" variant="secondary">
                Все заказы
              </ButtonLink>
            </div>
          </div>

          <DataTable
            caption="Последние заказы"
            columns={[
              { key: "order", label: "Заказ" },
              { key: "client", label: "Клиент" },
              { key: "status", label: "Статус" },
              { key: "total", label: "Сумма" },
            ]}
            rows={orderRows}
            emptyMessage="Первые заказы появятся здесь сразу после оформления через сайт."
          />
        </article>

        <article className="space-y-3">
          <div className="surface-glow rounded-[22px] border border-[color:var(--line)] bg-white/92 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
                  Входящий поток
                </p>
                <h3 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                  Последние заявки и обращения
                </h3>
              </div>
              <ButtonLink href="/admin/requests" variant="secondary">
                Все заявки
              </ButtonLink>
            </div>
          </div>

          <DataTable
            caption="Последние заявки"
            columns={[
              { key: "request", label: "Заявка" },
              { key: "type", label: "Тип" },
              { key: "status", label: "Статус" },
              { key: "client", label: "Клиент" },
            ]}
            rows={requestRows}
            emptyMessage="Новые сервисные обращения будут появляться здесь по мере поступления."
          />
        </article>
      </section>
    </div>
  );
}
