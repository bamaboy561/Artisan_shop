"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/dal";
import { canManageProduction } from "@/lib/auth/roles";
import { validDate } from "@/features/production/queue";
import {
  parseAbsenceReason,
  parseClock,
  parseIncidentArea,
  parseIncidentCauses,
  parseIncidentDecision,
  parseItemResults,
  parseShiftRole,
  defaultShiftEnd,
  defaultShiftStart,
} from "@/features/production/shift";
import {
  workStations,
  type WorkStation,
} from "@/features/production/cycle-time";
import {
  acknowledgeIncident,
  confirmShift,
  createIncident,
  decideIncident,
  defaultRoleFor,
  endShift,
  explainIncident,
  getMyShift,
  markAbsence,
  reportFault,
  resolveFault,
  saveShiftSettings,
  startShift,
} from "@/lib/server/production-shifts";
import { productionDateKey } from "@/features/production/queue";
import { uploadShiftPhoto } from "@/lib/server/production-shift-photo";

const myShiftPath = "/admin/production/shift";
const shiftsPath = "/admin/production/shifts";

async function session() {
  return requireAdminSession(`/login?next=${myShiftPath}`, myShiftPath);
}

function reader(formData: FormData) {
  return (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
}

function done(path: string, notice: string, hash = ""): never {
  revalidatePath(myShiftPath);
  revalidatePath(shiftsPath);
  revalidatePath("/admin/production/board");
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("notice", notice);
  redirect(`${base}?${params}${hash}`);
}

function safeShiftsReturn(value: string) {
  return value.startsWith(`${shiftsPath}?`) || value === shiftsPath
    ? value.replace(/[?&]notice=[^&]*/g, "")
    : shiftsPath;
}

export async function startShiftAction(formData: FormData) {
  const actor = await session();
  const get = reader(formData);
  const fallback = defaultRoleFor(actor);
  const requested = parseShiftRole(get("role")) ?? fallback;
  // Оператор выбирает «оператор» или «помощник», мастерский лист — только
  // у тех, кто управляет производством.
  const role =
    requested === "master" && !canManageProduction(actor.roleCode)
      ? fallback
      : requested;
  const parsed = parseItemResults(role, "start", get);
  if (!parsed.ok) done(myShiftPath, "checklist-incomplete");
  const result = await startShift({
    actor,
    role,
    results: parsed.results,
    note: get("note"),
    lateReason: get("lateReason"),
  });
  done(myShiftPath, `start-${result}`);
}

export async function endShiftAction(formData: FormData) {
  const actor = await session();
  const get = reader(formData);
  const shift = await getMyShift(actor, productionDateKey(new Date()));
  if (!shift?.startedAt) done(myShiftPath, "end-not-started");
  const role = parseShiftRole(shift.role) ?? defaultRoleFor(actor);
  const parsed = parseItemResults(role, "end", get);
  if (!parsed.ok) done(myShiftPath, "checklist-incomplete");
  let photoUrl: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      photoUrl = await uploadShiftPhoto(photo, actor.userId);
    } catch (error) {
      console.error("[shift] photo upload failed", error);
      done(myShiftPath, "photo-failed");
    }
  }
  const result = await endShift({
    actor,
    results: parsed.results,
    note: get("note"),
    unfinished: get("unfinished"),
    photoUrl,
  });
  done(myShiftPath, `end-${result}`);
}

export async function reportFaultAction(formData: FormData) {
  const actor = await session();
  const get = reader(formData);
  const station = get("station") as WorkStation;
  const description = get("description");
  const back = get("returnTo") === "shifts" ? shiftsPath : myShiftPath;
  if (!(workStations as readonly string[]).includes(station) || !description)
    done(back, "fault-incomplete", "#faults");
  const result = await reportFault({
    actor,
    station,
    machine: get("machine"),
    description,
    stopped: get("stopped") === "on",
  });
  done(back, `fault-${result}`, "#faults");
}

