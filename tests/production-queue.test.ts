import assert from "node:assert/strict";
import test from "node:test";
import { CuttingStage, ProductionStation, RoleCode } from "../generated/prisma";
import {
  getProductionPage,
  isProductionOverdue,
  parseProductionFilters,
  productionDateBounds,
  productionDateKey,
  productionQueueUrl,
  productionScopeForStage,
  safeProductionReturn,
  validDate,
} from "../features/production/queue";
import { canManageProduction } from "../lib/auth/roles";
import { getProductionTransition } from "../features/production/workflow";

test("dates reject impossible days and normalize a reversed range", () => {
  assert.equal(validDate("2026-02-29"), "");
  assert.equal(validDate("2028-02-29"), "2028-02-29");
  assert.equal(validDate("2026-09-31"), "");
  assert.equal(validDate("9999-01-01"), "");
  const f = parseProductionFilters({
    from: "2026-10-02",
    to: "2026-09-01",
    q: [" Клиент ", "ignored"],
    page: "-7",
  });
  assert.equal(f.from, "2026-09-01");
  assert.equal(f.to, "2026-10-02");
  assert.equal(f.page, 1);
  assert.equal(f.q, "Клиент");
});
test("date filters use inclusive local dates and an exclusive end in Bishkek", () => {
  const bounds = productionDateBounds("2026-09-29", "2026-09-29");
  assert.equal(bounds.gte?.toISOString(), "2026-09-28T18:00:00.000Z");
  assert.equal(bounds.lt?.toISOString(), "2026-09-29T18:00:00.000Z");
  assert.equal(
    productionDateKey(new Date("2026-09-28T18:00:00Z")),
    "2026-09-29",
  );
});
test("operator station cannot be overridden by URL filters", () => {
  for (const station of ["all", "DRILLING", "READY_FOR_PICKUP", "invalid"])
    assert.equal(
      parseProductionFilters({ station }, ProductionStation.CUTTING).station,
      "CUTTING",
    );
  assert.equal(
    parseProductionFilters({ station: "READY_FOR_PICKUP" }).station,
    "READY_FOR_PICKUP",
  );
  assert.equal(productionScopeForStage(null), "CUTTING");
});
test("pagination exposes requests beyond 100 and bounds stale URLs", () => {
  assert.deepEqual(getProductionPage(126, 5), { page: 5, pages: 6, skip: 100 });
  assert.deepEqual(getProductionPage(26, 100), { page: 2, pages: 2, skip: 25 });
  assert.deepEqual(getProductionPage(0, 100), { page: 1, pages: 1, skip: 0 });
});
test("queue links preserve filters but strip arbitrary redirect targets", () => {
  const f = parseProductionFilters({
    q: "Иванов МДФ",
    station: "EDGING",
    from: "2026-09-01",
    to: "2026-09-29",
    due: "overdue",
    sort: "due-asc",
    page: "3",
  });
  const url = productionQueueUrl(f);
  assert.equal(safeProductionReturn(url), url);
  assert.deepEqual(
    parseProductionFilters(
      Object.fromEntries(new URL(url, "https://test.local").searchParams),
    ),
    f,
  );
  assert.equal(safeProductionReturn("//evil.test"), "/admin/production");
  assert.equal(
    safeProductionReturn("/admin/production/other"),
    "/admin/production",
  );
  assert.equal(
    safeProductionReturn("/admin/production?next=https://evil.test"),
    "/admin/production",
  );
});
test("ready orders are not overdue; unfinished yesterday is overdue, today is not", () => {
  assert.equal(
    isProductionOverdue(
      "2026-09-28",
      CuttingStage.READY_FOR_PICKUP,
      "2026-09-29",
    ),
    false,
  );
  assert.equal(isProductionOverdue("2026-09-28", null, "2026-09-29"), true);
  assert.equal(
    isProductionOverdue("2026-09-29", CuttingStage.EDGING, "2026-09-29"),
    false,
  );
  assert.equal(isProductionOverdue(null, null, "2026-09-29"), false);
});
test("planning stays manager-only and existing station transitions remain unchanged", () => {
  assert.equal(canManageProduction(RoleCode.PRODUCTION_OPERATOR), false);
  assert.equal(canManageProduction(RoleCode.CUSTOMER), false);
  assert.equal(canManageProduction(RoleCode.CUTTING_MANAGER), true);
  assert.equal(canManageProduction(RoleCode.PRODUCTION_MANAGER), true);
  assert.equal(
    getProductionTransition(ProductionStation.EDGING, CuttingStage.CUTTING),
    null,
  );
  assert.equal(
    getProductionTransition(ProductionStation.CUTTING, null)?.to,
    CuttingStage.CUTTING,
  );
  assert.equal(
    getProductionTransition(ProductionStation.DRILLING, CuttingStage.DRILLING)
      ?.requiresPickupCell,
    true,
  );
});
