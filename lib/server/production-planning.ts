import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { RequestStatus, RequestType } from "@/generated/prisma";
import { validDate } from "@/features/production/queue";
import { canManageProduction } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { getDb, hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import type { OperationEventDto } from "@/lib/server/operation-events";
import { getRequestInboxItemById } from "@/lib/server/request-inbox";

export type ProductionPlanDto = { dueDate: string | null; version: number };
type DemoPlan = ProductionPlanDto & {
  events: Array<Omit<OperationEventDto, "createdAt"> & { createdAt: string }>;
};
const demoPath = path.join(
  process.cwd(),
  ".artisan-runtime",
  "production-plans.json",
);
let demoWrite: Promise<unknown> = Promise.resolve();

async function readDemoPlans(): Promise<Record<string, DemoPlan>> {
  try {
    return JSON.parse(await readFile(demoPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

export async function productionPlanningAvailable() {
  if (!hasDatabaseUrl()) return isDemoModeEnabled();
  if (process.env.ARTISAN_PRODUCTION_PLANNING !== "true") return false;
  try {
    await getDb().productionPlan.findFirst({ select: { requestId: true } });
    return true;
  } catch (error) {
    console.error("Production planning schema is unavailable", error);
    return false;
  }
}

export async function getProductionPlans(
  ids: string[],
): Promise<Map<string, ProductionPlanDto>> {
  if (!ids.length) return new Map();
  if (!hasDatabaseUrl()) {
    if (!isDemoModeEnabled()) return new Map();
    const plans = await readDemoPlans();
    return new Map(
      ids.flatMap((id) =>
        plans[id]
          ? [
              [
                id,
                { dueDate: plans[id].dueDate, version: plans[id].version },
              ] as const,
            ]
          : [],
      ),
    );
  }
  if (process.env.ARTISAN_PRODUCTION_PLANNING !== "true") return new Map();
  const plans = await getDb().productionPlan.findMany({
    where: { requestId: { in: ids } },
  });
  return new Map(
    plans.map((plan) => [
      plan.requestId,
      {
        dueDate: plan.dueDate?.toISOString().slice(0, 10) ?? null,
        version: plan.version,
      },
    ]),
  );
}

export async function getDemoPlanningEvents(
  id: string,
): Promise<OperationEventDto[]> {
  if (hasDatabaseUrl() || !isDemoModeEnabled()) return [];
  return ((await readDemoPlans())[id]?.events ?? []).map((event) => ({
    ...event,
    createdAt: new Date(event.createdAt),
  }));
}

export async function saveProductionPlan(input: {
  requestId: string;
  dueDate: string;
  expectedVersion: number;
  actor: SessionPayload;
}): Promise<
  "saved" | "forbidden" | "invalid" | "unavailable" | "closed" | "conflict"
> {
  if (!canManageProduction(input.actor.roleCode)) return "forbidden";
  if (
    (input.dueDate && !validDate(input.dueDate)) ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 0
  )
    return "invalid";
  if (!(await productionPlanningAvailable())) return "unavailable";
  const dueDate = input.dueDate || null;
  const actorName =
    [input.actor.firstName, input.actor.lastName].filter(Boolean).join(" ") ||
    input.actor.email;
  const eventData = (previous: string | null) => ({
    entityType: "request" as const,
    entityId: input.requestId,
    eventType: "production_deadline",
    title: "Изменена плановая готовность",
    description: `${previous ?? "Не назначена"} → ${dueDate ?? "Не назначена"}`,
    fromStatus: previous,
    toStatus: dueDate,
    actorId: input.actor.userId,
    actorName,
    isVisibleToClient: false,
  });

  if (!hasDatabaseUrl()) {
    const operation = demoWrite.then(async () => {
      const request = await getRequestInboxItemById(input.requestId);
      if (
        !request ||
        request.type !== RequestType.CUTTING_SERVICE ||
        request.status === RequestStatus.COMPLETED ||
        request.status === RequestStatus.CANCELED
      )
        return "closed" as const;
      const plans = await readDemoPlans();
      const previous = plans[input.requestId];
      if ((previous?.version ?? 0) !== input.expectedVersion)
        return "conflict" as const;
      if ((previous?.dueDate ?? null) === dueDate) return "saved" as const;
      plans[input.requestId] = {
        dueDate,
        version: (previous?.version ?? 0) + 1,
        events: [
          ...(previous?.events ?? []),
          {
            id: randomUUID(),
            ...eventData(previous?.dueDate ?? null),
            createdAt: new Date().toISOString(),
          },
        ],
      };
      await mkdir(path.dirname(demoPath), { recursive: true });
      const temporaryPath = `${demoPath}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(plans, null, 2), "utf8");
      await rename(temporaryPath, demoPath);
      return "saved" as const;
    });
    demoWrite = operation.catch(() => undefined);
    return operation;
  }

  return getDb().$transaction(async (tx) => {
    // Lock the parent even when no plan exists yet, serializing concurrent first saves.
    await tx.$queryRaw`SELECT "id" FROM "Request" WHERE "id" = ${input.requestId} FOR UPDATE`;
    const request = await tx.request.findUnique({
      where: { id: input.requestId },
      select: { type: true, status: true },
    });
    if (
      !request ||
      request.type !== RequestType.CUTTING_SERVICE ||
      request.status === RequestStatus.COMPLETED ||
      request.status === RequestStatus.CANCELED
    )
      return "closed";
    const previous = await tx.productionPlan.findUnique({
      where: { requestId: input.requestId },
    });
    if ((previous?.version ?? 0) !== input.expectedVersion) return "conflict";
    const previousDate = previous?.dueDate?.toISOString().slice(0, 10) ?? null;
    if (previousDate === dueDate) return "saved";
    const data = {
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00Z`) : null,
      version: (previous?.version ?? 0) + 1,
    };
    await tx.productionPlan.upsert({
      where: { requestId: input.requestId },
      create: { requestId: input.requestId, ...data },
      update: data,
    });
    await tx.operationEvent.create({ data: eventData(previousDate) });
    return "saved";
  });
}
