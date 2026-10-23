"use server";

import { revalidatePath } from "next/cache";

import { getOptionalSession } from "@/lib/auth/dal";
import { handleCuttingRequestCreated } from "@/lib/server/commercial-integrations";
import {
  createCuttingRequest,
  isAllowedRequestFile,
  type CuttingRequestSubmission,
} from "@/lib/server/request-inbox";
import { withBazisExtensions } from "@/lib/bazis-file";

export type SubmitCuttingRequestInput = CuttingRequestSubmission;

export type SubmitCuttingRequestResult =
  | {
      ok: true;
      number: string | null;
    }
  | {
      ok: false;
      message: string;
    };

function normalizeRequiredText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

const MAX_ATTACHMENTS = 5;

function readAttachments(formData?: FormData | null) {
  if (!formData) {
    return [] as File[];
  }

  return formData
    .getAll("files")
    .filter(
      (entry): entry is File =>
        typeof entry !== "string" &&
        entry.size > 0 &&
        entry.name.trim().length > 0,
    );
}

export async function submitCuttingRequestAction(
  input: SubmitCuttingRequestInput,
  attachments?: FormData | null,
): Promise<SubmitCuttingRequestResult> {
  const files = await withBazisExtensions(readAttachments(attachments));
  const subject = normalizeRequiredText(input.subject);
  const message = normalizeRequiredText(input.message);
  const contactName = normalizeRequiredText(input.contactName);
  const contactPhone = normalizeRequiredText(input.contactPhone);
  const material = normalizeRequiredText(input.material);
  const edgeOption = normalizeRequiredText(input.edgeOption);
  const messengerType = normalizeOptionalText(input.messengerType);
  const messengerHandle = normalizeOptionalText(input.messengerHandle);
  const contactEmail = normalizeOptionalText(input.contactEmail);
  const cuttingSheetCount = input.cuttingSheetCount ?? null;
  const cuttingEdgeMeters = input.cuttingEdgeMeters ?? null;

  if (!subject || !message || !contactName || !contactPhone || !material) {
    return {
      ok: false,
      message: "Заполните контактные данные и добавьте хотя бы одну деталь.",
    };
  }

  if (files.length > MAX_ATTACHMENTS) {
    return {
      ok: false,
      message: `Можно прикрепить до ${MAX_ATTACHMENTS} файлов.`,
    };
  }

  const unsupportedFile = files.find(
    (file) => !isAllowedRequestFile(file.name),
  );

  if (unsupportedFile) {
    return {
      ok: false,
      message: `Формат файла ${unsupportedFile.name} пока не поддерживается.`,
    };
  }

  if (messengerType && !messengerHandle) {
    return {
      ok: false,
      message: "Укажите контакт для выбранного мессенджера.",
    };
  }

  if (
    cuttingSheetCount !== null &&
    (!Number.isInteger(cuttingSheetCount) ||
      cuttingSheetCount < 1 ||
      cuttingSheetCount > 10000)
  ) {
    return {
      ok: false,
      message: "Проверьте количество листов в карте раскроя.",
    };
  }

  if (
    cuttingEdgeMeters !== null &&
    (!Number.isFinite(cuttingEdgeMeters) ||
      cuttingEdgeMeters <= 0 ||
      cuttingEdgeMeters > 100000)
  ) {
    return {
      ok: false,
      message: "Проверьте метраж кромки в карте раскроя.",
    };
  }

  try {
    const session = await getOptionalSession();
    const createdRequest = await createCuttingRequest({
      subject,
      message,
      contactName,
      contactPhone,
      contactEmail,
      messengerType,
      messengerHandle,
      material,
      cuttingSheetCount,
      cuttingEdgeMeters,
      edgeOption,
      estimatedBudget: input.estimatedBudget ?? null,
      deliveryNeeded: input.deliveryNeeded ?? false,
      userId: session?.userId ?? null,
      uploadedFiles: files,
    });

    if (!createdRequest.duplicate) {
      await handleCuttingRequestCreated({
        id: createdRequest.id,
        userId: session?.userId ?? null,
        number: createdRequest.number ?? null,
        requestType: "CUTTING_SERVICE",
        subject,
        status: "NEW",
        contactName,
        contactPhone,
        contactEmail,
        messengerType,
        messengerHandle,
        material,
        cuttingSheetCount,
        cuttingEdgeMeters,
        edgeOption,
        estimatedBudget: input.estimatedBudget ?? null,
        deliveryNeeded: input.deliveryNeeded ?? false,
        message,
        createdAt: new Date().toISOString(),
      });
    }

    revalidatePath("/admin");
    revalidatePath("/admin/requests");
    revalidatePath("/account");
    revalidatePath("/account/requests");

    return {
      ok: true,
      number: createdRequest.number ?? null,
    };
  } catch (error) {
    console.error("Failed to submit cutting request", error);

    return {
      ok: false,
      message:
        "Не удалось отправить заявку. Попробуйте еще раз или свяжитесь с менеджером.",
    };
  }
}
