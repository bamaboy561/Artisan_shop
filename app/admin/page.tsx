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
        title="Админка начнет работать после подключения PostgreSQL"
        description="Интерфейс уже подготовлен под управление каталогом, клиентами, заказами, заявками и скидками. Чтобы включить живые данные, нужно подключить базу и загрузить стартовый набор сущностей."
        steps={[
          "Скопируйте .env.example в .env и добавьте рабочий DATABASE_URL.",
          "Примените Prisma-схему через prisma db push или prisma migrate dev.",
          "Запустите prisma db seed, чтобы загрузить роли, каталог, клиентов и акции.",
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
        <p className="text-xs text-[var(--muted)]">
          {formatDate(order.createdAt)}
        </p>
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

  const modules = [
    {
      href: "/admin/products",
      label: "Каталог",
      title: "Ассортимент и публикация",
      description:
        "Быстрый доступ к товарам, режимам заказа, статусам и наполнению витрины.",
      value: `${metrics.activeProducts}/${metrics.productsTotal}`,
      detail: "товаров уже опубликовано",
    },
    {
      href: "/admin/orders",
      label: "Продажи",
      title: "Заказы и сервисные обращения",
      description:
        "Контроль рабочих статусов, менеджеров, доставки и общей коммерческой нагрузки.",
      value: `${metrics.openOrders + metrics.openRequests}`,
      detail: "активных задач в очередях",
    },
    {
      href: "/admin/users",
      label: "Клиенты",
      title: "Лояльность и персональные условия",
      description:
        "Уровни клиентов, накопленные баллы, скидки и активные коммерческие сценарии.",
      value: `${metrics.activePromotions}`,
      detail: "активных промо-механик",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-[var(--hero)] p-6 text-white sm:p-7">
          <p className="font-mono text-[10px] tracking-[0.3em] text-white/44 uppercase">
            Дашборд
          </p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight text-balance sm:text-[2.4rem]">
            Операционный центр сайта, каталога и клиентского сервиса.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72">
            Здесь команда держит в одном контуре ассортимент, активные заказы,
            сервисные заявки, клиентскую базу и коммерческие акции без
            лишнего переключения между экранами.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/admin/products" variant="contrast" icon>
              Открыть каталог
            </ButtonLink>
            <ButtonLink href="/admin/orders" variant="secondary">
              Заказы
            </ButtonLink>
            <ButtonLink href="/admin/requests" variant="secondary">
              Заявки
            </ButtonLink>
          </div>
        </article>

        <article className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6 sm:p-7">
          <p className="font-mono text-[10px] tracking-[0.26em] text-[var(--accent)] uppercase">
            Фокус смены
          </p>

          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Активные заказы
                </p>
                <StatusBadge tone="accent">{metrics.openOrders}</StatusBadge>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Заказы, которые сейчас находятся в обработке, производстве,
                отгрузке или подготовке к выдаче.
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Активные заявки
                </p>
                <StatusBadge tone="warning">{metrics.openRequests}</StatusBadge>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Входящие обращения на расчет, консультацию, распил и запрос
                цены, которые требуют ответа команды.
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Коммерческая активность
                </p>
                <StatusBadge tone="neutral">
                  {metrics.activePromotions} акций
                </StatusBadge>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Активные механики скидок и промо-сценарии, которые сейчас
                влияют на витрину и продажи.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Товары"
          value={metrics.productsTotal}
          detail={`${metrics.activeProducts} активных позиций и ${metrics.categoriesTotal} категорий в каталоге`}
        />
        <MetricCard
          label="Бренды"
          value={metrics.brandsTotal}
          detail="Подключенные производители и поставщики, доступные в публичном каталоге"
        />
        <MetricCard
          label="Клиенты"
          value={metrics.usersTotal}
          detail="Аккаунты клиентов и дилеров, доступные для персональных условий и loyalty"
        />
        <MetricCard
          label="Очередь"
          value={metrics.openOrders + metrics.openRequests}
          detail="Суммарная рабочая нагрузка по заказам и сервисным обращениям"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {modules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="surface-glow rounded-[26px] border border-[color:var(--line)] bg-white/82 p-6 transition hover:-translate-y-0.5 hover:border-[color:var(--line-strong)]"
          >
            <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
              {module.label}
            </p>
            <h3 className="mt-4 text-xl font-semibold text-[var(--foreground)]">
              {module.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {module.description}
            </p>

            <div className="mt-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-semibold leading-none text-[var(--foreground)]">
                  {module.value}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {module.detail}
                </p>
              </div>
              <span className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
                Открыть
              </span>
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-white/82 p-5">
            <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
              Последние заказы
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[var(--foreground)]">
              Очередь коммерческих заказов
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Последние оформленные заказы с текущим статусом и суммой,
              доступные для быстрого контроля.
            </p>
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
            emptyMessage="Первые заказы появятся здесь сразу после запуска реального оформления через сайт."
          />
        </div>

        <div className="space-y-4">
          <div className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-white/82 p-5">
            <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
              Последние заявки
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[var(--foreground)]">
              Сервисные обращения и запросы
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Запросы цены, консультации и заявки на распил, которые команда
              может сразу брать в работу.
            </p>
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
            emptyMessage="Новые сервисные заявки и запросы цены будут появляться здесь по мере поступления."
          />
        </div>
      </section>
    </div>
  );
}
