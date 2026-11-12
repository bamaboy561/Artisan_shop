import "server-only";

import { Prisma, RequestStatus, RequestType } from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import {
  activeRequestStatuses,
  filterAdminRequests,
  sortAdminRequests,
  type AdminRequestFilterState,
  type AdminRequestItem,
} from "@/features/admin/operations-filters";
import {
  ADMIN_CREATED_REQUEST_MARKER,
  isSiteRequest,
} from "@/features/admin/request-origin";
import { getRequestInbox } from "@/lib/server/request-inbox";

// Раньше «Заявки» и «Распил» грузили ВСЕ заявки целиком (с текстом и
// файлами) и рисовали их на одной странице. Теперь фильтр, сортировка и
// счётчики считаются в базе, а на страницу приходит только одна порция.
export const ADMIN_REQUESTS_PAGE_SIZE = 50;

const activeStatusList = [...activeRequestStatuses];

const listInclude = {
  manager: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  product: { select: { name: true, sku: true } },
  _count: { select: { files: true } },
} satisfies Prisma.RequestInclude;

const siteOriginWhere: Prisma.RequestWhereInput = {
  OR: [
    { message: null },
    { NOT: { message: { startsWith: ADMIN_CREATED_REQUEST_MARKER } } },
  ],
};

function searchWhere(query: string): Prisma.RequestWhereInput | null {
  const q = query.trim();
  if (!q) return null;
  const variants = Array.from(new Set([q, q.replaceAll("ё", "е")]));
  const contains = (value: string) => ({
    contains: value,
    mode: Prisma.QueryMode.insensitive,
  });

  return {
    OR: variants.flatMap((value) => [
      { number: contains(value) },
      { subject: contains(value) },
      { message: contains(value) },
      { contactName: contains(value) },
      { contactPhone: contains(value) },
      { contactEmail: contains(value) },
      { material: contains(value) },
      { edgeOption: contains(value) },
      { product: { is: { name: contains(value) } } },
      { product: { is: { sku: contains(value) } } },
    ]),
  };
}

export function clampPage(value: string | undefined | null) {
  const page = Number.parseInt(value ?? "", 10);
  return Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1;
}

function pageWindow(total: number, page: number) {
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_REQUESTS_PAGE_SIZE));
  const current = Math.min(page, pageCount);
  return {
    page: current,
    pageCount,
    skip: (current - 1) * ADMIN_REQUESTS_PAGE_SIZE,
  };
}

// ——— «Запросы на расчёт» (/admin/requests) ———

function requestFilterWhere(
  state: AdminRequestFilterState,
): Prisma.RequestWhereInput {
  const and: Prisma.RequestWhereInput[] = [];

  if (state.status !== "all") and.push({ status: state.status });
  if (state.type !== "all") and.push({ type: state.type });
  if (state.managerId) and.push({ managerId: state.managerId });
  if (state.assignment === "assigned") and.push({ managerId: { not: null } });
  if (state.assignment === "unassigned") and.push({ managerId: null });
  if (state.files === "with-files") and.push({ files: { some: {} } });
  if (state.files === "without-files") and.push({ files: { none: {} } });
  if (state.origin === "site") and.push(siteOriginWhere);

  const search = searchWhere(state.q);
  if (search) and.push(search);

  return and.length > 0 ? { AND: and } : {};
}

