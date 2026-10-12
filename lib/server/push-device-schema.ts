import "server-only";

import type { getDb } from "@/lib/db";

type DbClient = ReturnType<typeof getDb>;

let pushDeviceSchemaPromise: Promise<void> | null = null;

export function ensurePushDeviceSchema(db: DbClient) {
  pushDeviceSchemaPromise ??= (async () => {
    await db.$executeRawUnsafe(
      "ALTER TYPE \"NotificationChannel\" ADD VALUE IF NOT EXISTS 'PUSH'",
    );
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PushDevice" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "installationId" TEXT NOT NULL,
        "platform" TEXT NOT NULL DEFAULT 'ANDROID',
        "appVersion" TEXT,
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "PushDevice_installationId_key" ON "PushDevice" ("installationId")',
    );
    await db.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "PushDevice_userId_enabled_idx" ON "PushDevice" ("userId", "enabled")',
    );
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'PushDevice_userId_fkey'
        ) THEN
          ALTER TABLE "PushDevice"
          ADD CONSTRAINT "PushDevice_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
  })().catch((error) => {
    pushDeviceSchemaPromise = null;
    throw error;
  });

  return pushDeviceSchemaPromise;
}
