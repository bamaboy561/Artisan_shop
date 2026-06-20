"use server";

import { revalidatePath } from "next/cache";

import { getOptionalSession } from "@/lib/auth/dal";
import { handleCuttingRequestCreated } from "@/lib/server/commercial-integrations";
import {
  createCuttingRequest,
  type CuttingRequestSubmission,
} from "@/lib/server/request-inbox";

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

export async function submitCuttingRequestAction(
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

  if (!subject || !message || !contactName || !contactPhone || !material) {
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
      edgeOption,
      estimatedBudget: input.estimatedBudget ?? null,
      deliveryNeeded: input.deliveryNeeded ?? false,
      userId: session?.userId ?? null,
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
