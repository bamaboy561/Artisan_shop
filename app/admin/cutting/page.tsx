import { formatPrice } from "@/lib/commerce";
import Form from "next/form";
import Link from "next/link";
import { Plus, Printer, RotateCcw, Search } from "lucide-react";

import { RequestStatus } from "@/generated/prisma";
import { updateRequestAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { DeleteRequestButton } from "@/components/admin/delete-request-button";
import { MetricCard } from "@/components/admin/metric-card";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { getButtonClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SectionHeading } from "@/components/ui/section-heading";
import { DataTable } from "@/components/ui/table";
import {
  getManagerDisplayName,
  requestStatusLabels,
} from "@/features/admin/operations-filters";
import { cuttingStageLabels } from "@/features/cutting/progress";
import { requireAdminSession } from "@/lib/auth/dal";
import { canDeleteRequests } from "@/lib/auth/roles";
import { hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import { PageLinks } from "@/components/admin/page-links";
import {
  isSiteRequest,
  needsSiteAttention,
} from "@/features/admin/request-origin";
import { clampPage, listAdminCuttingRequests } from "@/lib/server/request-list";

export const dynamic = "force-dynamic";

type AdminCuttingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type CuttingDateSort = "date-asc" | "date-desc";

function getFirstSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];

  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Bishkek",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isValidDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const [, year, month, day] = match;
  const parsedDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );

  return (
    parsedDate.getUTCFullYear() === Number(year) &&
    parsedDate.getUTCMonth() === Number(month) - 1 &&
    parsedDate.getUTCDate() === Number(day)
  );
}