export async function resolveFaultAction(formData: FormData) {
  const actor = await session();
  const get = reader(formData);
  const back = get("returnTo") === "shifts" ? shiftsPath : myShiftPath;
  const result = await resolveFault({
    actor,
    id: get("id").slice(0, 64),
    resolution: get("resolution"),
  });
  done(back, `fault-resolved-${result}`, "#faults");
}

export async function explainIncidentAction(formData: FormData) {
  const actor = await session();
  const get = reader(formData);
  const back =
    get("returnTo") === "shifts"
      ? safeShiftsReturn(get("returnPath"))
      : myShiftPath;
  const refused = get("refused") === "on";
  if (!refused && !get("explanation")) done(back, "explain-empty");
  const result = await explainIncident({
    actor,
    id: get("id").slice(0, 64),
    explanation: get("explanation"),
    refused,
  });
  done(back, `explain-${result}`, `#incident-${get("id").slice(0, 64)}`);
}

export async function acknowledgeIncidentAction(formData: FormData) {
  const actor = await session();
  const get = reader(formData);
  const result = await acknowledgeIncident({
    actor,
    id: get("id").slice(0, 64),
    objection: get("objection"),
  });
  done(myShiftPath, `ack-${result}`);
}

// ——— Мастер ———

async function managerSession() {
  const actor = await requireAdminSession(
    `/login?next=${shiftsPath}`,
    shiftsPath,
  );
  if (!canManageProduction(actor.roleCode)) redirect(myShiftPath);
  return actor;
}

export async function saveShiftSettingsAction(formData: FormData) {
  const actor = await managerSession();
  const get = reader(formData);
  const start = parseClock(get("start"), defaultShiftStart);
  const end = parseClock(get("end"), defaultShiftEnd);
  const result = await saveShiftSettings(actor, { start, end });
  done(safeShiftsReturn(get("returnPath")), `settings-${result}`);
}

export async function confirmShiftAction(formData: FormData) {
  const actor = await managerSession();
  const get = reader(formData);
  const result = await confirmShift({
    actor,
    shiftId: get("shiftId").slice(0, 64),
    deviations: formData
      .getAll("deviation")
      .filter((v): v is string => typeof v === "string"),
    note: get("note"),
    lateExcused: get("lateExcused") === "on",
  });
  done(safeShiftsReturn(get("returnPath")), `confirm-${result}`);
}

export async function markAbsenceAction(formData: FormData) {
  const actor = await managerSession();
  const get = reader(formData);
  const day = validDate(get("day")) || productionDateKey(new Date());
  const result = await markAbsence({
    actor,
    userId: get("userId").slice(0, 64),
    day,
    reason: parseAbsenceReason(get("reason")),
    note: get("note"),
  });
  done(safeShiftsReturn(get("returnPath")), `absence-${result}`);
}

export async function createIncidentAction(formData: FormData) {
  const actor = await managerSession();
  const get = reader(formData);
  const back = safeShiftsReturn(get("returnPath"));
  const area = parseIncidentArea(get("area"));
  const observed = get("observed");
  const when = get("occurredAt");
  // Поле datetime-local даёт время по Бишкеку без пояса.
  const occurredAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)
    ? new Date(`${when}:00+06:00`)
    : new Date();
  if (!area || !observed || !get("employeeId"))
    done(back, "incident-incomplete");
  const result = await createIncident({
    actor,
    employeeId: get("employeeId").slice(0, 64),
    area,
    occurredAt: Number.isFinite(occurredAt.getTime()) ? occurredAt : new Date(),
    place: get("place"),
    observed,
    evidence: get("evidence"),
  });
  done(back, `incident-${result}`);
}

export async function decideIncidentAction(formData: FormData) {
  const actor = await managerSession();
  const get = reader(formData);
  const back = safeShiftsReturn(get("returnPath"));
  const decision = parseIncidentDecision(get("decision"));
  if (!decision)
    done(back, "decide-empty", `#incident-${get("id").slice(0, 64)}`);
  const result = await decideIncident({
    actor,
    id: get("id").slice(0, 64),
    decision,
    causes: parseIncidentCauses(formData.getAll("cause")),
    note: get("note"),
  });
  done(back, `decide-${result}`, `#incident-${get("id").slice(0, 64)}`);
}