function requestOrderBy(
  sort: AdminRequestFilterState["sort"],
): Prisma.RequestOrderByWithRelationInput[] {
  switch (sort) {
    case "updated-desc":
      return [{ updatedAt: "desc" }, { id: "desc" }];
    case "budget-desc":
      return [
        { estimatedBudget: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ];
    case "files-desc":
      return [{ files: { _count: "desc" } }, { createdAt: "desc" }];
    case "created-desc":
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

export type AdminRequestListResult = {
  items: AdminRequestItem[];
  filteredTotal: number;
  page: number;
  pageCount: number;
  metrics: {
    total: number;
    active: number;
    unassigned: number;
    cutting: number;
    withFiles: number;
    siteNew: number;
  };
};

export async function listAdminRequests(
  state: AdminRequestFilterState,
  requestedPage: number,
): Promise<AdminRequestListResult> {
  if (!hasDatabaseUrl()) {
    const all = await getRequestInbox();
    const filtered = sortAdminRequests(
      filterAdminRequests(all, state).filter(
        (request) => state.origin !== "site" || isSiteRequest(request),
      ),
      state.sort,
    );
    const { page, pageCount, skip } = pageWindow(
      filtered.length,
      requestedPage,
    );
    const active = all.filter((r) => activeRequestStatuses.has(r.status));

    return {
      items: filtered.slice(skip, skip + ADMIN_REQUESTS_PAGE_SIZE),
      filteredTotal: filtered.length,
      page,
      pageCount,
      metrics: {
        total: all.length,
        active: active.length,
        unassigned: active.filter((r) => !r.managerId).length,
        cutting: all.filter((r) => r.type === RequestType.CUTTING_SERVICE)
          .length,
        withFiles: all.filter((r) => r._count.files > 0).length,
        siteNew: all.filter(
          (r) => r.status === RequestStatus.NEW && isSiteRequest(r),
        ).length,
      },
    };
  }

  const db = getDb();
  const where = requestFilterWhere(state);

  const [
    filteredTotal,
    total,
    active,
    unassigned,
    cutting,
    withFiles,
    siteNew,
  ] = await Promise.all([
    db.request.count({ where }),
    db.request.count(),
    db.request.count({ where: { status: { in: activeStatusList } } }),
    db.request.count({
      where: { status: { in: activeStatusList }, managerId: null },
    }),
    db.request.count({ where: { type: RequestType.CUTTING_SERVICE } }),
    db.request.count({ where: { files: { some: {} } } }),
    db.request.count({
      where: { AND: [{ status: RequestStatus.NEW }, siteOriginWhere] },
    }),
  ]);

  const { page, pageCount, skip } = pageWindow(filteredTotal, requestedPage);
  const items = await db.request.findMany({
    where,
    orderBy: requestOrderBy(state.sort),
    skip,
    take: ADMIN_REQUESTS_PAGE_SIZE,
    include: listInclude,
  });

  return {
    items,
    filteredTotal,
    page,
    pageCount,
    metrics: { total, active, unassigned, cutting, withFiles, siteNew },
  };
}

// ——— «Распил» (/admin/cutting) ———

export type AdminCuttingFilter = {
  q: string;
  status: RequestStatus | "all";
  dateFrom: string;
  dateTo: string;
  sort: "date-asc" | "date-desc";
};

// Даты в фильтре — по Бишкеку (UTC+6, без перехода на летнее время).
function bishkekDayStart(day: string) {
  return new Date(`${day}T00:00:00+06:00`);
}

function bishkekNextDayStart(day: string) {
  const start = bishkekDayStart(day);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function cuttingWhere(filter: AdminCuttingFilter): Prisma.RequestWhereInput {
  const and: Prisma.RequestWhereInput[] = [
    { type: RequestType.CUTTING_SERVICE },
  ];
  if (filter.status !== "all") and.push({ status: filter.status });
  if (filter.dateFrom)
    and.push({ createdAt: { gte: bishkekDayStart(filter.dateFrom) } });
  if (filter.dateTo)
    and.push({ createdAt: { lt: bishkekNextDayStart(filter.dateTo) } });
  const search = searchWhere(filter.q);
  if (search) and.push(search);
  return { AND: and };
}

export type AdminCuttingListResult = {
  items: AdminRequestItem[];
  filteredTotal: number;
  page: number;
  pageCount: number;
  metrics: {
    total: number;
    active: number;
    withFiles: number;
    inProduction: number;
    siteNew: number;
  };
};

export async function listAdminCuttingRequests(
  filter: AdminCuttingFilter,
  requestedPage: number,
): Promise<AdminCuttingListResult> {
  const direction = filter.sort === "date-asc" ? "asc" : "desc";

  if (!hasDatabaseUrl()) {
    const all = (await getRequestInbox()).filter(
      (r) => r.type === RequestType.CUTTING_SERVICE,
    );
    const query = filter.q.trim().toLocaleLowerCase("ru-RU");
    const from = filter.dateFrom ? bishkekDayStart(filter.dateFrom) : null;
    const to = filter.dateTo ? bishkekNextDayStart(filter.dateTo) : null;
    const filtered = all
      .filter((r) => filter.status === "all" || r.status === filter.status)
      .filter((r) => !from || r.createdAt >= from)
      .filter((r) => !to || r.createdAt < to)
      .filter(
        (r) =>
          !query ||
          [
            r.number,
            r.subject,
            r.message,
            r.contactName,
            r.contactPhone,
            r.material,
            r.product?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("ru-RU")
            .includes(query),
      )
      .sort((left, right) => {
        const difference = left.createdAt.getTime() - right.createdAt.getTime();
        return direction === "asc" ? difference : -difference;
      });
    const { page, pageCount, skip } = pageWindow(
      filtered.length,
      requestedPage,
    );

    return {
      items: filtered.slice(skip, skip + ADMIN_REQUESTS_PAGE_SIZE),
      filteredTotal: filtered.length,
      page,
      pageCount,
      metrics: {
        total: all.length,
        active: all.filter((r) => activeRequestStatuses.has(r.status)).length,
        withFiles: all.filter((r) => r._count.files > 0).length,
        inProduction: all.filter((r) => r.status === RequestStatus.IN_PROGRESS)
          .length,
        siteNew: all.filter(
          (r) => r.status === RequestStatus.NEW && isSiteRequest(r),
        ).length,
      },
    };
  }

  const db = getDb();
  const where = cuttingWhere(filter);
  const cutting = { type: RequestType.CUTTING_SERVICE };

  const [filteredTotal, total, active, withFiles, inProduction, siteNew] =
    await Promise.all([
      db.request.count({ where }),
      db.request.count({ where: cutting }),
      db.request.count({
        where: { ...cutting, status: { in: activeStatusList } },
      }),
      db.request.count({ where: { ...cutting, files: { some: {} } } }),
      db.request.count({
        where: { ...cutting, status: RequestStatus.IN_PROGRESS },
      }),
      db.request.count({
        where: {
          AND: [cutting, { status: RequestStatus.NEW }, siteOriginWhere],
        },
      }),
    ]);

  const { page, pageCount, skip } = pageWindow(filteredTotal, requestedPage);
  const items = await db.request.findMany({
    where,
    orderBy: [{ createdAt: direction }, { id: direction }],
    skip,
    take: ADMIN_REQUESTS_PAGE_SIZE,
    include: listInclude,
  });

  return {
    items,
    filteredTotal,
    page,
    pageCount,
    metrics: { total, active, withFiles, inProduction, siteNew },
  };
}

// Для массовых действий: только отмеченные заявки, а не вся база.
export async function getRequestsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  if (!hasDatabaseUrl()) {
    const wanted = new Set(ids);
    return (await getRequestInbox()).filter((r) => wanted.has(r.id));
  }
  return getDb().request.findMany({
    where: { id: { in: ids } },
    include: listInclude,
  });
}
