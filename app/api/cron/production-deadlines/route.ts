import {
  runProductionDailyReport,
  runProductionDeadlineAlerts,
} from "@/lib/server/production-deadline-alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Каждые 30 минут в рабочие часы: начальнику производства — что делать в
// первую очередь (срок сегодня/завтра) и напоминание о просроченных.
// Vercel на текущем тарифе запускает cron только раз в сутки, поэтому
// вызывает GitHub Actions (.github/workflows/production-deadlines.yml).
// Ключ не обязателен: сама рассылка не чаще раза в 25 минут и проверка не
// чаще раза в 5 минут (замок в базе), так что лишние вызовы ничего не шлют.
// После 19:00 тот же вызов один раз в день шлёт итог дня по доске распила.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorized =
    Boolean(cronSecret) &&
    request.headers.get("authorization") === `Bearer ${cronSecret}`;

  try {
    const [result, dailyReport] = await Promise.all([
      runProductionDeadlineAlerts(),
      runProductionDailyReport().catch((error) => {
        console.error("[cron:production-daily-report] failed", error);
        return { status: "failed" };
      }),
    ]);
    return Response.json(
      authorized ? { ok: true, ...result, dailyReport } : { ok: true },
    );
  } catch (error) {
    console.error("[cron:production-deadlines] failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
