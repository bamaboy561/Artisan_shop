import assert from "node:assert/strict";
import test from "node:test";
import { RoleCode } from "../generated/prisma";
import {
  buildShiftScore,
  incidentStatus,
  itemsFor,
  lateMinutes,
  monthBounds,
  parseClock,
  parseItemResults,
  parseMonth,
  parseStoredResults,
  shiftDayMessageLines,
  shiftMonth,
  summarizeShiftDay,
  type ItemResults,
  type ScoreShift,
} from "../features/production/shift";
import {
  buildRequestCycle,
  overlapMs,
  stageIntervals,
  summarizeDurations,
  workWindows,
} from "../features/production/cycle-time";
import { canAccessAdminPath } from "../lib/auth/roles";

function all(role: "operator" | "helper" | "master", mark = "done") {
  const results: ItemResults = {};
  for (const phase of ["start", "end"] as const)
    for (const item of itemsFor(role, phase))
      results[item.key] = { mark: mark as "done", note: "" };
  return results;
}

test("checklist needs every item and a note for deviation or n/a", () => {
  const form: Record<string, string> = {};
  for (const item of itemsFor("operator", "start"))
    form[`mark_${item.key}`] = "done";
  const get = (key: string) => form[key] ?? "";
  assert.equal(parseItemResults("operator", "start", get).ok, true);
  form.mark_s_zone = "deviation";
  const missingNote = parseItemResults("operator", "start", get);
  assert.equal(missingNote.ok, false);
  assert.deepEqual(!missingNote.ok && missingNote.needNote, ["s_zone"]);
  form.note_s_zone = "доска у прохода";
  assert.equal(parseItemResults("operator", "start", get).ok, true);
  delete form.mark_s_care;
  const missing = parseItemResults("operator", "start", get);
  assert.deepEqual(!missing.ok && missing.missing, ["s_care"]);
});

test("stored results ignore broken json and unknown marks", () => {
  assert.deepEqual(parseStoredResults("{bad"), {});
  assert.deepEqual(
    parseStoredResults(
      JSON.stringify({ a: { mark: "done", note: 1 }, b: { mark: "x" } }),
    ),
    { a: { mark: "done", note: "" } },
  );
});

test("late minutes are counted against the Bishkek schedule", () => {
  // 03:10 UTC = 09:10 в Бишкеке.
  assert.equal(lateMinutes(new Date("2026-11-19T03:10:00Z"), "09:00"), 10);
  assert.equal(lateMinutes(new Date("2026-11-19T02:55:00Z"), "09:00"), 0);
  assert.equal(parseClock("8:30"), "08:30");
  assert.equal(parseClock("25:00"), "09:00");
});

test("score follows the weighted formula from the document", () => {
  const perfect: ScoreShift = {
    role: "operator",
    absent: null,
    lateMinutes: 0,
    lateExcused: false,
    startResults: all("operator"),
    endResults: all("operator"),
    masterDeviations: [],
  };
  assert.equal(buildShiftScore([perfect]).percent, 100);

  // Мастер отметил грязный станок: «станок» 0 из 1 → минус 20%.
  const dirty = { ...perfect, masterDeviations: ["e_clean"] };
  assert.equal(buildShiftScore([dirty]).percent, 80);

  // Опоздание без уважительной причины снимает только «график» (10%).
  assert.equal(buildShiftScore([{ ...perfect, lateMinutes: 5 }]).percent, 90);
  assert.equal(
    buildShiftScore([{ ...perfect, lateMinutes: 5, lateExcused: true }])
      .percent,
    100,
  );

  // Болезнь не оценивается вовсе; нет наблюдений — нет оценки, а не ноль.
  const sick = { ...perfect, absent: "sick" as const };
  const sickOnly = buildShiftScore([sick]);
  assert.equal(sickOnly.percent, null);
  assert.equal(sickOnly.absences, 1);
  assert.equal(buildShiftScore([perfect, sick]).percent, 100);

  // Несданная смена: пункты сдачи не проверены и не считаются.
  const notEnded = { ...perfect, endResults: null };
  const score = buildShiftScore([notEnded]);
  assert.equal(score.indicators.find((i) => i.key === "clean")!.checks, 0);
  assert.equal(score.percent, 100);

  // «Неприменимо» исключается, а не считается невыполненным.
  const na = all("operator");
  na.e_clean = { mark: "na", note: "станок в ремонте" };
  const naScore = buildShiftScore([{ ...perfect, endResults: na }]);
  assert.equal(naScore.indicators.find((i) => i.key === "clean")!.checks, 0);
  assert.equal(naScore.percent, 100);
});

test("helper sheet has no machine care, weights are recalculated", () => {
  const helper: ScoreShift = {
    role: "helper",
    absent: null,
    lateMinutes: 0,
    lateExcused: false,
    startResults: all("helper"),
    endResults: all("helper"),
    masterDeviations: ["e_zone"],
  };
  // Применимы: зона 15, график 10, передача 20, безопасность 15 = 60.
  // Зона 0 → 45/60 = 75%.
  assert.equal(buildShiftScore([helper]).percent, 75);
});

test("incident goes explain → decide → acknowledge → closed", () => {
  const base = {
    explanation: null,
    explanationRefused: false,
    decision: null,
    acknowledgedAt: null,
  };
  assert.equal(incidentStatus(base), "explain");
  assert.equal(incidentStatus({ ...base, explanationRefused: true }), "decide");
  assert.equal(
    incidentStatus({ ...base, explanation: "x", decision: "remark" }),
    "acknowledge",
  );
  assert.equal(
    incidentStatus({
      ...base,
      explanation: "x",
      decision: "remark",
      acknowledgedAt: new Date(),
    }),
    "closed",
  );
});

