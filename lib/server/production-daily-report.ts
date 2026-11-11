import "server-only";

import { RequestType } from "@/generated/prisma";
import { buildDailyReport } from "@/features/production/daily-report";
import { productionDateBounds } from "@/features/production/queue";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { getProductionPlans } from "@/lib/server/production-planning";
import type { getProductionBoard } from "@/lib/server/production-workspace";

type Board = Awaited<ReturnType<typeof getProductionBoard>>;

// Отчёт за день под доской распила: итоги дня по журналу заявок плюс
// где сейчас висят открытые заявки (время по Бишкеку).
export async function getProductionDailyReport(board: Board, day: string) {
  const window = productionDateBounds(day, day);
  const db = hasDatabaseUrl() ? getDb() : null;
  const [events, createdCount] = db
    ? await Promise.all([
        db.operationEvent.findMany({
          where: {
            entityType: "request",
            eventType: { in: ["cutting_stage", "production_flag", "status"] },
            createdAt: window,
          },
          select: {
            entityId: true,
            eventType: true,
            title: true,
            fromStatus: true,
            toStatus: true,
            actorName: true,
          },
          take: 5000,
        }),
        db.request.count({
          where: { type: RequestType.CUTTING_SERVICE, createdAt: window },
        }),
      ])
    : [[], 0];
  // Журнал общий для всех заявок: оставляем только заявки на распил.
  const ids = [...new Set(events.map((event) => event.entityId))];
  const requests =
    db && ids.length
      ? await db.request.findMany({
          where: { id: { in: ids }, type: RequestType.CUTTING_SERVICE },
          select: { id: true, cuttingSheetCount: true },
        })
      : [];
  const cuttingIds = new Set(requests.map((request) => request.id));
  const plans = await getProductionPlans([...cuttingIds]);
  return buildDailyReport({
    day,
    today: board.today,
    now: board.now,
    events: events.filter((event) => cuttingIds.has(event.entityId)),
    createdCount,
    sheets: new Map(
      requests.map((request) => [request.id, request.cuttingSheetCount]),
    ),
    dueDates: new Map(
      [...plans].map(([id, plan]) => [id, plan.dueDate as string | null]),
    ),
    cards: board.cards.map((card) => ({
      id: card.id,
      number: card.number,
      material: card.material,
      column: card.column,
      dueDate: card.dueDate,
      stageSince: card.stageSince,
      isUrgent: card.workflow.isUrgent,
      problemReason: card.workflow.problemReason,
    })),
  });
}
