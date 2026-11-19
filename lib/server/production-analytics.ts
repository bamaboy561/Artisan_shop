import "server-only";

import { RequestType } from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import {
  buildRequestCycle,
  overlapMs,
  stageIntervals,
  summarizeDurations,
  workStations,
  workWindows,
  type Interval,
  type WorkStation,
} from "@/features/production/cycle-time";
import { addDaysToDateKey } from "@/features/production/queue";
import { getFaultsOverlapping } from "@/lib/server/production-shifts";

function bishkekStart(day: string) {
  return new Date(`${day}T00:00:00+06:00`);
}

// Время цикла по клиентам и загрузка станков за период [from, toExclusive).
export async function getProductionAnalytics(input: {
  from: string;
  toExclusive: string;
  shiftStart: string;
  shiftEnd: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const start = bishkekStart(input.from);
  const end = new Date(
    Math.min(bishkekStart(input.toExclusive).getTime(), now.getTime()),
  );
  const empty = {
    cycles: [] as Array<
      ReturnType<typeof buildRequestCycle> & {
        id: string;
        number: string | null;
        contactName: string;
        material: string;
        sheets: number | null;
      }
    >,
    summary: {
      client: null as ReturnType<typeof summarizeDurations>,
      shop: null as ReturnType<typeof summarizeDurations>,
      wait: null as ReturnType<typeof summarizeDurations>,
      stages: {} as Partial<
        Record<WorkStation, ReturnType<typeof summarizeDurations>>
      >,
    },
    stations: workStations.map((station) => ({
      station,
      busyMs: 0,
      downtimeMs: 0,
      workMs: 0,
      faults: 0,
    })),
    faults: [] as Awaited<ReturnType<typeof getFaultsOverlapping>>,
  };
  if (!hasDatabaseUrl() || end <= start) return empty;
  const db = getDb();

  // Заявки, которые стали «Готово» в периоде, — по ним считаем цикл.
  const readyEvents = await db.operationEvent.findMany({
    where: {
      entityType: "request",
      eventType: "cutting_stage",
      toStatus: "READY_FOR_PICKUP",
      createdAt: { gte: start, lt: end },
    },
    select: { entityId: true },
    take: 3000,
  });
  // Для загрузки станков нужны все заявки, которые стояли на станции хоть
  // часть периода. Такая заявка либо сменила этап в периоде или позже
  // (событие с даты начала), либо стоит на станции до сих пор.
  const [activeEvents, onStation] = await Promise.all([
    db.operationEvent.findMany({
      where: {
        entityType: "request",
        eventType: "cutting_stage",
        createdAt: { gte: start },
      },
      select: { entityId: true },
      distinct: ["entityId"],
      take: 10000,
    }),
    db.request.findMany({
      where: {
        type: RequestType.CUTTING_SERVICE,
        cuttingStage: { in: [...workStations] },
        status: { notIn: ["COMPLETED", "CANCELED"] },
      },
      select: { id: true },
      take: 2000,
    }),
  ]);
  const ids = [
    ...new Set([
      ...readyEvents.map((e) => e.entityId),
      ...activeEvents.map((e) => e.entityId),
      ...onStation.map((r) => r.id),
    ]),
  ];
  if (!ids.length) {
    const faults = await getFaultsOverlapping(start, end);
    return withFaults(empty, faults, start, end, input);
  }
  const [requests, events] = await Promise.all([
    db.request.findMany({
      where: { id: { in: ids }, type: RequestType.CUTTING_SERVICE },
      select: {
        id: true,
        number: true,
        contactName: true,
        material: true,
        subject: true,
        createdAt: true,
        cuttingSheetCount: true,
      },
    }),
    db.operationEvent.findMany({
      where: {
        entityType: "request",
        eventType: "cutting_stage",
        entityId: { in: ids },
      },
      select: {
        entityId: true,
        eventType: true,
        fromStatus: true,
        toStatus: true,
        actorName: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const byRequest = new Map<string, typeof events>();
  for (const event of events) {
    const list = byRequest.get(event.entityId) ?? [];
    list.push(event);
    byRequest.set(event.entityId, list);
  }
  const readyIds = new Set(readyEvents.map((e) => e.entityId));
  const busy: Record<WorkStation, Interval[]> = {
    CUTTING: [],
    EDGING: [],
    DRILLING: [],
  };
  const cycles: typeof empty.cycles = [];
  for (const request of requests) {
    const list = byRequest.get(request.id) ?? [];
    const intervals = stageIntervals(list, now);
    for (const station of workStations)
      busy[station].push(...intervals[station]);
    if (!readyIds.has(request.id)) continue;
    const cycle = buildRequestCycle(list, request.createdAt, now);
    // Заявку могли вернуть из «Готово»: в цикл берём только завершённые
    // в этом периоде.
    if (!cycle.readyAt || cycle.readyAt < start || cycle.readyAt >= end)
      continue;
    cycles.push({
      ...cycle,
      id: request.id,
      number: request.number,
      contactName: request.contactName,
      material: request.material || request.subject,
      sheets: request.cuttingSheetCount,
    });
  }
  cycles.sort((a, b) => b.clientMs - a.clientMs);
  const windows = clipWindows(input, start, end);
  const result = {
    cycles,
    summary: {
      client: summarizeDurations(cycles.map((c) => c.clientMs)),
      shop: summarizeDurations(
        cycles.flatMap((c) => (c.shopMs === null ? [] : [c.shopMs])),
      ),
      wait: summarizeDurations(
        cycles.filter((c) => c.launchedAt).map((c) => c.waitMs),
      ),
      stages: Object.fromEntries(
        workStations.map((station) => [
          station,
          summarizeDurations(
            cycles.map((c) => c.stageMs[station]).filter((value) => value > 0),
          ),
        ]),
      ) as Partial<Record<WorkStation, ReturnType<typeof summarizeDurations>>>,
    },
    stations: workStations.map((station) => ({
      station,
      busyMs: overlapMs(busy[station], windows),
      downtimeMs: 0,
      workMs: windows.reduce((sum, w) => sum + (w.end - w.start), 0),
      faults: 0,
    })),
    faults: [] as Awaited<ReturnType<typeof getFaultsOverlapping>>,
  };
  const faults = await getFaultsOverlapping(start, end);
  return withFaults(result, faults, start, end, input);
}

function clipWindows(
  input: {
    from: string;
    toExclusive: string;
    shiftStart: string;
    shiftEnd: string;
  },
  start: Date,
  end: Date,
) {
  return workWindows(
    input.from,
    addDaysToDateKey(input.toExclusive, -1),
    input.shiftStart,
    input.shiftEnd,
  )
    .map((w) => ({
      start: Math.max(w.start, start.getTime()),
      end: Math.min(w.end, end.getTime()),
    }))
    .filter((w) => w.end > w.start);
}

function withFaults<
  T extends {
    stations: Array<{
      station: WorkStation;
      downtimeMs: number;
      workMs: number;
      faults: number;
    }>;
    faults: Awaited<ReturnType<typeof getFaultsOverlapping>>;
  },
>(
  result: T,
  faults: Awaited<ReturnType<typeof getFaultsOverlapping>>,
  start: Date,
  end: Date,
  input: {
    from: string;
    toExclusive: string;
    shiftStart: string;
    shiftEnd: string;
  },
): T {
  const windows = clipWindows(input, start, end);
  const workMs = windows.reduce((sum, w) => sum + (w.end - w.start), 0);
  for (const row of result.stations) {
    row.workMs = workMs;
    const own = faults.filter((fault) => fault.station === row.station);
    row.faults = own.length;
    // Простой — только когда станок остановлен, в рабочие часы смены.
    row.downtimeMs = overlapMs(
      own
        .filter((fault) => fault.stopped)
        .map((fault) => ({
          start: fault.reportedAt.getTime(),
          end: (fault.resolvedAt ?? end).getTime(),
        })),
      windows,
    );
  }
  result.faults = faults;
  return result;
}
