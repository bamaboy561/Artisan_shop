import "server-only";

import { randomUUID } from "node:crypto";

import type {
  MaterialLine,
  MaterialLineDto,
} from "@/features/cutting/material-lines";
import { getDb, hasDatabaseUrl } from "@/lib/db";

type SchemaDb = Pick<ReturnType<typeof getDb>, "$executeRawUnsafe">;

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

async function createTable(db: SchemaDb) {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RequestMaterialLine" (
      "id" TEXT PRIMARY KEY,
      "requestId" TEXT NOT NULL REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "kind" TEXT NOT NULL,
      "source" TEXT NOT NULL,
      "productId" TEXT,
      "name" TEXT NOT NULL,
      "sku" TEXT,
      "thicknessMm" DOUBLE PRECISION,
      "widthMm" DOUBLE PRECISION,
      "format" TEXT,
      "quantity" DOUBLE PRECISION,
      "note" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "RequestMaterialLine_requestId_sortOrder_idx" ON "RequestMaterialLine"("requestId", "sortOrder")`,
  );
}

// Таблицу создаём сами при первом обращении, как и остальные таблицы
// распила: так новый код работает, даже если db push ещё не прошёл.
export async function ensureRequestMaterialLinesTable(db: SchemaDb = getDb()) {
  if (schemaReady) return;
  schemaPromise ??= createTable(db)
    .catch(() => createTable(db))
    .then(() => {
      schemaReady = true;
    })
    .finally(() => {
      schemaPromise = null;
    });
  await schemaPromise;
}

async function prepare() {
  if (!hasDatabaseUrl()) return false;
  try {
    await ensureRequestMaterialLinesTable();
    return true;
  } catch (error) {
    console.error("[material-lines] schema unavailable", error);
    return false;
  }
}

export async function getRequestMaterialLines(
  requestId: string,
): Promise<MaterialLineDto[]> {
  if (!(await prepare())) return [];
  try {
    const rows = await getDb().requestMaterialLine.findMany({
      where: { requestId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind === "EDGE" ? "EDGE" : "SHEET",
      source: row.source === "STOCK" ? "STOCK" : "CLIENT",
      productId: row.productId,
      name: row.name,
      sku: row.sku,
      thicknessMm: row.thicknessMm,
      widthMm: row.widthMm,
      format: row.format,
      quantity: row.quantity,
      note: row.note,
    }));
  } catch (error) {
    console.error("[material-lines] read failed", error);
    return [];
  }
}

// Полная замена строк заказа: форма всегда присылает весь список.
export async function replaceRequestMaterialLines(
  requestId: string,
  lines: MaterialLine[],
) {
  if (!(await prepare())) {
    throw new Error("Material lines table is unavailable");
  }
  const db = getDb();
  await db.$transaction([
    db.requestMaterialLine.deleteMany({ where: { requestId } }),
    ...(lines.length
      ? [
          db.requestMaterialLine.createMany({
            data: lines.map((line, index) => ({
              id: randomUUID(),
              requestId,
              kind: line.kind,
              source: line.source,
              productId: line.productId,
              name: line.name,
              sku: line.sku,
              thicknessMm: line.thicknessMm,
              widthMm: line.widthMm,
              format: line.format,
              quantity: line.quantity,
              note: line.note,
              sortOrder: index,
            })),
          }),
        ]
      : []),
  ]);
}

// Товары магазина для строк «из магазина»: имя и артикул берём с сайта, а не
// из формы, чтобы в заказ не попала подменённая строка.
export async function resolveStockMaterialLines(lines: MaterialLine[]) {
  const ids = [
    ...new Set(
      lines
        .filter((line) => line.source === "STOCK" && line.productId)
        .map((line) => line.productId as string),
    ),
  ];
  if (!ids.length) return { ok: true as const, lines };
  if (!hasDatabaseUrl()) {
    return {
      ok: false as const,
      message: "Товары магазина недоступны без базы данных.",
    };
  }
  const products = await getDb().product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, sku: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  const missing = lines.find(
    (line) =>
      line.source === "STOCK" && line.productId && !byId.has(line.productId),
  );
  if (missing) {
    return {
      ok: false as const,
      message: `Товар «${missing.name}» не найден в магазине. Выберите его заново или отметьте «Привозной».`,
    };
  }
  return {
    ok: true as const,
    lines: lines.map((line) => {
      const product =
        line.source === "STOCK" && line.productId
          ? byId.get(line.productId)
          : null;
      return product
        ? { ...line, name: product.name.slice(0, 200), sku: product.sku }
        : line;
    }),
  };
}
