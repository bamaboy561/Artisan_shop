import Form from "next/form";
import Link from "next/link";

import { RequestStatus, RequestType } from "@/generated/prisma";
import { updateRequestAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { MetricCard } from "@/components/admin/metric-card";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SectionHeading } from "@/components/ui/section-heading";
import { DataTable } from "@/components/ui/table";
import {
  getManagerDisplayName,
  requestStatusLabels,
} from "@/features/admin/operations-filters";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import { getRequestInbox } from "@/lib/server/request-inbox";

export const dynamic = "force-dynamic";

type AdminCuttingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatBudget(value: number | null) {
  if (value === null) {
    return "По расчету";
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

  await requireAdminSession("/login?next=/admin/cutting");

  const [requests, resolvedSearchParams] = await Promise.all([
    getRequestInbox(),
    searchParams,
  ]);

  const statusParam = getFirstSearchValue(resolvedSearchParams, "status");
  const query = getFirstSearchValue(resolvedSearchParams, "q")
    .trim()
    .toLocaleLowerCase("ru-RU");
  const statusFilter =
    Object.values(RequestStatus).find((status) => status === statusParam) ?? "all";

  const cuttingRequests = requests.filter(
    (request) => request.type === RequestType.CUTTING_SERVICE,
  );
  const activeStatuses = new Set<RequestStatus>([
    RequestStatus.NEW,
    RequestStatus.IN_REVIEW,
    RequestStatus.QUOTE_SENT,
    RequestStatus.WAITING_FOR_CLIENT,
    RequestStatus.IN_PROGRESS,
  ]);
  const filteredRequests = cuttingRequests.filter((request) => {
    const matchesStatus =
      statusFilter === "all" || request.status === statusFilter;
    const haystack = [
      request.number,
      request.subject,
      request.contactName,
      request.contactPhone,
      request.material,
      request.product?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ru-RU");

    return matchesStatus && (!query || haystack.includes(query));
  });
  const activeRequests = cuttingRequests.filter((request) =>
    activeStatuses.has(request.status),
  );
  const withFiles = cuttingRequests.filter((request) => request._count.files > 0);
  const inProduction = cuttingRequests.filter(
    (request) => request.status === RequestStatus.IN_PROGRESS,
  );

  const rows = filteredRequests.map((request) => ({
    request: (
      <div className="space-y-1">
        <Link
          href={`/admin/requests/${request.id}`}
          className="font-semibold text-[var(--foreground)] transition hover:text-[var(--accent)]"
        >
          {request.number ?? request.id.slice(0, 8)}
        </Link>
        <p className="text-xs text-[var(--muted)]">
          {formatDate(request.createdAt)} · {request.contactName}
        </p>
      </div>
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
    budget: formatBudget(request.estimatedBudget),
    manage: (
      <form action={updateRequestAction} className="grid gap-2">
        <input type="hidden" name="id" value={request.id} />
        <input type="hidden" name="managerId" value={request.managerId ?? ""} />
        <Select name="status" defaultValue={request.status} className="h-9 text-xs">
          <option value={RequestStatus.IN_REVIEW}>На расчете</option>
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
    ),
  }));

  return (
    <div className="space-y-5">
      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6 sm:p-7">
        <SectionHeading
          title="Распил"
          description="Производственная очередь: клиентские файлы, расчет, Giblab-результат, карта раскроя и выдача заказа."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Всего заявок"
          value={cuttingRequests.length}
          detail="Все заявки на распил"
        />
        <MetricCard
          label="Активные"
          value={activeRequests.length}
          detail="Требуют расчета или производства"
        />
        <MetricCard
          label="С файлами"
          value={withFiles.length}
          detail="Есть Excel/PDF/DXF/DWG или архив"
        />
        <MetricCard
          label="В производстве"
          value={inProduction.length}
          detail="Переданы в цех"
        />
      </section>

      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
        <Form action="/admin/cutting" className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <Input name="q" defaultValue={query} placeholder="Поиск по клиенту, материалу или номеру" />
          <Select name="status" defaultValue={statusFilter}>
            <option value="all">Все статусы</option>
            {Object.values(RequestStatus).map((status) => (
              <option key={status} value={status}>
                {requestStatusLabels[status]}
              </option>
            ))}
          </Select>
          <button
            type="submit"
            className="h-10 border border-[color:var(--line-strong)] px-4 font-mono text-[10px] font-semibold tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white sm:h-11"
          >
            Найти
          </button>
        </Form>
      </section>

      <DataTable
        columns={[
          { key: "request", label: "Заявка" },
          { key: "material", label: "Материал" },
          { key: "files", label: "Файлы" },
          { key: "status", label: "Статус" },
          { key: "budget", label: "Ориентир" },
          { key: "manage", label: "Быстро" },
        ]}
        rows={rows}
        caption="Очередь распила"
        emptyMessage="По текущим фильтрам заявок на распил нет."
      />
    </div>
  );
}
