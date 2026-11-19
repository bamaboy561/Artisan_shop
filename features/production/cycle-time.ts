import { buildStageJournal } from "./stage-journal";
import { clockMinutes } from "./shift";

// Время цикла по заявке клиента и загрузка станков. Всё считается по
// журналу этапов (события cutting_stage), отдельных отметок не нужно.

type StageEvent = {
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string | null;
  createdAt: Date;
};

export const workStations = ["CUTTING", "EDGING", "DRILLING"] as const;
export type WorkStation = (typeof workStations)[number];

export const workStationLabels: Record<WorkStation, string> = {
  CUTTING: "Распил",
  EDGING: "Кромка",
  DRILLING: "Присадка",
};

export type RequestCycle = {
  createdAt: Date;
  launchedAt: Date | null;
  readyAt: Date | null;
  // Ожидание в очереди после запуска в цех и до начала распила.
  waitMs: number;
  stageMs: Record<WorkStation, number>;
  // От запуска в цех до «Готово» (или до сейчас, если ещё в работе).
  shopMs: number | null;
  // От заявки клиента до «Готово» (или до сейчас).
  clientMs: number;
  done: boolean;
};

export function buildRequestCycle(
  events: StageEvent[],
  createdAt: Date,
  now: Date = new Date(),
): RequestCycle {
  const rows = buildStageJournal(events, now);
  const stageMs: Record<WorkStation, number> = {
    CUTTING: 0,
    EDGING: 0,
    DRILLING: 0,
  };
  let waitMs = 0;
  let readyAt: Date | null = null;
  for (const row of rows) {
    if (row.stage === "READY_FOR_PICKUP") {
      readyAt ??= row.startedAt;
      continue;
    }
    // Если заявку вернули с «Готово» обратно, время после возврата тоже
    // работа, а «готово» — последний раз.
    if (readyAt) readyAt = null;
    if (row.stage === "ACCEPTED") waitMs += row.durationMs;
    else stageMs[row.stage as WorkStation] += row.durationMs;
  }
  const launchedAt = rows[0]?.startedAt ?? null;
  const end = readyAt ?? now;
  return {
    createdAt,
    launchedAt,
    readyAt,
    waitMs,
    stageMs,
    shopMs: launchedAt ? end.getTime() - launchedAt.getTime() : null,
    clientMs: end.getTime() - createdAt.getTime(),
    done: Boolean(readyAt),
  };
}

export function summarizeDurations(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    count: sorted.length,
    averageMs: sorted.reduce((sum, v) => sum + v, 0) / sorted.length,
    medianMs:
      sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2,
    maxMs: sorted[sorted.length - 1],
  };
}

export type Interval = { start: number; end: number };

// Время станции на этапе: интервалы, когда заявка стояла на этом этапе.
export function stageIntervals(
  events: StageEvent[],
  now: Date = new Date(),
): Record<WorkStation, Interval[]> {
  const result: Record<WorkStation, Interval[]> = {
    CUTTING: [],
    EDGING: [],
    DRILLING: [],
  };
  for (const row of buildStageJournal(events, now)) {
    if (!(workStations as readonly string[]).includes(row.stage)) continue;
    result[row.stage as WorkStation].push({
      start: row.startedAt.getTime(),
      end: row.startedAt.getTime() + row.durationMs,
    });
  }
  return result;
}

export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end)
      last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}

const dayMs = 86_400_000;
const bishkekOffsetMs = 6 * 3_600_000;

// Рабочие окна смены по Бишкеку (пн–сб) между днями from..to включительно.
export function workWindows(
  from: string,
  to: string,
  shiftStart: string,
  shiftEnd: string,
): Interval[] {
  const startMin = clockMinutes(shiftStart);
  const endMin = clockMinutes(shiftEnd);
  if (endMin <= startMin) return [];
  const windows: Interval[] = [];
  for (
    let day = Date.parse(`${from}T00:00:00Z`);
    day <= Date.parse(`${to}T00:00:00Z`);
    day += dayMs
  ) {
    if (new Date(day).getUTCDay() === 0) continue;
    const base = day - bishkekOffsetMs;
    windows.push({
      start: base + startMin * 60_000,
      end: base + endMin * 60_000,
    });
  }
  return windows;
}

export function overlapMs(intervals: Interval[], windows: Interval[]) {
  let total = 0;
  for (const interval of mergeIntervals(intervals))
    for (const window of windows) {
      const start = Math.max(interval.start, window.start);
      const end = Math.min(interval.end, window.end);
      if (end > start) total += end - start;
    }
  return total;
}

export function formatHours(ms: number) {
  const hours = ms / 3_600_000;
  if (hours < 0.05) return "0 ч";
  return hours >= 10 ? `${Math.round(hours)} ч` : `${hours.toFixed(1)} ч`;
}
