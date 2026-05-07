import "server-only";

import { getDb, hasDatabaseUrl } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth/session";

export type OperationEntityType = "request" | "order";

export type OperationEventDto = {
  id: string;
  entityType: OperationEntityType;
  entityId: string;
  eventType: string;
  title: string;
  description: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  actorId: string | null;
  actorName: string | null;
  isVisibleToClient: boolean;
  createdAt: Date;
};

export type CreateOperationEventInput = {
  entityType: OperationEntityType;
  entityId: string;
  eventType:
    | "created"
    | "status"
    | "manager"
    | "converted"
    | "system"
    | "manager_note"
    | "client_note"
    | "production_result"
    | "result_files"
    | "fulfillment";
  title: string;
  description?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  actor?: SessionPayload | null;
  actorName?: string | null;
  isVisibleToClient?: boolean;
};

function getActorName(input: CreateOperationEventInput) {
  if (input.actorName) {
    return input.actorName;
  }

  if (!input.actor) {
    return null;
  }

  return (
    [input.actor.firstName, input.actor.lastName].filter(Boolean).join(" ") ||
    input.actor.email
  );
}

export async function logOperationEvent(input: CreateOperationEventInput) {
  if (!hasDatabaseUrl()) {
    return;
  }

  try {
    await getDb().operationEvent.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        eventType: input.eventType,
        title: input.title,
        description: input.description ?? null,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        isVisibleToClient: input.isVisibleToClient ?? false,
        actorId: input.actor?.userId ?? null,
        actorName: getActorName(input),
      },
    });
  } catch (error) {
    console.warn("Operation event was not saved", error);
  }
}

export async function getClientOperationEvents(
  entityType: OperationEntityType,
  entityIds: string[],
): Promise<OperationEventDto[]> {
  if (!hasDatabaseUrl() || entityIds.length === 0) {
    return [];
  }

  try {
    const events = await getDb().operationEvent.findMany({
      where: {
        entityType,
        entityId: {
          in: entityIds,
        },
        isVisibleToClient: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return events.map((event) => ({
      ...event,
      entityType: event.entityType as OperationEntityType,
    }));
  } catch (error) {
    console.warn("Client operation events are not available", error);
    return [];
  }
}

export async function getOperationEvents(
  entityType: OperationEntityType,
  entityId: string,
): Promise<OperationEventDto[]> {
  if (!hasDatabaseUrl()) {
    return [];
  }

  try {
    const events = await getDb().operationEvent.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
    });

    return events.map((event) => ({
      ...event,
      entityType: event.entityType as OperationEntityType,
    }));
  } catch (error) {
    console.warn("Operation events are not available", error);
    return [];
  }
}
