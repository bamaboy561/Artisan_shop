import "server-only";

import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import {
  diffFolder,
  filterTopLevel,
  findRequestNumbers,
  matchRequestByName,
  normalizeMachineFolders,
  parseMachineFolders,
  type MachineFolder,
  type ReportedFile,
  type WatcherReport,
} from "@/features/production/machine-folders";
import { revalidatePath } from "next/cache";

import { CuttingStage, RequestStatus, RequestType } from "@/generated/prisma";
import { cuttingStageLabels } from "@/features/cutting/progress";
import { canManageProduction } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";
import { sendStaffNotice } from "@/lib/server/commercial-integrations";
import { logOperationEvent } from "@/lib/server/operation-events";
import { updateRequestCuttingProgress } from "@/lib/server/request-production";
import { prepareShifts } from "@/lib/server/production-shifts";

const keySetting = "machineWatcherKey";
const foldersSetting = "machineFolders";
const statusSetting = "machineWatcherStatus";

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

async function createTable() {
  const db = getDb();
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductionMachineFile" (
      "id" TEXT NOT NULL,
      "folderId" TEXT NOT NULL,
      "machine" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "fileSize" INTEGER,
      "fileModifiedAt" TIMESTAMP(3),
      "requestId" TEXT,
      "requestNumber" TEXT,
      "linkedManually" BOOLEAN NOT NULL DEFAULT false,
      "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "removedAt" TIMESTAMP(3),
      CONSTRAINT "ProductionMachineFile_pkey" PRIMARY KEY ("id")
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductionMachineFile_folderId_removedAt_idx" ON "ProductionMachineFile"("folderId", "removedAt")`,
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductionMachineFile_requestId_idx" ON "ProductionMachineFile"("requestId")`,
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductionMachineFile_firstSeenAt_idx" ON "ProductionMachineFile"("firstSeenAt")`,
  );
}

// На продакшене таблицу создаём сами при первом обращении (как смены).
export async function prepareMachineFolders() {
  if (!hasDatabaseUrl()) return false;
  try {
    if (!(await prepareShifts())) return false;
    if (!schemaReady) {
      schemaPromise ??= createTable()
        .catch(() => createTable())
        .then(() => {
          schemaReady = true;
        })
        .finally(() => {
          schemaPromise = null;
        });
      await schemaPromise;
    }
    return true;
  } catch (error) {
    console.error("[machine-folders] schema unavailable", error);
    return false;
  }
}

async function readSetting(key: string) {
  const row = await getDb().productionShiftSetting.findUnique({
    where: { key },
  });
  return row?.value ?? null;
}

async function writeSetting(key: string, value: string) {
  await getDb().productionShiftSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value, updatedAt: new Date() },
  });
}

export async function getMachineFolders(): Promise<MachineFolder[]> {
  if (!(await prepareMachineFolders())) return parseMachineFolders(null);
  return parseMachineFolders(await readSetting(foldersSetting));
}

export async function saveMachineFolders(
  actor: SessionPayload,
  folders: unknown[],
) {
  if (!canManageProduction(actor.roleCode)) return "forbidden" as const;
  if (!(await prepareMachineFolders())) return "unavailable" as const;
  const normalized = normalizeMachineFolders(folders);
  await writeSetting(foldersSetting, JSON.stringify(normalized));
  // Станок убрали — его файлы больше не считаются лежащими на станке.
  await getDb().productionMachineFile.updateMany({
    where: {
      removedAt: null,
      folderId: { notIn: normalized.filter((f) => f.path).map((f) => f.id) },
    },
    data: { removedAt: new Date() },
  });
  return "saved" as const;
}

// Ключ наблюдателя: создаётся при первом открытии страницы, новый — по
// кнопке (старый файл .cmd тогда перестаёт работать).
export async function getWatcherKey(actor: SessionPayload) {
  if (!canManageProduction(actor.roleCode)) return null;
  if (!(await prepareMachineFolders())) return null;
  const existing = await readSetting(keySetting);
  if (existing) return existing;
  const key = randomBytes(24).toString("base64url");
  await getDb().productionShiftSetting.createMany({
    data: [{ key: keySetting, value: key }],
    skipDuplicates: true,
  });
  return (await readSetting(keySetting)) ?? key;
}

export async function regenerateWatcherKey(actor: SessionPayload) {
  if (!canManageProduction(actor.roleCode)) return "forbidden" as const;
  if (!(await prepareMachineFolders())) return "unavailable" as const;
  await writeSetting(keySetting, randomBytes(24).toString("base64url"));
  return "saved" as const;
}

