import "server-only";

import { OrderStatus, RequestStatus, RequestType } from "@/generated/prisma";
import { ADMIN_CREATED_REQUEST_MARKER } from "@/features/admin/request-origin";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { revenueOrderStatuses } from "@/lib/server/admin-data";
import {
  getProductionBoard,
  type BoardColumnKey,
} from "@/lib/server/production-workspace";

// «Пульт дня» на главной админки: выручка за сегодня по часам, цех по
// этапам и лента последних событий. Время — Бишкек (UTC+6, без перевода).
const OFFSET_MS = 6 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const PULSE_FIRST_HOUR = 9;
export const PULSE_LAST_HOUR = 20;

function dayStart(now: Date) {
  const local = new Date(now.getTime() + OFFSET_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
      OFFSET_MS,
  );
}

export type PulseStage = {
  key: BoardColumnKey;
  label: string;
  count: number;
  overdue: number;
  sheets: number;
};

export type PulseEvent = {
  id: string;
  href: string;
  kind: "order" | "request";
  title: string;
  detail: string | null;
  at: Date;
};

export type AdminPulse = {
  now: Date;
  revenueToday: number;
  revenueSameTimeLastWeek: number;
  hourly: number[];
  currentHourIndex: number;
  ordersToday: number;
  ordersLastWeek: number;
  cuttingToday: number;
  cuttingSheetsToday: number;
  sheetsInWork: number;
  siteWaiting: number;
  siteWaitingOverHour: number;
  stages: PulseStage[];
  inWork: number;
  overdue: number;
  urgent: number;
  problems: number;
  issuedToday: number;
  events: PulseEvent[];
};

const stageLabels: Array<[BoardColumnKey, string]> = [
  ["NEW", "Приём"],
  ["QUEUED", "Очередь"],
  ["CUTTING", "Распил"],
  ["EDGING", "Кромка"],
  ["DRILLING", "Присадка"],
  ["READY_FOR_PICKUP", "Выдача"],
];

