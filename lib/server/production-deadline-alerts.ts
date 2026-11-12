import "server-only";

import { RoleCode } from "@/generated/prisma";
import {
  buildDeadlineAlert,
  isAlertWorkingHour,
  overdueRepeatMinutes,
  planDeadlineAlert,
} from "@/features/production/deadline-alerts";
import {
  productionBoardPath,
  productionTimeZone,
} from "@/features/production/queue";
import {
  buildDailyReportMessage,
  eveningReportHour,
} from "@/features/production/daily-report";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { getSiteUrl } from "@/lib/seo";
import { sendStaffNotice } from "@/lib/server/commercial-integrations";
import { getProductionDailyReport } from "@/lib/server/production-daily-report";
import { getProductionBoard } from "@/lib/server/production-workspace";
import { sendTelegramDirectMessage } from "@/lib/server/telegram-bot";

// Какие оповещения уже ушли: таблица создаётся сама, как и другие таблицы
// цеха (на продакшене prisma db push не запускается).
let tableReady = false;

async function ensureAlertTable() {
  if (tableReady) return;
  const create = () =>
    getDb().$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProductionDeadlineAlert" (
        "key" TEXT PRIMARY KEY,
        "sentAt" TIMESTAMP(3) NOT NULL,
        "payload" TEXT
      )
    `);
  // Параллельный CREATE из другого экземпляра может упасть на гонке.
  await create().catch(() => create());
  tableReady = true;
}

// Забираем «право» на запуск атомарно: если строка обновлена недавно,
// другой вызов уже работает или только что отработал.
async function claim(key: string, minutes: number) {
  const rows = await getDb().$queryRawUnsafe<{ key: string }[]>(
    `INSERT INTO "ProductionDeadlineAlert" ("key", "sentAt")
     VALUES ($1, CURRENT_TIMESTAMP)
     ON CONFLICT ("key") DO UPDATE SET "sentAt" = CURRENT_TIMESTAMP
     WHERE "ProductionDeadlineAlert"."sentAt" < CURRENT_TIMESTAMP - make_interval(mins => $2)
     RETURNING "key"`,
    key,
    minutes,
  );
  return rows.length > 0;
}

async function readState(key: string) {
  const rows = await getDb().$queryRawUnsafe<
    { sentAt: Date; payload: string | null }[]
  >(
    `SELECT "sentAt", "payload" FROM "ProductionDeadlineAlert" WHERE "key" = $1`,
    key,
  );
  return rows[0] ?? null;
}

async function writeState(key: string, payload: string | null) {
  await getDb().$executeRawUnsafe(
    `INSERT INTO "ProductionDeadlineAlert" ("key", "sentAt", "payload")
     VALUES ($1, CURRENT_TIMESTAMP, $2)
     ON CONFLICT ("key") DO UPDATE SET "sentAt" = CURRENT_TIMESTAMP, "payload" = $2`,
    key,
    payload,
  );
}

function parseAnnounced(payload: string | null | undefined) {
  if (!payload) return null;
  try {
    const value = JSON.parse(payload) as { date?: unknown; ids?: unknown };
    if (typeof value.date === "string" && Array.isArray(value.ids)) {
      return {
        date: value.date,
        ids: value.ids.filter((id): id is string => typeof id === "string"),
      };
    }
  } catch {}
  return null;
}

function bishkekHour(date: Date) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: productionTimeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date),
  );
}

// Лично начальникам производства, у кого подключён Telegram; если ни
// одному не дошло — в тему «Распил» рабочего чата.
async function deliver(message: { title: string; lines: string[] }) {
  const boardUrl = `${getSiteUrl()}${productionBoardPath}`;
  const managers = await getDb().user.findMany({
    where: {
      isActive: true,
      telegramChatId: { not: null },
      role: { code: RoleCode.PRODUCTION_MANAGER },
    },
    select: { id: true },
  });
  let personal = 0;

  for (const manager of managers) {
    try {
      const sent = await sendTelegramDirectMessage(manager.id, {
        ...message,
        category: "requests",
        actions: [{ text: "Открыть доску цеха", url: boardUrl }],
      });
      if (sent) personal += 1;
    } catch (error) {
      console.error("[production-deadlines] direct message failed", error);
    }
  }

  if (personal > 0) return { ok: true, to: `personal:${personal}` };

  const result = await sendStaffNotice({
    ...message,
    threadKey: "cutting",
    actions: [{ label: "Открыть доску цеха", url: boardUrl }],
  });
  return { ok: result.ok, to: result.ok ? "cutting-thread" : result.message };
}

export async function runProductionDeadlineAlerts(now = new Date()) {
  if (!hasDatabaseUrl()) return { status: "no-database" };
  if (!isAlertWorkingHour(bishkekHour(now))) return { status: "off-hours" };

  await ensureAlertTable();
  // Защита от двойного запуска и от частых вызовов извне.
  if (!(await claim("run", 5))) return { status: "recently-checked" };

  const board = await getProductionBoard();
  if (!board.planning) return { status: "planning-off" };

  const [overdueState, priorityState] = await Promise.all([
    readState("overdue"),
    readState("priority"),
  ]);
  const overdueDue =
    !overdueState ||
    now.getTime() - overdueState.sentAt.getTime() >=
      overdueRepeatMinutes * 60_000;
  const plan = planDeadlineAlert({
    cards: board.cards.map((card) => ({
      id: card.id,
      number: card.number,
      material: card.material,
      column: card.column,
      dueDate: card.dueDate,
      isUrgent: card.workflow.isUrgent,
      problemReason: card.workflow.problemReason,
    })),
    today: board.today,
    announced: parseAnnounced(priorityState?.payload),
    overdueDue,
  });

  if (!plan.send) {
    return { status: "nothing-new", overdue: plan.overdue.length };
  }

  const result = await deliver(
    buildDeadlineAlert({ ...plan, today: board.today }),
  );

  if (result.ok) {
    if (plan.sendOverdue) await writeState("overdue", null);
    await writeState("priority", JSON.stringify(plan.announced));
  }

  return {
    status: result.ok ? "sent" : "failed",
    to: result.to,
    overdue: plan.overdue.length,
    dueToday: plan.dueToday.length,
    dueTomorrow: plan.dueTomorrow.length,
  };
}

// Вечерний итог дня по доске распила: один раз в день, с первого запуска
// после 19:00 по Бишкеку. Уходит в тему «Распил» рабочего чата и лично
// начальникам производства, у кого подключён Telegram.
export async function runProductionDailyReport(now = new Date()) {
  if (!hasDatabaseUrl()) return { status: "no-database" };
  const hour = bishkekHour(now);
  if (hour < eveningReportHour || hour >= 23) return { status: "not-yet" };

  await ensureAlertTable();
  const board = await getProductionBoard();
  const key = `daily-report:${board.today}`;
  // Запись «отправлено сегодня» ставим заранее, чтобы два вызова подряд не
  // прислали отчёт дважды; при ошибке снимаем, и следующий вызов повторит.
  if (!(await claim(key, 24 * 60))) return { status: "already-sent" };

  try {
    const report = await getProductionDailyReport(board, board.today);
    const message = buildDailyReportMessage(report, board.today);
    const boardUrl = `${getSiteUrl()}${productionBoardPath}#daily-report`;
    const topic = await sendStaffNotice({
      ...message,
      threadKey: "cutting",
      actions: [{ label: "Открыть отчёт", url: boardUrl }],
    });
    const managers = await getDb().user.findMany({
      where: {
        isActive: true,
        telegramChatId: { not: null },
        role: { code: RoleCode.PRODUCTION_MANAGER },
      },
      select: { id: true },
    });
    let personal = 0;
    for (const manager of managers) {
      try {
        const sent = await sendTelegramDirectMessage(manager.id, {
          ...message,
          category: "requests",
          actions: [{ text: "Открыть отчёт", url: boardUrl }],
        });
        if (sent) personal += 1;
      } catch (error) {
        console.error("[production-daily-report] direct message failed", error);
      }
    }
    if (!topic.ok && personal === 0) throw new Error(topic.message);
    return { status: "sent", topic: topic.ok, personal };
  } catch (error) {
    await getDb().$executeRawUnsafe(
      `DELETE FROM "ProductionDeadlineAlert" WHERE "key" = $1`,
      key,
    );
    throw error;
  }
}
