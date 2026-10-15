import type { PrismaClient } from "@/generated/prisma";

type SchemaDb = Pick<PrismaClient, "$executeRawUnsafe">;

let stockPendingSchemaReady = false;
let stockPendingSchemaPromise: Promise<void> | null = null;

// Таблица списка «Нет на сайте». На продакшене prisma db push не запускается,
// поэтому создаём её сами при первом обращении.
export async function ensureStockPendingItemsTable(db: SchemaDb) {
  if (stockPendingSchemaReady) {
    return;
  }

  stockPendingSchemaPromise ??= createStockPendingItemsTable(db)
    // Параллельный CREATE ... IF NOT EXISTS из другого экземпляра может
    // упасть на гонке в каталоге Postgres; повтор видит готовую таблицу.
    .catch(() => createStockPendingItemsTable(db))
    .then(() => {
      stockPendingSchemaReady = true;
    })
    .finally(() => {
      stockPendingSchemaPromise = null;
    });

  await stockPendingSchemaPromise;
}

async function createStockPendingItemsTable(db: SchemaDb) {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StockPendingItem" (
      "id" TEXT NOT NULL,
      "matchKey" TEXT NOT NULL,
      "sku" TEXT,
      "name" TEXT NOT NULL,
      "unit" TEXT,
      "quantity" DOUBLE PRECISION,
      "note" TEXT,
      "sourceFile" TEXT,
      "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "dismissedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StockPendingItem_pkey" PRIMARY KEY ("id")
    );
  `);

  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "StockPendingItem_matchKey_key"
    ON "StockPendingItem" ("matchKey");
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "StockPendingItem_dismissedAt_lastSeenAt_idx"
    ON "StockPendingItem" ("dismissedAt", "lastSeenAt");
  `);

  // Связь с товаром сайта, заданная вручную (кнопка «Это он»).
  await db.$executeRawUnsafe(`
    ALTER TABLE "StockPendingItem"
    ADD COLUMN IF NOT EXISTS "linkedProductId" TEXT;
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StockLink" (
      "id" TEXT NOT NULL,
      "matchKey" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "sku" TEXT,
      "name" TEXT NOT NULL,
      "manual" BOOLEAN NOT NULL DEFAULT false,
      "importLogId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StockLink_pkey" PRIMARY KEY ("id")
    );
  `);
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "StockLink_matchKey_key"
    ON "StockLink" ("matchKey");
  `);
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "StockLink_productId_idx"
    ON "StockLink" ("productId");
  `);
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StockImportLog" (
      "id" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "userId" TEXT,
      "mode" TEXT NOT NULL,
      "changes" JSONB NOT NULL,
      "links" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "undoneAt" TIMESTAMP(3),
      CONSTRAINT "StockImportLog_pkey" PRIMARY KEY ("id")
    );
  `);
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "StockImportLog_createdAt_idx"
    ON "StockImportLog" ("createdAt");
  `);
}
