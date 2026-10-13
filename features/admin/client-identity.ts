import { normalizeWhatsappPhone } from "@/features/admin/whatsapp";

// Клиента у прилавка заводят по имени и телефону, а в базе почта обязательна
// и служит логином. Таким клиентам ставится технический адрес: писать на него
// нельзя, войти с ним в кабинет тоже, пока менеджер не впишет настоящую почту.
const technicalEmailDomain = "clients.artisan.invalid";

export function buildTechnicalClientEmail(normalizedPhone: string) {
  return `tel-${normalizedPhone}@${technicalEmailDomain}`;
}

export function isTechnicalClientEmail(email: string | null | undefined) {
  return Boolean(email?.toLowerCase().endsWith(`@${technicalEmailDomain}`));
}

export function getClientEmailLabel(email: string | null | undefined) {
  return !email || isTechnicalClientEmail(email) ? "Почта не указана" : email;
}

// Единый вид номера для сравнения: 996XXXXXXXXX.
export function normalizeClientPhone(phone: string | null | undefined) {
  return normalizeWhatsappPhone(phone);
}
