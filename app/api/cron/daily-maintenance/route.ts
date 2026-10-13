import { buildStaffDigest } from "@/features/admin/attention";
import { getSiteUrl } from "@/lib/seo";
import { getAttentionSummary } from "@/lib/server/attention";
import { cleanupBazisTempFiles } from "@/lib/server/bazis-temp-files";
import { sendStaffNotice } from "@/lib/server/commercial-integrations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Ежедневные задачи в 9:00 по Бишкеку: удалить проекты Базиса старше двух
// дней и отправить в рабочий чат сводку «что требует внимания». Задачи не
// зависят друг от друга: сбой одной не отменяет другую.
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

  let deletedBazisFiles: number | null = null;
  let digest = "skipped";

  try {
    deletedBazisFiles = await cleanupBazisTempFiles();
  } catch (error) {
    console.error("[cron:daily] bazis cleanup failed", error);
  }

  try {
    const summary = await getAttentionSummary();

    if (summary) {
      const result = await sendStaffNotice(
        buildStaffDigest(summary, getSiteUrl()),
      );

      digest = result.ok ? "sent" : result.message;
    }
  } catch (error) {
    console.error("[cron:daily] digest failed", error);
    digest = "failed";
  }

  return Response.json({ ok: true, deletedBazisFiles, digest });
}
