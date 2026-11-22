import { RequestStatus } from "@/generated/prisma";

// Первая строка сообщения у распила, созданного менеджером в админке.
// Всё остальное (калькулятор, форма распила, обращения) пришло с сайта.
export const ADMIN_CREATED_REQUEST_MARKER = "Создано менеджером в админке.";

export function isSiteRequest(request: { message: string | null }) {
  return !(request.message ?? "").startsWith(ADMIN_CREATED_REQUEST_MARKER);
}

// Красным подсвечиваем заявку с сайта, пока её никто не взял в работу.
export function needsSiteAttention(request: {
  message: string | null;
  status: RequestStatus;
}) {
  return isSiteRequest(request) && request.status === RequestStatus.NEW;
}
