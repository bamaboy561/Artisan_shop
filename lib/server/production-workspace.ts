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
  getCuttingWorkflows,
  prepareCuttingWorkflow,
} from "@/lib/server/cutting-workflow";
import {
  emptyCuttingWorkflow,
  isUrgentByText,
} from "@/features/production/workflow-flags";
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
        if (filters.flag === "problem") return false;
        if (
          filters.flag === "urgent" &&
          !isUrgentByText(request.subject, request.message)
        )
          return false;
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
        if (filters.sort === "priority") {
          const urgent =
            Number(isUrgentByText(b.subject, b.message)) -
            Number(isUrgentByText(a.subject, a.message));
          if (urgent) return urgent;
        }
        if (filters.sort === "due-asc" || filters.sort === "priority") {
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
          dueDate: (plans.get(request.id)?.dueDate as string | null) ?? null,
          workflow: {
            ...emptyCuttingWorkflow,
            isUrgent: isUrgentByText(request.subject, request.message),
          },
        })),
      total: matching.length,
      ...pagination,
      filters: { ...filters, page: pagination.page },
      planning,
      workflowReady: false,
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
  const workflowReady = await prepareCuttingWorkflow();
  const urgentWhere: Prisma.RequestWhereInput = {
    cuttingWorkflow: { is: { isUrgent: true } },
  };
  const notUrgentWhere: Prisma.RequestWhereInput = {
    OR: [
      { cuttingWorkflow: { is: null } },
      { cuttingWorkflow: { is: { isUrgent: false } } },
    ],
  };
  const flagWhere: Prisma.RequestWhereInput = !workflowReady
    ? {}
    : filters.flag === "urgent"
      ? urgentWhere
      : filters.flag === "problem"
        ? { cuttingWorkflow: { is: { problemReason: { not: null } } } }
        : {};
  const where: Prisma.RequestWhereInput = {
    type: RequestType.CUTTING_SERVICE,
    status: { in: activeProductionStatuses },
    createdAt: dateBounds,
    AND: [stageWhere, searchWhere, dueWhere, flagWhere],
  };
  const db = getDb();
  const total = await db.request.count({ where });
  const pagination = getProductionPage(total, filters.page);
  const byDue =
    planning && (filters.sort === "due-asc" || filters.sort === "priority");
  const orderBy: Prisma.RequestOrderByWithRelationInput[] = [
    ...(byDue
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
  const include = {
    manager: {
      select: { id: true, firstName: true, lastName: true, email: true },
    },
    product: { select: { id: true, name: true, sku: true } },
    _count: { select: { files: true } },
  } satisfies Prisma.RequestInclude;
  let items;
  if (filters.sort === "priority" && workflowReady) {
    // Срочные всегда идут первыми: сначала страница из срочных, затем
    // продолжение из остальных.
    const urgentFilter = { AND: [where, urgentWhere] };
    const urgentTotal = await db.request.count({ where: urgentFilter });
    const urgentItems =
      pagination.skip < urgentTotal
        ? await db.request.findMany({
            where: urgentFilter,
            orderBy,
            skip: pagination.skip,
            take: productionPageSize,
            include,
          })
        : [];
    const restTake = productionPageSize - urgentItems.length;
    const restItems =
      restTake > 0
        ? await db.request.findMany({
            where: { AND: [where, notUrgentWhere] },
            orderBy,
            skip: Math.max(0, pagination.skip - urgentTotal),
            take: restTake,
            include,
          })
        : [];
    items = [...urgentItems, ...restItems];
  } else {
    items = await db.request.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: productionPageSize,
      include,
    });
  }
  const ids = items.map((item) => item.id);
  const [plans, workflows] = await Promise.all([
    planning ? getProductionPlans(ids) : Promise.resolve(new Map()),
    getCuttingWorkflows(ids),
  ]);
  return {
    items: items.map((item) => ({
      ...item,
      dueDate: (plans.get(item.id)?.dueDate as string | null) ?? null,
      workflow: workflows.get(item.id) ?? emptyCuttingWorkflow,
    })),
    total,
    ...pagination,
    filters: { ...filters, page: pagination.page },
    planning,
    workflowReady,
    today,
  };
}

export type BoardColumnKey =
  | "NEW"
  | "QUEUED"
  | "CUTTING"
  | "EDGING"
  | "DRILLING"
  | "READY_FOR_PICKUP";

export function boardColumnFor(
  stage: CuttingStage | null,
  status: RequestStatus,
): BoardColumnKey {
  if (!stage) return status === RequestStatus.IN_PROGRESS ? "QUEUED" : "NEW";
  if (stage === CuttingStage.ACCEPTED) return "QUEUED";
  return stage;
}

const boardLimit = 400;

// Доска распила: все открытые заявки по колонкам этапов.
export async function getProductionBoard() {
  const planning = await productionPlanningAvailable();
  const today = productionDateKey(new Date());
  const workflowReady = await prepareCuttingWorkflow();
  const requests = hasDatabaseUrl()
    ? await getDb().request.findMany({
        where: {
          type: RequestType.CUTTING_SERVICE,
          status: { in: activeProductionStatuses },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: boardLimit,
        select: {
          id: true,
          number: true,
          status: true,
          subject: true,
          message: true,
          material: true,
          contactName: true,
          cuttingSheetCount: true,
          cuttingEdgeMeters: true,
          cuttingStage: true,
          cuttingPickupCell: true,
          cuttingStageUpdatedAt: true,
          createdAt: true,
          manager: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      })
    : isDemoModeEnabled()
      ? (await getRequestInbox()).filter(
          (request) =>
            request.type === RequestType.CUTTING_SERVICE &&
            activeProductionStatuses.includes(request.status),
        )
      : [];
  const ids = requests.map((request) => request.id);
  const [plans, workflows, issuedToday] = await Promise.all([
    planning ? getProductionPlans(ids) : Promise.resolve(new Map()),
    getCuttingWorkflows(ids),
    hasDatabaseUrl()
      ? // Считаем сами выдачи, а не правки закрытых заявок.
        getDb().operationEvent.count({
          where: {
            entityType: "request",
            eventType: "status",
            title: "Заказ выдан клиенту",
            createdAt: { gte: new Date(`${today}T00:00:00+06:00`) },
          },
        })
      : Promise.resolve(0),
  ]);
  const cards = requests
    .map((request) => ({
      id: request.id,
      number: request.number,
      status: request.status,
      material: request.material || request.subject,
      contactName: request.contactName,
      sheets: request.cuttingSheetCount,
      edgeMeters: request.cuttingEdgeMeters,
      stage: request.cuttingStage,
      pickupCell: request.cuttingPickupCell,
      stageSince: request.cuttingStageUpdatedAt ?? request.createdAt,
      createdAt: request.createdAt,
      manager: request.manager
        ? [request.manager.firstName, request.manager.lastName]
            .filter(Boolean)
            .join(" ") || request.manager.email
        : null,
      dueDate: (plans.get(request.id)?.dueDate as string | null) ?? null,
      workflow: workflowReady
        ? (workflows.get(request.id) ?? emptyCuttingWorkflow)
        : {
            ...emptyCuttingWorkflow,
            isUrgent: isUrgentByText(request.subject, request.message),
          },
      column: boardColumnFor(request.cuttingStage, request.status),
    }))
    .sort(
      (a, b) =>
        Number(b.workflow.isUrgent) - Number(a.workflow.isUrgent) ||
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
  return {
    cards,
    planning,
    workflowReady,
    today,
    issuedToday,
    now: Date.now(),
    truncated: requests.length >= boardLimit,
  };
}
