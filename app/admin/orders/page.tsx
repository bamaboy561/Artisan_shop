import { formatPrice } from "@/lib/commerce";
import Link from "next/link";
import { Search, SlidersHorizontal, SquarePen } from "lucide-react";

import { OrderStatus } from "@/generated/prisma";
import { bulkUpdateOrdersAction, updateOrderAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { BulkOrdersSubmitButton } from "@/components/admin/bulk-orders-submit-button";
import { BulkSelectionTools } from "@/components/admin/bulk-selection-tools";
import { DeleteOrderButton } from "@/components/admin/delete-order-button";
import { AutoFilterForm } from "@/components/admin/list/auto-filter-form";
import { ListHeader } from "@/components/admin/list/list-header";
import { RowMenu, rowMenuItemClass } from "@/components/admin/list/row-menu";
import { SetupState } from "@/components/admin/setup-state";
import { DownloadCsvButton } from "@/components/admin/download-csv-button";
import { Pagination } from "@/components/ui/pagination";
import { WhatsappClientLink } from "@/components/admin/whatsapp-client-link";
import { buildOrderWhatsappText } from "@/features/admin/whatsapp";
import { StatusBadge } from "@/components/admin/status-badge";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { formatListDate } from "@/features/admin/list-format";
import { cn } from "@/lib/utils";
import { requireAdminSession } from "@/lib/auth/dal";
import { canDeleteOrders } from "@/lib/auth/roles";
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
  isOrderOverdue,
  isOrderUnpaid,
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
  { value: "reserve", label: "Поставить выбранные в бронь" },
  { value: "confirm", label: "Подтвердить выбранные" },
  { value: "mark-paid", label: "Отметить выбранные оплаченными" },
  { value: "to-production", label: "Перевести в производство" },
  { value: "ready-for-pickup", label: "Отметить готовыми к выдаче" },
  { value: "ship", label: "Отметить как отгруженные" },
  { value: "complete", label: "Завершить выбранные" },
  { value: "cancel", label: "Отменить выбранные" },
  { value: "assign-manager", label: "Назначить менеджера" },
  { value: "clear-manager", label: "Снять менеджера" },
] as const;

