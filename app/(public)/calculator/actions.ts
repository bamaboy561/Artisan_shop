"use server";

import { revalidatePath } from "next/cache";

import { getOptionalSession } from "@/lib/auth/dal";
import { handleCuttingRequestCreated } from "@/lib/server/commercial-integrations";
import {
  createCuttingRequest,
  isAllowedRequestFile,
  type CuttingRequestSubmission,
} from "@/lib/server/request-inbox";
import { notifyTelegramClientRequestCreated } from "@/lib/server/telegram-client";

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

function getFileList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter(
      (value): value is File =>
        typeof value !== "string" &&
        typeof value.name === "string" &&
        value.size > 0,
    );
}

async function submitCuttingRequest(
  input: SubmitCuttingRequestInput,
): Promise<SubmitCuttingRequestResult> {
  const subject = normalizeRequiredText(input.subject);
  const message = normalizeRequiredText(input.message);
  const contactName = normalizeRequiredText(input.contactName);
  const contactPhone = normalizeRequiredText(input.contactPhone);
  const material = normalizeRequiredText(input.material);
  const edgeOption = normalizeRequiredText(input.edgeOption);
  const messengerType = normalizeOptionalText(input.messengerType);
  const messengerHandle = normalizeOptionalText(input.messengerHandle);
  const contactEmail = normalizeOptionalText(input.contactEmail);
  const uploadedFiles = input.uploadedFiles ?? [];
  const requestMessage =
    uploadedFiles.length > 0
      ? `${message}\nФайлов клиента: ${uploadedFiles.length}`
      : message;

  if (
    !subject ||
    !requestMessage ||
    !contactName ||
    !contactPhone ||
    !material
  ) {
    return {
      ok: false,
      message: "Заполните контактные данные и добавьте хотя бы одну деталь.",
    };
  }

  if (messengerType && !messengerHandle) {
    return {
      ok: false,
      message: "Укажите контакт для выбранного мессенджера.",
    };
  }

  const oversizedFile = uploadedFiles.find(
    (file) => file.size > 25 * 1024 * 1024,
  );

  if (oversizedFile) {
    return {
      ok: false,
      message: `Файл ${oversizedFile.name} превышает лимит 25 МБ.`,
    };
  }

  const unsupportedFile = uploadedFiles.find(
    (file) => !isAllowedRequestFile(file.name),
  );

  if (unsupportedFile) {
    return {
      ok: false,
      message: `Формат файла ${unsupportedFile.name} пока не поддерживается.`,
    };
  }

  try {
    const session = await getOptionalSession();
    const createdRequest = await createCuttingRequest({
      subject,
      message: requestMessage,
      contactName,
      contactPhone,
      contactEmail,
      messengerType,
      messengerHandle,
      material,
      edgeOption,
      estimatedBudget: input.estimatedBudget ?? null,
      deliveryNeeded: input.deliveryNeeded ?? false,
      userId: session?.userId ?? null,
      uploadedFiles,
    });

    if (!createdRequest.duplicate) {
      await handleCuttingRequestCreated({
        id: createdRequest.id,
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
        edgeOption,
        estimatedBudget: input.estimatedBudget ?? null,
        deliveryNeeded: input.deliveryNeeded ?? false,
        message: requestMessage,
        createdAt: new Date().toISOString(),
      });

      await notifyTelegramClientRequestCreated(createdRequest.id);
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

export async function submitCuttingRequestAction(
  input: SubmitCuttingRequestInput,
): Promise<SubmitCuttingRequestResult> {
  return submitCuttingRequest(input);
}

export async function submitCuttingRequestFormAction(
  formData: FormData,
): Promise<SubmitCuttingRequestResult> {
  const payloadValue = formData.get("payload");

  if (typeof payloadValue !== "string") {
    return {
      ok: false,
      message:
        "Не удалось прочитать заявку. Обновите страницу и попробуйте еще раз.",
    };
  }

  try {
    const payload = JSON.parse(payloadValue) as SubmitCuttingRequestInput;

    return submitCuttingRequest({
      ...payload,
      uploadedFiles: getFileList(formData, "files"),
    });
  } catch {
    return {
      ok: false,
      message:
        "Не удалось собрать заявку. Обновите страницу и попробуйте еще раз.",
    };
  }
}
