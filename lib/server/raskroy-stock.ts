import "server-only";

import { getDb } from "@/lib/db";

// Склад деловых остатков программы раскроя: один общий на все компьютеры цеха.
// Хранится одной записью с версией: сохранение принимается, только если
// программа правила текущую версию, иначе она перечитывает склад и повторяет правку.

let tableReady = false;

async function prepare() {
  if (tableReady) return;
  await getDb().$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RaskroyStock" (
      "id" TEXT NOT NULL,
      "data" TEXT NOT NULL,
      "version" INTEGER NOT NULL DEFAULT 0,
      "savedById" TEXT,
      "savedByName" TEXT,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RaskroyStock_pkey" PRIMARY KEY ("id")
    )
  `);
  tableReady = true;
}

const KEY = "main";
const maxBytes = 3_000_000;
const maxItems = 20_000;

export type RaskroyStockItem = {
  id: string | number;
  mat: string;
  name: string;
  t: number;
  l: number;
  w: number;
  from?: string;
  place?: string;
  note?: string;
  at?: number;
  by?: string;
};
export type RaskroyStock = {
  stock: RaskroyStockItem[];
  ledger: unknown[];
  version: number;
  savedAt: string | null;
  savedBy: string | null;
};

export async function getRaskroyStock(): Promise<RaskroyStock> {
  await prepare();
  const rows = await getDb().$queryRawUnsafe<
    Array<{ data: string; version: number; updatedAt: Date; savedByName: string | null }>
  >(`SELECT "data", "version", "updatedAt", "savedByName" FROM "RaskroyStock" WHERE "id" = $1`, KEY);
  const row = rows[0];
  if (!row) return { stock: [], ledger: [], version: 0, savedAt: null, savedBy: null };
  let parsed: { stock?: unknown; ledger?: unknown } = {};
  try {
    parsed = JSON.parse(row.data);
  } catch {
    parsed = {};
  }
  return {
    stock: Array.isArray(parsed.stock) ? (parsed.stock as RaskroyStockItem[]) : [],
    ledger: Array.isArray(parsed.ledger) ? parsed.ledger : [],
    version: row.version,
    savedAt: row.updatedAt.toISOString(),
    savedBy: row.savedByName,
  };
}

const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown, max = 300) => typeof v === "string" && v.length <= max;
const optStr = (v: unknown) => v === undefined || v === null || str(v);

function validItem(x: unknown): x is RaskroyStockItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    (num(o.id) || str(o.id, 80)) &&
    str(o.mat) &&
    str(o.name) &&
    num(o.t) &&
    num(o.l) &&
    num(o.w) &&
    (o.l as number) > 0 &&
    (o.w as number) > 0 &&
    optStr(o.from) &&
    optStr(o.place) &&
    optStr(o.note) &&
    optStr(o.by) &&
    (o.at === undefined || o.at === null || num(o.at))
  );
}

export type RaskroyStockSave = { stock: RaskroyStockItem[]; ledger: unknown[]; baseVersion: number };

export function parseRaskroyStockSave(body: unknown): RaskroyStockSave | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.stock) || !Array.isArray(b.ledger) || !Number.isInteger(b.baseVersion)) return null;
  if (b.stock.length > maxItems || !b.stock.every(validItem)) return null;
  return { stock: b.stock, ledger: b.ledger, baseVersion: b.baseVersion as number };
}

export type RaskroyStockSaveResult =
  | { status: "ok"; version: number; savedAt: string }
  | { status: "too_large" }
  | { status: "conflict"; version: number };

export async function saveRaskroyStock(
  input: RaskroyStockSave,
  actor: { userId: string; name: string },
): Promise<RaskroyStockSaveResult> {
  await prepare();
  const data = JSON.stringify({ stock: input.stock, ledger: input.ledger });
  if (Buffer.byteLength(data) > maxBytes) return { status: "too_large" };
  const db = getDb();
  // Сравнение версии и запись одним запросом: первая запись создаётся с версии 0, дальше обновление только своей версии.
  const saved =
    input.baseVersion === 0
      ? await db.$queryRawUnsafe<Array<{ version: number; updatedAt: Date }>>(
          `INSERT INTO "RaskroyStock" ("id", "data", "version", "savedById", "savedByName", "updatedAt")
           VALUES ($1, $2, 1, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT ("id") DO NOTHING
           RETURNING "version", "updatedAt"`,
          KEY,
          data,
          actor.userId,
          actor.name,
        )
      : await db.$queryRawUnsafe<Array<{ version: number; updatedAt: Date }>>(
          `UPDATE "RaskroyStock" SET "data" = $2, "savedById" = $3, "savedByName" = $4,
             "updatedAt" = CURRENT_TIMESTAMP, "version" = "version" + 1
           WHERE "id" = $1 AND "version" = $5
           RETURNING "version", "updatedAt"`,
          KEY,
          data,
          actor.userId,
          actor.name,
          input.baseVersion,
        );
  if (saved[0]) return { status: "ok", version: saved[0].version, savedAt: saved[0].updatedAt.toISOString() };
  const cur = await db.$queryRawUnsafe<Array<{ version: number }>>(
    `SELECT "version" FROM "RaskroyStock" WHERE "id" = $1`,
    KEY,
  );
  return { status: "conflict", version: cur[0]?.version ?? 0 };
}