function formatBudget(value: number | null) {
  if (value === null) {
    return "По расчету";
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

export default async function AdminCuttingPage({
  searchParams,
}: AdminCuttingPageProps) {
  if (!hasDatabaseUrl() && !isDemoModeEnabled()) {
    return (
      <SetupState
        title="Очередь распила появится после настройки БД"
        description="Здесь будут заявки с файлами клиента, расчетом, картой раскроя и ведомостью для производства."
        steps={[
          "Настройте DATABASE_URL.",
          "Примените Prisma-схему через prisma db push.",
          "Отправьте первую заявку на распил с сайта.",
        ]}
      />
    );
  }

  const session = await requireAdminSession(
    "/login?next=/admin/cutting",
    "/admin/cutting",
  );
  const canDeleteRequest = canDeleteRequests(session.roleCode);

  const resolvedSearchParams = await searchParams;

  const statusParam = getFirstSearchValue(resolvedSearchParams, "status");
  const query = getFirstSearchValue(resolvedSearchParams, "q").trim();
  const dateFromParam = getFirstSearchValue(resolvedSearchParams, "dateFrom");
  const dateToParam = getFirstSearchValue(resolvedSearchParams, "dateTo");
  const sortParam = getFirstSearchValue(resolvedSearchParams, "sort");
  const statusFilter =
    Object.values(RequestStatus).find((status) => status === statusParam) ??
    "all";
  const validDateFrom = isValidDateInput(dateFromParam) ? dateFromParam : "";
  const validDateTo = isValidDateInput(dateToParam) ? dateToParam : "";
  const [dateFrom, dateTo] =
    validDateFrom && validDateTo && validDateFrom > validDateTo
      ? [validDateTo, validDateFrom]
      : [validDateFrom, validDateTo];
  // По умолчанию сверху самые новые заявки.
  const dateSort: CuttingDateSort =
    sortParam === "date-asc" ? "date-asc" : "date-desc";

  const list = await listAdminCuttingRequests(
    {
      q: query,
      status: statusFilter,
      dateFrom,
      dateTo,
      sort: dateSort,
    },
    clampPage(getFirstSearchValue(resolvedSearchParams, "page")),
  );
  const filteredRequests = list.items;
  const { metrics } = list;
  const baseParams = new URLSearchParams();
  if (query) baseParams.set("q", query);
  if (statusFilter !== "all") baseParams.set("status", statusFilter);
  if (dateFrom) baseParams.set("dateFrom", dateFrom);
  if (dateTo) baseParams.set("dateTo", dateTo);
  if (dateSort !== "date-desc") baseParams.set("sort", dateSort);
  const baseHref = baseParams.size
    ? `/admin/cutting?${baseParams.toString()}`
    : "/admin/cutting";
  const hasActiveFilters =
    Boolean(query || dateFrom || dateTo) ||
    statusFilter !== "all" ||
    dateSort !== "date-desc";

  const rows = filteredRequests.map((request) => ({
    request: (
      <div className="space-y-1">
        <Link
          href={`/admin/requests/${request.id}`}
          className="font-semibold text-[var(--foreground)] transition hover:text-[var(--accent)]"
        >
          {request.number ?? request.id.slice(0, 8)}
        </Link>
        <p className="text-xs text-[var(--muted)]">{request.contactName}</p>
        {isSiteRequest(request) ? (
          <p
            className={
              needsSiteAttention(request)
                ? "inline-flex rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white"
                : "inline-flex rounded-full border border-red-300 px-2 py-0.5 text-[11px] font-semibold text-red-700"
            }
          >
            {needsSiteAttention(request)
              ? "С сайта · не обработана"
              : "С сайта"}
          </p>
        ) : null}
      </div>
    ),
    date: (
      <time
        dateTime={request.createdAt.toISOString()}
        className="text-sm whitespace-nowrap text-[var(--foreground)]"
      >
        {formatDate(request.createdAt)}
      </time>
    ),
    material: (
      <div className="space-y-1">
        <p className="font-medium text-[var(--foreground)]">
          {request.product?.name ?? request.material ?? "Материал уточняется"}
        </p>
        <p className="text-xs text-[var(--muted)]">{request.subject}</p>
      </div>
    ),
    files: (
      <StatusBadge tone={request._count.files > 0 ? "accent" : "neutral"}>
        {request._count.files > 0
          ? `Файлы ${request._count.files}`
          : "Без файлов"}
      </StatusBadge>
    ),
    stage: (
      <div className="space-y-2">
        <StatusBadge tone={request.cuttingStage ? "accent" : "neutral"}>
          {request.cuttingStage
            ? cuttingStageLabels[request.cuttingStage]
            : "Не запущен"}
        </StatusBadge>
        {request.cuttingPickupCell ? (
          <p className="text-xs font-semibold text-emerald-700">
            Ячейка № {request.cuttingPickupCell}
          </p>
        ) : null}
      </div>
    ),
    status: (
      <div className="space-y-2">
        <StatusBadge tone={getStatusTone(request.status)}>
          {requestStatusLabels[request.status]}
        </StatusBadge>
        <p className="text-xs text-[var(--muted)]">
          {request.manager
            ? getManagerDisplayName(request.manager)
            : "Без менеджера"}
        </p>
      </div>
    ),
    budget: formatBudget(
      request.quotedTotal ?? request.estimatedBudget ?? null,
    ),
    manage: (
      <div className="grid gap-2">
        <Link
          href={`/admin/requests/${request.id}/route-sheet`}
          className="inline-flex h-9 items-center justify-center gap-2 border border-[color:var(--line-strong)] px-3 text-xs font-semibold transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
        >
          <Printer className="size-3.5" />
          Маршрут
        </Link>
        <form action={updateRequestAction} className="grid gap-2">
          <input type="hidden" name="id" value={request.id} />
          <input
            type="hidden"
            name="managerId"
            value={request.managerId ?? ""}
          />
          <Select
            name="status"
            defaultValue={request.status}
            className="h-9 text-xs"
          >
            <option value={RequestStatus.NEW}>Новая</option>
            <option value={RequestStatus.IN_REVIEW}>На расчете</option>
            <option value={RequestStatus.WAITING_FOR_CLIENT}>
              Ждём клиента
            </option>
            <option value={RequestStatus.QUOTE_SENT}>КП отправлено</option>
            <option value={RequestStatus.IN_PROGRESS}>В производстве</option>
            <option value={RequestStatus.COMPLETED}>Завершена</option>
            <option value={RequestStatus.CANCELED}>Отменена</option>
          </Select>
          <AdminSubmitButton
            type="submit"
            variant="secondary"
            size="sm"
            idleLabel="Обновить"
            pendingLabel="Сохраняем..."
          />
        </form>
        {canDeleteRequest ? (
          <DeleteRequestButton
            requestId={request.id}
            requestNumber={request.number ?? request.id.slice(0, 8)}
            returnTo="/admin/cutting"
          />
        ) : null}
      </div>
    ),
  }));

  return (
    <div className="space-y-5">
      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeading
            title="Распил"
            description="Производственная очередь: клиентские файлы, расчет, Giblab-результат, карта раскроя и выдача заказа."
            titleClassName="text-2xl sm:text-3xl"
            descriptionClassName="max-w-3xl text-sm leading-7"
          />
          <Link
            href="/admin/cutting/pricing"
            className={getButtonClassName("secondary", "md", "shrink-0")}
          >
            Прайс работ
          </Link>
          <Link
            href="/admin/cutting/new"
            className={getButtonClassName("accent", "md", "shrink-0")}
          >
            <Plus className="size-4" />
            Новый распил
          </Link>
        </div>
      </section>

      {metrics.siteNew > 0 ? (
        <Link
          href="/admin/cutting?status=NEW"
          className="flex items-center justify-between gap-3 rounded-[20px] border-2 border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
        >
          <span>
            Новых заявок с сайта: {metrics.siteNew} — их ещё никто не взял в
            работу
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Всего заявок"
          value={metrics.total}
          detail="Все заявки на распил"
        />
        <MetricCard
          label="Активные"
          value={metrics.active}
          detail="Требуют расчета или производства"
        />
        <MetricCard
          label="С файлами"
          value={metrics.withFiles}
          detail="Есть Excel/PDF/DXF/DWG или архив"
        />
        <MetricCard
          label="В производстве"
          value={metrics.inProduction}
          detail="Переданы в цех"
        />
      </section>

      <section className="surface-glow space-y-3 rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
        <Form
          action="/admin/cutting"
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.5fr)_180px_155px_155px_190px_auto] xl:items-end"
        >
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[var(--muted)]">
              Поиск
            </span>
            <Input
              name="q"
              defaultValue={query}
              placeholder="Клиент, материал или номер"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[var(--muted)]">
              Статус
            </span>
            <Select name="status" defaultValue={statusFilter}>
              <option value="all">Все статусы</option>
              {Object.values(RequestStatus).map((status) => (
                <option key={status} value={status}>
                  {requestStatusLabels[status]}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[var(--muted)]">
              Дата с
            </span>
            <Input
              type="date"
              name="dateFrom"
              defaultValue={dateFrom}
              max={dateTo || undefined}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[var(--muted)]">
              Дата по
            </span>
            <Input
              type="date"
              name="dateTo"
              defaultValue={dateTo}
              min={dateFrom || undefined}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[var(--muted)]">
              Порядок
            </span>
            <Select name="sort" defaultValue={dateSort}>
              <option value="date-desc">Сначала новые</option>
              <option value="date-asc">Сначала ранние</option>
            </Select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className={getButtonClassName("secondary", "md", "flex-1")}
            >
              <Search className="size-4" />
              Найти
            </button>
            {hasActiveFilters ? (
              <Link
                href="/admin/cutting"
                className={getButtonClassName("ghost", "icon")}
                title="Сбросить фильтры"
                aria-label="Сбросить фильтры"
              >
                <RotateCcw className="size-4" />
              </Link>
            ) : null}
          </div>
        </Form>
        <p className="text-xs text-[var(--muted)]">
          Найдено {list.filteredTotal} из {metrics.total} заявок
          {list.pageCount > 1
            ? ` · страница ${list.page} из ${list.pageCount}`
            : ""}
          . Сортировка по дате создания заявки.
        </p>
      </section>

      <DataTable
        columns={[
          { key: "request", label: "Заявка" },
          { key: "date", label: "Дата" },
          { key: "material", label: "Материал" },
          { key: "files", label: "Файлы" },
          { key: "stage", label: "Этап распила" },
          { key: "status", label: "Статус" },
          { key: "budget", label: "Ориентир" },
          { key: "manage", label: "Быстро" },
        ]}
        rows={rows}
        rowTones={filteredRequests.map((request) =>
          needsSiteAttention(request) ? "alert" : undefined,
        )}
        caption="Очередь распила по дате создания"
        emptyMessage="По текущим фильтрам заявок на распил нет."
      />
      <PageLinks
        baseHref={baseHref}
        page={list.page}
        pageCount={list.pageCount}
      />
    </div>
  );
}
