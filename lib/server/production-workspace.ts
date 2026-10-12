import "server-only";

import {
  CuttingStage,
  RequestStatus,
  RequestType,
  type Prisma,
} from "@/generated/prisma";
import { productionStationStages } from "@/features/production/workflow";
import {
  getProductionPage,
  isProductionOverdue,
  productionDateBounds,
  productionDateKey,
  productionPageSize,
  productionScopeForStage,
  type ProductionFilters,
} from "@/features/production/queue";
import { getDb, hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import { getRequestInbox } from "@/lib/server/request-inbox";
import {
  getProductionPlans,
  productionPlanningAvailable,
} from "@/lib/server/production-planning";

const activeProductionStatuses: RequestStatus[] = [
  RequestStatus.NEW,
  RequestStatus.IN_REVIEW,
  RequestStatus.QUOTE_SENT,
  RequestStatus.WAITING_FOR_CLIENT,
  RequestStatus.IN_PROGRESS,
];

export async function getProductionQueue(input: ProductionFilters) {
  const planning = await productionPlanningAvailable();
  const filters = {
    ...input,
    ...(!planning
      ? {
          due: "all" as const,
          sort:
            input.sort === "due-asc" ? ("created-asc" as const) : input.sort,
        }
      : {}),
  };
  const today = productionDateKey(new Date());
  const dateBounds = productionDateBounds(filters.from, filters.to);

  if (!hasDatabaseUrl()) {
    const requests = isDemoModeEnabled() ? await getRequestInbox() : [];
    const plans = planning
      ? await getProductionPlans(requests.map((request) => request.id))
      : new Map();
    const matching = requests
      .filter((request) => {
        if (
          request.type !== RequestType.CUTTING_SERVICE ||
          !activeProductionStatuses.includes(request.status)
        )
          return false;
        if (
          filters.station !== "all" &&
          productionScopeForStage(request.cuttingStage) !== filters.station
        )
          return false;
        if (dateBounds.gte && request.createdAt < dateBounds.gte) return false;
        if (dateBounds.lt && request.createdAt >= dateBounds.lt) return false;
        const dueDate = plans.get(request.id)?.dueDate ?? null;
        if (
          filters.due === "overdue" &&
          !isProductionOverdue(dueDate, request.cuttingStage, today)
        )
          return false;
        if (
          filters.due === "today" &&
          (dueDate !== today ||
            request.cuttingStage === CuttingStage.READY_FOR_PICKUP)
        )
          return false;
        if (filters.due === "unplanned" && dueDate) return false;
        return (
          !filters.q ||
          [
            request.id,
            request.number,
            request.subject,
            request.material,
            request.contactName,
            request.contactPhone,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("ru-RU")
            .includes(filters.q.toLocaleLowerCase("ru-RU"))
        );
      })
      .sort((a, b) => {
        if (filters.sort === "due-asc") {
          const due = (plans.get(a.id)?.dueDate ?? "9999").localeCompare(
            plans.get(b.id)?.dueDate ?? "9999",
          );
          if (due) return due;
        }
        const date = a.createdAt.getTime() - b.createdAt.getTime();
        return (
          (filters.sort === "created-desc" ? -date : date) ||
          a.id.localeCompare(b.id)
        );
      });
    const pagination = getProductionPage(matching.length, filters.page);
    return {
      items: matching
        .slice(pagination.skip, pagination.skip + productionPageSize)
        .map((request) => ({
          ...request,
          dueDate: plans.get(request.id)?.dueDate ?? null,
        })),
      total: matching.length,
      ...pagination,
      filters: { ...filters, page: pagination.page },
      planning,
      today,
    };
  }

  const stageWhere: Prisma.RequestWhereInput =
    filters.station === "all"
      ? {}
      : filters.station === "READY_FOR_PICKUP"
        ? { cuttingStage: CuttingStage.READY_FOR_PICKUP }
        : filters.station === "CUTTING"
          ? {
              // Без этапа на станцию попадает только запущенное в работу.
              OR: [
                { cuttingStage: null, status: RequestStatus.IN_PROGRESS },
                { cuttingStage: { in: productionStationStages.CUTTING } },
              ],
            }
          : { cuttingStage: { in: productionStationStages[filters.station] } };
  const dueWhere: Prisma.RequestWhereInput =
    filters.due === "unplanned"
      ? {
          OR: [
            { productionPlan: { is: null } },
            { productionPlan: { is: { dueDate: null } } },
          ],
        }
      : filters.due === "today" || filters.due === "overdue"
        ? {
            AND: [
              {
                OR: [
                  { cuttingStage: null },
                  { cuttingStage: { not: CuttingStage.READY_FOR_PICKUP } },
                ],
              },
              {
                productionPlan: {
                  is: {
                    dueDate:
                      filters.due === "today"
                        ? new Date(`${today}T00:00:00Z`)
                        : { lt: new Date(`${today}T00:00:00Z`) },
                  },
                },
              },
            ],
          }
        : {};
  const searchWhere: Prisma.RequestWhereInput = filters.q
    ? {
        OR: [
          "id",
          "number",
          "subject",
          "material",
          "contactName",
          "contactPhone",
        ].map((field) => ({
          [field]: { contains: filters.q, mode: "insensitive" },
        })),
      }
    : {};
  const where: Prisma.RequestWhereInput = {
    type: RequestType.CUTTING_SERVICE,
    status: { in: activeProductionStatuses },
    createdAt: dateBounds,
    AND: [stageWhere, searchWhere, dueWhere],
  };
  const db = getDb();
  const total = await db.request.count({ where });
  const pagination = getProductionPage(total, filters.page);
  const orderBy: Prisma.RequestOrderByWithRelationInput[] = [
    ...(filters.sort === "due-asc"
      ? [
          {
            productionPlan: {
              dueDate: { sort: "asc" as const, nulls: "last" as const },
            },
          },
        ]
      : []),
    { createdAt: filters.sort === "created-desc" ? "desc" : "asc" },
    { id: "asc" },
  ];
  const items = await db.request.findMany({
    where,
    orderBy,
    skip: pagination.skip,
    take: productionPageSize,
    include: {
      manager: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      product: { select: { id: true, name: true, sku: true } },
      _count: { select: { files: true } },
    },
  });
  const plans = planning
    ? await getProductionPlans(items.map((item) => item.id))
    : new Map();
  return {
    items: items.map((item) => ({
      ...item,
      dueDate: plans.get(item.id)?.dueDate ?? null,
    })),
    total,
    ...pagination,
    filters: { ...filters, page: pagination.page },
    planning,
    today,
  };
}
