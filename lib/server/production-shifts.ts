import "server-only";

import { randomUUID } from "node:crypto";
import { RoleCode } from "@/generated/prisma";
import {
  canAccessProduction,
  canManageProduction,
  isProductionOperator,
  productionStationDefinitions,
} from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";
import { sendStaffNotice } from "@/lib/server/commercial-integrations";
import {
  productionDateKey,
  productionTimeZone,
} from "@/features/production/queue";
import {
  defaultShiftEnd,
  defaultShiftStart,
  itemsFor,
  lateMinutes,
  parseClock,
  parseStoredResults,
  type AbsenceReason,
  type IncidentArea,
  type IncidentCause,
  type IncidentDecision,
  type ItemResults,
  type ShiftRole,
  countDeviations,
  summarizeShiftDay,
} from "@/features/production/shift";
import {
  workStationLabels,
  type WorkStation,
} from "@/features/production/cycle-time";

type SchemaDb = Pick<ReturnType<typeof getDb>, "$executeRawUnsafe">;

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

// Таблицы смен создаём сами при первом обращении, как и остальные
// таблицы цеха; те же модели есть в prisma/schema.prisma.
export async function ensureShiftTables(db: SchemaDb = getDb()) {
  if (schemaReady) return;
  schemaPromise ??= createTables(db)
    .catch(() => createTables(db))
    .then(() => {
      schemaReady = true;
    })
    .finally(() => {
      schemaPromise = null;
    });
  await schemaPromise;
}

