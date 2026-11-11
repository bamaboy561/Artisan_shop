import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDailyReport,
  parseReportDay,
  type ReportCard,
  type ReportEvent,
} from "../features/production/daily-report";

const now = new Date("2026-11-11T12:00:00+06:00").getTime();
const hour = 3_600_000;

function card(id: string, extra: Partial<ReportCard> = {}): ReportCard {
  return {
    id,
    number: id.toUpperCase(),
    material: "ЛДСП",
    column: "CUTTING",
    dueDate: "2026-11-15",
    stageSince: new Date(now - hour),
    isUrgent: false,
    problemReason: null,
    ...extra,
  };
}

function move(
  id: string,
  from: string | null,
  to: string,
  actorName = "Азамат",
): ReportEvent {
  return {
    entityId: id,
    eventType: "cutting_stage",
    title: "Распил",
    fromStatus: from,
    toStatus: to,
    actorName,
  };
}

test("итоги дня считают переходы по этапам", () => {
  const report = buildDailyReport({
    day: "2026-11-11",
    today: "2026-11-11",
    now,
    createdCount: 3,
    events: [
      move("a", null, "ACCEPTED"),
      move("a", "ACCEPTED", "CUTTING"),
      move("a", "CUTTING", "EDGING"),
      move("b", "CUTTING", "ACCEPTED"), // возврат — не распил
      move("c", "DRILLING", "READY_FOR_PICKUP", "Бека"),
      move("c", "READY_FOR_PICKUP", "READY_FOR_PICKUP"), // смена ячейки
      {
        entityId: "c",
        eventType: "status",
        title: "Заказ выдан клиенту",
        fromStatus: null,
        toStatus: null,
        actorName: null,
      },
      {
        entityId: "b",
        eventType: "production_flag",
        title: "Проблема: нет материала",
        fromStatus: null,
        toStatus: null,
        actorName: null,
      },
    ],
    sheets: new Map([["a", 4]]),
    dueDates: new Map([["c", "2026-11-10"]]),
    cards: [],
  });
  assert.equal(report.day.created, 3);
  assert.equal(report.day.launched, 1);
  assert.equal(report.day.cut, 1);
  assert.equal(report.day.cutSheets, 4);
  assert.equal(report.day.drilled, 1);
  assert.equal(report.day.ready, 1);
  assert.equal(report.day.readyLate, 1);
  assert.equal(report.day.issued, 1);
  assert.equal(report.day.problemsReported, 1);
  assert.deepEqual(report.day.people, [
    { name: "Азамат", moves: 4 },
    { name: "Бека", moves: 1 },
  ]);
});

test("сейчас: просроченные, висящие и проблемные по этапам", () => {
  const report = buildDailyReport({
    day: "2026-11-11",
    today: "2026-11-11",
    now,
    createdCount: 0,
    events: [],
    sheets: new Map(),
    dueDates: new Map(),
    cards: [
      card("late", { dueDate: "2026-11-09" }),
      card("stuck", {
        column: "EDGING",
        stageSince: new Date(now - 30 * hour),
      }),
      card("new", {
        column: "NEW",
        dueDate: "2026-11-01",
        stageSince: new Date(now - 90 * hour),
      }),
      card("ready", {
        column: "READY_FOR_PICKUP",
        dueDate: "2026-11-01",
        stageSince: new Date(now - 90 * hour),
      }),
      card("problem", { problemReason: "other" }),
    ],
  });
  assert.deepEqual(
    report.now.overdue.map((c) => c.id),
    ["late"],
  );
  assert.deepEqual(
    report.now.stuck.map((c) => c.id),
    ["stuck"],
  );
  assert.deepEqual(
    report.now.problems.map((c) => c.id),
    ["problem"],
  );
  const cutting = report.now.stages.find((s) => s.key === "CUTTING");
  assert.equal(cutting?.count, 2);
  assert.equal(cutting?.overdue, 1);
  assert.equal(report.now.stages.find((s) => s.key === "NEW")?.overdue, 0);
});

test("день из адреса", () => {
  assert.equal(parseReportDay("2026-11-05", "2026-11-11"), "2026-11-05");
  assert.equal(parseReportDay("2026-12-01", "2026-11-11"), "2026-11-11");
  assert.equal(parseReportDay("2026-02-30", "2026-11-11"), "2026-11-11");
  assert.equal(parseReportDay(undefined, "2026-11-11"), "2026-11-11");
});
