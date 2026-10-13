import { buildStaffDigest } from "@/features/admin/attention";
import { getSiteUrl } from "@/lib/seo";
import { getAttentionSummary } from "@/lib/server/attention";
import { cleanupBazisTempFiles } from "@/lib/server/bazis-temp-files";
import { sendStaffNotice } from "@/lib/server/commercial-integrations";
import { sendPickupReminders } from "@/lib/server/pickup-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Ежедневные задачи в 9:00 по Бишкеку: удалить проекты Базиса старше двух
// дней, напомнить клиентам о готовых заказах и отправить в рабочий чат
// сводку «что требует внимания». Задачи не
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
  let pickupReminders: Awaited<ReturnType<typeof sendPickupReminders>> | null =
    null;

  try {
    pickupReminders = await sendPickupReminders();
  } catch (error) {
    console.error("[cron:daily] pickup reminders failed", error);
  }

  try {
    deletedBazisFiles = await cleanupBazisTempFiles();
  } catch (error) {
    console.error("[cron:daily] bazis cleanup failed", error);
  }

  try {
    const summary = await getAttentionSummary();

    if (summary) {
      const message = buildStaffDigest(summary, getSiteUrl());

      if (
        pickupReminders &&
        pickupReminders.sent + pickupReminders.unreachable > 0
      ) {
        message.lines.push(
          "",
          `Напоминаний клиентам о готовых заказах: ${pickupReminders.sent}`,
          ...(pickupReminders.unreachable > 0
            ? [
                `Не удалось напомнить (нет Telegram, уведомлений сайта и email): ${pickupReminders.unreachable}. Позвоните этим клиентам.`,
              ]
            : []),
        );
      }

      const result = await sendStaffNotice(message);

      digest = result.ok ? "sent" : result.message;
    }
  } catch (error) {
    console.error("[cron:daily] digest failed", error);
    digest = "failed";
  }

  return Response.json({
    ok: true,
    deletedBazisFiles,
    pickupReminders,
    digest,
  });
}
