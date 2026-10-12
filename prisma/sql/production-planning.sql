-- Additive, opt-in migration. Apply before ARTISAN_PRODUCTION_PLANNING=true.
BEGIN;
CREATE TABLE IF NOT EXISTS "ProductionPlan" (
  "requestId" TEXT PRIMARY KEY REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "dueDate" DATE,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "ProductionPlan_dueDate_idx" ON "ProductionPlan"("dueDate");
COMMIT;
