import { companyContacts } from "@/lib/site-config";

// Приводит телефон клиента к виду 996XXXXXXXXX для ссылки wa.me.
export function normalizeWhatsappPhone(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("996")) {
    return digits;
  }

  if (digits.length === 10 && digits.startsWith("0")) {
    return `996${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `996${digits}`;
  }

  // Иностранный номер с кодом страны оставляем как есть.
  return digits.length >= 11 ? digits : null;
}

export function buildWhatsappHref(
  phone: string | null | undefined,
  text: string,
) {
  const normalized = normalizeWhatsappPhone(phone);

  return normalized
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`
    : null;
}

const signature = `Artisan, ${companyContacts.phone}`;
const pickup = `Забрать можно: ${companyContacts.address}, ${companyContacts.hours}.`;

export function buildOrderWhatsappText(input: {
  number: string | null;
  contactName: string;
  statusLabel: string;
  isReady: boolean;
}) {
  const number = input.number ? `№ ${input.number}` : "";

  return input.isReady
    ? `Здравствуйте, ${input.contactName}! Ваш заказ ${number} готов. ${pickup} ${signature}`
        .replace(/\s+/g, " ")
        .trim()
    : `Здравствуйте, ${input.contactName}! Пишем по вашему заказу ${number}. Статус: ${input.statusLabel}. ${signature}`
        .replace(/\s+/g, " ")
        .trim();
}

export function buildRequestWhatsappText(input: {
  number: string | null;
  contactName: string;
  statusLabel: string;
  isCutting: boolean;
  isReady: boolean;
}) {
  const number = input.number ? `№ ${input.number}` : "";
  const subject = input.isCutting ? "заявке на распил" : "заявке";

  return input.isReady
    ? `Здравствуйте, ${input.contactName}! Распил по вашей заявке ${number} готов. ${pickup} ${signature}`
        .replace(/\s+/g, " ")
        .trim()
    : `Здравствуйте, ${input.contactName}! Пишем по вашей ${subject} ${number}. Статус: ${input.statusLabel}. ${signature}`
        .replace(/\s+/g, " ")
        .trim();
}
