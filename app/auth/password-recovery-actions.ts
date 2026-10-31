"use server";

import { after } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { isPasswordRecoveryConfigured, recoveryEmailSchema, recoveryPasswordSchema, requestPasswordRecovery, resetRecoveredPassword } from "@/lib/server/password-recovery";

export type PasswordRecoveryState = { success?: boolean; message?: string };

export async function requestPasswordRecoveryAction(_state: PasswordRecoveryState, formData: FormData): Promise<PasswordRecoveryState> {
  const email = recoveryEmailSchema.safeParse(formData.get("email"));
  if (!email.success) return { message: "Введите корректный email." };
  if (!isPasswordRecoveryConfigured()) return { message: "Восстановление через email пока недоступно. Свяжитесь с магазином: +996502788118." };
  after(async () => {
    try { await requestPasswordRecovery(email.data); }
    catch { console.error("[password-recovery:request-failed]"); }
  });
  return { success: true, message: "Если этот email зарегистрирован, мы отправим ссылку для восстановления. Проверьте входящие и папку «Спам». Повторный запрос доступен через минуту." };
}

export async function resetPasswordAction(_state: PasswordRecoveryState, formData: FormData): Promise<PasswordRecoveryState> {
  const token = formData.get("token");
  const password = recoveryPasswordSchema.safeParse({ password: formData.get("password"), confirmPassword: formData.get("confirmPassword") });
  if (!password.success) return { message: "Пароли должны совпадать: от 8 символов, не более 72 байт (для кириллицы обычно до 36 символов)." };
  if (typeof token !== "string") return { message: "Некорректная ссылка. Запросите новую." };
  try {
    if (!await resetRecoveredPassword(token, password.data.password, password.data.confirmPassword)) return { message: "Ссылка недействительна или срок её действия истёк. Запросите новую." };
  } catch {
    console.error("[password-recovery:reset-failed]");
    return { message: "Не удалось изменить пароль. Попробуйте ещё раз позже." };
  }
  await destroySession();
  return { success: true, message: "Пароль изменён. Войдите с новым паролем." };
}
