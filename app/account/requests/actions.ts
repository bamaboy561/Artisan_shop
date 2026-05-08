"use server";

import { revalidatePath } from "next/cache";

import {
  RequestFileKind,
  RequestStatus,
} from "@/generated/prisma";
import { verifySession } from "@/lib/auth/dal";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { logOperationEvent } from "@/lib/server/operation-events";
import {
  isAllowedRequestFile,
  persistRequestFiles,
} from "@/lib/server/request-inbox";

const requestUploadStatuses = [
  RequestStatus.NEW,
  RequestStatus.IN_REVIEW,
  RequestStatus.QUOTE_SENT,
  RequestStatus.WAITING_FOR_CLIENT,
  RequestStatus.IN_PROGRESS,
];

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getFileList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter(
      (value): value is File =>
        typeof value !== "string" &&
        typeof value.name === "string" &&
        value.size > 0 &&
        isAllowedRequestFile(value.name),
    );
}

function getActorName(session: Awaited<ReturnType<typeof verifySession>>) {
  return (
    [session.firstName, session.lastName].filter(Boolean).join(" ") ||
    session.email
  );
}

export async function uploadAccountRequestFilesAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const session = await verifySession("/login?next=/account/requests");
  const requestId = getString(formData, "requestId");
  const files = getFileList(formData, "files");

  if (!requestId || files.length === 0) {
    return;
  }

  const db = getDb();
  const request = await db.request.findFirst({
    where: {
      id: requestId,
      userId: session.userId,
      status: {
        in: requestUploadStatuses,
      },
    },
    select: {
      id: true,
      number: true,
    },
  });

  if (!request) {
    return;
  }

  const storedFiles = await persistRequestFiles(request.id, files, {
    directorySlug: "client",
    kind: RequestFileKind.CLIENT_UPLOAD,
    isVisibleToClient: true,
    uploadedByUserId: session.userId,
    uploadedByName: getActorName(session),
  });

  if (storedFiles.length === 0) {
    return;
  }

  await db.requestFile.createMany({
    data: storedFiles.map((file) => ({
      requestId: request.id,
      kind: file.kind ?? RequestFileKind.CLIENT_UPLOAD,
      isVisibleToClient: true,
      uploadedByUserId: session.userId,
      uploadedByName: getActorName(session),
      note: null,
      fileName: file.fileName,
      fileUrl: file.fileUrl,
      mimeType: file.mimeType ?? null,
      size: file.size ?? null,
    })),
  });

  await logOperationEvent({
    entityType: "request",
    entityId: request.id,
    eventType: "client_files",
    title: `Клиент добавил файлы: ${storedFiles.length}`,
    description: "Файлы доступны менеджеру в карточке заявки.",
    isVisibleToClient: true,
    actorName: getActorName(session),
  });

  revalidatePath("/account/requests");
  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${request.id}`);
  revalidatePath("/admin/cutting");
}
