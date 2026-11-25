import { formatPrice } from "@/lib/commerce";
import Link from "next/link";
import { Search, SlidersHorizontal, SquarePen } from "lucide-react";

import { RequestStatus, RequestType } from "@/generated/prisma";
import {
  bulkUpdateRequestsAction,
  updateRequestAction,
} from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { BulkSelectionTools } from "@/components/admin/bulk-selection-tools";
import { DeleteRequestButton } from "@/components/admin/delete-request-button";
import { AutoFilterForm } from "@/components/admin/list/auto-filter-form";
import { ListHeader } from "@/components/admin/list/list-header";
import { RowMenu, rowMenuItemClass } from "@/components/admin/list/row-menu";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { formatListDate } from "@/features/admin/list-format";
import { requireAdminSession } from "@/lib/auth/dal";
import { canDeleteRequests } from "@/lib/auth/roles";
import { hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import { getAdminManagers } from "@/lib/server/operations-admin";
import { PageLinks } from "@/components/admin/page-links";
import { clampPage, listAdminRequests } from "@/lib/server/request-list";
import {
  adminRequestSortOptions,
  buildAdminRequestsHref,
  getManagerDisplayName,
  parseAdminRequestSearchParams,
  requestStatusLabels,
  requestTypeLabels,
  sanitizeAdminRequestFilterState,
  type AdminRequestFilterState,
} from "@/features/admin/operations-filters";
import {
  isSiteRequest,
  needsSiteAttention,
} from "@/features/admin/request-origin";

export const dynamic = "force-dynamic";

type AdminRequestsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const bulkActionOptions = [
  { value: "review", label: "Перевести на расчет" },
  { value: "quote-sent", label: "Отметить: КП отправлено" },
  { value: "waiting-client", label: "Отметить: ждем клиента" },
  { value: "in-progress", label: "Перевести в работу" },
  { value: "complete", label: "Завершить выбранные" },
  { value: "cancel", label: "Отменить выбранные" },
  { value: "assign-manager", label: "Назначить менеджера" },
  { value: "clear-manager", label: "Снять менеджера" },
] as const;

function formatBudget(value: number | null) {
  if (value === null) {
    return "Не указан";
  }

  return formatPrice(value);
}

function getStatusTone(status: RequestStatus) {
  switch (status) {
    case RequestStatus.NEW:
    case RequestStatus.IN_REVIEW:
      return "warning" as const;
    case RequestStatus.QUOTE_SENT:
    case RequestStatus.WAITING_FOR_CLIENT:
    case RequestStatus.IN_PROGRESS:
      return "accent" as const;
    case RequestStatus.COMPLETED:
      return "success" as const;
    case RequestStatus.CANCELED:
    default:
      return "neutral" as const;
  }
}

function getStateHref(
  state: AdminRequestFilterState,
  overrides: Partial<AdminRequestFilterState>,
) {
  return buildAdminRequestsHref("/admin/requests", {
    ...state,
    ...overrides,
  });
}

export default async function AdminRequestsPage({
  searchParams,
}: AdminRequestsPageProps) {
  if (!hasDatabaseUrl() && !isDemoModeEnabled()) {
    return (
      <SetupState
        title="Заявки начнут работать после настройки БД"
        description="Раздел уже готов к обработке запросов цены, консультаций и услуг распила с назначением менеджеров и статусами."
        steps={[
          "Настройте DATABASE_URL в .env.",
          "Примените схему БД через prisma db push.",
          "Первая реальная заявка появится после отправки формы распила или обращения с сайта.",
        ]}
      />
    );
  }

  const session = await requireAdminSession(
    "/login?next=/admin/requests",
    "/admin/requests",
  );
  const canDeleteRequest = canDeleteRequests(session.roleCode);

  const [managers, resolvedSearchParams] = await Promise.all([
    getAdminManagers(),
    searchParams,
  ]);

  const parsedState = parseAdminRequestSearchParams(resolvedSearchParams);
  const state = sanitizeAdminRequestFilterState(parsedState, managers);
  const pageParam = resolvedSearchParams.page;
  const list = await listAdminRequests(
    state,
    clampPage(Array.isArray(pageParam) ? pageParam[0] : pageParam),
  );
  const filteredRequests = list.items;
  const { metrics } = list;

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
          label: `Статус: ${requestStatusLabels[state.status]}`,
          href: getStateHref(state, { status: "all" }),
        }
      : null,
    state.type !== "all"
      ? {
          key: "type",
          label: `Тип: ${requestTypeLabels[state.type]}`,
          href: getStateHref(state, { type: "all" }),
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
    state.origin !== "all"
      ? {
          key: "origin",
          label: "Только с сайта",
          href: getStateHref(state, { origin: "all" }),
        }
      : null,
    state.files !== "all"
      ? {
          key: "files",
          label:
            state.files === "with-files" ? "Только с файлами" : "Без файлов",
          href: getStateHref(state, { files: "all" }),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; href: string }>;

  const now = new Date();
  const canTake = managers.some((manager) => manager.id === session.userId);
  const moreFiltersOpen = Boolean(
    state.managerId ||
    state.assignment !== "all" ||
    state.files !== "all" ||
    state.origin !== "all",
  );
  const emptyState = sanitizeAdminRequestFilterState(
    parseAdminRequestSearchParams({}),
    managers,
  );
  const isOnly = (overrides: Partial<AdminRequestFilterState>) =>
    getStateHref(state, { sort: emptyState.sort }) ===
    getStateHref(emptyState, overrides);

  const rows = filteredRequests.map((request) => {
    const site = isSiteRequest(request);
    const number = request.number ?? request.id.slice(0, 8);

    return {
      select: (
        <input
          type="checkbox"
          name="requestIds"
          value={request.id}
          form="bulk-requests-form"
          data-request-bulk-checkbox="true"
          className="size-4 rounded border-[color:var(--line-strong)] accent-[var(--accent)]"
          aria-label={`Выбрать заявку ${number}`}
        />
      ),
      request: (
        <div className="min-w-[150px]">
          <p className="flex items-center gap-2">
            <Link
              href={`/admin/requests/${request.id}`}
              className="font-bold text-[var(--foreground)] transition hover:text-[var(--accent)]"
            >
              {number}
            </Link>
            {site ? (
              <span className="rounded-full bg-red-50 px-1.5 py-px text-[11px] font-semibold text-red-600">
                с сайта
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[12.5px] whitespace-nowrap text-[var(--muted)]">
            {formatListDate(request.createdAt, now)} ·{" "}
            {requestTypeLabels[request.type]}
          </p>
        </div>
      ),
      client: (
        <div className="max-w-[190px]">
          <p className="truncate font-medium">{request.contactName}</p>
          <p className="text-[12.5px] whitespace-nowrap text-[var(--muted)]">
            {request.contactPhone}
          </p>
        </div>
      ),
      details: (
        <div className="max-w-[300px]">
          <p className="truncate font-medium">{request.subject}</p>
          <p className="truncate text-[12.5px] text-[var(--muted)]">
            {[
              request.product?.name ?? request.material,
              request._count.files > 0
                ? `файлов: ${request._count.files}`
                : null,
              request.deliveryNeeded ? "доставка" : null,
              request.estimatedBudget
                ? `бюджет ${formatBudget(request.estimatedBudget)}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Материал не указан"}
          </p>
        </div>
      ),
      status: (
        <div>
          <StatusBadge tone={getStatusTone(request.status)}>
            {requestStatusLabels[request.status]}
          </StatusBadge>
          <p
            className={
              request.manager
                ? "mt-1 text-xs text-[var(--muted)]"
                : "mt-1 text-xs font-medium text-amber-700"
            }
          >
            {request.manager
              ? getManagerDisplayName(request.manager)
              : "без менеджера"}
          </p>
        </div>
      ),
      manage: (
        <div className="flex items-center justify-end gap-1.5">
          {!request.managerId &&
          canTake &&
          request.status !== RequestStatus.COMPLETED &&
          request.status !== RequestStatus.CANCELED ? (
            <form action={updateRequestAction}>
              <input type="hidden" name="id" value={request.id} />
              <input type="hidden" name="managerId" value={session.userId} />
              <input
                type="hidden"
                name="status"
                value={
                  request.status === RequestStatus.NEW
                    ? RequestStatus.IN_REVIEW
                    : request.status
                }
              />
              <AdminSubmitButton
                type="submit"
                size="sm"
                className="h-8 rounded-[8px] px-3 text-[12.5px] whitespace-nowrap"
                idleLabel="Взять себе"
                pendingLabel="..."
              />
            </form>
          ) : (
            <Link
              href={`/admin/requests/${request.id}`}
              className="inline-flex h-8 items-center rounded-[8px] border border-[color:var(--line)] px-3 text-[12.5px] font-semibold whitespace-nowrap transition hover:border-[color:var(--line-strong)]"
            >
              Открыть
            </Link>
          )}
          <RowMenu label={`Действия с заявкой ${number}`}>
            <Link
              href={`/admin/requests/${request.id}`}
              className={rowMenuItemClass}
            >
              <SquarePen className="size-4 text-[var(--muted)]" />
              Открыть заявку
            </Link>
            <form
              action={updateRequestAction}
              className="grid gap-1.5 border-t border-[color:var(--line)] px-1 pt-2 pb-1"
            >
              <input type="hidden" name="id" value={request.id} />
              <Select
                name="status"
                defaultValue={request.status}
                aria-label="Статус"
                className="h-8 text-xs sm:h-8"
              >
                {Object.values(RequestStatus).map((status) => (
                  <option key={status} value={status}>
                    {requestStatusLabels[status]}
                  </option>
                ))}
              </Select>
              <Select
                name="managerId"
                defaultValue={request.managerId ?? ""}
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
            {canDeleteRequest ? (
              <div className="border-t border-[color:var(--line)] pt-1">
                <DeleteRequestButton
                  requestId={request.id}
                  requestNumber={number}
                  returnTo="/admin/requests"
                  variant="menu"
                />
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
        title="Заявки"
        tabs={[
          {
            label: "Все",
            href: "/admin/requests",
            count: metrics.total,
            active: activeFilters.length === 0,
          },
          {
            label: "Новые с сайта",
            href: getStateHref(emptyState, {
              origin: "site",
              status: RequestStatus.NEW,
            }),
            count: metrics.siteNew,
            alert: true,
            active: isOnly({ origin: "site", status: RequestStatus.NEW }),
          },
          {
            label: "Без менеджера",
            href: getStateHref(emptyState, { assignment: "unassigned" }),
            count: metrics.unassigned,
            active: isOnly({ assignment: "unassigned" }),
          },
          {
            label: "Распил",
            href: getStateHref(emptyState, {
              type: RequestType.CUTTING_SERVICE,
            }),
            count: metrics.cutting,
            active: isOnly({ type: RequestType.CUTTING_SERVICE }),
          },
          {
            label: "С файлами",
            href: getStateHref(emptyState, { files: "with-files" }),
            count: metrics.withFiles,
            active: isOnly({ files: "with-files" }),
          },
        ]}
        actions={
          <Link
            href="/admin/requests/bazis-files"
            className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-[color:var(--line)] bg-white px-4 text-[13.5px] font-semibold whitespace-nowrap transition hover:border-[color:var(--line-strong)]"
          >
            Проекты Базиса с сайта
          </Link>
        }
      />

      <AutoFilterForm
        action="/admin/requests"
        className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
      >
        <label className="relative col-span-2 lg:col-span-1">
          <span className="sr-only">Поиск</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            name="q"
            type="search"
            defaultValue={state.q}
            placeholder="Номер, клиент, телефон, тема, материал или SKU"
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
          {Object.values(RequestStatus).map((status) => (
            <option key={status} value={status}>
              {requestStatusLabels[status]}
            </option>
          ))}
        </Select>
        <Select
          name="type"
          defaultValue={state.type}
          aria-label="Тип заявки"
          wrapperClassName="lg:w-44"
          className="h-10 rounded-[var(--radius-control)] sm:h-10 sm:pr-10"
        >
          <option value="all">Все типы</option>
          {Object.values(RequestType).map((type) => (
            <option key={type} value={type}>
              {requestTypeLabels[type]}
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
                <option value="all">Все заявки</option>
                <option value="assigned">С менеджером</option>
                <option value="unassigned">Без менеджера</option>
              </Select>
            </label>
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Файлы
              <Select name="files" defaultValue={state.files}>
                <option value="all">Все заявки</option>
                <option value="with-files">Только с файлами</option>
                <option value="without-files">Без файлов</option>
              </Select>
            </label>
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Откуда
              <Select name="origin" defaultValue={state.origin}>
                <option value="all">Все заявки</option>
                <option value="site">Только с сайта</option>
              </Select>
            </label>
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Сортировка
              <Select name="sort" defaultValue={state.sort}>
                {adminRequestSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </details>
      </AutoFilterForm>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <span>
          Найдено {list.filteredTotal} из {metrics.total}
          {list.pageCount > 1
            ? ` · страница ${list.page} из ${list.pageCount}`
            : ""}
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
            href="/admin/requests"
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            Сбросить всё
          </Link>
        ) : null}
      </div>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 rounded-[var(--radius-inner)] border border-[color:var(--line)] bg-white p-2.5 lg:flex-row lg:items-center">
          <BulkSelectionTools checkboxSelector="[data-request-bulk-checkbox='true']" />
          <form
            id="bulk-requests-form"
            action={bulkUpdateRequestsAction}
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
            <AdminSubmitButton
              type="submit"
              variant="secondary"
              size="sm"
              idleLabel="Применить"
              pendingLabel="Применяем..."
            />
          </form>
        </div>

        <DataTable
          columns={[
            { key: "select", label: "" },
            { key: "request", label: "Заявка" },
            { key: "client", label: "Клиент" },
            { key: "details", label: "Содержание" },
            { key: "status", label: "Статус" },
            { key: "manage", label: "Действие" },
          ]}
          rows={rows}
          compact
          rowTones={filteredRequests.map((request) =>
            needsSiteAttention(request) ? "alert" : undefined,
          )}
          caption="Таблица заявок"
          emptyMessage="По текущим фильтрам ничего не найдено. Измените срез или сбросьте параметры."
        />
        <PageLinks
          baseHref={getStateHref(state, {})}
          page={list.page}
          pageCount={list.pageCount}
        />
      </section>
    </div>
  );
}
