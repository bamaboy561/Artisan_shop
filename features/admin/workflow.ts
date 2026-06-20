import { OrderStatus, RequestStatus } from "@/generated/prisma";

export const requestWorkflowSteps = [
  {
    status: RequestStatus.NEW,
    label: "Новая",
    summary: "Заявка пришла с сайта или калькулятора.",
  },
  {
    status: RequestStatus.IN_REVIEW,
    label: "Расчет",
    summary: "Менеджер проверяет материал, детали, кромку и файлы.",
  },
  {
    status: RequestStatus.QUOTE_SENT,
    label: "КП",
    summary: "Клиенту отправлена цена и условия.",
  },
  {
    status: RequestStatus.WAITING_FOR_CLIENT,
    label: "Ожидание",
    summary: "Команда ждет подтверждение или правки клиента.",
  },
  {
    status: RequestStatus.IN_PROGRESS,
    label: "В работе",
    summary: "Заявка подтверждена и готовится к заказу/производству.",
  },
  {
    status: RequestStatus.COMPLETED,
    label: "Закрыта",
    summary: "Заявка обработана, заказ создан или задача завершена.",
  },
] as const;

export const requestQuickTransitions: Record<
  RequestStatus,
  Array<{
    status: RequestStatus;
    label: string;
    intent?: "accent" | "secondary";
  }>
> = {
  [RequestStatus.NEW]: [
    {
      status: RequestStatus.IN_REVIEW,
      label: "Взять на расчет",
      intent: "accent",
    },
    { status: RequestStatus.CANCELED, label: "Отменить", intent: "secondary" },
  ],
  [RequestStatus.IN_REVIEW]: [
    {
      status: RequestStatus.QUOTE_SENT,
      label: "КП отправлено",
      intent: "accent",
    },
    {
      status: RequestStatus.WAITING_FOR_CLIENT,
      label: "Запросить уточнение",
      intent: "secondary",
    },
  ],
  [RequestStatus.QUOTE_SENT]: [
    {
      status: RequestStatus.WAITING_FOR_CLIENT,
      label: "Ждем клиента",
      intent: "secondary",
    },
    {
      status: RequestStatus.IN_PROGRESS,
      label: "Клиент подтвердил",
      intent: "accent",
    },
  ],
  [RequestStatus.WAITING_FOR_CLIENT]: [
    {
      status: RequestStatus.IN_REVIEW,
      label: "Вернуть на расчет",
      intent: "secondary",
    },
    { status: RequestStatus.IN_PROGRESS, label: "В работу", intent: "accent" },
  ],
  [RequestStatus.IN_PROGRESS]: [
    {
      status: RequestStatus.COMPLETED,
      label: "Завершить заявку",
      intent: "accent",
    },
  ],
  [RequestStatus.COMPLETED]: [],
  [RequestStatus.CANCELED]: [
    {
      status: RequestStatus.IN_REVIEW,
      label: "Вернуть в работу",
      intent: "secondary",
    },
  ],
};

export const orderWorkflowSteps = [
  {
    status: OrderStatus.NEW,
    label: "Новый",
    summary: "Заказ создан и ожидает подтверждения менеджера.",
  },
  {
    status: OrderStatus.CONFIRMED,
    label: "Подтвержден",
    summary: "Состав, сумма и условия согласованы.",
  },
  {
    status: OrderStatus.IN_PRODUCTION,
    label: "Производство",
    summary: "Заказ находится в работе цеха или комплектации.",
  },
  {
    status: OrderStatus.READY_FOR_PICKUP,
    label: "Готов",
    summary: "Заказ готов к выдаче клиенту.",
  },
  {
    status: OrderStatus.SHIPPED,
    label: "Отгрузка",
    summary: "Заказ передан в доставку или выдан.",
  },
  {
    status: OrderStatus.COMPLETED,
    label: "Закрыт",
    summary: "Заказ завершен.",
  },
] as const;

export const orderQuickTransitions: Record<
  OrderStatus,
  Array<{ status: OrderStatus; label: string; intent?: "accent" | "secondary" }>
> = {
  [OrderStatus.NEW]: [
    { status: OrderStatus.CONFIRMED, label: "Подтвердить", intent: "accent" },
    { status: OrderStatus.CANCELED, label: "Отменить", intent: "secondary" },
  ],
  [OrderStatus.CONFIRMED]: [
    {
      status: OrderStatus.IN_PRODUCTION,
      label: "В производство",
      intent: "accent",
    },
  ],
  [OrderStatus.IN_PRODUCTION]: [
    {
      status: OrderStatus.READY_FOR_PICKUP,
      label: "Готов к выдаче",
      intent: "accent",
    },
  ],
  [OrderStatus.READY_FOR_PICKUP]: [
    { status: OrderStatus.SHIPPED, label: "Отгружен", intent: "accent" },
    { status: OrderStatus.COMPLETED, label: "Завершить", intent: "secondary" },
  ],
  [OrderStatus.SHIPPED]: [
    { status: OrderStatus.COMPLETED, label: "Закрыть заказ", intent: "accent" },
  ],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELED]: [
    {
      status: OrderStatus.CONFIRMED,
      label: "Вернуть заказ",
      intent: "secondary",
    },
  ],
};
