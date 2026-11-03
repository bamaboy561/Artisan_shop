import "server-only";

import { RequestStatus, RequestType } from "@/generated/prisma";
import {
  cuttingProblemReasons,
  emptyCuttingWorkflow,
  isUrgentByText,
  type CuttingProblemReason,
  type CuttingWorkflowDto,
} from "@/features/production/workflow-flags";
import { canManageProduction, canAccessProduction } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { logOperationEvent } from "@/lib/server/operation-events";

type SchemaDb = Pick<ReturnType<typeof getDb>, "$executeRawUnsafe">;

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

// На продакшене prisma db push не запускается, поэтому таблицы
// «срочно/проблема» и плана готовности создаём сами при первом обращении.
export async function ensureCuttingWorkflowTables(db: SchemaDb = getDb()) {
  if (schemaReady) return;
  schemaPromise ??= createTables(db)
    // Параллельный CREATE ... IF NOT EXISTS из другого экземпляра может
    // упасть на гонке в каталоге Postgres; повтор видит готовую таблицу.
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
    CREATE TABLE IF NOT EXISTS "CuttingWorkflow" (
      "requestId" TEXT PRIMARY KEY REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "isUrgent" BOOLEAN NOT NULL DEFAULT false,
      "problemReason" TEXT,
      "problemNote" TEXT,
      "problemAt" TIMESTAMP(3),
      "problemById" TEXT,
      "problemByName" TEXT,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "CuttingWorkflow_isUrgent_idx" ON "CuttingWorkflow"("isUrgent")`,
  );
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductionPlan" (
      "requestId" TEXT PRIMARY KEY REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "dueDate" DATE,
      "version" INTEGER NOT NULL DEFAULT 1,
      "updatedAt" TIMESTAMP(3) NOT NULL
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductionPlan_dueDate_idx" ON "ProductionPlan"("dueDate")`,
  );
}

let lastLegacySync = 0;

// Старые и клиентские заявки помечают срочность текстом «Приоритет: срочно».
// Переносим это во флажок один раз: если строка уже есть (менеджер снял
// срочность), её не трогаем.
async function syncLegacyUrgency() {
  if (Date.now() - lastLegacySync < 30_000) return;
  lastLegacySync = Date.now();
  await getDb().$executeRawUnsafe(`
    INSERT INTO "CuttingWorkflow" ("requestId", "isUrgent", "updatedAt")
    SELECT r."id", true, CURRENT_TIMESTAMP
    FROM "Request" r
    WHERE r."type" = 'CUTTING_SERVICE'
      AND r."status" NOT IN ('COMPLETED', 'CANCELED')
      AND regexp_replace(
            coalesce(r."subject", '') || ' ' || coalesce(r."message", ''),
            'Приоритет:\\s*стандарт', '', 'gi'
          ) ~* 'срочно'
    ON CONFLICT ("requestId") DO NOTHING
  `);
}

// true, когда таблица готова и по ней можно фильтровать и сортировать.
export async function prepareCuttingWorkflow() {
  if (!hasDatabaseUrl()) return false;
  try {
    await ensureCuttingWorkflowTables();
    await syncLegacyUrgency();
    return true;
  } catch (error) {
    console.error("[cutting-workflow] schema unavailable", error);
    return false;
  }
}

export async function getCuttingWorkflows(
  ids: string[],
): Promise<Map<string, CuttingWorkflowDto>> {
  if (!ids.length || !(await prepareCuttingWorkflow())) return new Map();
  const rows = await getDb().cuttingWorkflow.findMany({
    where: { requestId: { in: ids } },
  });
  return new Map(
    rows.map((row) => [
      row.requestId,
      {
        isUrgent: row.isUrgent,
        problemReason: row.problemReason,
        problemNote: row.problemNote,
        problemAt: row.problemAt,
        problemByName: row.problemByName,
      },
    ]),
  );
}

