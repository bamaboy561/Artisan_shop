import { cuttingProblemLabel, deadlineTone } from "./workflow-flags";

export type DigestCard = {
  number: string | null;
  id: string;
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

export type ProductionDigestInput = {
  cards: DigestCard[];
  today: string;
  // На доске показаны не все открытые заявки: цифры ниже неполные.
  truncated?: boolean;
  yesterday: {
    issued: number;
    cutRequests: number;
    cutSheets: number;
    problems: number;
  };
  boardUrl: string;
};

const listLimit = 5;

function formatDate(value: string) {
  return value.split("-").reverse().slice(0, 2).join(".");
}

function label(card: DigestCard) {
  return `${card.number ?? card.id.slice(0, 8).toUpperCase()} · ${card.material}`;
}

function listed(cards: DigestCard[], detail: (card: DigestCard) => string) {
  return [
    ...cards
      .slice(0, listLimit)
      .map((card) => `  • ${label(card)}${detail(card)}`),
    ...(cards.length > listLimit
      ? [`  … и ещё ${cards.length - listLimit}`]
      : []),
  ];
}

// Утренняя сводка цеха для рабочего Telegram: что в работе, что горит и
// итоги вчерашнего дня.
export function buildProductionDigest(input: ProductionDigestInput) {
  const count = (column: DigestCard["column"]) =>
    input.cards.filter((card) => card.column === column).length;
  const inWork = input.cards.filter((card) => card.column !== "NEW");
  const tone = (card: DigestCard) =>
    deadlineTone(card.dueDate, input.today, card.column === "READY_FOR_PICKUP");
  const overdue = inWork.filter((card) => tone(card) === "overdue");
  const dueToday = inWork.filter((card) => tone(card) === "today");
  const urgent = input.cards.filter(
    (card) => card.isUrgent && card.column !== "READY_FOR_PICKUP",
  );
  const problems = input.cards.filter((card) => card.problemReason);
  const unplanned = inWork.filter(
    (card) => !card.dueDate && card.column !== "READY_FOR_PICKUP",
  );

  const lines = [
    ...(input.truncated
      ? [
          "Внимание: открытых заявок больше 400, ниже учтены только первые 400. Закройте выданные.",
          "",
        ]
      : []),
    `Вчера: распилено ${input.yesterday.cutSheets} лист. по ${input.yesterday.cutRequests} заявкам, выдано ${input.yesterday.issued}, проблем отмечено ${input.yesterday.problems}`,
    "",
    `В работе ${inWork.length}: ждут распила ${count("QUEUED")}, распил ${count("CUTTING")}, кромка ${count("EDGING")}, присадка ${count("DRILLING")}, к выдаче ${count("READY_FOR_PICKUP")}`,
    `Не запущены в цех: ${count("NEW")}`,
  ];

  if (overdue.length) {
    lines.push(
      "",
      `Просрочено: ${overdue.length}`,
      ...listed(overdue, (card) => ` · срок ${formatDate(card.dueDate!)}`),
    );
  }
  if (dueToday.length) {
    lines.push(
      "",
      `Срок сегодня: ${dueToday.length}`,
      ...listed(dueToday, () => ""),
    );
  }
  if (urgent.length) {
    lines.push("", `Срочные: ${urgent.length}`, ...listed(urgent, () => ""));
  }
  if (problems.length) {
    lines.push(
      "",
      `С проблемой: ${problems.length}`,
      ...listed(
        problems,
        (card) => ` · ${cuttingProblemLabel(card.problemReason)}`,
      ),
    );
  }
  if (unplanned.length) {
    lines.push("", `Без срока готовности: ${unplanned.length}`);
  }
  if (!overdue.length && !dueToday.length && !problems.length) {
    lines.push("", "Просрочек и проблем нет.");
  }
  lines.push("", input.boardUrl);

  return { title: "Цех на утро", lines };
}