export async function isWatcherAuthorized(request: Request) {
  if (!(await prepareMachineFolders())) return "unavailable" as const;
  const expected = await readSetting(keySetting);
  const header = request.headers.get("authorization")?.trim() ?? "";
  const incoming = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  if (!expected || !incoming) return "denied" as const;
  const a = Buffer.from(incoming);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b)
    ? ("ok" as const)
    : ("denied" as const);
}

export type WatcherStatus = {
  lastSeenAt: Date | null;
  computer: string | null;
  folders: Record<string, { ok: boolean; files: number }>;
};

export async function getWatcherStatus(): Promise<WatcherStatus> {
  const empty: WatcherStatus = {
    lastSeenAt: null,
    computer: null,
    folders: {},
  };
  if (!(await prepareMachineFolders())) return empty;
  const raw = await readSetting(statusSetting);
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as {
      lastSeenAt?: string;
      computer?: string | null;
      folders?: WatcherStatus["folders"];
    };
    const lastSeenAt = parsed.lastSeenAt ? new Date(parsed.lastSeenAt) : null;
    return {
      lastSeenAt:
        lastSeenAt && !Number.isNaN(lastSeenAt.getTime()) ? lastSeenAt : null,
      computer: parsed.computer ?? null,
      folders: parsed.folders ?? {},
    };
  } catch {
    return empty;
  }
}

const maxInt = 2_147_483_647;

type RequestRef = { id: string; number: string | null; contactName: string };

async function matchRequests(files: ReportedFile[]) {
  const result = new Map<string, RequestRef>();
  if (!files.length) return result;
  const db = getDb();
  const numbers = [
    ...new Set(files.flatMap((f) => findRequestNumbers(f.name))),
  ];
  const byNumber = numbers.length
    ? await db.request.findMany({
        where: { number: { in: numbers } },
        select: { id: true, number: true, contactName: true },
      })
    : [];
  let open: RequestRef[] | null = null;
  for (const file of files) {
    const number = findRequestNumbers(file.name).find((n) =>
      byNumber.some((r) => r.number === n),
    );
    const direct = number ? byNumber.find((r) => r.number === number) : null;
    if (direct) {
      result.set(file.name, direct);
      continue;
    }
    // Без номера — по имени клиента среди открытых заявок на распил.
    open ??= await db.request.findMany({
      where: {
        type: RequestType.CUTTING_SERVICE,
        status: {
          notIn: [RequestStatus.COMPLETED, RequestStatus.CANCELED],
        },
        createdAt: { gte: new Date(Date.now() - 120 * 86_400_000) },
      },
      select: { id: true, number: true, contactName: true },
      take: 500,
    });
    const byName = matchRequestByName(file.name, open);
    if (byName) result.set(file.name, byName);
  }
  return result;
}