function formatCurrency(value: number) {
  return formatPrice(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Bishkek",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getStatusTone(status: OrderStatus) {
  switch (status) {
    case OrderStatus.NEW:
    case OrderStatus.RESERVED:
    case OrderStatus.CONFIRMED:
      return "warning" as const;
    case OrderStatus.PAID:
      return "success" as const;
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

// Одна кнопка «что дальше» в строке заказа.
const nextOrderStep: Partial<
  Record<OrderStatus, { status: OrderStatus; label: string }>
> = {
  [OrderStatus.NEW]: { status: OrderStatus.CONFIRMED, label: "Подтвердить" },
  [OrderStatus.RESERVED]: {
    status: OrderStatus.CONFIRMED,
    label: "Подтвердить",
  },
  [OrderStatus.CONFIRMED]: { status: OrderStatus.PAID, label: "Оплачен" },
  [OrderStatus.PAID]: { status: OrderStatus.IN_PRODUCTION, label: "В работу" },
  [OrderStatus.IN_PRODUCTION]: {
    status: OrderStatus.READY_FOR_PICKUP,
    label: "Готов",
  },
  [OrderStatus.READY_FOR_PICKUP]: {
    status: OrderStatus.COMPLETED,
    label: "Выдан",
  },
  [OrderStatus.SHIPPED]: { status: OrderStatus.COMPLETED, label: "Завершить" },
};

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

  const session = await requireAdminSession(
    "/login?next=/admin/orders",
    "/admin/orders",
  );
  const canDeleteOrder = canDeleteOrders(session.roleCode);

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
  const overdueCount = orders.filter((order) => isOrderOverdue(order)).length;
  const unpaidCount = orders.filter((order) => isOrderUnpaid(order)).length;
  const csvCell = (value: string | number) =>
    `"${String(value).replaceAll('"', '""')}"`;
  const ordersCsv = [
    [
      "Номер",
      "Дата",
      "Статус",
      "Клиент",
      "Телефон",
      "Компания",
      "Менеджер",
      "Позиций",
      "Сумма, сом",
      "Срок готовности",
      "Просрочен",
    ],
    ...filteredOrders.map((order) => [
      order.number ?? "",
      formatDate(order.createdAt),
      orderStatusLabels[order.status],
      order.contactName,
      order.contactPhone,
      order.companyName ?? "",
      order.manager ? getManagerDisplayName(order.manager) : "",
      order._count.items,
      order.total,
      order.productionDueAt ? formatDate(new Date(order.productionDueAt)) : "",
      isOrderOverdue(order) ? "да" : "",
    ]),
  ]
    .map((row) => row.map(csvCell).join(";"))
    .join("\n");

  const activeOrders = orders.filter((order) =>
    activeOrderStatuses.has(order.status),
  );
  const unassignedOrders = activeOrders.filter((order) => !order.managerId);

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

  const pageSize = 30;
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const requestedPage = Number.parseInt(
    String(
      Array.isArray(resolvedSearchParams.page)
        ? resolvedSearchParams.page[0]
        : (resolvedSearchParams.page ?? "1"),
    ),
    10,
  );
  const currentPage =
    Number.isFinite(requestedPage) && requestedPage >= 1
      ? Math.min(requestedPage, totalPages)
      : 1;
  const pageOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const getPageHref = (page: number) => {
    const href = getStateHref(state, {});

    return page > 1
      ? `${href}${href.includes("?") ? "&" : "?"}page=${page}`
      : href;
  };

  const now = new Date();
  const emptyState = sanitizeAdminOrderFilterState(
    parseAdminOrderSearchParams({}),
    managers,
  );
  const isOnly = (overrides: Partial<AdminOrderFilterState>) =>
    getStateHref(state, { sort: emptyState.sort }) ===
    getStateHref(emptyState, overrides);
  const moreFiltersOpen = Boolean(
    state.managerId || state.assignment !== "all" || state.delivery !== "all",
  );

  const rows = pageOrders.map((order) => {
    const number = order.number ?? order.id.slice(0, 8);
    const overdue = isOrderOverdue(order);
    const next = nextOrderStep[order.status];

    return {
      select: (
        <input
          type="checkbox"
          name="orderIds"
          value={order.id}
          form="bulk-orders-form"
          data-order-bulk-checkbox="true"
          className="size-4 rounded border-[color:var(--line-strong)] accent-[var(--accent)]"
          aria-label={`Выбрать заказ ${number}`}
        />
      ),
      order: (
        <div className="min-w-[140px]">
          <Link
            href={`/admin/orders/${order.id}`}
            className="font-bold text-[var(--foreground)] transition hover:text-[var(--accent)]"
          >
            {number}
          </Link>
          <p className="mt-0.5 text-[12.5px] whitespace-nowrap text-[var(--muted)]">
            {formatListDate(order.createdAt, now)} · {order._count.items} поз.
          </p>
        </div>
      ),
      client: (
        <div className="max-w-[210px]">
          <p className="truncate font-medium">{order.contactName}</p>
          <p className="truncate text-[12.5px] text-[var(--muted)]">
            {order.contactPhone}
            {(order.companyName ?? order.user?.companyName)
              ? ` · ${order.companyName ?? order.user?.companyName}`
              : ""}
          </p>
        </div>
      ),
      logistics: (
        <div>
          <p className="font-semibold whitespace-nowrap tabular-nums">
            {formatCurrency(order.total)}
          </p>
          <p className="max-w-[180px] truncate text-[12.5px] text-[var(--muted)]">
            {[
              order.deliveryMethod?.name ?? "Самовывоз",
              order.appliedPromoCode,
              order.loyaltyRedemptionTotal > 0
                ? `баллы ${formatCurrency(order.loyaltyRedemptionTotal)}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      ),
      status: (
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={getStatusTone(order.status)}>
              {orderStatusLabels[order.status]}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs whitespace-nowrap">
            {overdue ? (
              <span className="font-semibold text-red-600">
                просрочен
                {order.productionDueAt
                  ? ` · срок ${formatDate(new Date(order.productionDueAt))}`
                  : ""}
              </span>
            ) : (
              <span
                className={
                  order.manager || !activeOrderStatuses.has(order.status)
                    ? "text-[var(--muted)]"
                    : "font-medium text-amber-700"
                }
              >
                {order.manager
                  ? getManagerDisplayName(order.manager)
                  : "без менеджера"}
              </span>
            )}
          </p>
        </div>
      ),
      manage: (
        <div className="flex items-center justify-end gap-1.5">
          {next ? (
            <form action={updateOrderAction}>
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="status" value={next.status} />
              <AdminSubmitButton
                type="submit"
                size="sm"
                className="h-8 rounded-[8px] px-3 text-[12.5px] whitespace-nowrap"
                idleLabel={`${next.label} →`}
                pendingLabel="..."
              />
            </form>
          ) : null}
          <RowMenu label={`Действия с заказом ${number}`}>
            <Link
              href={`/admin/orders/${order.id}`}
              className={rowMenuItemClass}
            >
              <SquarePen className="size-4 text-[var(--muted)]" />
              Открыть и редактировать
            </Link>
            <WhatsappClientLink
              className={cn(
                rowMenuItemClass,
                "text-emerald-700 hover:no-underline",
              )}
              label="Написать в WhatsApp"
              phone={order.contactPhone}
              text={buildOrderWhatsappText({
                number: order.number,
                contactName: order.contactName,
                statusLabel: orderStatusLabels[order.status],
                isReady: order.status === OrderStatus.READY_FOR_PICKUP,
              })}
            />
            <form
              action={updateOrderAction}
              className="grid gap-1.5 border-t border-[color:var(--line)] px-1 pt-2 pb-1"
            >
              <input type="hidden" name="id" value={order.id} />
              <Select
                name="status"
                defaultValue={order.status}
                aria-label="Статус"
                className="h-8 text-xs sm:h-8"
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
                aria-label="Менеджер"
                className="h-8 text-xs sm:h-8"
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
                className="h-8 text-xs"
                idleLabel="Сохранить"
                pendingLabel="Сохраняем..."
              />
            </form>
            {canDeleteOrder ? (
              <div className="border-t border-[color:var(--line)] pt-1">
                <DeleteOrderButton orderId={order.id} orderNumber={number} />
              </div>
            ) : null}
          </RowMenu>
        </div>
      ),
    };
  });

  return (
    <div className="space-y-4">
      <ListHeader
        title="Заказы"
        tabs={[
          {
            label: "Все",
            href: "/admin/orders",
            count: orders.length,
            active: activeFilters.length === 0 && state.due === "all",
          },
          {
            label: "Новые",
            href: getStateHref(emptyState, { status: OrderStatus.NEW }),
            count: orders.filter((order) => order.status === OrderStatus.NEW)
              .length,
            alert: true,
            active: isOnly({ status: OrderStatus.NEW }),
          },
          {
            label: "Без менеджера",
            href: getStateHref(emptyState, { assignment: "unassigned" }),
            count: unassignedOrders.length,
            active: isOnly({ assignment: "unassigned" }),
          },
          {
            label: "В производстве",
            href: getStateHref(emptyState, {
              status: OrderStatus.IN_PRODUCTION,
            }),
            count: orders.filter(
              (order) => order.status === OrderStatus.IN_PRODUCTION,
            ).length,
            active: isOnly({ status: OrderStatus.IN_PRODUCTION }),
          },
          {
            label: "Просрочено",
            href: getStateHref(emptyState, { due: "overdue" }),
            count: overdueCount,
            alert: true,
            active: isOnly({ due: "overdue" }),
          },
          {
            label: "Без оплаты",
            href: getStateHref(emptyState, { due: "unpaid" }),
            count: unpaidCount,
            active: isOnly({ due: "unpaid" }),
          },
        ]}
        actions={
          <DownloadCsvButton
            csvContent={ordersCsv}
            fileName={`artisan-orders-${new Date().toISOString().slice(0, 10)}.csv`}
          />
        }
      />

      <AutoFilterForm
        action="/admin/orders"
        className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
      >
        <label className="relative col-span-2 lg:col-span-1">
          <span className="sr-only">Поиск</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            name="q"
            type="search"
            defaultValue={state.q}
            placeholder="Номер, фамилия, телефон, компания или промокод"
            className="h-10 rounded-[var(--radius-control)] pl-10 sm:h-10 sm:pl-10"
          />
        </label>
        <Select
          name="status"
          defaultValue={state.status}
          aria-label="Статус"
          wrapperClassName="lg:w-44"
          className="h-10 rounded-[var(--radius-control)] sm:h-10 sm:pr-10"
        >
          <option value="all">Любой статус</option>
          {Object.values(OrderStatus).map((status) => (
            <option key={status} value={status}>
              {orderStatusLabels[status]}
            </option>
          ))}
        </Select>
        <Select
          name="sort"
          defaultValue={state.sort}
          aria-label="Сортировка"
          wrapperClassName="lg:w-52"
          className="h-10 rounded-[var(--radius-control)] sm:h-10 sm:pr-10"
        >
          {adminOrderSortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <details
          className="relative col-span-2 lg:col-span-1"
          open={moreFiltersOpen ? true : undefined}
        >
          <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--line)] bg-white px-3.5 text-sm font-medium whitespace-nowrap">
            <SlidersHorizontal className="size-4 text-[var(--muted)]" />
            Ещё фильтры
          </summary>
          <div className="absolute right-0 z-20 mt-2 grid w-72 gap-2.5 rounded-[12px] border border-[color:var(--line)] bg-white p-3 shadow-[0_16px_40px_rgba(0,0,0,0.12)]">
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Менеджер
              <Select name="managerId" defaultValue={state.managerId}>
                <option value="">Все менеджеры</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {getManagerDisplayName(manager)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Назначение
              <Select name="assignment" defaultValue={state.assignment}>
                <option value="all">Все заказы</option>
                <option value="assigned">С менеджером</option>
                <option value="unassigned">Без менеджера</option>
              </Select>
            </label>
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Логистика
              <Select name="delivery" defaultValue={state.delivery}>
                <option value="all">Все варианты</option>
                <option value="delivery">С доставкой</option>
                <option value="pickup">Самовывоз</option>
              </Select>
            </label>
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Срок и оплата
              <Select name="due" defaultValue={state.due}>
                <option value="all">Любой</option>
                <option value="overdue">Просроченные ({overdueCount})</option>
                <option value="unpaid">Без оплаты ({unpaidCount})</option>
              </Select>
            </label>
          </div>
        </details>
      </AutoFilterForm>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <span>
          Найдено {filteredOrders.length} из {orders.length}
          {overdueCount > 0 ? ` · просрочено ${overdueCount}` : ""}
        </span>
        {activeFilters.map((filter) => (
          <Link
            key={filter.key}
            href={filter.href}
            className="rounded-full border border-[color:var(--line)] bg-white px-2.5 py-1 text-xs text-[var(--foreground)] transition hover:border-[color:var(--line-strong)]"
          >
            {filter.label} ×
          </Link>
        ))}
        {activeFilters.length > 1 ? (
          <Link
            href="/admin/orders"
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            Сбросить всё
          </Link>
        ) : null}
      </div>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 rounded-[var(--radius-inner)] border border-[color:var(--line)] bg-white p-2.5 lg:flex-row lg:items-center">
          <BulkSelectionTools checkboxSelector="[data-order-bulk-checkbox='true']" />
          <form
            id="bulk-orders-form"
            action={bulkUpdateOrdersAction}
            className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_220px_auto]"
          >
            <Select
              name="bulkAction"
              defaultValue=""
              aria-label="Действие для отмеченных"
              className="h-9 rounded-[var(--radius-control)] text-sm sm:h-9"
            >
              <option value="" disabled>
                С отмеченными…
              </option>
              {bulkActionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              name="managerId"
              defaultValue=""
              aria-label="Менеджер для назначения"
              className="h-9 rounded-[var(--radius-control)] text-sm sm:h-9"
            >
              <option value="">Менеджер</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {getManagerDisplayName(manager)}
                </option>
              ))}
            </Select>
            <BulkOrdersSubmitButton checkboxSelector="[data-order-bulk-checkbox='true']" />
          </form>
        </div>

        <DataTable
          columns={[
            { key: "select", label: "" },
            { key: "order", label: "Заказ" },
            { key: "client", label: "Клиент" },
            { key: "logistics", label: "Сумма" },
            { key: "status", label: "Статус" },
            { key: "manage", label: "Действие" },
          ]}
          rows={rows}
          compact
          rowTones={pageOrders.map((order) =>
            order.status === OrderStatus.NEW ? "alert" : undefined,
          )}
          caption="Таблица заказов"
          emptyMessage="По текущим фильтрам ничего не найдено. Измените срез или сбросьте параметры."
        />
        {totalPages > 1 ? (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            getHref={getPageHref}
            className="mt-4"
          />
        ) : null}
      </section>
    </div>
  );
}
