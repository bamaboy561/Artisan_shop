import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

// One durable counter per employee, shared by all server instances.
export async function claimInvoicePhotoAttempt(userId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `invoice-ocr-limit:${userId}`;
  const rows = await getDb().$queryRaw<Array<{ id: string }>>`
    INSERT INTO "SiteSetting" ("id", "key", "value", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${key}, jsonb_build_object('day', ${day}::text, 'count', 1), NOW(), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "value" = jsonb_build_object('day', ${day}::text, 'count',
        CASE WHEN "SiteSetting"."value"->>'day' = ${day}::text
        THEN ("SiteSetting"."value"->>'count')::int + 1 ELSE 1 END),
      "updatedAt" = NOW()
    WHERE "SiteSetting"."updatedAt" < NOW() - INTERVAL '30 seconds'
      AND ("SiteSetting"."value"->>'day' <> ${day}::text
        OR ("SiteSetting"."value"->>'count')::int < 50)
    RETURNING "id"
  `;
  return rows.length > 0;
}