// Приём списка файлов от наблюдателя.
export async function ingestWatcherReport(report: WatcherReport) {
  const now = new Date();
  const db = getDb();
  const folders = parseMachineFolders(await readSetting(foldersSetting));
  const known = new Map(folders.map((f) => [f.id, f]));
  const reported = report.folders
    .filter((f) => known.has(f.id))
    .map((f) => (known.get(f.id)!.recurse ? f : filterTopLevel(f)));
  // Файлы из подпапок, попавшие раньше, убираем молча (без «снят»).
  const flat = folders.filter((f) => !f.recurse).map((f) => f.id);
  if (flat.length)
    // strpos, а не LIKE: обратная косая в LIKE — символ экранирования.
    await db.$executeRawUnsafe(
      `DELETE FROM "ProductionMachineFile" WHERE "removedAt" IS NULL AND "folderId" = ANY($1::text[]) AND strpos("fileName", chr(92)) > 0`,
      flat,
    );
  const active = await db.productionMachineFile.findMany({
    where: { removedAt: null, folderId: { in: reported.map((f) => f.id) } },
    select: {
      id: true,
      folderId: true,
      fileName: true,
      requestId: true,
      requestNumber: true,
    },
  });
  const previous = await getWatcherStatus();
  let added = 0;
  let removed = 0;
  const status: WatcherStatus["folders"] = {};
  const noticeLines: string[] = [];
  const started = new Map<string, string>();
  const finished = new Map<string, string>();
  for (const folder of reported) {
    const machine = known.get(folder.id)!.name;
    const diff = diffFolder(active, folder);
    status[folder.id] = { ok: folder.ok, files: folder.files.length };
    const requests = await matchRequests(diff.added);
    if (known.get(folder.id)!.stage === "cutting") {
      for (const file of diff.added) {
        const request = requests.get(file.name);
        if (request) started.set(request.id, machine);
      }
      for (const id of diff.removedIds) {
        const row = active.find((r) => r.id === id);
        if (row?.requestId) finished.set(row.requestId, machine);
      }
    }
    // Первый отчёт по папке — это то, что уже лежало: не сообщаем.
    if (previous.folders[folder.id]) {
      const label = (name: string, number: string | null | undefined) =>
        number ? `${number} (${name})` : name;
      for (const file of diff.added)
        noticeLines.push(
          `➕ ${machine}: ${label(file.name, requests.get(file.name)?.number)}`,
        );
      for (const id of diff.removedIds) {
        const row = active.find((r) => r.id === id);
        if (row)
          noticeLines.push(
            `✅ ${machine}: снят ${label(row.fileName, row.requestNumber)}`,
          );
      }
      if (previous.folders[folder.id].ok && !folder.ok)
        noticeLines.push(`⚠️ ${machine}: папка недоступна`);
    }
    if (diff.added.length)
      await db.productionMachineFile.createMany({
        data: diff.added.map((file) => {
          const request = requests.get(file.name);
          return {
            id: randomUUID(),
            folderId: folder.id,
            machine,
            fileName: file.name,
            fileSize: file.size === null ? null : Math.min(file.size, maxInt),
            fileModifiedAt: file.modifiedAt,
            requestId: request?.id ?? null,
            requestNumber: request?.number ?? null,
            firstSeenAt: now,
            lastSeenAt: now,
          };
        }),
      });
    if (diff.kept.length)
      await db.productionMachineFile.updateMany({
        where: { id: { in: diff.kept.map((k) => k.id) } },
        data: { lastSeenAt: now, machine },
      });
    if (diff.removedIds.length)
      await db.productionMachineFile.updateMany({
        where: { id: { in: diff.removedIds } },
        data: { removedAt: now },
      });
    added += diff.added.length;
    removed += diff.removedIds.length;
  }
  await writeSetting(
    statusSetting,
    JSON.stringify({
      lastSeenAt: now.toISOString(),
      computer: report.computer,
      folders: status,
    }),
  );
  noticeLines.push(...(await autoAdvance({ started, finished, folders })));
  if (noticeLines.length)
    await sendStaffNotice({
      title: "Artisan · станки: изменения в папках GibLab",
      threadKey: "cutting",
      lines:
        noticeLines.length > 15
          ? [...noticeLines.slice(0, 15), `…и ещё ${noticeLines.length - 15}`]
          : noticeLines,
      actions: [
        {
          label: "Станки и папки",
          url: absoluteUrl("/admin/production/machines"),
        },
      ],
    }).catch((error) => console.error("[machine-folders] notice", error));
  return { added, removed };
}

// Доска распила двигается сама: файл попал в папку пилы → «Распил»; все
// файлы заявки ушли из папок пилы → «Кромка». Только вперёд и только с
// ожидаемого этапа: если оператор уже передвинул вручную, не трогаем.
async function autoAdvance(input: {
  started: Map<string, string>;
  finished: Map<string, string>;
  folders: MachineFolder[];
}) {
  const lines: string[] = [];
  const db = getDb();
  const cuttingFolders = input.folders
    .filter((f) => f.stage === "cutting")
    .map((f) => f.id);
  const ids = [...new Set([...input.started.keys(), ...input.finished.keys()])];
  if (!ids.length) return lines;
  const requests = await db.request.findMany({
    where: {
      id: { in: ids },
      type: RequestType.CUTTING_SERVICE,
      status: { notIn: [RequestStatus.COMPLETED, RequestStatus.CANCELED] },
    },
    select: { id: true, number: true, cuttingStage: true },
  });
  for (const request of requests) {
    let from: CuttingStage | null = null;
    let to: CuttingStage | null = null;
    let machine = "";
    const stage = request.cuttingStage;
    if (
      input.started.has(request.id) &&
      (stage === null || stage === CuttingStage.ACCEPTED)
    ) {
      from = stage;
      to = CuttingStage.CUTTING;
      machine = input.started.get(request.id)!;
    } else if (
      input.finished.has(request.id) &&
      stage === CuttingStage.CUTTING &&
      !input.started.has(request.id)
    ) {
      const stillThere = await db.productionMachineFile.count({
        where: {
          requestId: request.id,
          removedAt: null,
          folderId: { in: cuttingFolders },
        },
      });
      if (stillThere) continue;
      from = stage;
      to = CuttingStage.EDGING;
      machine = input.finished.get(request.id)!;
    }
    if (!to) continue;
    const updated = await updateRequestCuttingProgress({
      requestId: request.id,
      stage: to,
      expectedStage: from,
    });
    if (!updated) continue;
    await logOperationEvent({
      entityType: "request",
      entityId: request.id,
      eventType: "cutting_stage",
      title: `Распил: ${cuttingStageLabels[to]}`,
      description:
        to === CuttingStage.CUTTING
          ? `Файл передан на станок ${machine} (GibLab).`
          : `Файл снят со станка ${machine}: распил закончен.`,
      fromStatus: from,
      toStatus: to,
      isVisibleToClient: true,
      actorName: `Станок ${machine}`,
    });
    lines.push(
      `➡️ ${request.number ?? request.id.slice(0, 8)}: ${cuttingStageLabels[to]} (автоматически)`,
    );
    revalidatePath(`/admin/production/${request.id}`);
    revalidatePath(`/admin/requests/${request.id}`);
  }
  if (lines.length) {
    revalidatePath("/admin/production");
    revalidatePath("/admin/production/board");
  }
  return lines;
}

