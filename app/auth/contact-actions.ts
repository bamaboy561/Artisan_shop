"use server";

import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Введите ваше имя"),
  phone: z.string().trim().min(6, "Введите телефон"),
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.email("Введите корректный email").optional()),
  message: z.string().trim().min(10, "Опишите ваш запрос (минимум 10 символов)"),
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

  // TODO: Подключить отправку email/Telegram/сохранение в БД.
  // Данные формы доступны в validated.data: { name, phone, email?, message }

  return {
    success: true,
    message:
      "Спасибо! Ваша заявка отправлена. Менеджер свяжется с вами в ближайшее время.",
  };
}
