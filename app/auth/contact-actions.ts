"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getOptionalSession } from "@/lib/auth/dal";
import { handleCuttingRequestCreated } from "@/lib/server/commercial-integrations";
import { logOperationEvent } from "@/lib/server/operation-events";
import { createContactRequest } from "@/lib/server/request-inbox";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Введите ваше имя"),
  phone: z.string().trim().min(6, "Введите телефон"),
  email: z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(z.email("Введите корректный email").optional()),
  message: z.string().trim().min(10, "Опишите ваш запрос, минимум 10 символов"),
});

export type ContactFormState = {
  message?: string;
  success?: boolean;
};

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const validated = contactSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    message: formData.get("message"),
  });

  if (!validated.success) {
    return {
      message:
        validated.error.issues[0]?.message ?? "Проверьте корректность данных.",
    };
  }

  try {
    const session = await getOptionalSession();
    const subject = "Консультация с сайта";
    const createdRequest = await createContactRequest({
      subject,
      message: validated.data.message,
      contactName: validated.data.name,
      contactPhone: validated.data.phone,
      contactEmail: validated.data.email ?? null,
      userId: session?.userId ?? null,
    });

    if (!createdRequest.duplicate) {
      await logOperationEvent({
        entityType: "request",
        entityId: createdRequest.id,
        eventType: "created",
        title: `Заявка ${createdRequest.number ?? createdRequest.id} создана`,
        description: "Заявка создана из контактной формы.",
        toStatus: "NEW",
        isVisibleToClient: true,
        actor: session ?? null,
        actorName: validated.data.name,
      });

      await handleCuttingRequestCreated({
        id: createdRequest.id,
        userId: session?.userId ?? null,
        number: createdRequest.number ?? null,
        requestType: "CONSULTATION",
        subject,
        status: "NEW",
        contactName: validated.data.name,
        contactPhone: validated.data.phone,
        contactEmail: validated.data.email ?? null,
        messengerType: validated.data.email ? "EMAIL" : null,
        messengerHandle: validated.data.email ?? null,
        deliveryNeeded: false,
        estimatedBudget: null,
        message: validated.data.message,
        createdAt: new Date().toISOString(),
      });
    }

    revalidatePath("/admin");
    revalidatePath("/admin/requests");
    revalidatePath("/account");
    revalidatePath("/account/requests");

    return {
      success: true,
      message: createdRequest.duplicate
        ? createdRequest.number
          ? `Заявка ${createdRequest.number} уже принята. Повторно отправлять не нужно.`
          : "Такая заявка уже принята. Повторно отправлять не нужно."
        : createdRequest.number
          ? `Спасибо! Заявка ${createdRequest.number} отправлена. Менеджер свяжется с вами в ближайшее время.`
          : "Спасибо! Ваша заявка отправлена. Менеджер свяжется с вами в ближайшее время.",
    };
  } catch (error) {
    console.error("Failed to submit contact form", error);

    return {
      message:
        "Не удалось отправить заявку. Попробуйте еще раз или свяжитесь с менеджером напрямую.",
    };
  }
}
