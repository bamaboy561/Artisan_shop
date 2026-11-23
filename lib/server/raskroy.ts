import "server-only";

import { RequestStatus, RequestType } from "@/generated/prisma";
import { getDb } from "@/lib/db";
import { gibLabOrderFileName } from "@/features/production/giblab-orders";
import { buildContent } from "@/lib/server/giblab-orders";
import { applyRequestCuttingDetails } from "@/lib/server/request-inbox";

// Программа раскроя цеха (/raskroy): заявки на распил открываются в ней
// как проекты, а сохранённый проект и итог раскроя (листы, кромка)
// возвращаются в заявку. Стадию заявки программа не меняет: стадии ведут
// операторы через смены, там же уходят уведомления клиенту.

let tableReady = false;

async function prepare() {
  if (tableReady) return;
  const db = getDb();
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RaskroyProject" (
      "requestId" TEXT NOT NULL,
      "data" TEXT NOT NULL,
      "sheets" INTEGER,
      "edgeMeters" DOUBLE PRECISION,
      "total" INTEGER,
      "savedById" TEXT,
      "savedByName" TEXT,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RaskroyProject_pkey" PRIMARY KEY ("requestId")
    )
  `);
  // Версия проекта: каждое сохранение +1. Сохранение принимается, только если
  // программа правила ту версию, что сейчас в базе, иначе — конфликт.
  await db.$executeRawUnsafe(
    `ALTER TABLE "RaskroyProject" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0`,
  );
  tableReady = true;
}

const days = 120;

export type RaskroyOrder = {
  id: string;
  number: string | null;
  status: RequestStatus;
  stage: string | null;
  client: string;
  material: string;
  createdAt: string;
  dueDate: string | null;
  sheets: number | null;
  edgeMeters: number | null;
  savedAt: string | null;
};

/** Заявки на распил за последние месяцы, кроме отменённых, новые сверху. */
export async function listRaskroyOrders(): Promise<RaskroyOrder[]> {
  await prepare();
  const db = getDb();
  const since = new Date(Date.now() - days * 86_400_000);
  const requests = await db.request.findMany({
    where: {
      type: RequestType.CUTTING_SERVICE,
      status: { not: RequestStatus.CANCELED },
      OR: [
        { createdAt: { gte: since } },
        { status: { notIn: [RequestStatus.COMPLETED, RequestStatus.CANCELED] } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      number: true,
      status: true,
      cuttingStage: true,
      contactName: true,
      material: true,
      subject: true,
      createdAt: true,
      cuttingSheetCount: true,
      cuttingEdgeMeters: true,
      productionPlan: { select: { dueDate: true } },
    },
  });
  const saved = requests.length
    ? await db.$queryRawUnsafe<Array<{ requestId: string; updatedAt: Date }>>(
        `SELECT "requestId", "updatedAt" FROM "RaskroyProject" WHERE "requestId" = ANY($1)`,
        requests.map((r) => r.id),
      )
    : [];
  const savedAt = new Map(saved.map((s) => [s.requestId, s.updatedAt]));
  return requests.map((r) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    stage: r.cuttingStage,
    client: r.contactName,
    material: r.material || r.subject,
    createdAt: r.createdAt.toISOString(),
    dueDate: r.productionPlan?.dueDate?.toISOString().slice(0, 10) ?? null,
    sheets: r.cuttingSheetCount,
    edgeMeters: r.cuttingEdgeMeters,
    savedAt: savedAt.get(r.id)?.toISOString() ?? null,
  }));
}

/** Одна заявка: сохранённый проект программы, а если его нет — файл .project
 *  из Базиса или калькулятора сайта (тот же, что уходит в GibLab), в base64. */
export async function getRaskroyOrder(id: string) {
  await prepare();
  const db = getDb();
  const r = await db.request.findFirst({
    where: { id, type: RequestType.CUTTING_SERVICE },
    select: {
      id: true,
      number: true,
      contactName: true,
      contactPhone: true,
      material: true,
      subject: true,
      productionComment: true,
      createdAt: true,
      productionPlan: { select: { dueDate: true } },
      files: { select: { fileName: true, fileUrl: true, createdAt: true } },
    },
  });
  if (!r) return null;
  const rows = await db.$queryRawUnsafe<
    Array<{ data: string; updatedAt: Date; version: number; savedByName: string | null }>
  >(
    `SELECT "data", "updatedAt", "version", "savedByName" FROM "RaskroyProject" WHERE "requestId" = $1`,
    id,
  );
  const meta = {
    id: r.id,
    number: r.number,
    client: r.contactName,
    material: r.material || r.subject,
    note: r.productionComment ?? "",
    createdAt: r.createdAt.toISOString(),
    dueDate: r.productionPlan?.dueDate?.toISOString().slice(0, 10) ?? null,
  };
  if (rows[0]) {
    let project: unknown = null;
    try {
      project = JSON.parse(rows[0].data);
    } catch {
      project = null;
    }
    if (project)
      return {
        ...meta,
        project,
        savedAt: rows[0].updatedAt.toISOString(),
        version: rows[0].version,
        savedBy: rows[0].savedByName,
      };
  }
  const name = gibLabOrderFileName({
    number: r.number,
    id: r.id,
    contactName: r.contactName,
    contactPhone: r.contactPhone,
  }).replace(/\.project$/i, "");
  const { bytes, source } = await buildContent(
    name,
    r.files,
    `artisan.shop.kg ${r.number ?? ""}: ${r.material || r.subject}`,
  );
  return { ...meta, projectFile: bytes.toString("base64"), source, version: null };
}

export type RaskroySave = {
  project: unknown;
  // Версия, с которой программа начала правку: null — проект в базе ещё не сохраняли.
  baseVersion: number | null;
  sheets: number | null;
  edgeMeters: number | null;
  total: number | null;
};

const maxBytes = 5_000_000;

export function parseRaskroySave(body: unknown): RaskroySave | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!b.project || typeof b.project !== "object") return null;
  const num = (v: unknown, max: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null;
  const base = b.baseVersion;
  if (base != null && !(Number.isInteger(base) && (base as number) >= 0)) return null;
  return {
    project: b.project,
    baseVersion: base == null ? null : (base as number),
    sheets: num(b.sheets, 10_000) == null ? null : Math.round(b.sheets as number),
    edgeMeters: num(b.edgeMeters, 100_000),
    total: num(b.total, 1_000_000_000) == null ? null : Math.round(b.total as number),
  };
}

export type RaskroySaveResult =
  | { status: "ok"; version: number; savedAt: string }
  | { status: "conflict"; version: number; savedAt: string; savedBy: string | null }
  | { status: "missing" }
  | { status: "too_large" };

/** Сохраняет проект программы и итоги раскроя в заявку одной транзакцией.
 *  Проверка версии: если после открытия заявки её уже сохранил кто-то другой
 *  (версия в базе не та, с которой начали), ничего не пишем и возвращаем конфликт. */
export async function saveRaskroyOrder(
  id: string,
  input: RaskroySave,
  actor: { userId: string; name: string },
): Promise<RaskroySaveResult> {
  await prepare();
  const data = JSON.stringify(input.project);
  if (Buffer.byteLength(data) > maxBytes) return { status: "too_large" };
  const db = getDb();
  return db.$transaction(
    async (tx) => {
      const exists = await tx.request.findFirst({
        where: { id, type: RequestType.CUTTING_SERVICE },
        select: {
          id: true,
          material: true,
          edgeOption: true,
          cuttingSheetCount: true,
          cuttingEdgeMeters: true,
        },
      });
      if (!exists) return { status: "missing" as const };
      // Сравнение и запись одним запросом: строка обновится, только если версия совпала.
      const saved = await tx.$queryRawUnsafe<Array<{ version: number; updatedAt: Date }>>(
        `INSERT INTO "RaskroyProject" ("requestId", "data", "sheets", "edgeMeters", "total", "savedById", "savedByName", "updatedAt", "version")
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, 1)
         ON CONFLICT ("requestId") DO UPDATE SET "data" = EXCLUDED."data", "sheets" = EXCLUDED."sheets",
           "edgeMeters" = EXCLUDED."edgeMeters", "total" = EXCLUDED."total", "savedById" = EXCLUDED."savedById",
           "savedByName" = EXCLUDED."savedByName", "updatedAt" = CURRENT_TIMESTAMP,
           "version" = "RaskroyProject"."version" + 1
         WHERE "RaskroyProject"."version" = $8
         RETURNING "version", "updatedAt"`,
        id,
        data,
        input.sheets,
        input.edgeMeters,
        input.total,
        actor.userId,
        actor.name,
        input.baseVersion,
      );
      if (!saved[0]) {
        const cur = await tx.$queryRawUnsafe<
          Array<{ version: number; updatedAt: Date; savedByName: string | null }>
        >(
          `SELECT "version", "updatedAt", "savedByName" FROM "RaskroyProject" WHERE "requestId" = $1`,
          id,
        );
        return {
          status: "conflict" as const,
          version: cur[0]?.version ?? 0,
          savedAt: (cur[0]?.updatedAt ?? new Date()).toISOString(),
          savedBy: cur[0]?.savedByName ?? null,
        };
      }
      // Количества пишем тем же путём, что и форма заявки: если у заявки
      // зафиксированы цены распила, сумма расчёта пересчитается по ним.
      const sheets = input.sheets ?? exists.cuttingSheetCount;
      const edgeMeters =
        input.edgeMeters != null
          ? Math.round(input.edgeMeters * 10) / 10
          : exists.cuttingEdgeMeters;
      if (sheets !== exists.cuttingSheetCount || edgeMeters !== exists.cuttingEdgeMeters) {
        await applyRequestCuttingDetails(tx, {
          id,
          material: exists.material ?? "",
          cuttingSheetCount: sheets,
          cuttingEdgeMeters: edgeMeters,
          edgeOption: exists.edgeOption,
        });
      }
      return {
        status: "ok" as const,
        version: saved[0].version,
        savedAt: saved[0].updatedAt.toISOString(),
      };
    },
    { isolationLevel: "Serializable" },
  );
}
