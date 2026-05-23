import type { getDb } from "@/lib/db";

type DbClient = ReturnType<typeof getDb>;

let productBundleSchemaReady = false;

export async function ensureProductBundleItemsTable(db: DbClient) {
  if (productBundleSchemaReady) {
    return;
  }

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductBundleItem" (
      "id" TEXT NOT NULL,
      "bundleProductId" TEXT NOT NULL,
      "componentProductId" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductBundleItem_pkey" PRIMARY KEY ("id")
    );
  `);

  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ProductBundleItem_bundleProductId_componentProductId_key"
    ON "ProductBundleItem" ("bundleProductId", "componentProductId");
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ProductBundleItem_bundleProductId_sortOrder_idx"
    ON "ProductBundleItem" ("bundleProductId", "sortOrder");
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ProductBundleItem_componentProductId_idx"
    ON "ProductBundleItem" ("componentProductId");
  `);

  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ProductBundleItem_bundleProductId_fkey'
      ) THEN
        ALTER TABLE "ProductBundleItem"
        ADD CONSTRAINT "ProductBundleItem_bundleProductId_fkey"
        FOREIGN KEY ("bundleProductId") REFERENCES "Product"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ProductBundleItem_componentProductId_fkey'
      ) THEN
        ALTER TABLE "ProductBundleItem"
        ADD CONSTRAINT "ProductBundleItem_componentProductId_fkey"
        FOREIGN KEY ("componentProductId") REFERENCES "Product"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  productBundleSchemaReady = true;
}
