// Сообщение клиенту о смене статуса заказа: для каждого этапа свой текст,
// чтобы было понятно, что произошло и что делать дальше.
type OrderStatusCode =
  | "NEW"
  | "RESERVED"
  | "CONFIRMED"
  | "PAID"
  | "IN_PRODUCTION"
  | "READY_FOR_PICKUP"
  | "SHIPPED"
  | "COMPLETED"
  | "CANCELED";

type Contacts = { address: string; hours: string; phone: string };

export function buildOrderStatusClientText(input: {
  number: string;
  status: string;
  statusLabel: string;
  total: string;
  contacts: Contacts;
}) {
  const { number, contacts } = input;
  const sum = `Сумма: ${input.total}`;
  const texts: Record<OrderStatusCode, { title: string; lines: string[] }> = {
    NEW: {
      title: `Заказ ${number} принят`,
      lines: [sum, "Менеджер проверит заказ и свяжется с вами."],
    },
    RESERVED: {
      title: `Заказ ${number}: товар забронирован`,
      lines: [sum, "Товар отложен для вас. Оплата на кассе."],
    },
    CONFIRMED: {
      title: `Заказ ${number} подтверждён`,
      lines: [sum, "Менеджер проверил заказ. Оплата на кассе."],
    },
    PAID: {
      title: `Заказ ${number} оплачен`,
      lines: [
        sum,
        "Оплата получена, спасибо. Сообщим, когда заказ будет готов.",
      ],
    },
    IN_PRODUCTION: {
      title: `Заказ ${number} в работе`,
      lines: ["Мы начали готовить заказ. Сообщим, когда он будет готов."],
    },
    READY_FOR_PICKUP: {
      title: `Заказ ${number} готов к выдаче`,
      lines: [
        `Адрес: ${contacts.address}`,
        `Часы работы: ${contacts.hours}`,
        `Телефон: ${contacts.phone}`,
      ],
    },
    SHIPPED: {
      title: `Заказ ${number} передан в доставку`,
      lines: [`Телефон для связи: ${contacts.phone}`],
    },
    COMPLETED: {
      title: `Заказ ${number} выдан`,
      lines: [sum, "Спасибо, что выбрали нас."],
    },
    CANCELED: {
      title: `Заказ ${number} отменён`,
      lines: [`Если это ошибка, позвоните нам: ${contacts.phone}`],
    },
  };

  return (
    texts[input.status as OrderStatusCode] ?? {
      title: `Статус заказа ${number} обновлён`,
      lines: [`Теперь: ${input.statusLabel}`, sum],
    }
  );
}