export async function getAdminPulse(now = new Date()): Promise<AdminPulse> {
  const start = dayStart(now);
  const weekAgoStart = new Date(start.getTime() - 7 * DAY_MS);
  const weekAgoNow = new Date(now.getTime() - 7 * DAY_MS);
  const hours = PULSE_LAST_HOUR - PULSE_FIRST_HOUR + 1;
  const localHour = new Date(now.getTime() + OFFSET_MS).getUTCHours();
  const currentHourIndex = Math.min(
    hours - 1,
    Math.max(0, localHour - PULSE_FIRST_HOUR),
  );

  const empty: AdminPulse = {
    now,
    revenueToday: 0,
    revenueSameTimeLastWeek: 0,
    hourly: Array.from({ length: hours }, () => 0),
    currentHourIndex,
    ordersToday: 0,
    ordersLastWeek: 0,
    cuttingToday: 0,
    cuttingSheetsToday: 0,
    sheetsInWork: 0,
    siteWaiting: 0,
    siteWaitingOverHour: 0,
    stages: stageLabels.map(([key, label]) => ({
      key,
      label,
      count: 0,
      overdue: 0,
      sheets: 0,
    })),
    inWork: 0,
    overdue: 0,
    urgent: 0,
    problems: 0,
    issuedToday: 0,
    events: [],
  };

  if (!hasDatabaseUrl()) {
    return empty;
  }

  const db = getDb();
  const notCanceled = { not: OrderStatus.CANCELED };
  // Выручка считается как в отчётах (revenueOrderStatuses: без новых и
  // брони), а «Заказы сегодня» — все неотменённые.
  const revenueStatuses = { in: [...revenueOrderStatuses] };
  const [
    todayOrders,
    lastWeekRevenue,
    lastWeekOrders,
    cuttingToday,
    siteWaiting,
    board,
    events,
  ] = await Promise.all([
    db.order.findMany({
      where: { createdAt: { gte: start }, status: notCanceled },
      select: { total: true, createdAt: true, status: true },
    }),
    db.order.aggregate({
      where: {
        createdAt: { gte: weekAgoStart, lt: weekAgoNow },
        status: revenueStatuses,
      },
      _sum: { total: true },
    }),
    db.order.count({
      where: {
        createdAt: { gte: weekAgoStart, lt: weekAgoNow },
        status: notCanceled,
      },
    }),
    db.request.aggregate({
      where: {
        type: RequestType.CUTTING_SERVICE,
        createdAt: { gte: start },
        status: { not: RequestStatus.CANCELED },
      },
      _sum: { cuttingSheetCount: true },
      _count: { _all: true },
    }),
    db.request.findMany({
      where: {
        status: RequestStatus.NEW,
        // Как в списке заявок: без текста — тоже с сайта.
        OR: [
          { message: null },
          { NOT: { message: { startsWith: ADMIN_CREATED_REQUEST_MARKER } } },
        ],
      },
      select: { createdAt: true },
      take: 500,
    }),
    getProductionBoard().catch(() => null),
    db.operationEvent
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          title: true,
          description: true,
          createdAt: true,
        },
      })
      .catch(() => []),
  ]);

  const hourly = [...empty.hourly];
  let revenueToday = 0;
  for (const order of todayOrders) {
    if (!revenueOrderStatuses.has(order.status)) continue;
    revenueToday += order.total;
    const hour = new Date(order.createdAt.getTime() + OFFSET_MS).getUTCHours();
    const index = Math.min(hours - 1, Math.max(0, hour - PULSE_FIRST_HOUR));
    hourly[index] += order.total;
  }

  const stages = empty.stages.map((stage) => ({ ...stage }));
  let sheetsInWork = 0;
  let overdue = 0;
  for (const card of board?.cards ?? []) {
    const stage = stages.find((item) => item.key === card.column);
    if (!stage) continue;
    stage.count += 1;
    stage.sheets += card.sheets ?? 0;
    const late = Boolean(
      board &&
      card.dueDate &&
      card.dueDate < board.today &&
      card.column !== "READY_FOR_PICKUP",
    );
    if (late) {
      stage.overdue += 1;
      overdue += 1;
    }
    if (card.column !== "NEW" && card.column !== "READY_FOR_PICKUP") {
      sheetsInWork += card.sheets ?? 0;
    }
  }

  // Номера для ленты: события хранят только id заявки или заказа.
  const requestIds = events
    .filter((event) => event.entityType === "request")
    .map((event) => event.entityId);
  const orderIds = events
    .filter((event) => event.entityType === "order")
    .map((event) => event.entityId);
  const [requestNumbers, orderNumbers] = await Promise.all([
    requestIds.length
      ? db.request.findMany({
          where: { id: { in: requestIds } },
          select: { id: true, number: true, contactName: true },
        })
      : Promise.resolve([]),
    orderIds.length
      ? db.order.findMany({
          where: { id: { in: orderIds } },
          select: { id: true, number: true, contactName: true },
        })
      : Promise.resolve([]),
  ]);
  const names = new Map(
    [...requestNumbers, ...orderNumbers].map((item) => [
      item.id,
      [item.number, item.contactName].filter(Boolean).join(" · "),
    ]),
  );

  const hourAgo = now.getTime() - HOUR_MS;

  return {
    ...empty,
    revenueToday,
    revenueSameTimeLastWeek: lastWeekRevenue._sum.total ?? 0,
    hourly,
    ordersToday: todayOrders.length,
    ordersLastWeek: lastWeekOrders,
    cuttingToday: cuttingToday._count._all,
    cuttingSheetsToday: cuttingToday._sum.cuttingSheetCount ?? 0,
    sheetsInWork,
    siteWaiting: siteWaiting.length,
    siteWaitingOverHour: siteWaiting.filter(
      (item) => item.createdAt.getTime() < hourAgo,
    ).length,
    stages,
    inWork: board?.cards.length ?? 0,
    overdue,
    urgent: board?.cards.filter((card) => card.workflow.isUrgent).length ?? 0,
    problems:
      board?.cards.filter((card) => Boolean(card.workflow.problemReason))
        .length ?? 0,
    issuedToday: board?.issuedToday ?? 0,
    events: events.map((event) => {
      const kind = event.entityType === "order" ? "order" : "request";
      return {
        id: event.id,
        kind,
        href: `/admin/${kind === "order" ? "orders" : "requests"}/${event.entityId}`,
        title: event.title,
        detail: names.get(event.entityId) ?? event.description,
        at: event.createdAt,
      };
    }),
  };
}
