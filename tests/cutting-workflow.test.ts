import assert from "node:assert/strict";
import test from "node:test";
import { CuttingStage, RoleCode } from "../generated/prisma";
import {
  parseProductionFilters,
  productionQueueUrl,
  safeProductionReturn,
} from "../features/production/queue";
import {
  daysUntil,
  deadlineTone,
  formatDuration,
  isUrgentByText,
  parseCuttingProblemReason,
} from "../features/production/workflow-flags";
import { buildStageJournal } from "../features/production/stage-journal";
import { canAccessAdminPath } from "../lib/auth/roles";

test("queue defaults to priority order and keeps the flag filter in the url", () => {
  const filters = parseProductionFilters({});
  assert.equal(filters.sort, "priority");
  assert.equal(filters.flag, "all");
  assert.equal(productionQueueUrl(filters), "/admin/production");
  const urgent = parseProductionFilters({ flag: "urgent", sort: "bogus" });
  assert.equal(urgent.sort, "priority");
  assert.equal(productionQueueUrl(urgent), "/admin/production?flag=urgent");
  assert.equal(parseProductionFilters({ flag: "x" }).flag, "all");
  assert.equal(
    productionQueueUrl(parseProductionFilters({ sort: "created-asc" })),
    "/admin/production?sort=created-asc",
  );
});

test("board is a safe return target, other paths are not", () => {
  assert.equal(
    safeProductionReturn("/admin/production/board"),
    "/admin/production/board",
  );
  assert.equal(
    safeProductionReturn("/admin/production/board/../x"),
    "/admin/production",
  );
  assert.equal(safeProductionReturn("https://evil.test"), "/admin/production");
});

test("only production managers open the board", () => {
  const path = "/admin/production/board";
  assert.equal(canAccessAdminPath(RoleCode.PRODUCTION_OPERATOR, path), false);
  assert.equal(canAccessAdminPath(RoleCode.PRODUCTION_MANAGER, path), true);
  assert.equal(canAccessAdminPath(RoleCode.MANAGER, path), true);
  assert.equal(
    canAccessAdminPath(RoleCode.PRODUCTION_OPERATOR, "/admin/production"),
    true,
  );
});

test("urgency from legacy request text ignores the standard priority", () => {
  assert.equal(isUrgentByText("Распил", "Приоритет: срочно"), true);
  assert.equal(isUrgentByText("Распил", "Приоритет: стандарт"), false);
  assert.equal(isUrgentByText("СРОЧНО распил", null), true);
});

test("deadline tones: overdue, today, tomorrow, later, ready", () => {
  const today = "2026-11-03";
  assert.equal(daysUntil("2026-11-01", today), -2);
  assert.equal(deadlineTone("2026-11-01", today, false), "overdue");
  assert.equal(deadlineTone("2026-11-03", today, false), "today");
  assert.equal(deadlineTone("2026-11-04", today, false), "soon");
  assert.equal(deadlineTone("2026-11-10", today, false), "later");
  assert.equal(deadlineTone("2026-11-01", today, true), "none");
  assert.equal(deadlineTone(null, today, false), "none");
});

test("problem reasons are a closed list", () => {
  assert.equal(parseCuttingProblemReason("no-material"), "no-material");
  assert.equal(parseCuttingProblemReason("toString"), null);
  assert.equal(parseCuttingProblemReason(""), null);
});

test("stage journal shows who moved each stage and how long it took", () => {
  const at = (iso: string) => new Date(iso);
  const rows = buildStageJournal(
    [
      {
        eventType: "cutting_stage",
        fromStatus: CuttingStage.CUTTING,
        toStatus: CuttingStage.EDGING,
        actorName: "Кромка",
        createdAt: at("2026-11-03T06:30:00Z"),
      },
      {
        eventType: "cutting_stage",
        fromStatus: null,
        toStatus: CuttingStage.CUTTING,
        actorName: "Пильщик",
        createdAt: at("2026-11-03T05:00:00Z"),
      },
      {
        eventType: "cutting_stage",
        fromStatus: null,
        toStatus: null,
        actorName: "Комментарий",
        createdAt: at("2026-11-03T05:10:00Z"),
      },
      {
        eventType: "production_flag",
        fromStatus: null,
        toStatus: null,
        actorName: "x",
        createdAt: at("2026-11-03T05:20:00Z"),
      },
    ],
    at("2026-11-03T07:00:00Z"),
  );
  assert.deepEqual(
    rows.map((row) => [row.stage, row.actorName, row.durationMs, row.running]),
    [
      [CuttingStage.CUTTING, "Пильщик", 90 * 60_000, false],
      [CuttingStage.EDGING, "Кромка", 30 * 60_000, true],
    ],
  );
  assert.equal(formatDuration(90 * 60_000), "1 ч 30 мин");
  assert.equal(formatDuration(26 * 3_600_000), "1 д 2 ч");
});
