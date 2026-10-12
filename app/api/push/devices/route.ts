import { NextResponse } from "next/server";
import { z } from "zod";

import { getOptionalSession } from "@/lib/auth/dal";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { ensurePushDeviceSchema } from "@/lib/server/push-device-schema";

export const dynamic = "force-dynamic";

const registrationSchema = z.object({
  installationId: z.string().trim().min(8).max(512),
  platform: z.literal("ANDROID").default("ANDROID"),
  appVersion: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  const session = await getOptionalSession();

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid device registration" },
      { status: 400 },
    );
  }

  const db = getDb();
  await ensurePushDeviceSchema(db);

  await db.pushDevice.upsert({
    where: { installationId: parsed.data.installationId },
    create: {
      userId: session.userId,
      installationId: parsed.data.installationId,
      platform: parsed.data.platform,
      appVersion: parsed.data.appVersion || null,
      lastSeenAt: new Date(),
    },
    update: {
      userId: session.userId,
      platform: parsed.data.platform,
      appVersion: parsed.data.appVersion || null,
      enabled: true,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
