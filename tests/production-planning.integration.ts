import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  RoleCode,
  RequestStatus,
  RequestType,
  CuttingStage,
} from "../generated/prisma";
import { parseProductionFilters } from "../features/production/queue";

test("production planning and queue integration in isolated demo storage", async (t) => {
  const original = process.cwd();
  const directory = await mkdtemp(
    path.join(tmpdir(), "artisan-production-test-"),
  );
  process.env.ARTISAN_DEMO_MODE = "true";
  process.env.DATABASE_URL = "";
  process.chdir(directory);
  try {
    await mkdir(path.join(directory, ".artisan-runtime"));
    const requests = Array.from({ length: 126 }, (_, i) => ({
      id: `qa-${String(i).padStart(3, "0")}`,
      number: `QA-${i}`,
      type: RequestType.CUTTING_SERVICE,
      status: RequestStatus.IN_PROGRESS,
      subject: "Test sheet",
      material: "МДФ 18 мм",
      contactName: "Тест Иванова",
      contactPhone: "000000",
      contactEmail: null,
      cuttingStage: i % 3 ? CuttingStage.CUTTING : CuttingStage.EDGING,
      createdAt: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(),
      updatedAt: "2026-09-01T00:00:00Z",
      files: [],
    }));
    await writeFile(
      path.join(directory, ".artisan-runtime", "requests.json"),
      JSON.stringify(requests),
    );
    const {
      saveProductionPlan,
      getProductionPlans,
      getDemoPlanningEvents,
      productionPlanningAvailable,
    } = await import("../lib/server/production-planning");
    const { getProductionQueue } =
      await import("../lib/server/production-workspace");
    const actor = {
      userId: "qa-manager",
      roleCode: RoleCode.PRODUCTION_MANAGER,
      email: "qa@example.invalid",
    };
    const input = {
      requestId: "qa-001",
      dueDate: "2026-10-01",
      expectedVersion: 0,
      actor,
    };
    await t.test("manager saves, persists and logs a deadline", async () => {
      assert.equal(await saveProductionPlan(input), "saved");
      assert.deepEqual(
        (await getProductionPlans([input.requestId])).get(input.requestId),
        { dueDate: "2026-10-01", version: 1 },
      );
      const [event] = await getDemoPlanningEvents(input.requestId);
      assert.equal(event.actorId, actor.userId);
      assert.equal(event.toStatus, "2026-10-01");
      assert.equal(event.isVisibleToClient, false);
    });
    await t.test(
      "concurrent stale edits are rejected, same value is idempotent and clearing is logged",
      async () => {
        const results = await Promise.all([
          saveProductionPlan({
            ...input,
            expectedVersion: 1,
            dueDate: "2026-10-02",
          }),
          saveProductionPlan({
            ...input,
            expectedVersion: 1,
            dueDate: "2026-10-03",
          }),
        ]);
        assert.deepEqual(results, ["saved", "conflict"]);
        assert.equal(
          await saveProductionPlan({
            ...input,
            expectedVersion: 2,
            dueDate: "2026-10-02",
          }),
          "saved",
        );
        assert.equal((await getDemoPlanningEvents(input.requestId)).length, 2);
        assert.equal(
          await saveProductionPlan({
            ...input,
            expectedVersion: 2,
            dueDate: "",
          }),
          "saved",
        );
        assert.equal(
          (await getProductionPlans([input.requestId])).get(input.requestId)
            ?.dueDate,
          null,
        );
      },
    );
    await t.test(
      "operators, invalid dates, missing and closed requests cannot write",
      async () => {
        assert.equal(
          await saveProductionPlan({
            ...input,
            actor: { ...actor, roleCode: RoleCode.PRODUCTION_OPERATOR },
          }),
          "forbidden",
        );
        assert.equal(
          await saveProductionPlan({ ...input, dueDate: "2026-02-31" }),
          "invalid",
        );
        assert.equal(
          await saveProductionPlan({ ...input, expectedVersion: -1 }),
          "invalid",
        );
        assert.equal(
          await saveProductionPlan({ ...input, requestId: "missing" }),
          "closed",
        );
        requests[0].status =
          RequestStatus.COMPLETED as (typeof requests)[0]["status"];
        await writeFile(
          path.join(directory, ".artisan-runtime", "requests.json"),
          JSON.stringify(requests),
        );
        assert.equal(
          await saveProductionPlan({ ...input, requestId: "qa-000" }),
          "closed",
        );
      },
    );
    await t.test(
      "queue paginates beyond 100, filters by client and dates, and sorts deterministically",
      async () => {
        const page = await getProductionQueue(
          parseProductionFilters({ page: "5" }),
        );
        assert.equal(page.total, 125);
        assert.equal(page.items.length, 25);
        assert.equal(page.items[0].id, "qa-101");
        const filtered = await getProductionQueue(
          parseProductionFilters({
            q: "Иванова",
            from: "2026-09-01",
            to: "2026-09-01",
            station: "EDGING",
          }),
        );
        assert.equal(filtered.total, 41);
        assert.ok(
          filtered.items.every(
            (item) => item.cuttingStage === CuttingStage.EDGING,
          ),
        );
        const empty = await getProductionQueue(
          parseProductionFilters({ q: "Not a customer" }),
        );
        assert.equal(empty.total, 0);
        const sorted = await getProductionQueue(
          parseProductionFilters({ sort: "created-desc" }),
        );
        assert.equal(sorted.items[0].id, "qa-125");
        await saveProductionPlan({
          ...input,
          requestId: "qa-125",
          dueDate: "2026-01-01",
        });
        const overdue = await getProductionQueue(
          parseProductionFilters({ due: "overdue" }),
        );
        assert.equal(overdue.total, 1);
        assert.equal(overdue.items[0].id, "qa-125");
        const dueSorted = await getProductionQueue(
          parseProductionFilters({ sort: "due-asc" }),
        );
        assert.equal(dueSorted.items[0].id, "qa-125");
      },
    );
    await t.test(
      "disabled planning never touches the configured database",
      async () => {
        process.env.ARTISAN_DEMO_MODE = "false";
        process.env.DATABASE_URL =
          "postgresql://invalid:invalid@127.0.0.1:1/invalid";
        delete process.env.ARTISAN_PRODUCTION_PLANNING;
        assert.equal(await productionPlanningAvailable(), false);
        assert.equal((await getProductionPlans(["qa-001"])).size, 0);
        assert.equal(await saveProductionPlan(input), "unavailable");
      },
    );
  } finally {
    process.chdir(original);
  }
});
