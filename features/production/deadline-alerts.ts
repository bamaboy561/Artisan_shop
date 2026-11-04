import { cuttingProblemLabel, daysUntil, deadlineTone } from "./workflow-flags";

// Оповещения начальнику производства о сроках: что делать в первую очередь
// (срок сегодня или завтра) и напоминание о просроченных каждые полчаса.

export type DeadlineAlertCard = {
  id: string;
  number: string | null;
  material: string;
  column:
    | "NEW"
    | "QUEUED"
    | "CUTTING"
    | "EDGING"
    | "DRILLING"
    | "READY_FOR_PICKUP";
  dueDate: string | null;
  isUrgent: boolean;
  problemReason: string | null;
};

// Как часто повторять напоминание о просроченных (с запасом на неровный
// запуск планировщика: вызов каждые 30 минут не должен пропускаться).
export const overdueRepeatMinutes = 25;

// Рабочие часы цеха по Бишкеку: ночью не будим.
export const alertWorkStartHour = 8;
export const alertWorkEndHour = 20;

const listLimit = 15;

// Telegram принимает до 4096 символов в сообщении; оставляем запас на
// заголовок, оформление и экранирование.
export const alertTextBudget = 3300;
const materialMaxLength = 60;

const columnLabels: Record<DeadlineAlertCard["column"], string> = {
  NEW: "не запущен в цех",
  QUEUED: "ждёт распила",
  CUTTING: "распил",
  EDGING: "кромка",
  DRILLING: "присадка",
  READY_FOR_PICKUP: "готов к выдаче",
};

export function isAlertWorkingHour(hour: number) {
  return hour >= alertWorkStartHour && hour < alertWorkEndHour;
}

export function selectDeadlineCards(cards: DeadlineAlertCard[], today: string) {
  const tone = (card: DeadlineAlertCard) =>
    deadlineTone(card.dueDate, today, card.column === "READY_FOR_PICKUP");
  const byDue = (a: DeadlineAlertCard, b: DeadlineAlertCard) =>
    (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
    Number(b.isUrgent) - Number(a.isUrgent);
  const byUrgent = (a: DeadlineAlertCard, b: DeadlineAlertCard) =>
    Number(b.isUrgent) - Number(a.isUrgent) ||
    (a.dueDate ?? "").localeCompare(b.dueDate ?? "");

  return {
    overdue: cards.filter((card) => tone(card) === "overdue").sort(byDue),
    dueToday: cards.filter((card) => tone(card) === "today").sort(byUrgent),
    dueTomorrow: cards.filter((card) => tone(card) === "soon").sort(byUrgent),
  };
}

// Решение, что отправить в этот запуск. Список «в первую очередь»
// отправляем, когда в нём появилась заявка, о которой сегодня ещё не
// сообщали; просроченные — не чаще раза в overdueRepeatMinutes.
export function planDeadlineAlert(input: {
  cards: DeadlineAlertCard[];
  today: string;
  announced: { date: string; ids: string[] } | null;
  overdueDue: boolean;
}) {
  const selected = selectDeadlineCards(input.cards, input.today);
  const priority = [...selected.dueToday, ...selected.dueTomorrow];
  const known = new Set(
    input.announced?.date === input.today ? input.announced.ids : [],
  );
  const newPriorityIds = priority
    .map((card) => card.id)
    .filter((id) => !known.has(id));
  const sendOverdue = input.overdueDue && selected.overdue.length > 0;
  const send = sendOverdue || newPriorityIds.length > 0;

  return {
    ...selected,
    send,
    sendOverdue,
    newPriorityIds,
    announced: {
      date: input.today,
      ids: [...known, ...newPriorityIds],
    },
  };
}

function formatDate(value: string) {
  return value.split("-").reverse().slice(0, 2).join(".");
}

function cardLine(card: DeadlineAlertCard, extra: string[]) {
  const parts = [
    card.number ?? card.id.slice(0, 8).toUpperCase(),
    card.material.length > materialMaxLength
      ? `${card.material.slice(0, materialMaxLength - 1)}…`
      : card.material,
    columnLabels[card.column],
    ...extra,
    ...(card.isUrgent ? ["СРОЧНО"] : []),
    ...(card.problemReason
      ? [`проблема: ${cuttingProblemLabel(card.problemReason)}`]
      : []),
  ];
  return `  • ${parts.filter(Boolean).join(" · ")}`;
}

function listed(
  cards: DeadlineAlertCard[],
  detail: (card: DeadlineAlertCard) => string[],
  budget: { left: number },
) {
  const lines: string[] = [];
  const reserve = 30; // на строку «… и ещё N»
  for (const card of cards.slice(0, listLimit)) {
    const line = cardLine(card, detail(card));
    if (line.length + 1 > budget.left - reserve) break;
    budget.left -= line.length + 1;
    lines.push(line);
  }
  if (cards.length > lines.length) {
    const more = `  … и ещё ${cards.length - lines.length}`;
    budget.left -= more.length + 1;
    lines.push(more);
  }
  return lines;
}

export function buildDeadlineAlert(input: {
  overdue: DeadlineAlertCard[];
  dueToday: DeadlineAlertCard[];
  dueTomorrow: DeadlineAlertCard[];
  newPriorityIds: string[];
  sendOverdue: boolean;
  today: string;
}) {
  const isNew = new Set(input.newPriorityIds);
  const mark = (card: DeadlineAlertCard) =>
    isNew.has(card.id) ? ["новый"] : [];
  const lines: string[] = [];
  const budget = { left: alertTextBudget };
  const header = (text: string) => {
    budget.left -= text.length + 2;
    return text;
  };

  if (input.overdue.length) {
    lines.push(
      header(`Просрочено: ${input.overdue.length}`),
      ...listed(
        input.overdue,
        (card) => {
          const late = -(daysUntil(card.dueDate, input.today) ?? 0);
          return [
            `срок был ${formatDate(card.dueDate!)}, опоздание ${late} дн.`,
          ];
        },
        budget,
      ),
    );
  }
  if (input.dueToday.length) {
    if (lines.length) lines.push("");
    lines.push(
      header(`Срок сегодня: ${input.dueToday.length}`),
      ...listed(input.dueToday, mark, budget),
    );
  }
  if (input.dueTomorrow.length) {
    if (lines.length) lines.push("");
    lines.push(
      header(`Срок завтра: ${input.dueTomorrow.length}`),
      ...listed(input.dueTomorrow, mark, budget),
    );
  }

  const title = input.sendOverdue
    ? `Просроченные заказы: ${input.overdue.length}. Сделайте их в первую очередь`
    : "Подходит срок: сделать в первую очередь";

  return { title, lines };
}
