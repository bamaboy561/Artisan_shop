import "server-only";

import {
  emptyGibLabProject,
  gibLabOrderFileName,
  gibLabOrderFolder,
  isGibLabProjectFile,
  normalizeGibLabOrderSettings,
  parseGibLabOrderSettings,
  type GibLabOrderSettings,
} from "@/features/production/giblab-orders";
import { CuttingStage, RequestStatus, RequestType } from "@/generated/prisma";
import { canManageProduction } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { readBazisGibLabSource } from "@/lib/bazis-b3d";
import {
  describeGibLabCheck,
  exportBazisToGibLabChecked,
} from "@/lib/server/bazis-giblab-export";
import {
  prepareMachineFolders,
  readSetting,
  writeSetting,
} from "@/lib/server/machine-folders";
import { logOperationEvent } from "@/lib/server/operation-events";
import { sendStaffNotice } from "@/lib/server/commercial-integrations";
import { absoluteUrl } from "@/lib/seo";
import { readRequestFileBytes } from "@/lib/server/request-file-content";

const settingsKey = "gibLabOrders";
const maxAttempts = 5;

let tableReady = false;

async function createTable() {
  const db = getDb();
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductionGibLabOrder" (
      "requestId" TEXT NOT NULL,
      "root" TEXT,
      "folder" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "source" TEXT,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "error" TEXT,
      "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "writtenAt" TIMESTAMP(3),
      CONSTRAINT "ProductionGibLabOrder_pkey" PRIMARY KEY ("requestId")
    )
  `);
  await db.$executeRawUnsafe(
    `ALTER TABLE "ProductionGibLabOrder" ADD COLUMN IF NOT EXISTS "root" TEXT`,
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductionGibLabOrder_queuedAt_idx" ON "ProductionGibLabOrder"("queuedAt")`,
  );
}

async function prepare() {
  if (!(await prepareMachineFolders())) return false;
  if (!tableReady) {
    await createTable().catch(() => createTable());
    tableReady = true;
  }
  return true;
}

export async function getGibLabOrderSettings(): Promise<GibLabOrderSettings> {
  if (!(await prepare())) return parseGibLabOrderSettings(null);
  const raw = await readSetting(settingsKey);
  const settings = parseGibLabOrderSettings(raw);
  // Первое включение: выгружаем только то, что пойдёт в работу с этого
  // момента, а не все старые заявки разом.
  if (settings.enabled && !settings.since) {
    const next = { ...settings, since: new Date().toISOString() };
    await writeSetting(settingsKey, JSON.stringify(next));
    return next;
  }
  return settings;
}

export async function saveGibLabOrderSettings(
  actor: SessionPayload,
  input: Record<string, unknown>,
) {
  if (!canManageProduction(actor.roleCode)) return "forbidden" as const;
  if (!(await prepare())) return "unavailable" as const;
  const previous = parseGibLabOrderSettings(await readSetting(settingsKey));
  const next = normalizeGibLabOrderSettings(input);
  next.since =
    next.enabled && previous.enabled && previous.since
      ? previous.since
      : next.enabled
        ? new Date().toISOString()
        : null;
  await writeSetting(settingsKey, JSON.stringify(next));
  return "saved" as const;
}

export type RequestFileRef = { fileName: string; fileUrl: string; createdAt: Date };

// Что положить в файл. Первым идёт проект Базиса: в нём точная присадка
// и все материалы. Калькулятор сайта считает один материал за раз, а
// отверстия Базиса знает только числом, поэтому его проект берём, только
// когда Базиса в заявке нет. Все файлы Базиса заявки собираются в один
// проект GibLab, чтобы ни одна деталь не потерялась. Затем пустой проект.
export async function buildContent(
  name: string,
  files: RequestFileRef[],
  comment: string,
): Promise<{ bytes: Buffer; source: string }> {
  const sorted = [...files].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const bazisFiles = sorted.filter((f) => /\.b3d$/i.test(f.fileName)).reverse();
  const bazis: Array<{ name: string; bytes: Buffer }> = [];
  for (const file of bazisFiles) {
    const bytes = await readRequestFileBytes(file.fileUrl);
    if (!bytes) continue;
    try {
      readBazisGibLabSource(bytes);
      bazis.push({ name: file.fileName, bytes });
    } catch {
      // Не прочитался — остальные файлы всё равно уйдут.
    }
  }
  if (bazis.length > 0) {
    const { bytes, check } = exportBazisToGibLabChecked(
      bazis.map((item) => item.bytes),
    );
    return {
      bytes,
      source: `Базис ${bazis.map((item) => item.name).join(", ")}: ${describeGibLabCheck(check)}`,
    };
  }
  const project = sorted.find((f) => isGibLabProjectFile(f.fileName));
  if (project) {
    const bytes = await readRequestFileBytes(project.fileUrl);
    if (bytes) return { bytes, source: `файл ${project.fileName}` };
  }
  return {
    bytes: Buffer.from(emptyGibLabProject(name, comment), "utf8"),
    source: "пустой проект",
  };
}

