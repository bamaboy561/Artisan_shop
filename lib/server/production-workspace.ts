import "server-only";

import {
  CuttingStage,
  ProductionStation,
  RequestStatus,
  RequestType,
  type Prisma,
} from "@/generated/prisma";
import { productionStationStages } from "@/features/production/workflow";
import { getDb, hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import { getRequestInbox } from "@/lib/server/request-inbox";

type ProductionQueueInput = {
  query?: string;
  station?: ProductionStation | null;
};

const activeProductionStatuses: RequestStatus[] = [
  RequestStatus.NEW,
  RequestStatus.IN_REVIEW,
  RequestStatus.QUOTE_SENT,
  RequestStatus.WAITING_FOR_CLIENT,
  RequestStatus.IN_PROGRESS,
];

function normalizeQuery(query: string | undefined) {
  return query?.trim().slice(0, 120) ?? "";
}

function matchesDemoQuery(
  request: Awaited<ReturnType<typeof getRequestInbox>>[number],
  query: string,
) {
  if (!query) return true;
  const haystack = [
    request.id,
    request.number,
    request.subject,
    request.material,
    request.contactName,
    request.contactPhone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ru-RU");

  return haystack.includes(query.toLocaleLowerCase("ru-RU"));
}

function isAtStation(
  stage: CuttingStage | null,
  station: ProductionStation | null | undefined,
) {
  if (!station) return true;
  const normalizedStage = stage ?? CuttingStage.ACCEPTED;
  return productionStationStages[station].includes(normalizedStage);
}

export async function getProductionQueue(input: ProductionQueueInput = {}) {
  const query = normalizeQuery(input.query);

  if (!hasDatabaseUrl()) {
    if (!isDemoModeEnabled()) {
      return { items: [], query, total: 0 };
    }

    const items = (await getRequestInbox())
      .filter((request) => request.type === RequestType.CUTTING_SERVICE)
      .filter((request) => activeProductionStatuses.includes(request.status))
      .filter((request) => isAtStation(request.cuttingStage, input.station))
      .filter((request) => matchesDemoQuery(request, query))
      .slice(0, 100);

    return { items, query, total: items.length };
  }

  const stageWhere: Prisma.RequestWhereInput = input.station
    ? input.station === ProductionStation.CUTTING
      ? {
          OR: [
            { cuttingStage: null },
            { cuttingStage: { in: productionStationStages[input.station] } },
          ],
        }
      : { cuttingStage: { in: productionStationStages[input.station] } }
    : {};
  const searchWhere: Prisma.RequestWhereInput = query
    ? {
        OR: [
          { id: { contains: query, mode: "insensitive" } },
          { number: { contains: query, mode: "insensitive" } },
          { subject: { contains: query, mode: "insensitive" } },
          { material: { contains: query, mode: "insensitive" } },
          { contactName: { contains: query, mode: "insensitive" } },
          { contactPhone: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};
  const where: Prisma.RequestWhereInput = {
    type: RequestType.CUTTING_SERVICE,
    status: { in: activeProductionStatuses },
    AND: [stageWhere, searchWhere],
  };
  const db = getDb();
  const [items, total] = await Promise.all([
    db.request.findMany({
      where,
      orderBy: [
        { cuttingStageUpdatedAt: { sort: "asc", nulls: "first" } },
        { createdAt: "asc" },
      ],
      take: 100,
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        product: { select: { id: true, name: true, sku: true } },
        _count: { select: { files: true } },
      },
    }),
    db.request.count({ where }),
  ]);

  return { items, query, total };
}
