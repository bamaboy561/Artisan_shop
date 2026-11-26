import "server-only";

import type { CuttingStage } from "@/generated/prisma";
import { handleRequestUpdated } from "@/lib/server/commercial-integrations";
import { getRequestInboxItemById } from "@/lib/server/request-inbox";

type ManagerSnapshot = Parameters<
  typeof handleRequestUpdated
>[0]["previousManager"];

export type RequestTransitionSnapshot = {
  previousStatus?: string | null;
  previousManager?: ManagerSnapshot;
  previousCuttingStage?: CuttingStage | null;
  previousCuttingPickupCell?: string | null;
  cuttingStageNote?: string | null;
  cuttingStageNoteInternal?: boolean;
};

// Уведомления по заявке (Telegram сотрудникам и клиенту, интеграции) после
// изменения статуса или этапа распила.
export async function syncRequestById(
  requestId: string,
  transition?: RequestTransitionSnapshot,
) {
  const request = await getRequestInboxItemById(requestId);

  if (!request) {
    return;
  }

  await handleRequestUpdated({
    id: request.id,
    userId: request.userId ?? null,
    number: request.number,
    requestType: request.type,
    subject: request.subject,
    status: request.status,
    contactName: request.contactName,
    contactPhone: request.contactPhone,
    contactEmail: request.contactEmail,
    messengerType: request.messengerType,
    messengerHandle: request.messengerHandle,
    material: request.material,
    cuttingSheetCount: request.cuttingSheetCount,
    edgeOption: request.edgeOption,
    estimatedBudget: request.estimatedBudget,
    deliveryNeeded: request.deliveryNeeded,
    message: request.message,
    createdAt: request.createdAt.toISOString(),
    manager: request.manager,
    previousStatus: transition?.previousStatus,
    previousManager: transition?.previousManager,
    cuttingStage: request.cuttingStage,
    cuttingPickupCell: request.cuttingPickupCell,
    previousCuttingStage: transition?.previousCuttingStage,
    previousCuttingPickupCell: transition?.previousCuttingPickupCell,
    cuttingStageNote: transition?.cuttingStageNote,
    cuttingStageNoteInternal: transition?.cuttingStageNoteInternal,
    product: request.product,
  });
}