export async function getActiveMachinesByRequest(requestIds: string[]) {
  const result = new Map<string, string[]>();
  if (!requestIds.length || !hasDatabaseUrl()) return result;
  try {
    if (!(await prepareMachineFolders())) return result;
    const rows = await getDb().productionMachineFile.findMany({
      where: { requestId: { in: requestIds }, removedAt: null },
      select: { requestId: true, machine: true },
    });
    for (const row of rows) {
      if (!row.requestId) continue;
      const list = result.get(row.requestId) ?? [];
      if (!list.includes(row.machine)) list.push(row.machine);
      result.set(row.requestId, list);
    }
  } catch (error) {
    console.error("[machine-folders] machines by request", error);
  }
  return result;
}

export async function getCurrentMachineFiles() {
  if (!(await prepareMachineFolders())) return [];
  return getDb().productionMachineFile.findMany({
    where: { removedAt: null },
    orderBy: [{ firstSeenAt: "desc" }, { fileName: "asc" }],
    take: 500,
  });
}

export async function getRemovedMachineFiles(since: Date) {
  if (!(await prepareMachineFolders())) return [];
  return getDb().productionMachineFile.findMany({
    where: { removedAt: { gte: since } },
    orderBy: { removedAt: "desc" },
    take: 200,
  });
}

export async function getMachineFilesForRequest(requestId: string) {
  if (!(await prepareMachineFolders())) return [];
  return getDb().productionMachineFile.findMany({
    where: { requestId },
    orderBy: { firstSeenAt: "desc" },
    take: 50,
  });
}

// Ручная привязка файла к заявке, если номера в имени файла нет.
export async function linkMachineFile(input: {
  actor: SessionPayload;
  fileId: string;
  requestNumber: string;
}) {
  if (!canManageProduction(input.actor.roleCode)) return "forbidden" as const;
  if (!(await prepareMachineFolders())) return "unavailable" as const;
  const db = getDb();
  const raw = input.requestNumber.trim();
  if (!raw) {
    await db.productionMachineFile.updateMany({
      where: { id: input.fileId },
      data: { requestId: null, requestNumber: null, linkedManually: true },
    });
    return "unlinked" as const;
  }
  const digits = raw.match(/\d{1,6}/)?.[0];
  if (!digits) return "not-found" as const;
  const number = `R-${digits.padStart(4, "0")}`;
  const request = await db.request.findUnique({
    where: { number },
    select: { id: true, number: true },
  });
  if (!request) return "not-found" as const;
  const file = await db.productionMachineFile.findUnique({
    where: { id: input.fileId },
    select: { id: true, folderId: true, machine: true, removedAt: true },
  });
  if (!file) return "not-found" as const;
  await db.productionMachineFile.update({
    where: { id: file.id },
    data: {
      requestId: request.id,
      requestNumber: request.number,
      linkedManually: true,
    },
  });
  // Файл уже лежит в папке пилы — двигаем заявку так же, как при появлении.
  const folders = parseMachineFolders(await readSetting(foldersSetting));
  if (
    !file.removedAt &&
    folders.some((f) => f.id === file.folderId && f.stage === "cutting")
  )
    await autoAdvance({
      started: new Map([[request.id, file.machine]]),
      finished: new Map(),
      folders,
    });
  return "linked" as const;
}
