import type { getDb } from "@/lib/db";

type DbClient = ReturnType<typeof getDb>;

let telegramUserColumnsPromise: Promise<void> | null = null;

export function ensureTelegramUserColumns(db: DbClient) {
  telegramUserColumnsPromise ??= (async () => {
    await db.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT',
    );
    await db.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramUsername" TEXT',
    );
    await db.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramLinkedAt" TIMESTAMP(3)',
    );
    await db.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramNotifyOrders" BOOLEAN NOT NULL DEFAULT true',
    );
    await db.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramNotifyRequests" BOOLEAN NOT NULL DEFAULT true',
    );
    await db.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramNotifyLoyalty" BOOLEAN NOT NULL DEFAULT true',
    );
    await db.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramChatId_key" ON "User" ("telegramChatId")',
    );
  })().catch((error) => {
    telegramUserColumnsPromise = null;
    throw error;
  });

  return telegramUserColumnsPromise;
}
