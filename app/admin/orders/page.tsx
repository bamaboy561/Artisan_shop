import Form from "next/form";
import Link from "next/link";

import { OrderStatus } from "@/generated/prisma";
import { bulkUpdateOrdersAction, updateOrderAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { BulkSelectionTools } from "@/components/admin/bulk-selection-tools";
import { MetricCard } from "@/components/admin/metric-card";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import {
  getAdminManagers,
  getAdminOrders,
} from "@/lib/server/operations-admin";
import {
  activeOrderStatuses,
  adminOrderSortOptions,
  buildAdminOrdersHref,
  filterAdminOrders,
  getManagerDisplayName,
  orderStatusLabels,
  parseAdminOrderSearchParams,
  sanitizeAdminOrderFilterState,
  sortAdminOrders,
  type AdminOrderFilterState,
} from "@/features/admin/operations-filters";

export const dynamic = "force-dynamic";

type AdminOrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const bulkActionOptions = [
  { value: "confirm", label: "Подтвердить выбранные" },
  { value: "to-production", label: "Перевести в производство" },
  { value: "ready-for-pickup", label: "Отметить готовыми к выдаче" },
  { value: "ship", label: "Отметить как отгруженные" },
  { value: "complete", label: "Завершить выбранные" },
  { value: "cancel", label: "Отменить выбранные" },
  { value: "assign-manager", label: "Назначить менеджера" },
  { value: "clear-manager", label: "Снять менеджера" },
] as const;

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

function getStatusTone(status: OrderStatus) {
  switch (status) {
    case OrderStatus.NEW:
    case OrderStatus.CONFIRMED:
      return "warning" as const;
    case OrderStatus.IN_PRODUCTION:
    case OrderStatus.READY_FOR_PICKUP:
    case OrderStatus.SHIPPED:
      return "accent" as const;
    case OrderStatus.COMPLETED:
      return "success" as const;
    case OrderStatus.CANCELED:
    default:
      return "neutral" as const;
  }
}

function getStateHref(
  state: AdminOrderFilterState,
  overrides: Partial<AdminOrderFilterState>,
) {
  return buildAdminOrdersHref("/admin/orders", {
    ...state,
    ...overrides,
  });
}

export default async function AdminOrdersPage({
  searchParams,
}: AdminOrdersPageProps) {
  if (!hasDatabaseUrl() && !isDemoModeEnabled()) {
    return (
      <SetupState
        title="Заказы станут рабочими после подключения базы данных"
        description="Раздел готов к обновлению статусов, назначению менеджеров и формированию рабочей очереди, но для этого нужен подключенный PostgreSQL и реальные заказы."
        steps={[
          "Добавьте DATABASE_URL в .env.",
          "Примените Prisma-схему командой prisma db push.",
          "Первые заказы появятся после оформления на сайте или перевода заявки в заказ.",
        ]}
      />
    );
  }

  await requireAdminSession("/login?next=/admin/orders");

  const [orders, managers, resolvedSearchParams] = await Promise.all([
    getAdminOrders(),
    getAdminManagers(),
    searchParams,
  ]);

  const parsedState = parseAdminOrderSearchParams(resolvedSearchParams);
  const state = sanitizeAdminOrderFilterState(parsedState, managers);
  const filteredOrders = sortAdminOrders(
    filterAdminOrders(orders, state),
    state.sort,
  );

  const activeOrders = orders.filter((order) =>
    activeOrderStatuses.has(order.status),
  );
  const unassignedOrders = activeOrders.filter((order) => !order.managerId);
  const deliveryOrders = orders.filter((order) =>
    Boolean(order.deliveryMethodId),
  );
  const shippedOrders = orders.filter(
    (order) => order.status === OrderStatus.SHIPPED,
  );

  const activeFilters = [
    state.q
      ? {
          key: "q",
          label: `Поиск: ${state.q}`,
          href: getStateHref(state, { q: "" }),
        }
      : null,
    state.status !== "all"
      ? {
          key: "status",
          label: `Статус: ${orderStatusLabels[state.status]}`,
          href: getStateHref(state, { status: "all" }),
        }
      : null,
    state.managerId
      ? {
          key: "managerId",
          label: `Менеджер: ${
            managers.find((item) => item.id === state.managerId)
              ? getManagerDisplayName(
                  managers.find((item) => item.id === state.managerId)!,
                )
              : "назначен"
          }`,
          href: getStateHref(state, { managerId: "" }),
        }
      : null,
    state.assignment !== "all"
      ? {
          key: "assignment",
          label:
            state.assignment === "assigned"
              ? "Только назначенные"
              : "Без менеджера",
          href: getStateHref(state, { assignment: "all" }),
        }
      : null,
    state.delivery !== "all"
      ? {
          key: "delivery",
          label: state.delivery === "delivery" ? "С доставкой" : "Самовывоз",
          href: getStateHref(state, { delivery: "all" }),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; href: string }>;

  const rows = filteredOrders.map((order) => ({
    select: (
      <input
        type="checkbox"
        name="orderIds"
        value={order.id}
        form="bulk-orders-form"
        data-order-bulk-checkbox="true"
        className="size-4 rounded border-[color:var(--line-strong)] accent-[var(--accent)]"
        aria-label={`Выбрать заказ ${order.number ?? order.id.slice(0, 8)}`}
      />
    ),
    order: (
      <div className="space-y-1">
        <Link
          href={`/admin/orders/${order.id}`}
          className="font-semibold text-[var(--foreground)] transition hover:text-[var(--accent)]"
        >
          {order.number ?? order.id.slice(0, 8)}
        </Link>
        <p className="text-xs text-[var(--muted)]">
          {formatDate(order.createdAt)} · {order._count.items} позиций
        </p>
        <Link
          href={`/admin/orders/${order.id}`}
          className="inline-flex h-8 items-center justify-center border border-[color:var(--line-strong)] px-3 text-[11px] font-semibold tracking-[0.12em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
        >
          Редактировать
        </Link>
      </div>
    ),
    client: (
      <div className="space-y-1">
        <p>{order.contactName}</p>
        <p className="text-xs text-[var(--muted)]">{order.contactPhone}</p>
        <p className="text-xs text-[var(--muted)]">
          {order.companyName ?? order.user?.companyName ?? "Частный клиент"}
        </p>
      </div>
    ),
    logistics: (
      <div className="space-y-2">
        <p className="font-medium text-[var(--foreground)]">
          {formatCurrency(order.total)}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {order.deliveryMethod?.name ?? "Самовывоз / без доставки"}
        </p>
        {order.appliedPromoCode || order.loyaltyRedemptionTotal > 0 ? (
          <div className="flex flex-wrap gap-2">
            {order.appliedPromoCode ? (
              <StatusBadge tone="accent">{order.appliedPromoCode}</StatusBadge>
            ) : null}
            {order.loyaltyRedemptionTotal > 0 ? (
              <StatusBadge tone="neutral">
                Баллы {formatCurrency(order.loyaltyRedemptionTotal)}
              </StatusBadge>
            ) : null}
          </div>
        ) : null}
      </div>
    ),
    status: (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={getStatusTone(order.status)}>
            {orderStatusLabels[order.status]}
          </StatusBadge>
          <StatusBadge tone={order.managerId ? "neutral" : "warning"}>
            {order.manager
              ? getManagerDisplayName(order.manager)
              : "Без менеджера"}
          </StatusBadge>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Обновлен {formatDate(order.updatedAt)}
        </p>
      </div>
    ),
    manage: (
      <form action={updateOrderAction} className="grid gap-2">
        <input type="hidden" name="id" value={order.id} />
        <Select
          name="status"
          defaultValue={order.status}
          className="h-9 text-xs"
        >
          {Object.values(OrderStatus).map((status) => (
            <option key={status} value={status}>
              {orderStatusLabels[status]}
            </option>
          ))}
        </Select>
        <Select
          name="managerId"
          defaultValue={order.managerId ?? ""}
          className="h-9 text-xs"
        >
          <option value="">Без менеджера</option>
          {managers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {getManagerDisplayName(manager)}
            </option>
          ))}
        </Select>
        <AdminSubmitButton
          type="submit"
          variant="secondary"
          size="sm"
          idleLabel="Сохранить"
          pendingLabel="Сохраняем..."
        />
      </form>
    ),
  }));

  return (
    <div className="space-y-5">
      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6 sm:p-7">
        <SectionHeading
          title="Заказы"
          description="Операционная очередь по подтверждению, производству, выдаче и отгрузке. Команда может быстро находить проблемные заказы и управлять ими пакетно."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Всего заказов"
          value={orders.length}
          detail={`${filteredOrders.length} видно по текущему срезу`}
        />
        <MetricCard
          label="Активные"
          value={activeOrders.length}
          detail="Заказы, которые находятся в работе команды"
        />
        <MetricCard
          label="Без менеджера"
          value={unassignedOrders.length}
          detail="Активные заказы, которые еще не разобраны"
        />
        <MetricCard
          label="Логистика"
          value={deliveryOrders.length}
          detail={`${shippedOrders.length} уже находятся в стадии отгрузки`}
        />
      </section>

      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
              Фильтры очереди
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[var(--foreground)]">
              Фокус по смене
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Можно быстро отфильтровать только новые, только без менеджера,
              только логистику или конкретную рабочую зону по ответственному.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={getStateHref(state, { assignment: "unassigned" })}
              className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
            >
              Без менеджера
            </Link>
            <Link
              href={getStateHref(state, { status: OrderStatus.NEW })}
              className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
            >
              Новые
            </Link>
            <Link
              href={getStateHref(state, { status: OrderStatus.IN_PRODUCTION })}
              className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
            >
              Производство
            </Link>
            <Link
              href={getStateHref(state, { delivery: "delivery" })}
              className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
            >
              С доставкой
            </Link>
          </div>
        </div>

        <Form
          action="/admin/orders"
          scroll={false}
          className="mt-6 grid gap-4 xl:grid-cols-5"
        >
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm text-[var(--foreground)]">
              Поиск по номеру, клиенту, телефону или промокоду
            </span>
            <Input
              name="q"
              defaultValue={state.q}
              placeholder="Например, A-1042 или ОсОО Интерьер"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Статус</span>
            <Select name="status" defaultValue={state.status}>
              <option value="all">Все статусы</option>
              {Object.values(OrderStatus).map((status) => (
                <option key={status} value={status}>
                  {orderStatusLabels[status]}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Менеджер</span>
            <Select name="managerId" defaultValue={state.managerId}>
              <option value="">Все менеджеры</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {getManagerDisplayName(manager)}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Назначение</span>
            <Select name="assignment" defaultValue={state.assignment}>
              <option value="all">Все заказы</option>
              <option value="assigned">С менеджером</option>
              <option value="unassigned">Без менеджера</option>
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Логистика</span>
            <Select name="delivery" defaultValue={state.delivery}>
              <option value="all">Все варианты</option>
              <option value="delivery">С доставкой</option>
              <option value="pickup">Самовывоз</option>
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Сортировка</span>
            <Select name="sort" defaultValue={state.sort}>
              {adminOrderSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <div className="flex flex-wrap items-end gap-3 xl:col-span-5">
            <AdminSubmitButton
              type="submit"
              variant="accent"
              idleLabel="Применить"
              pendingLabel="Применяем..."
            />
            <Link
              href="/admin/orders"
              className="inline-flex h-11 items-center justify-center border border-[color:var(--line-strong)] px-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
            >
              Сбросить всё
            </Link>
            <span className="text-sm text-[var(--muted)]">
              Найдено {filteredOrders.length} из {orders.length} заказов
            </span>
          </div>
        </Form>

        {activeFilters.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-[color:var(--line)] pt-5">
            {activeFilters.map((filter) => (
              <Link
                key={filter.key}
                href={filter.href}
                className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] transition hover:border-[color:var(--line-strong)]"
              >
                {filter.label} ×
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
                Массовые действия
              </p>
              <h3 className="mt-3 text-xl font-semibold text-[var(--foreground)]">
                Управление текущей выборкой
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Выделите нужные заказы и быстро назначьте менеджера, переведите
                их на следующий этап или закройте массово.
              </p>
            </div>

            <BulkSelectionTools checkboxSelector="[data-order-bulk-checkbox='true']" />
          </div>

          <form
            id="bulk-orders-form"
            action={bulkUpdateOrdersAction}
            className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px_auto]"
          >
            <Select name="bulkAction" defaultValue="">
              <option value="" disabled>
                Выберите действие для отмеченных заказов
              </option>
              {bulkActionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select name="managerId" defaultValue="">
              <option value="">Менеджер для назначения</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {getManagerDisplayName(manager)}
                </option>
              ))}
            </Select>
            <AdminSubmitButton
              type="submit"
              variant="secondary"
              idleLabel="Применить"
              pendingLabel="Применяем..."
            />
          </form>
        </section>

        <DataTable
          columns={[
            { key: "select", label: "" },
            { key: "order", label: "Заказ" },
            { key: "client", label: "Клиент" },
            { key: "logistics", label: "Логистика и сумма" },
            { key: "status", label: "Статус" },
            { key: "manage", label: "Быстрое управление" },
          ]}
          rows={rows}
          caption="Таблица заказов"
          emptyMessage="По текущим фильтрам ничего не найдено. Измените срез или сбросьте параметры."
        />
      </section>
    </div>
  );
}
