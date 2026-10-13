import { cleanupBazisTempFiles } from "@/lib/server/bazis-temp-files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Раз в сутки удаляет проекты Базиса старше двух дней.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return Response.json(
      { ok: false, message: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json(
      { ok: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    return Response.json({ ok: true, deleted: await cleanupBazisTempFiles() });
  } catch {
    return Response.json(
      { ok: false, message: "Cleanup failed." },
      { status: 500 },
    );
  }
}
