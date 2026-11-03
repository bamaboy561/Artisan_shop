import "server-only";

import { CuttingStage } from "@/generated/prisma";
import { buildProductionDigest } from "@/features/production/digest";
import { productionBoardPath } from "@/features/production/queue";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { getSiteUrl } from "@/lib/seo";
import { getProductionBoard } from "@/lib/server/production-workspace";

// Утренняя сводка цеха: данные доски распила плюс итоги вчерашнего дня по
// журналу действий (время по Бишкеку).
export async function getProductionDigest() {
  if (!hasDatabaseUrl()) return null;
  const board = await getProductionBoard();
  const todayStart = new Date(`${board.today}T00:00:00+06:00`);
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const window = { gte: yesterdayStart, lt: todayStart };
  const db = getDb();
  const [issued, cutEvents, problems] = await Promise.all([
    db.operationEvent.count({
      where: {
        entityType: "request",
        eventType: "status",
        title: "Заказ выдан клиенту",
        createdAt: window,
      },
    }),
    db.operationEvent.findMany({
      where: {
        entityType: "request",
        eventType: "cutting_stage",
        fromStatus: CuttingStage.CUTTING,
        // Возврат в очередь (CUTTING → ACCEPTED) — не распил.
        toStatus: {
          in: [
            CuttingStage.EDGING,
            CuttingStage.DRILLING,
            CuttingStage.READY_FOR_PICKUP,
          ],
        },
        createdAt: window,
      },
      select: { entityId: true },
    }),
    db.operationEvent.count({
      where: {
        entityType: "request",
        eventType: "production_flag",
        title: { startsWith: "Проблема:" },
        createdAt: window,
      },
    }),
  ]);
  const cutIds = [...new Set(cutEvents.map((event) => event.entityId))];
  const cutRequests = cutIds.length
    ? await db.request.findMany({
        where: { id: { in: cutIds } },
        select: { cuttingSheetCount: true },
      })
    : [];
  return buildProductionDigest({
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
    truncated: board.truncated,
    yesterday: {
      issued,
      cutRequests: cutRequests.length,
      cutSheets: cutRequests.reduce(
        (sum, request) => sum + (request.cuttingSheetCount ?? 0),
        0,
      ),
      problems,
    },
    boardUrl: `${getSiteUrl()}${productionBoardPath}`,
  });
}
