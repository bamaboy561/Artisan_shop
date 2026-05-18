"use server";

import { revalidatePath } from "next/cache";
import path from "node:path";
import { z } from "zod";

import { getOptionalSession } from "@/lib/auth/dal";
import { handleCuttingRequestCreated } from "@/lib/server/commercial-integrations";
import { logOperationEvent } from "@/lib/server/operation-events";
import { createCuttingRequest } from "@/lib/server/request-inbox";
import { notifyTelegramClientRequestCreated } from "@/lib/server/telegram-client";

const serviceRequestSchema = z.object({
  contactName: z.string().trim().min(2, "Укажите имя для заявки."),
  contactPhone: z.string().trim().min(6, "Укажите телефон для связи."),
  contactEmail: z
    .union([z.string().trim().email("Укажите корректный email."), z.literal("")])
    .optional()
    .default(""),
  messengerType: z.string().trim().optional().default(""),
  messengerHandle: z.string().trim().optional().default(""),
  material: z.string().trim().min(2, "Выберите материал."),
  edgeOption: z.string().trim().optional().default(""),
  addressText: z.string().trim().optional().default(""),
  comment: z.string().trim().optional().default(""),
  priority: z.enum(["standard", "urgent"]).optional().default("standard"),
});

export type ServiceRequestFormState = {
  message?: string;
  success?: boolean;
  number?: string | null;
};

function normalizeOptionalText(value: string) {
  return value.trim().length > 0 ? value.trim() : null;
}

function normalizeFiles(rawEntries: FormDataEntryValue[]) {
  return rawEntries.filter(
    (entry): entry is File =>
      typeof entry !== "string" &&
      entry.size > 0 &&
      entry.name.trim().length > 0,
  );
}

function hasAllowedFileExtension(fileName: string) {
  return new Set([
    ".pdf",
    ".xls",
    ".xlsx",
    ".csv",
    ".txt",
    ".doc",
    ".docx",
    ".zip",
    ".rar",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".dwg",
    ".dxf",
  ]).has(path.extname(fileName).toLowerCase());
}

function buildServiceRequestMessage(input: {
  material: string;
  edgeOption: string | null;
  addressText: string | null;
  comment: string | null;
  priority: "standard" | "urgent";
  filesCount: number;
}) {
  const lines = [
    `Материал: ${input.material}`,
    input.edgeOption ? `Кромка: ${input.edgeOption}` : "Кромка: уточнить",
    input.addressText ? `Адрес: ${input.addressText}` : "",
    `Приоритет: ${input.priority === "urgent" ? "срочно" : "стандарт"}`,
    input.filesCount > 0 ? `Файлов: ${input.filesCount}` : "",
  ].filter(Boolean);

  if (input.comment) {
    lines.push("", "Комментарий клиента:", input.comment);
  }

  return lines.join("\n");
}

export async function submitServiceRequestAction(
  _prevState: ServiceRequestFormState,
  formData: FormData,
): Promise<ServiceRequestFormState> {
  const validated = serviceRequestSchema.safeParse({
    contactName: formData.get("contactName"),
    contactPhone: formData.get("contactPhone"),
    contactEmail: formData.get("contactEmail"),
    messengerType: formData.get("messengerType"),
    messengerHandle: formData.get("messengerHandle"),
    material: formData.get("material"),
    edgeOption: formData.get("edgeOption"),
    addressText: formData.get("addressText"),
    comment: formData.get("comment"),
    priority: formData.get("priority"),
  });

  if (!validated.success) {
    return {
      message:
        validated.error.issues[0]?.message ??
        "Проверьте корректность данных.",
    };
  }

  const files = normalizeFiles(formData.getAll("files"));

  if (files.length > 5) {
    return {
      message: "Загрузите не больше 5 файлов в одной заявке.",
    };
  }

  const oversizedFile = files.find((file) => file.size > 25 * 1024 * 1024);

  if (oversizedFile) {
    return {
      message: `Файл ${oversizedFile.name} превышает лимит 25 МБ.`,
    };
  }

  const unsupportedFile = files.find((file) => !hasAllowedFileExtension(file.name));

  if (unsupportedFile) {
    return {
      message: `Формат файла ${unsupportedFile.name} пока не поддерживается.`,
    };
  }

  if (validated.data.messengerType && !validated.data.messengerHandle.trim()) {
    return {
      message: "Укажите контакт для выбранного мессенджера.",
    };
  }

  if (files.length === 0 && !validated.data.comment.trim()) {
    return {
      message:
        "Добавьте файл проекта или коротко опишите задачу для менеджера.",
    };
  }

  const session = await getOptionalSession();
  const contactEmail = normalizeOptionalText(validated.data.contactEmail);
  const messengerType = normalizeOptionalText(validated.data.messengerType);
  const messengerHandle = normalizeOptionalText(validated.data.messengerHandle);
  const edgeOption = normalizeOptionalText(validated.data.edgeOption);
  const addressText = normalizeOptionalText(validated.data.addressText);
  const comment = normalizeOptionalText(validated.data.comment);
  const subject =
    validated.data.priority === "urgent"
      ? "Срочно: распил по файлу"
      : "Распил по файлу";
  const requestMessage = buildServiceRequestMessage({
    material: validated.data.material,
    edgeOption,
    addressText,
    comment,
    priority: validated.data.priority,
    filesCount: files.length,
  });

  try {
    const createdRequest = await createCuttingRequest({
      subject,
      message: requestMessage,
      contactName: validated.data.contactName,
      contactPhone: validated.data.contactPhone,
      contactEmail,
      messengerType,
      messengerHandle,
      material: validated.data.material,
      edgeOption: edgeOption ?? "Уточнить",
      estimatedBudget: null,
      deliveryNeeded: Boolean(addressText),
      addressText,
      userId: session?.userId ?? null,
      uploadedFiles: files,
    });

    if (!createdRequest.duplicate) {
      await logOperationEvent({
        entityType: "request",
        entityId: createdRequest.id,
        eventType: "created",
        title: `Заявка ${createdRequest.number ?? createdRequest.id} создана`,
        description:
          files.length > 0
            ? `Клиент приложил файлов: ${files.length}.`
            : "Заявка создана из формы услуги.",
        toStatus: "NEW",
        isVisibleToClient: true,
        actorName: validated.data.contactName,
      });

      await handleCuttingRequestCreated({
        id: createdRequest.id,
        number: createdRequest.number ?? null,
        requestType: "CUTTING_SERVICE",
        subject,
        status: "NEW",
        contactName: validated.data.contactName,
        contactPhone: validated.data.contactPhone,
        contactEmail,
        messengerType,
        messengerHandle,
        material: validated.data.material,
        edgeOption: edgeOption ?? "Уточнить",
        deliveryNeeded: Boolean(addressText),
        estimatedBudget: null,
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
      success: true,
      number: createdRequest.number ?? null,
      message: createdRequest.duplicate
        ? createdRequest.number
          ? `Заявка ${createdRequest.number} уже принята. Повторно отправлять не нужно.`
          : "Такая заявка уже принята. Повторно отправлять не нужно."
        : createdRequest.number
          ? `Заявка ${createdRequest.number} отправлена. Менеджер увидит файл и свяжется с вами.`
          : "Заявка отправлена. Менеджер увидит файл и свяжется с вами.",
    };
  } catch (error) {
    console.error("Failed to submit service request", error);

    return {
      message:
        "Не удалось отправить заявку. Попробуйте еще раз или свяжитесь с менеджером напрямую.",
    };
  }
}
