import {
  CuttingStage,
  RequestFileKind,
  RequestStatus,
  RequestType,
} from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { readCuttingPrice } from "@/lib/server/cutting-pricing";
import {
  isAllowedRequestFile,
  persistRequestFiles,
} from "@/lib/server/request-inbox";

type ActorSnapshot = {
  userId?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type RequestResultInput = {
  requestId: string;
  quotedTotal?: number | null;
  productionComment?: string | null;
  status?: RequestStatus | null;
};

type RequestNoteInput = {
  requestId: string;
  body: string;
  isVisibleToClient: boolean;
  actor: ActorSnapshot;
};

type RequestResultFilesInput = {
  requestId: string;
  files: File[];
  note?: string | null;
  isVisibleToClient: boolean;
  actor: ActorSnapshot;
};

type CuttingProgressInput = {
  requestId: string;
  stage: CuttingStage;
  pickupCell?: string | null;
  expectedStage?: CuttingStage | null;
};

function getActorName(actor: ActorSnapshot) {
  return (
    [actor.firstName, actor.lastName].filter(Boolean).join(" ") ||
    actor.email ||
    "Менеджер Artisan"
  );
}

export async function addRequestManagerNote(input: RequestNoteInput) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  return getDb().managerNote.create({
    data: {
      entityType: "request",
      entityId: input.requestId,
      requestId: input.requestId,
      body: input.body,
      isVisibleToClient: input.isVisibleToClient,
      authorId: input.actor.userId ?? null,
      authorName: getActorName(input.actor),
    },
  });
}

export async function updateRequestProductionResult(input: RequestResultInput) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  return getDb().$transaction(async (tx) => {
    const price = await readCuttingPrice(tx, input.requestId);
    return tx.request.update({
    where: { id: input.requestId },
    data: {
      ...(!price ? { quotedTotal: input.quotedTotal ?? null } : {}),
      productionComment: input.productionComment ?? null,
      ...(input.status ? { status: input.status } : {}),
    },
    select: {
      id: true,
      number: true,
      status: true,
      quotedTotal: true,
      productionComment: true,
    },
    });
  }, { isolationLevel: "Serializable" });
}

export async function updateRequestCuttingProgress(
  input: CuttingProgressInput,
) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const db = getDb();
  const request = await db.request.findUnique({
    where: { id: input.requestId },
    select: {
      id: true,
      type: true,
      status: true,
      cuttingStage: true,
      cuttingPickupCell: true,
      cuttingStageUpdatedAt: true,
    },
  });

  if (!request || request.type !== RequestType.CUTTING_SERVICE) {
    return null;
  }

  const pickupCell =
    input.stage === CuttingStage.READY_FOR_PICKUP
      ? input.pickupCell?.trim().slice(0, 64) || null
      : null;
  const progressChanged =
    request.cuttingStage !== input.stage ||
    request.cuttingPickupCell !== pickupCell;
  const shouldMoveToProduction =
    request.status !== RequestStatus.CANCELED &&
    request.status !== RequestStatus.COMPLETED;

  const data = {
    cuttingStage: input.stage,
    cuttingPickupCell: pickupCell,
    cuttingStageUpdatedAt: progressChanged
      ? new Date()
      : request.cuttingStageUpdatedAt,
    ...(shouldMoveToProduction ? { status: RequestStatus.IN_PROGRESS } : {}),
  };
  const select = {
    id: true,
    status: true,
    cuttingStage: true,
    cuttingPickupCell: true,
    cuttingStageUpdatedAt: true,
  } as const;

  if (Object.prototype.hasOwnProperty.call(input, "expectedStage")) {
    const result = await db.request.updateMany({
      where: {
        id: input.requestId,
        type: RequestType.CUTTING_SERVICE,
        cuttingStage: input.expectedStage ?? null,
        status: {
          notIn: [RequestStatus.CANCELED, RequestStatus.COMPLETED],
        },
      },
      data,
    });

    if (result.count === 0) {
      return null;
    }

    return db.request.findUnique({
      where: { id: input.requestId },
      select,
    });
  }

  return db.request.update({
    where: { id: input.requestId },
    data,
    select: {
      ...select,
    },
  });
}

export async function addRequestResultFiles(input: RequestResultFilesInput) {
  if (!hasDatabaseUrl()) {
    return 0;
  }

  const allowedFiles = input.files.filter(
    (file) =>
      file &&
      typeof file.name === "string" &&
      file.size > 0 &&
      isAllowedRequestFile(file.name),
  );

  if (allowedFiles.length === 0) {
    return 0;
  }

  const storedFiles = await persistRequestFiles(input.requestId, allowedFiles, {
    directorySlug: "results",
    kind: RequestFileKind.MANAGER_RESULT,
    isVisibleToClient: input.isVisibleToClient,
    uploadedByUserId: input.actor.userId ?? null,
    uploadedByName: getActorName(input.actor),
    note: input.note ?? null,
  });

  await getDb().requestFile.createMany({
    data: storedFiles.map((file) => ({
      requestId: input.requestId,
      kind: file.kind ?? RequestFileKind.MANAGER_RESULT,
      isVisibleToClient: file.isVisibleToClient ?? input.isVisibleToClient,
      uploadedByUserId: file.uploadedByUserId ?? null,
      uploadedByName: file.uploadedByName ?? getActorName(input.actor),
      note: file.note ?? null,
      fileName: file.fileName,
      fileUrl: file.fileUrl,
      mimeType: file.mimeType ?? null,
      size: file.size ?? null,
    })),
  });

  return storedFiles.length;
}