export async function getCuttingWorkflow(id: string) {
  return (await getCuttingWorkflows([id])).get(id) ?? emptyCuttingWorkflow;
}

function actorName(actor: SessionPayload) {
  return (
    [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email
  );
}

async function loadOpenCuttingRequest(requestId: string) {
  const request = await getDb().request.findUnique({
    where: { id: requestId },
    select: { type: true, status: true, subject: true, message: true },
  });
  return request &&
    request.type === RequestType.CUTTING_SERVICE &&
    request.status !== RequestStatus.COMPLETED &&
    request.status !== RequestStatus.CANCELED
    ? request
    : null;
}

export type WorkflowResult = "saved" | "forbidden" | "closed" | "unavailable";

export async function setCuttingUrgent(input: {
  requestId: string;
  urgent: boolean;
  actor: SessionPayload;
}): Promise<WorkflowResult> {
  if (!canManageProduction(input.actor.roleCode)) return "forbidden";
  if (!(await prepareCuttingWorkflow())) return "unavailable";
  if (!(await loadOpenCuttingRequest(input.requestId))) return "closed";
  await getDb().cuttingWorkflow.upsert({
    where: { requestId: input.requestId },
    create: { requestId: input.requestId, isUrgent: input.urgent },
    update: { isUrgent: input.urgent },
  });
  await logOperationEvent({
    entityType: "request",
    entityId: input.requestId,
    eventType: "production_flag",
    title: input.urgent ? "Отмечено «Срочно»" : "Снята отметка «Срочно»",
    actor: input.actor,
  });
  return "saved";
}

export async function reportCuttingProblem(input: {
  requestId: string;
  reason: CuttingProblemReason;
  note: string | null;
  actor: SessionPayload;
}): Promise<WorkflowResult> {
  if (!canAccessProduction(input.actor.roleCode)) return "forbidden";
  if (!(await prepareCuttingWorkflow())) return "unavailable";
  const request = await loadOpenCuttingRequest(input.requestId);
  if (!request) return "closed";
  const data = {
    problemReason: input.reason,
    problemNote: input.note?.slice(0, 1000) || null,
    problemAt: new Date(),
    problemById: input.actor.userId,
    problemByName: actorName(input.actor),
  };
  await getDb().cuttingWorkflow.upsert({
    where: { requestId: input.requestId },
    // Новая строка не должна терять срочность из текста заявки.
    create: {
      requestId: input.requestId,
      isUrgent: isUrgentByText(request.subject, request.message),
      ...data,
    },
    update: data,
  });
  await logOperationEvent({
    entityType: "request",
    entityId: input.requestId,
    eventType: "production_flag",
    title: `Проблема: ${cuttingProblemReasons[input.reason]}`,
    description: data.problemNote,
    actor: input.actor,
  });
  return "saved";
}

export async function resolveCuttingProblem(input: {
  requestId: string;
  actor: SessionPayload;
}): Promise<WorkflowResult> {
  if (!canAccessProduction(input.actor.roleCode)) return "forbidden";
  if (!(await prepareCuttingWorkflow())) return "unavailable";
  const existing = await getDb().cuttingWorkflow.findUnique({
    where: { requestId: input.requestId },
  });
  if (!existing?.problemReason) return "saved";
  await getDb().cuttingWorkflow.update({
    where: { requestId: input.requestId },
    data: {
      problemReason: null,
      problemNote: null,
      problemAt: null,
      problemById: null,
      problemByName: null,
    },
  });
  await logOperationEvent({
    entityType: "request",
    entityId: input.requestId,
    eventType: "production_flag",
    title: "Проблема решена",
    description: cuttingProblemReasons[
      existing.problemReason as CuttingProblemReason
    ]
      ? `Была: ${cuttingProblemReasons[existing.problemReason as CuttingProblemReason]}`
      : null,
    actor: input.actor,
  });
  return "saved";
}
