import "server-only";

import type { getDb } from "@/lib/db";

type DbClient = ReturnType<typeof getDb>;

let loyaltyAuditSchemaPromise: Promise<void> | null = null;

export function ensureLoyaltyAuditSchema(db: DbClient) {
  loyaltyAuditSchemaPromise ??= (async () => {
    await db.$executeRawUnsafe(
      'ALTER TABLE "LoyaltyTransaction" ADD COLUMN IF NOT EXISTS "balanceBefore" INTEGER',
    );
    await db.$executeRawUnsafe(
      'ALTER TABLE "LoyaltyTransaction" ADD COLUMN IF NOT EXISTS "reversalOfTransactionId" TEXT',
    );
    await db.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyTransaction_reversalOfTransactionId_key" ON "LoyaltyTransaction" ("reversalOfTransactionId")',
    );
    await db.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "LoyaltyTransaction_type_createdAt_idx" ON "LoyaltyTransaction" ("type", "createdAt")',
    );
    await db.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "LoyaltyTransaction_approvedById_createdAt_idx" ON "LoyaltyTransaction" ("approvedById", "createdAt")',
    );
  })().catch((error) => {
    loyaltyAuditSchemaPromise = null;
    throw error;
  });

  return loyaltyAuditSchemaPromise;
}
