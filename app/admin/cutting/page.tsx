import { formatPrice } from "@/lib/commerce";
import Link from "next/link";
import {
  CalendarRange,
  Plus,
  Printer,
  RotateCcw,
  Search,
  SquarePen,
} from "lucide-react";

import { CuttingStage, RequestStatus } from "@/generated/prisma";
import {
  setProductionStageAction,
  updateRequestAction,
} from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { DeleteRequestButton } from "@/components/admin/delete-request-button";
import { AutoFilterForm } from "@/components/admin/list/auto-filter-form";
import { ListHeader } from "@/components/admin/list/list-header";
import { RowMenu, rowMenuItemClass } from "@/components/admin/list/row-menu";
import { StageBar } from "@/components/admin/list/stage-bar";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/table";
import {
  getManagerDisplayName,
  requestStatusLabels,
} from "@/features/admin/operations-filters";
import { requireAdminSession } from "@/lib/auth/dal";
import { canDeleteRequests, canManageProduction } from "@/lib/auth/roles";
import { formatListDate } from "@/features/admin/list-format";
import { cn } from "@/lib/utils";
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

const headerButton =
  "inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--line)] bg-white px-4 text-[13.5px] font-semibold whitespace-nowrap transition hover:border-[color:var(--line-strong)]";

const stageStep: Record<CuttingStage, number> = {
  [CuttingStage.ACCEPTED]: 1,
  [CuttingStage.CUTTING]: 2,
  [CuttingStage.EDGING]: 3,
  [CuttingStage.DRILLING]: 4,
  [CuttingStage.READY_FOR_PICKUP]: 5,
};

const stageShortLabels: Record<CuttingStage, string> = {
  [CuttingStage.ACCEPTED]: "В очереди",
  [CuttingStage.CUTTING]: "Распил",
  [CuttingStage.EDGING]: "Кромка",
  [CuttingStage.DRILLING]: "Присадка",
  [CuttingStage.READY_FOR_PICKUP]: "Готово",
};