// Имена в base64: Windows PowerShell 5 без charset читает ответ как
// latin-1, и кириллица («Ноябрь», «Алишер») ломалась бы.
export type PendingGibLabOrder = {
  requestId: string;
  root64: string;
  folder64: string;
  fileName64: string;
  content: string;
};

const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64");

export type WatchedGibLabOrder = {
  requestId: string;
  root64: string;
  folder64: string;
  fileName64: string;
};

// Уже положенные файлы открытых заявок, которые ещё не в работе: если
// оператор удалил файл в GibLab, заявку отменяем (клиент передумал).
export async function getWatchedGibLabOrders(): Promise<WatchedGibLabOrder[]> {
  const settings = await getGibLabOrderSettings();
  if (!settings.enabled) return [];
  const db = getDb();
  const rows = await db.productionGibLabOrder.findMany({
    where: {
      status: { in: ["written", "exists"] },
      writtenAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
    },
    select: { requestId: true, root: true, folder: true, fileName: true },
  });
  if (!rows.length) return [];
  const open = await db.request.findMany({
    where: {
      id: { in: rows.map((r) => r.requestId) },
      status: { notIn: [RequestStatus.COMPLETED, RequestStatus.CANCELED] },
      OR: [{ cuttingStage: null }, { cuttingStage: CuttingStage.ACCEPTED }],
    },
    select: { id: true },
  });
  const openIds = new Set(open.map((r) => r.id));
  // Корень — тот, куда файл положили: смена папки в настройках не должна
  // выглядеть как «файл удалён».
  return rows
    .filter((r) => openIds.has(r.requestId))
    .slice(0, 500)
    .map((r) => ({
      requestId: r.requestId,
      root64: b64(r.root ?? settings.root),
      folder64: b64(r.folder),
      fileName64: b64(r.fileName),
    }));
}

// Для программы цеха: какие заказы положить в папку GibLab.
export async function getPendingGibLabOrders(limit = 10) {
  const settings = await getGibLabOrderSettings();
  if (!settings.enabled || !settings.since) return [];
  const db = getDb();
  const since = new Date(settings.since);
  // Файлы заявки (проект калькулятора, Базис) сохраняются уже после самой
  // заявки: ждём 2 минуты, чтобы не выгрузить пустой проект вместо них.
  const ready = new Date(Date.now() - 2 * 60_000);
  const done = await db.productionGibLabOrder.findMany({
    where: {
      OR: [
        { status: { in: ["written", "exists"] } },
        { attempts: { gte: maxAttempts } },
      ],
    },
    select: { requestId: true },
  });
  const requests = await db.request.findMany({
    where: {
      type: RequestType.CUTTING_SERVICE,
      id: { notIn: done.map((d) => d.requestId) },
      ...(settings.trigger === "new"
        ? {
            status: {
              notIn: [RequestStatus.COMPLETED, RequestStatus.CANCELED],
            },
            createdAt: { gte: since, lte: ready },
          }
        : {
            status: RequestStatus.IN_PROGRESS,
            updatedAt: { gte: since },
            createdAt: { lte: ready },
          }),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      number: true,
      contactName: true,
      contactPhone: true,
      material: true,
      subject: true,
      files: { select: { fileName: true, fileUrl: true, createdAt: true } },
    },
  });
  const result: PendingGibLabOrder[] = [];
  for (const request of requests) {
    const existing = await db.productionGibLabOrder.findUnique({
      where: { requestId: request.id },
    });
    // Папка и имя фиксируются при первой выдаче, чтобы повтор после сбоя
    // не создал второй файл в другой папке дня.
    const folder = existing?.folder ?? gibLabOrderFolder(new Date());
    const fileName =
      existing?.fileName ??
      gibLabOrderFileName({
        number: request.number,
        id: request.id,
        contactName: request.contactName,
        contactPhone: request.contactPhone,
      });
    const { bytes, source } = await buildContent(
      fileName.replace(/\.project$/i, ""),
      request.files,
      `artisan.shop.kg ${request.number ?? ""}: ${request.material || request.subject}`,
    );
    if (!existing)
      await db.productionGibLabOrder.create({
        data: {
          requestId: request.id,
          root: settings.root,
          folder,
          fileName,
          source,
        },
      });
    result.push({
      requestId: request.id,
      root64: b64(existing?.root ?? settings.root),
      folder64: b64(folder),
      fileName64: b64(fileName),
      content: bytes.toString("base64"),
    });
  }
  return result;
}

