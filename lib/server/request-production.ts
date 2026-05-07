import { RequestFileKind, RequestStatus } from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";
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

  return getDb().request.update({
    where: { id: input.requestId },
    data: {
      quotedTotal: input.quotedTotal ?? null,
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