// Одна кнопка «что дальше» вместо выпадающего списка и «Обновить».
function nextStage(stage: CuttingStage | null) {
  switch (stage) {
    case null:
      return { stage: CuttingStage.ACCEPTED, label: "Запустить" };
    case CuttingStage.ACCEPTED:
      return { stage: CuttingStage.CUTTING, label: "На распил" };
    case CuttingStage.CUTTING:
      return { stage: CuttingStage.EDGING, label: "На кромку" };
    case CuttingStage.EDGING:
      return { stage: CuttingStage.DRILLING, label: "На присадку" };
    case CuttingStage.DRILLING:
      // Для «Готово» нужна ячейка выдачи — её вводят в карточке.
      return {
        stage: CuttingStage.READY_FOR_PICKUP,
        label: "Готово",
        needsCell: true,
      };
    default:
      return {
        stage: CuttingStage.READY_FOR_PICKUP,
        label: "Выдать",
        needsCell: true,
      };
  }
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
  const canMoveStage = canManageProduction(session.roleCode);

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

  const now = new Date();
  const currentHref = baseHref;
  const tabHref = (status: string) =>
    status === "all" ? "/admin/cutting" : `/admin/cutting?status=${status}`;
  const notice = getFirstSearchValue(resolvedSearchParams, "notice");
  const noticeText =
    notice === "stage-updated"
      ? "Заявка перенесена на следующий этап."
      : notice === "stage-conflict"
        ? "Этап уже изменили на другом устройстве. Список обновлён."
        : notice === "action-forbidden"
          ? "Для этого аккаунта действие недоступно."
          : null;

  const rows = filteredRequests.map((request) => {
    const site = isSiteRequest(request);
    const closed =
      request.status === RequestStatus.COMPLETED ||
      request.status === RequestStatus.CANCELED;
    const step = request.cuttingStage ? stageStep[request.cuttingStage] : 0;
    const next = closed ? null : nextStage(request.cuttingStage);
    const amount = request.quotedTotal ?? request.estimatedBudget ?? null;
    const facts = [
      request.cuttingSheetCount ? `${request.cuttingSheetCount} л.` : null,
      request.cuttingEdgeMeters
        ? `${Math.round(request.cuttingEdgeMeters)} м кромки`
        : null,
      request._count.files > 0 ? `файлов: ${request._count.files}` : null,
    ].filter(Boolean);

    return {
      request: (
        <div className="max-w-[200px]">
          <p className="flex items-center gap-2">
            <Link
              href={`/admin/requests/${request.id}`}
              className="font-bold text-[var(--foreground)] transition hover:text-[var(--accent)]"
            >
              {request.number ?? request.id.slice(0, 8)}
            </Link>
            {site ? (
              <span className="rounded-full bg-red-50 px-1.5 py-px text-[11px] font-semibold text-red-600">
                с сайта
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-[12.5px] text-[var(--muted)]">
            {request.contactName}
          </p>
        </div>
      ),
      date: (
        <time
          dateTime={request.createdAt.toISOString()}
          className="text-sm whitespace-nowrap tabular-nums"
        >
          {formatListDate(request.createdAt, now)}
        </time>
      ),
      material: (
        <div className="max-w-[220px]">
          <p className="truncate font-semibold">
            {request.product?.name ?? request.material ?? "Материал уточняется"}
          </p>
          <p className="text-[12.5px] text-[var(--muted)]">
            {facts.length ? facts.join(" · ") : request.subject}
          </p>
        </div>
      ),
      stage: (
        <StageBar
          step={step}
          label={
            request.cuttingStage
              ? stageShortLabels[request.cuttingStage]
              : closed
                ? "—"
                : "не запущена"
          }
          note={
            request.cuttingPickupCell
              ? `ячейка ${request.cuttingPickupCell}`
              : null
          }
        />
      ),
      status: (
        <div>
          <StatusBadge tone={getStatusTone(request.status)}>
            {requestStatusLabels[request.status]}
          </StatusBadge>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {request.manager
              ? getManagerDisplayName(request.manager)
              : "без менеджера"}
          </p>
        </div>
      ),
      budget: (
        <span className="font-semibold whitespace-nowrap tabular-nums">
          {formatBudget(amount)}
        </span>
      ),
      manage: (
        <div className="flex items-center justify-end gap-1.5">
          {next &&
          canMoveStage &&
          request.cuttingStage === CuttingStage.EDGING ? (
            // После кромки — «Готово» (ячейка вводится в карточке), если
            // присадки в заказе нет.
            <Link
              href={`/admin/production/${request.id}?stage=${CuttingStage.READY_FOR_PICKUP}`}
              className="inline-flex h-8 items-center rounded-[8px] border border-[var(--line-strong)] px-3 text-[12.5px] font-semibold whitespace-nowrap text-[var(--foreground)] transition hover:bg-[var(--surface)]"
            >
              Готово →
            </Link>
          ) : null}
          {next && canMoveStage ? (
            next.needsCell ? (
              <Link
                href={`/admin/production/${request.id}`}
                className="inline-flex h-8 items-center rounded-[8px] bg-[var(--foreground)] px-3 text-[12.5px] font-semibold whitespace-nowrap text-white transition hover:opacity-90"
              >
                {next.label} →
              </Link>
            ) : (
              <form action={setProductionStageAction}>
                <input type="hidden" name="requestId" value={request.id} />
                <input
                  type="hidden"
                  name="expectedStage"
                  value={request.cuttingStage ?? ""}
                />
                <input type="hidden" name="cuttingStage" value={next.stage} />
                <input type="hidden" name="returnTo" value={currentHref} />
                <input type="hidden" name="origin" value="cutting-list" />
                <AdminSubmitButton
                  type="submit"
                  size="sm"
                  className="h-8 rounded-[8px] px-3 text-[12.5px] whitespace-nowrap"
                  idleLabel={`${next.label} →`}
                  pendingLabel="..."
                />
              </form>
            )
          ) : null}
          <RowMenu label={`Действия с заявкой ${request.number ?? ""}`}>
            <Link
              href={`/admin/requests/${request.id}`}
              className={rowMenuItemClass}
            >
              <SquarePen className="size-4 text-[var(--muted)]" />
              Открыть заявку
            </Link>
            <Link
              href={`/admin/requests/${request.id}/route-sheet`}
              className={rowMenuItemClass}
            >
              <Printer className="size-4 text-[var(--muted)]" />
              Маршрутный лист
            </Link>
            <form
              action={updateRequestAction}
              className="flex items-center gap-1.5 border-t border-[color:var(--line)] px-1 pt-2 pb-1"
            >
              <input type="hidden" name="id" value={request.id} />
              <input
                type="hidden"
                name="managerId"
                value={request.managerId ?? ""}
              />
              <Select
                name="status"
                defaultValue={request.status}
                aria-label="Статус заявки"
                className="h-8 min-w-0 flex-1 text-xs"
              >
                {Object.values(RequestStatus).map((status) => (
                  <option key={status} value={status}>
                    {requestStatusLabels[status]}
                  </option>
                ))}
              </Select>
              <AdminSubmitButton
                type="submit"
                variant="secondary"
                size="sm"
                className="h-8 px-3 text-xs"
                idleLabel="Сохранить"
                pendingLabel="..."
              />
            </form>
            {canDeleteRequest ? (
              <div className="border-t border-[color:var(--line)] pt-1">
                <DeleteRequestButton
                  requestId={request.id}
                  requestNumber={request.number ?? request.id.slice(0, 8)}
                  returnTo="/admin/cutting"
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
        title="Распил"
        tabs={[
          {
            label: "Все",
            href: tabHref("all"),
            count: metrics.total,
            active: statusFilter === "all",
          },
          {
            label: "Новые",
            href: tabHref(RequestStatus.NEW),
            count: metrics.siteNew || null,
            alert: true,
            active: statusFilter === RequestStatus.NEW,
          },
          {
            label: "На расчёте",
            href: tabHref(RequestStatus.IN_REVIEW),
            active: statusFilter === RequestStatus.IN_REVIEW,
          },
          {
            label: "В цеху",
            href: tabHref(RequestStatus.IN_PROGRESS),
            count: metrics.inProduction,
            active: statusFilter === RequestStatus.IN_PROGRESS,
          },
          {
            label: "Завершены",
            href: tabHref(RequestStatus.COMPLETED),
            active: statusFilter === RequestStatus.COMPLETED,
          },
        ]}
        actions={
          <>
            {/* Статическая программа из public/raskroy — обычная ссылка, не Link. */}
            <a
              href="/raskroy"
              className={cn(headerButton, "hidden sm:inline-flex")}
            >
              Программа раскроя
            </a>
            <Link
              href="/admin/cutting/pricing"
              className={cn(headerButton, "hidden sm:inline-flex")}
            >
              Прайс работ
            </Link>
            <Link
              href="/admin/cutting/new"
              className={cn(
                headerButton,
                "border-[color:var(--accent)] bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]",
              )}
            >
              <Plus className="size-4" />
              Новый распил
            </Link>
          </>
        }
      />

      {noticeText ? (
        <p
          role="status"
          className={cn(
            "rounded-[var(--radius-inner)] px-4 py-2.5 text-sm font-medium",
            notice === "stage-updated"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-800",
          )}
        >
          {noticeText}
        </p>
      ) : null}

      <AutoFilterForm
        action="/admin/cutting"
        className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
      >
        <label className="relative col-span-2 lg:col-span-1">
          <span className="sr-only">Поиск</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Клиент, телефон, материал или номер"
            className="h-10 rounded-[var(--radius-control)] pl-10 sm:h-10 sm:pl-10"
          />
        </label>
        <Select
          name="status"
          defaultValue={statusFilter}
          aria-label="Статус"
          wrapperClassName="lg:w-48"
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
          name="sort"
          defaultValue={dateSort}
          aria-label="Порядок"
          wrapperClassName="lg:w-44"
          className="h-10 rounded-[var(--radius-control)] sm:h-10 sm:pr-10"
        >
          <option value="date-desc">Сначала новые</option>
          <option value="date-asc">Сначала ранние</option>
        </Select>
        <details
          className="group relative col-span-2 lg:col-span-1"
          open={Boolean(dateFrom || dateTo)}
        >
          <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--line)] bg-white px-3.5 text-sm font-medium whitespace-nowrap">
            <CalendarRange className="size-4 text-[var(--muted)]" />
            {dateFrom || dateTo ? "Даты" : "За всё время"}
          </summary>
          <div className="absolute right-0 z-20 mt-2 grid w-72 gap-2 rounded-[12px] border border-[color:var(--line)] bg-white p-3 shadow-[0_16px_40px_rgba(0,0,0,0.12)]">
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              С
              <Input
                type="date"
                name="dateFrom"
                defaultValue={dateFrom}
                max={dateTo || undefined}
              />
            </label>
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              По
              <Input
                type="date"
                name="dateTo"
                defaultValue={dateTo}
                min={dateFrom || undefined}
              />
            </label>
          </div>
        </details>
      </AutoFilterForm>
      <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
        <span>
          Найдено {list.filteredTotal} из {metrics.total}
          {list.pageCount > 1
            ? ` · страница ${list.page} из ${list.pageCount}`
            : ""}
        </span>
        {hasActiveFilters ? (
          <Link
            href="/admin/cutting"
            className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
          >
            <RotateCcw className="size-3.5" />
            Сбросить фильтры
          </Link>
        ) : null}
      </div>

      <DataTable
        columns={[
          { key: "request", label: "Заявка" },
          { key: "date", label: "Принята" },
          { key: "material", label: "Материал" },
          { key: "stage", label: "Где сейчас" },
          { key: "status", label: "Статус" },
          { key: "budget", label: "Сумма" },
          { key: "manage", label: "Действие" },
        ]}
        rows={rows}
        rowTones={filteredRequests.map((request) =>
          needsSiteAttention(request) ? "alert" : undefined,
        )}
        compact
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
