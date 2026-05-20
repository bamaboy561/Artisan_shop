import Form from "next/form";
import Link from "next/link";

import { RequestStatus, RequestType } from "@/generated/prisma";
import {
  bulkUpdateRequestsAction,
  deleteRequestAction,
  updateRequestAction,
} from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { BulkSelectionTools } from "@/components/admin/bulk-selection-tools";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
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
} from "@/lib/server/operations-admin";
import { getRequestInbox } from "@/lib/server/request-inbox";
import {
  activeRequestStatuses,
  adminRequestSortOptions,
  buildAdminRequestsHref,
  filterAdminRequests,
  getManagerDisplayName,
  parseAdminRequestSearchParams,
  requestStatusLabels,
  requestTypeLabels,
  sanitizeAdminRequestFilterState,
  sortAdminRequests,
  type AdminRequestFilterState,
} from "@/features/admin/operations-filters";

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
  { value: "delete", label: "Удалить выбранные" },
] as const;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatBudget(value: number | null) {
  if (value === null) {
    return "Не указан";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KGS",
    maximumFractionDigits: 0,
  }).format(value);
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
          "Запустите prisma db seed, чтобы получить тестовую заявку в очереди.",
        ]}
      />
    );
  }

  await requireAdminSession("/login?next=/admin/requests");

  const [requests, managers, resolvedSearchParams] = await Promise.all([
    getRequestInbox(),
    getAdminManagers(),
    searchParams,
  ]);

  const parsedState = parseAdminRequestSearchParams(resolvedSearchParams);
  const state = sanitizeAdminRequestFilterState(parsedState, managers);
  const filteredRequests = sortAdminRequests(
    filterAdminRequests(requests, state),
    state.sort,
  );

  const activeRequests = requests.filter((request) =>
    activeRequestStatuses.has(request.status),
  );
  const unassignedRequests = activeRequests.filter((request) => !request.managerId);
  const requestsWithFiles = requests.filter((request) => request._count.files > 0);
  const cuttingRequests = requests.filter(
    (request) => request.type === RequestType.CUTTING_SERVICE,
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
    state.files !== "all"
      ? {
          key: "files",
          label: state.files === "with-files" ? "Только с файлами" : "Без файлов",
          href: getStateHref(state, { files: "all" }),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; href: string }>;

  const rows = filteredRequests.map((request) => ({
    select: (
      <input
        type="checkbox"
        name="requestIds"
        value={request.id}
        form="bulk-requests-form"
        data-request-bulk-checkbox="true"
        className="size-4 rounded border-[color:var(--line-strong)] accent-[var(--accent)]"
        aria-label={`Выбрать заявку ${request.number ?? request.id.slice(0, 8)}`}
      />
    ),
    request: (
      <div className="space-y-1">
        <Link
          href={`/admin/requests/${request.id}`}
          className="font-semibold text-[var(--foreground)] transition hover:text-[var(--accent)]"
        >
          {request.number ?? request.id.slice(0, 8)}
        </Link>
        <p className="text-xs text-[var(--muted)]">
          {formatDate(request.createdAt)} · {requestTypeLabels[request.type]}
        </p>
      </div>
    ),
    client: (
      <div className="space-y-1">
        <p>{request.contactName}</p>
        <p className="text-xs text-[var(--muted)]">{request.contactPhone}</p>
        {request.contactEmail ? (
          <p className="text-xs text-[var(--muted)]">{request.contactEmail}</p>
        ) : null}
      </div>
    ),
    details: (
      <div className="space-y-2">
        <p className="font-medium text-[var(--foreground)]">{request.subject}</p>
        <p className="text-xs text-[var(--muted)]">
          {request.product?.name ?? request.material ?? "Материал не указан"}
        </p>
        {request.message ? (
          <p className="text-xs leading-5 text-[var(--muted)]">
            {request.message.split("\n").slice(0, 3).join(" · ")}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {request._count.files > 0 ? (
            <StatusBadge tone="accent">
              Файлы {request._count.files}
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Без файлов</StatusBadge>
          )}
          {request.deliveryNeeded ? (
            <StatusBadge tone="warning">Нужна доставка</StatusBadge>
          ) : null}
          {request.edgeOption ? (
            <StatusBadge tone="neutral">{request.edgeOption}</StatusBadge>
          ) : null}
        </div>
      </div>
    ),
    status: (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={getStatusTone(request.status)}>
            {requestStatusLabels[request.status]}
          </StatusBadge>
          <StatusBadge tone={request.managerId ? "neutral" : "warning"}>
            {request.manager
              ? getManagerDisplayName(request.manager)
              : "Без менеджера"}
          </StatusBadge>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Бюджет: {formatBudget(request.estimatedBudget)}
        </p>
      </div>
    ),
    manage: (
      <div className="grid gap-2">
        <form action={updateRequestAction} className="grid gap-2">
          <input type="hidden" name="id" value={request.id} />
          <Select
            name="status"
            defaultValue={request.status}
            className="h-9 text-xs"
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
        <form action={deleteRequestAction}>
          <input type="hidden" name="id" value={request.id} />
          <ConfirmSubmit
            message={`Удалить заявку ${request.number ?? request.id.slice(0, 8)}? Действие необратимо.`}
            className="h-8 w-full px-2 text-[11px]"
          >
            Удалить
          </ConfirmSubmit>
        </form>
      </div>
    ),
  }));

  return (
    <div className="space-y-5">
      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6 sm:p-7">
        <SectionHeading
          title="Заявки"
          description="Рабочая очередь для запросов цены, консультаций и услуг распила. Команда может быстро выделять срочные обращения и вести их по этапам."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Всего заявок"
          value={requests.length}
          detail={`${filteredRequests.length} видно по текущему срезу`}
        />
        <MetricCard
          label="Активные"
          value={activeRequests.length}
          detail="Заявки, требующие ответа, расчета или сопровождения"
        />
        <MetricCard
          label="Без менеджера"
          value={unassignedRequests.length}
          detail="Активные обращения, еще не распределенные в команде"
        />
        <MetricCard
          label="Распил и файлы"
          value={cuttingRequests.length}
          detail={`${requestsWithFiles.length} заявок уже содержат файлы`}
        />
      </section>

      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
              Фильтры очереди
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[var(--foreground)]">
              Сервисный поток
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Можно быстро оставить только заявки на распил, только обращения с
              файлами или только новые запросы без ответственного менеджера.
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
              href={getStateHref(state, { status: RequestStatus.NEW })}
              className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
            >
              Новые
            </Link>
            <Link
              href={getStateHref(state, { type: RequestType.CUTTING_SERVICE })}
              className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
            >
              Распил
            </Link>
            <Link
              href={getStateHref(state, { files: "with-files" })}
              className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
            >
              С файлами
            </Link>
          </div>
        </div>

        <Form action="/admin/requests" scroll={false} className="mt-6 grid gap-4 xl:grid-cols-5">
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm text-[var(--foreground)]">
              Поиск по номеру, клиенту, теме, материалу или SKU
            </span>
            <Input
              name="q"
              defaultValue={state.q}
              placeholder="Например, распил AGT или 101-004"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Статус</span>
            <Select name="status" defaultValue={state.status}>
              <option value="all">Все статусы</option>
              {Object.values(RequestStatus).map((status) => (
                <option key={status} value={status}>
                  {requestStatusLabels[status]}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Тип заявки</span>
            <Select name="type" defaultValue={state.type}>
              <option value="all">Все типы</option>
              {Object.values(RequestType).map((type) => (
                <option key={type} value={type}>
                  {requestTypeLabels[type]}
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
              <option value="all">Все заявки</option>
              <option value="assigned">С менеджером</option>
              <option value="unassigned">Без менеджера</option>
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Файлы</span>
            <Select name="files" defaultValue={state.files}>
              <option value="all">Все заявки</option>
              <option value="with-files">Только с файлами</option>
              <option value="without-files">Без файлов</option>
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Сортировка</span>
            <Select name="sort" defaultValue={state.sort}>
              {adminRequestSortOptions.map((option) => (
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
              href="/admin/requests"
              className="inline-flex h-11 items-center justify-center border border-[color:var(--line-strong)] px-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
            >
              Сбросить всё
            </Link>
            <span className="text-sm text-[var(--muted)]">
              Найдено {filteredRequests.length} из {requests.length} заявок
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
                Обработка текущей выборки
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Выделите обращения и быстро распределите их по менеджерам или
                переведите на следующий этап обработки.
              </p>
            </div>

            <BulkSelectionTools checkboxSelector="[data-request-bulk-checkbox='true']" />
          </div>

          <form
            id="bulk-requests-form"
            action={bulkUpdateRequestsAction}
            className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px_auto]"
          >
            <Select name="bulkAction" defaultValue="">
              <option value="" disabled>
                Выберите действие для отмеченных заявок
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
            { key: "request", label: "Заявка" },
            { key: "client", label: "Клиент" },
            { key: "details", label: "Содержание" },
            { key: "status", label: "Статус" },
            { key: "manage", label: "Быстрое управление" },
          ]}
          rows={rows}
          caption="Таблица заявок"
          emptyMessage="По текущим фильтрам ничего не найдено. Измените срез или сбросьте параметры."
        />
      </section>
    </div>
  );
}