test("day summary lists who did not hand over the shift", () => {
  const at = new Date();
  const summary = summarizeShiftDay(
    [
      { id: "a", name: "Азат" },
      { id: "b", name: "Бакыт" },
      { id: "c", name: "Чынгыз" },
      { id: "d", name: "Данияр" },
    ],
    [
      {
        userId: "a",
        userName: "Азат",
        startedAt: at,
        endedAt: at,
        confirmedAt: null,
        absence: null,
        lateMinutes: 0,
        deviations: 1,
      },
      {
        userId: "b",
        userName: "Бакыт",
        startedAt: at,
        endedAt: null,
        confirmedAt: null,
        absence: null,
        lateMinutes: 12,
        deviations: 0,
      },
      {
        userId: "c",
        userName: "Чынгыз",
        startedAt: null,
        endedAt: null,
        confirmedAt: null,
        absence: "sick",
        lateMinutes: 0,
        deviations: 0,
      },
    ],
  );
  assert.deepEqual(summary.notStarted, ["Данияр"]);
  assert.deepEqual(summary.working, ["Бакыт"]);
  assert.deepEqual(summary.unconfirmed, ["Азат"]);
  const lines = shiftDayMessageLines(summary, {
    openFaults: 1,
    pendingIncidents: 0,
  });
  assert.equal(lines[0], "Смена: приняли 2 из 4 · сдали 1");
  assert.ok(lines.includes("Не сдали смену: Бакыт"));
  assert.ok(lines.includes("Опоздания: Бакыт 12 мин"));
  assert.ok(lines.includes("Отсутствуют: Чынгыз (болезнь)"));
  assert.ok(lines.includes("Неисправностей не устранено: 1"));
  assert.deepEqual(
    shiftDayMessageLines(summarizeShiftDay([], []), {
      openFaults: 0,
      pendingIncidents: 0,
    }),
    [],
  );
});

const h = (iso: string) => new Date(iso);
const stage = (from: string | null, to: string, at: string) => ({
  eventType: "cutting_stage",
  fromStatus: from,
  toStatus: to,
  actorName: null,
  createdAt: h(at),
});

test("request cycle splits wait, stations and total", () => {
  const events = [
    stage(null, "ACCEPTED", "2026-11-10T03:00:00Z"),
    stage("ACCEPTED", "CUTTING", "2026-11-10T05:00:00Z"),
    stage("CUTTING", "EDGING", "2026-11-10T08:00:00Z"),
    stage("EDGING", "DRILLING", "2026-11-11T04:00:00Z"),
    stage("DRILLING", "READY_FOR_PICKUP", "2026-11-11T06:00:00Z"),
  ];
  const cycle = buildRequestCycle(
    events,
    h("2026-11-09T03:00:00Z"),
    h("2026-11-20T00:00:00Z"),
  );
  assert.equal(cycle.done, true);
  assert.equal(cycle.waitMs, 2 * 3_600_000);
  assert.equal(cycle.stageMs.CUTTING, 3 * 3_600_000);
  assert.equal(cycle.stageMs.EDGING, 20 * 3_600_000);
  assert.equal(cycle.stageMs.DRILLING, 2 * 3_600_000);
  assert.equal(cycle.shopMs, 27 * 3_600_000);
  assert.equal(cycle.clientMs, 51 * 3_600_000);

  const running = buildRequestCycle(
    events.slice(0, 3),
    h("2026-11-09T03:00:00Z"),
    h("2026-11-10T09:00:00Z"),
  );
  assert.equal(running.done, false);
  assert.equal(running.stageMs.EDGING, 3_600_000);
});

test("machine load counts overlapping requests once, only in shift hours", () => {
  const a = stageIntervals(
    [
      stage(null, "CUTTING", "2026-11-16T03:00:00Z"), // 09:00 Бишкек, пн
      stage("CUTTING", "EDGING", "2026-11-16T05:00:00Z"),
    ],
    h("2026-11-20T00:00:00Z"),
  );
  const b = stageIntervals(
    [
      stage(null, "CUTTING", "2026-11-16T04:00:00Z"),
      stage("CUTTING", "EDGING", "2026-11-16T14:00:00Z"), // 20:00 — после смены
    ],
    h("2026-11-20T00:00:00Z"),
  );
  const windows = workWindows("2026-11-16", "2026-11-16", "09:00", "18:00");
  assert.equal(windows.length, 1);
  // 09:00–18:00 занято целиком = 9 ч.
  assert.equal(overlapMs([...a.CUTTING, ...b.CUTTING], windows), 9 * 3_600_000);
  // Воскресенье не рабочий день.
  assert.equal(
    workWindows("2026-11-22", "2026-11-22", "09:00", "18:00").length,
    0,
  );
  assert.deepEqual(summarizeDurations([3, 1, 2])?.medianMs, 2);
  assert.equal(summarizeDurations([]), null);
});

test("month helpers", () => {
  assert.deepEqual(monthBounds("2026-12"), {
    from: "2026-12-01",
    next: "2027-01-01",
  });
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(parseMonth("2026-13", "2026-11"), "2026-11");
});

test("only production managers open the workshop shifts page", () => {
  assert.equal(
    canAccessAdminPath(RoleCode.PRODUCTION_OPERATOR, "/admin/production/shift"),
    true,
  );
  assert.equal(
    canAccessAdminPath(
      RoleCode.PRODUCTION_OPERATOR,
      "/admin/production/shifts",
    ),
    false,
  );
  assert.equal(
    canAccessAdminPath(RoleCode.PRODUCTION_MANAGER, "/admin/production/shifts"),
    true,
  );
  assert.equal(
    canAccessAdminPath(RoleCode.CUTTING_MANAGER, "/admin/production/shifts"),
    true,
  );
});