async function createTables(db: SchemaDb) {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductionShift" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "userName" TEXT NOT NULL,
      "shiftDate" DATE NOT NULL,
      "role" TEXT NOT NULL,
      "station" TEXT,
      "startedAt" TIMESTAMP(3),
      "lateMinutes" INTEGER NOT NULL DEFAULT 0,
      "lateReason" TEXT,
      "lateExcused" BOOLEAN NOT NULL DEFAULT false,
      "startResults" TEXT,
      "startNote" TEXT,
      "endedAt" TIMESTAMP(3),
      "endResults" TEXT,
      "endNote" TEXT,
      "unfinished" TEXT,
      "photoUrl" TEXT,
      "absence" TEXT,
      "absenceNote" TEXT,
      "confirmedAt" TIMESTAMP(3),
      "confirmedByName" TEXT,
      "masterDeviations" TEXT,
      "masterNote" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductionShift_pkey" PRIMARY KEY ("id")
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductionShift_shiftDate_idx" ON "ProductionShift"("shiftDate")`,
  );
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "ProductionShift_userId_shiftDate_key" ON "ProductionShift"("userId", "shiftDate")`,
  );
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductionMachineFault" (
      "id" TEXT NOT NULL,
      "station" TEXT NOT NULL,
      "machine" TEXT,
      "description" TEXT NOT NULL,
      "stopped" BOOLEAN NOT NULL DEFAULT false,
      "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "reportedById" TEXT,
      "reportedByName" TEXT,
      "resolvedAt" TIMESTAMP(3),
      "resolvedByName" TEXT,
      "resolution" TEXT,
      CONSTRAINT "ProductionMachineFault_pkey" PRIMARY KEY ("id")
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductionMachineFault_reportedAt_idx" ON "ProductionMachineFault"("reportedAt")`,
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductionMachineFault_resolvedAt_idx" ON "ProductionMachineFault"("resolvedAt")`,
  );
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductionIncident" (
      "id" TEXT NOT NULL,
      "occurredAt" TIMESTAMP(3) NOT NULL,
      "area" TEXT NOT NULL,
      "employeeId" TEXT NOT NULL,
      "employeeName" TEXT NOT NULL,
      "place" TEXT,
      "observed" TEXT NOT NULL,
      "evidence" TEXT,
      "reportedById" TEXT,
      "reportedByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "causes" TEXT,
      "explanation" TEXT,
      "explanationAt" TIMESTAMP(3),
      "explanationRefused" BOOLEAN NOT NULL DEFAULT false,
      "decision" TEXT,
      "decisionNote" TEXT,
      "decidedAt" TIMESTAMP(3),
      "decidedByName" TEXT,
      "acknowledgedAt" TIMESTAMP(3),
      "objection" TEXT,
      CONSTRAINT "ProductionIncident_pkey" PRIMARY KEY ("id")
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductionIncident_employeeId_idx" ON "ProductionIncident"("employeeId")`,
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductionIncident_occurredAt_idx" ON "ProductionIncident"("occurredAt")`,
  );
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductionShiftSetting" (
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductionShiftSetting_pkey" PRIMARY KEY ("key")
    )
  `);
}

export async function prepareShifts() {
  if (!hasDatabaseUrl()) return false;
  try {
    await ensureShiftTables();
    return true;
  } catch (error) {
    console.error("[production-shifts] schema unavailable", error);
    return false;
  }
}

export function actorName(actor: SessionPayload) {
  return (
    [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email
  );
}

export function dateFromKey(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

export function keyFromDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function defaultRoleFor(actor: SessionPayload): ShiftRole {
  return isProductionOperator(actor.roleCode) ? "operator" : "master";
}

// ——— Настройки смены ———

export type ShiftSettings = { start: string; end: string };

export async function getShiftSettings(): Promise<ShiftSettings> {
  if (!(await prepareShifts()))
    return { start: defaultShiftStart, end: defaultShiftEnd };
  const rows = await getDb().productionShiftSetting.findMany({
    where: { key: { in: ["shiftStart", "shiftEnd"] } },
  });
  const value = (key: string) => rows.find((row) => row.key === key)?.value;
  return {
    start: parseClock(value("shiftStart"), defaultShiftStart),
    end: parseClock(value("shiftEnd"), defaultShiftEnd),
  };
}

export async function saveShiftSettings(
  actor: SessionPayload,
  settings: ShiftSettings,
) {
  if (!canManageProduction(actor.roleCode)) return "forbidden" as const;
  if (!(await prepareShifts())) return "unavailable" as const;
  const db = getDb();
  for (const [key, value] of [
    ["shiftStart", settings.start],
    ["shiftEnd", settings.end],
  ] as const)
    await db.productionShiftSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value, updatedAt: new Date() },
    });
  return "saved" as const;
}

// ——— Смена сотрудника ———

export type ShiftRow = Awaited<ReturnType<typeof loadShift>>;

async function loadShift(userId: string, day: string) {
  return getDb().productionShift.findUnique({
    where: { userId_shiftDate: { userId, shiftDate: dateFromKey(day) } },
  });
}

export async function getMyShift(actor: SessionPayload, day: string) {
  if (!(await prepareShifts())) return null;
  return loadShift(actor.userId, day);
}

export type ShiftResult =
  | "saved"
  | "forbidden"
  | "unavailable"
  | "already"
  | "not-started"
  | "absent";

export async function startShift(input: {
  actor: SessionPayload;
  role: ShiftRole;
  results: ItemResults;
  note: string;
  lateReason: string;
  now?: Date;
}): Promise<ShiftResult> {
  if (!canAccessProduction(input.actor.roleCode)) return "forbidden";
  if (!(await prepareShifts())) return "unavailable";
  const now = input.now ?? new Date();
  const day = productionDateKey(now);
  const existing = await loadShift(input.actor.userId, day);
  if (existing?.startedAt) return "already";
  const settings = await getShiftSettings();
  const late = lateMinutes(now, settings.start);
  const data = {
    userName: actorName(input.actor),
    role: input.role,
    station: input.actor.productionStation ?? null,
    startedAt: now,
    lateMinutes: late,
    lateReason: late ? input.lateReason.slice(0, 500) || null : null,
    startResults: JSON.stringify(input.results),
    startNote: input.note.slice(0, 1000) || null,
    absence: null,
    absenceNote: null,
    updatedAt: now,
  };
  await getDb().productionShift.upsert({
    where: {
      userId_shiftDate: {
        userId: input.actor.userId,
        shiftDate: dateFromKey(day),
      },
    },
    create: {
      id: randomUUID(),
      userId: input.actor.userId,
      shiftDate: dateFromKey(day),
      ...data,
    },
    update: data,
  });
  const deviations = Object.entries(input.results).filter(
    ([, r]) => r.mark === "deviation",
  );
  // Принятые от прошлой смены дефекты — сразу мастеру, до работы на станке.
  if (deviations.length)
    await notify(
      `приёмка смены с отклонениями — ${data.userName}`,
      deviations.map(
        ([key, r]) =>
          `• ${itemsFor(input.role, "start").find((i) => i.key === key)?.label ?? key}: ${r.note}`,
      ),
      "/admin/production/shifts",
    );
  return "saved";
}

export async function endShift(input: {
  actor: SessionPayload;
  results: ItemResults;
  note: string;
  unfinished: string;
  photoUrl: string | null;
  now?: Date;
}): Promise<ShiftResult> {
  if (!canAccessProduction(input.actor.roleCode)) return "forbidden";
  if (!(await prepareShifts())) return "unavailable";
  const now = input.now ?? new Date();
  const day = productionDateKey(now);
  const existing = await loadShift(input.actor.userId, day);
  if (!existing?.startedAt) return "not-started";
  if (existing.endedAt) return "already";
  await getDb().productionShift.update({
    where: { id: existing.id },
    data: {
      endedAt: now,
      endResults: JSON.stringify(input.results),
      endNote: input.note.slice(0, 1000) || null,
      unfinished: input.unfinished.slice(0, 2000) || null,
      photoUrl: input.photoUrl,
      updatedAt: now,
    },
  });
  return "saved";
}

// Мастер принимает сдачу смены: может отметить пункты с отклонением.
export async function confirmShift(input: {
  actor: SessionPayload;
  shiftId: string;
  deviations: string[];
  note: string;
  lateExcused: boolean;
}): Promise<ShiftResult> {
  if (!canManageProduction(input.actor.roleCode)) return "forbidden";
  if (!(await prepareShifts())) return "unavailable";
  const shift = await getDb().productionShift.findUnique({
    where: { id: input.shiftId },
  });
  if (!shift?.startedAt) return "not-started";
  if (shift.absence) return "absent";
  const role = shift.role as ShiftRole;
  const known = new Set([
    ...itemsFor(role, "start").map((item) => item.key),
    ...itemsFor(role, "end").map((item) => item.key),
  ]);
  await getDb().productionShift.update({
    where: { id: shift.id },
    data: {
      confirmedAt: new Date(),
      confirmedByName: actorName(input.actor),
      masterDeviations: JSON.stringify(
        input.deviations.filter((key) => known.has(key)),
      ),
      masterNote: input.note.slice(0, 1000) || null,
      lateExcused: input.lateExcused,
      updatedAt: new Date(),
    },
  });
  return "saved";
}

// Отсутствие отмечает мастер. Диагноз не пишем: документы у кадровика.
export async function markAbsence(input: {
  actor: SessionPayload;
  userId: string;
  day: string;
  reason: AbsenceReason | null;
  note: string;
}): Promise<ShiftResult> {
  if (!canManageProduction(input.actor.roleCode)) return "forbidden";
  if (!(await prepareShifts())) return "unavailable";
  const user = await getDb().user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      productionStation: true,
      role: { select: { code: true } },
    },
  });
  if (!user) return "forbidden";
  const existing = await loadShift(user.id, input.day);
  if (existing?.startedAt && input.reason) return "already";
  if (!input.reason) {
    if (existing && !existing.startedAt)
      await getDb().productionShift.delete({ where: { id: existing.id } });
    return "saved";
  }
  const data = {
    absence: input.reason,
    absenceNote: input.note.slice(0, 300) || null,
    updatedAt: new Date(),
  };
  await getDb().productionShift.upsert({
    where: {
      userId_shiftDate: {
        userId: user.id,
        shiftDate: dateFromKey(input.day),
      },
    },
    create: {
      id: randomUUID(),
      userId: user.id,
      userName:
        [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
      shiftDate: dateFromKey(input.day),
      role:
        user.role.code === RoleCode.PRODUCTION_OPERATOR ? "operator" : "master",
      station: user.productionStation ?? null,
      ...data,
    },
    update: data,
  });
  return "saved";
}

// ——— Сотрудники цеха ———

export const workshopRoleCodes = [
  RoleCode.PRODUCTION_OPERATOR,
  RoleCode.PRODUCTION_MANAGER,
  RoleCode.CUTTING_MANAGER,
];

export async function getWorkshopStaff() {
  if (!hasDatabaseUrl()) return [];
  const users = await getDb().user.findMany({
    where: { isActive: true, role: { code: { in: workshopRoleCodes } } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      productionStation: true,
      role: { select: { code: true } },
    },
    orderBy: [{ firstName: "asc" }, { email: "asc" }],
  });
  return users.map((user) => ({
    id: user.id,
    name:
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
    roleCode: user.role.code,
    station: user.productionStation,
    stationLabel: user.productionStation
      ? productionStationDefinitions[user.productionStation].shortLabel
      : null,
  }));
}

export async function getShiftsForDay(day: string) {
  if (!(await prepareShifts())) return [];
  return getDb().productionShift.findMany({
    where: { shiftDate: dateFromKey(day) },
    orderBy: { startedAt: "asc" },
  });
}

export async function getShiftsForRange(from: string, toExclusive: string) {
  if (!(await prepareShifts())) return [];
  return getDb().productionShift.findMany({
    where: {
      shiftDate: { gte: dateFromKey(from), lt: dateFromKey(toExclusive) },
    },
    orderBy: { shiftDate: "asc" },
  });
}

export function shiftResults(shift: NonNullable<ShiftRow>) {
  let masterDeviations: string[] = [];
  try {
    const parsed = JSON.parse(shift.masterDeviations ?? "[]");
    if (Array.isArray(parsed))
      masterDeviations = parsed.filter((v) => typeof v === "string");
  } catch {}
  return {
    start: parseStoredResults(shift.startResults),
    end: shift.endResults ? parseStoredResults(shift.endResults) : null,
    masterDeviations,
  };
}

// ——— Неисправности станков ———

export async function reportFault(input: {
  actor: SessionPayload;
  station: WorkStation;
  machine: string;
  description: string;
  stopped: boolean;
}) {
  if (!canAccessProduction(input.actor.roleCode)) return "forbidden" as const;
  if (!(await prepareShifts())) return "unavailable" as const;
  const name = actorName(input.actor);
  await getDb().productionMachineFault.create({
    data: {
      id: randomUUID(),
      station: input.station,
      machine: input.machine.slice(0, 120) || null,
      description: input.description.slice(0, 1000),
      stopped: input.stopped,
      reportedById: input.actor.userId,
      reportedByName: name,
    },
  });
  await notify(
    `${input.stopped ? "станок остановлен" : "неисправность"} — ${workStationLabels[input.station]}${input.machine ? `, ${input.machine}` : ""}`,
    [`Что случилось: ${input.description}`, `Сообщил: ${name}`],
    "/admin/production/shifts#faults",
  );
  return "saved" as const;
}

export async function resolveFault(input: {
  actor: SessionPayload;
  id: string;
  resolution: string;
}) {
  if (!canAccessProduction(input.actor.roleCode)) return "forbidden" as const;
  if (!(await prepareShifts())) return "unavailable" as const;
  const fault = await getDb().productionMachineFault.findUnique({
    where: { id: input.id },
  });
  if (!fault || fault.resolvedAt) return "saved" as const;
  const name = actorName(input.actor);
  await getDb().productionMachineFault.update({
    where: { id: fault.id },
    data: {
      resolvedAt: new Date(),
      resolvedByName: name,
      resolution: input.resolution.slice(0, 1000) || null,
    },
  });
  await notify(
    `неисправность устранена — ${workStationLabels[fault.station as WorkStation] ?? fault.station}${fault.machine ? `, ${fault.machine}` : ""}`,
    [
      `Была: ${fault.description}`,
      input.resolution ? `Что сделали: ${input.resolution}` : "",
      `Отметил: ${name}`,
    ].filter(Boolean),
    "/admin/production/shifts#faults",
  );
  return "saved" as const;
}

export async function getOpenFaults() {
  if (!(await prepareShifts())) return [];
  return getDb().productionMachineFault.findMany({
    where: { resolvedAt: null },
    orderBy: { reportedAt: "desc" },
    take: 50,
  });
}

export async function getFaultsOverlapping(from: Date, to: Date) {
  if (!(await prepareShifts())) return [];
  return getDb().productionMachineFault.findMany({
    where: {
      reportedAt: { lt: to },
      OR: [{ resolvedAt: null }, { resolvedAt: { gte: from } }],
    },
    orderBy: { reportedAt: "desc" },
    take: 500,
  });
}

// ——— Журнал фактов ———

export async function createIncident(input: {
  actor: SessionPayload;
  employeeId: string;
  area: IncidentArea;
  occurredAt: Date;
  place: string;
  observed: string;
  evidence: string;
}) {
  if (!canManageProduction(input.actor.roleCode)) return "forbidden" as const;
  if (!(await prepareShifts())) return "unavailable" as const;
  const staff = await getWorkshopStaff();
  const employee = staff.find((person) => person.id === input.employeeId);
  if (!employee) return "forbidden" as const;
  await getDb().productionIncident.create({
    data: {
      id: randomUUID(),
      occurredAt: input.occurredAt,
      area: input.area,
      employeeId: employee.id,
      employeeName: employee.name,
      place: input.place.slice(0, 200) || null,
      observed: input.observed.slice(0, 2000),
      evidence: input.evidence.slice(0, 1000) || null,
      reportedById: input.actor.userId,
      reportedByName: actorName(input.actor),
    },
  });
  return "saved" as const;
}

export async function getIncident(id: string) {
  if (!(await prepareShifts())) return null;
  return getDb().productionIncident.findUnique({ where: { id } });
}

// Объяснение пишет сам сотрудник или мастер с его слов; отказ — актом.
export async function explainIncident(input: {
  actor: SessionPayload;
  id: string;
  explanation: string;
  refused: boolean;
}) {
  const incident = await getIncident(input.id);
  if (!incident) return "forbidden" as const;
  const own = incident.employeeId === input.actor.userId;
  if (!own && !canManageProduction(input.actor.roleCode))
    return "forbidden" as const;
  if (incident.decision) return "already" as const;
  if (input.refused && own) return "forbidden" as const;
  await getDb().productionIncident.update({
    where: { id: incident.id },
    data: input.refused
      ? {
          explanation: null,
          explanationRefused: true,
          explanationAt: new Date(),
        }
      : {
          explanation: input.explanation.slice(0, 2000),
          explanationRefused: false,
          explanationAt: new Date(),
        },
  });
  return "saved" as const;
}

// За один проступок — одно решение: после записи его не меняют.
export async function decideIncident(input: {
  actor: SessionPayload;
  id: string;
  decision: IncidentDecision;
  causes: IncidentCause[];
  note: string;
}) {
  if (!canManageProduction(input.actor.roleCode)) return "forbidden" as const;
  const incident = await getIncident(input.id);
  if (!incident) return "forbidden" as const;
  if (incident.decision) return "already" as const;
  if (!incident.explanation && !incident.explanationRefused)
    return "not-explained" as const;
  await getDb().productionIncident.update({
    where: { id: incident.id },
    data: {
      decision: input.decision,
      causes: input.causes.join(",") || null,
      decisionNote: input.note.slice(0, 2000) || null,
      decidedAt: new Date(),
      decidedByName: actorName(input.actor),
    },
  });
  return "saved" as const;
}

export async function acknowledgeIncident(input: {
  actor: SessionPayload;
  id: string;
  objection: string;
}) {
  const incident = await getIncident(input.id);
  if (!incident || incident.employeeId !== input.actor.userId)
    return "forbidden" as const;
  if (!incident.decision) return "not-decided" as const;
  if (incident.acknowledgedAt) return "already" as const;
  await getDb().productionIncident.update({
    where: { id: incident.id },
    data: {
      acknowledgedAt: new Date(),
      objection: input.objection.slice(0, 2000) || null,
    },
  });
  return "saved" as const;
}

export async function getIncidents(input: {
  employeeId?: string;
  from?: Date;
  to?: Date;
  openOnly?: boolean;
  take?: number;
}) {
  if (!(await prepareShifts())) return [];
  return getDb().productionIncident.findMany({
    where: {
      ...(input.employeeId ? { employeeId: input.employeeId } : {}),
      ...(input.from || input.to
        ? {
            occurredAt: {
              ...(input.from ? { gte: input.from } : {}),
              ...(input.to ? { lt: input.to } : {}),
            },
          }
        : {}),
      ...(input.openOnly ? { acknowledgedAt: null } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: input.take ?? 100,
  });
}

// Итог смены за день для доски и вечернего отчёта.
export async function getShiftDaySummary(day: string) {
  if (!(await prepareShifts())) return null;
  const [staff, shifts, openFaults, pendingIncidents] = await Promise.all([
    getWorkshopStaff(),
    getShiftsForDay(day),
    getDb().productionMachineFault.count({ where: { resolvedAt: null } }),
    getDb().productionIncident.count({ where: { acknowledgedAt: null } }),
  ]);
  const summary = summarizeShiftDay(
    staff,
    shifts.map((shift) => {
      const results = shiftResults(shift);
      return {
        userId: shift.userId,
        userName: shift.userName,
        startedAt: shift.startedAt,
        endedAt: shift.endedAt,
        confirmedAt: shift.confirmedAt,
        absence: shift.absence,
        lateMinutes: shift.lateMinutes,
        deviations:
          countDeviations(results.start) +
          (results.end ? countDeviations(results.end) : 0),
      };
    }),
  );
  return { summary, openFaults, pendingIncidents };
}

// ——— Telegram ———

async function notify(title: string, lines: string[], path: string) {
  try {
    await sendStaffNotice({
      title: `Artisan · цех: ${title}`,
      threadKey: "cutting",
      lines,
      actions: [{ label: "Открыть", url: absoluteUrl(path) }],
    });
  } catch (error) {
    console.error("[production-shifts] staff notice failed", error);
  }
}

export const shiftTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: productionTimeZone,
});

export const shiftDateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: productionTimeZone,
});

// Номера заявок, которые сейчас стоят на этапе станции, — подсказка для
// «незавершённые заказы» при сдаче смены.
export async function getStationOpenRequests(station: WorkStation | null) {
  if (!station || !hasDatabaseUrl()) return [];
  const rows = await getDb().request.findMany({
    where: {
      type: "CUTTING_SERVICE",
      cuttingStage: station,
      status: { notIn: ["COMPLETED", "CANCELED"] },
    },
    select: { id: true, number: true },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
  return rows.map((row) => row.number ?? row.id.slice(0, 8).toUpperCase());
}