export type GibLabOrderAck = {
  requestId: string;
  status: "written" | "exists" | "failed" | "missing";
  error?: string | null;
};

export function parseGibLabOrderAcks(body: unknown): GibLabOrderAck[] {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === "object"
      ? (((body as Record<string, unknown>).results ?? [body]) as unknown[])
      : [];
  const items = Array.isArray(list) ? list : [list];
  return items
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object"),
    )
    .map(
      (item): GibLabOrderAck => ({
        requestId: String(item.requestId ?? "").slice(0, 64),
        status:
          item.status === "written" ||
          item.status === "exists" ||
          item.status === "missing"
            ? item.status
            : "failed",
        error: typeof item.error === "string" ? item.error.slice(0, 300) : null,
      }),
    )
    .filter((item) => item.requestId)
    .slice(0, 50);
}

export async function ackGibLabOrders(acks: GibLabOrderAck[]) {
  const db = getDb();
  const settings = parseGibLabOrderSettings(await readSetting(settingsKey));
  for (const ack of acks) {
    const row = await db.productionGibLabOrder.findUnique({
      where: { requestId: ack.requestId },
    });
    if (!row) continue;
    if (ack.status === "missing") {
      if (row.status === "written" || row.status === "exists")
        await cancelDeletedOrder(row);
      continue;
    }
    if (row.status === "written" || row.status === "exists") continue;
    const ok = ack.status !== "failed";
    await db.productionGibLabOrder.update({
      where: { requestId: ack.requestId },
      data: {
        status: ack.status,
        attempts: { increment: 1 },
        error: ok ? null : ack.error || "Не удалось записать файл",
        writtenAt: ok ? new Date() : null,
      },
    });
    if (ok)
      await logOperationEvent({
        entityType: "request",
        entityId: ack.requestId,
        eventType: "system",
        title:
          ack.status === "written"
            ? "Заказ передан в GibLab"
            : "Файл заказа в GibLab уже был",
        description: `${(row.root ?? settings.root).replace(/\\+$/, "")}\\${row.folder}\\${row.fileName}`,
        actorName: "Программа цеха",
      });
  }
}

async function cancelDeletedOrder(row: {
  requestId: string;
  folder: string;
  fileName: string;
}) {
  const db = getDb();
  const request = await db.request.findUnique({
    where: { id: row.requestId },
    select: { id: true, number: true, status: true, contactName: true },
  });
  await db.productionGibLabOrder.update({
    where: { requestId: row.requestId },
    data: { status: "deleted" },
  });
  if (!request) return;
  // Только пока распил не начат: та же проверка, что и в списке.
  const cancelled = await db.request.updateMany({
    where: {
      id: row.requestId,
      status: { notIn: [RequestStatus.COMPLETED, RequestStatus.CANCELED] },
      OR: [{ cuttingStage: null }, { cuttingStage: CuttingStage.ACCEPTED }],
    },
    data: { status: RequestStatus.CANCELED },
  });
  if (!cancelled.count) return;
  await logOperationEvent({
    entityType: "request",
    entityId: row.requestId,
    eventType: "status",
    title: "Заявка отменена: файл удалён в GibLab",
    description: `${row.folder}\\${row.fileName}`,
    fromStatus: request.status,
    toStatus: RequestStatus.CANCELED,
    actorName: "Программа цеха",
  });
  await sendStaffNotice({
    title: `Artisan · распил ${request.number ?? ""}: отменена`,
    threadKey: "cutting",
    lines: [
      `Клиент: ${request.contactName}`,
      `Файл удалили в GibLab: ${row.fileName}`,
      "Если по ошибке — верните статус заявки в карточке.",
    ],
    actions: [
      {
        label: "Открыть заявку",
        url: absoluteUrl(`/admin/requests/${row.requestId}`),
      },
    ],
  }).catch(() => undefined);
}

export async function getRecentGibLabOrders() {
  if (!(await prepare())) return [];
  return getDb().productionGibLabOrder.findMany({
    orderBy: { queuedAt: "desc" },
    take: 30,
  });
}

export async function getGibLabOrderForRequest(requestId: string) {
  if (!(await prepare())) return null;
  return getDb().productionGibLabOrder.findUnique({ where: { requestId } });
}

// «Положить ещё раз»: например, оператор удалил файл.
export async function resendGibLabOrder(
  actor: SessionPayload,
  requestId: string,
) {
  if (!canManageProduction(actor.roleCode)) return "forbidden" as const;
  if (!(await prepare())) return "unavailable" as const;
  await getDb().productionGibLabOrder.deleteMany({ where: { requestId } });
  return "saved" as const;
}
