import type { PrismaClient } from "@/generated/prisma";

let stockPendingSchemaReady = false;

// Таблица списка «Нет на сайте». На продакшене prisma db push не запускается,
// поэтому создаём её сами при первом обращении.
export async function ensureStockPendingItemsTable(
  db: Pick<PrismaClient, "$executeRawUnsafe">,
) {
  if (stockPendingSchemaReady) {
    return;
  }

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

  stockPendingSchemaReady = true;
}
