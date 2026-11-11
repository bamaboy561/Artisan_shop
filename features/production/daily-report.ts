import { cuttingProblemLabel, deadlineTone } from "./workflow-flags";

export type ReportColumn =
  | "NEW"
  | "QUEUED"
  | "CUTTING"
  | "EDGING"
  | "DRILLING"
  | "READY_FOR_PICKUP";

export type ReportCard = {
  id: string;
  number: string | null;
  material: string;
  column: ReportColumn;
  dueDate: string | null;
  stageSince: Date;
  isUrgent: boolean;
  problemReason: string | null;
};

export type ReportEvent = {
  entityId: string;
  eventType: string;
  title: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string | null;
};

export type DailyReportInput = {
  day: string;
  today: string;
  now: number;
  // События журнала заявок за выбранный день (время по Бишкеку).
  events: ReportEvent[];
  createdCount: number;
  // Листы и срок по заявкам, которые упоминаются в событиях дня.
  sheets: Map<string, number | null>;
  dueDates: Map<string, string | null>;
  // Текущие открытые заявки с доски.
  cards: ReportCard[];
};

// Заявка «висит», если стоит на одном этапе дольше суток.
export const stuckAfterMs = 24 * 60 * 60 * 1000;

const stageOrder = [
  "ACCEPTED",
  "CUTTING",
  "EDGING",
  "DRILLING",
  "READY_FOR_PICKUP",
];

export const reportColumns: Array<{ key: ReportColumn; title: string }> = [
  { key: "NEW", title: "Новые" },
  { key: "QUEUED", title: "Ждут распила" },
  { key: "CUTTING", title: "Распил" },
  { key: "EDGING", title: "Кромка" },
  { key: "DRILLING", title: "Присадка" },
  { key: "READY_FOR_PICKUP", title: "К выдаче" },
];

function isStageMove(event: ReportEvent) {
  return (
    event.eventType === "cutting_stage" &&
    Boolean(event.toStatus) &&
    event.fromStatus !== event.toStatus
  );
}

function movedForward(event: ReportEvent, from: string) {
  return (
    isStageMove(event) &&
    event.fromStatus === from &&
    stageOrder.indexOf(event.toStatus ?? "") > stageOrder.indexOf(from)
  );
}

function distinct(events: ReportEvent[]) {
  return [...new Set(events.map((event) => event.entityId))];
}

export function buildDailyReport(input: DailyReportInput) {
  const { events } = input;
  const cutIds = distinct(events.filter((e) => movedForward(e, "CUTTING")));
  const readyIds = distinct(
    events.filter((e) => isStageMove(e) && e.toStatus === "READY_FOR_PICKUP"),
  );
  const readyLate = readyIds.filter((id) => {
    const due = input.dueDates.get(id);
    return Boolean(due && due < input.day);
  }).length;

  const people = new Map<string, number>();
  for (const event of events) {
    if (!isStageMove(event)) continue;
    const name = event.actorName?.trim() || "Без имени";
    people.set(name, (people.get(name) ?? 0) + 1);
  }

  const day = {
    created: input.createdCount,
    // В цех попадают: первый перевод этапа (в очередь или сразу на распил)
    // и заявки, которые менеджер создал в админке уже запущенными.
    launched: distinct(
      events.filter(
        (e) =>
          (isStageMove(e) && !e.fromStatus) ||
          (e.eventType === "created" && e.title.startsWith("Распил ")),
      ),
    ).length,
    cut: cutIds.length,
    cutSheets: cutIds.reduce((sum, id) => sum + (input.sheets.get(id) ?? 0), 0),
    edged: distinct(events.filter((e) => movedForward(e, "EDGING"))).length,
    drilled: distinct(events.filter((e) => movedForward(e, "DRILLING"))).length,
    ready: readyIds.length,
    readyLate,
    issued: events.filter(
      (e) => e.eventType === "status" && e.title === "Заказ выдан клиенту",
    ).length,
    problemsReported: events.filter(
      (e) =>
        e.eventType === "production_flag" && e.title.startsWith("Проблема:"),
    ).length,
    problemsResolved: events.filter(
      (e) => e.eventType === "production_flag" && e.title === "Проблема решена",
    ).length,
    people: [...people.entries()]
      .map(([name, moves]) => ({ name, moves }))
      .sort((a, b) => b.moves - a.moves || a.name.localeCompare(b.name, "ru")),
  };

  const tone = (card: ReportCard) =>
    deadlineTone(card.dueDate, input.today, card.column === "READY_FOR_PICKUP");
  const age = (card: ReportCard) => input.now - card.stageSince.getTime();
  // Новые ещё не в цехе: их срок и «висит» считаем только для запущенных.
  const inWork = input.cards.filter((card) => card.column !== "NEW");
  const overdue = inWork
    .filter((card) => tone(card) === "overdue")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const stuck = inWork
    .filter(
      (card) => card.column !== "READY_FOR_PICKUP" && age(card) >= stuckAfterMs,
    )
    .sort((a, b) => age(b) - age(a));
  const problems = input.cards.filter((card) => card.problemReason);

  const stages = reportColumns.map((column) => {
    const cards = input.cards.filter((card) => card.column === column.key);
    const oldest = cards.reduce((max, card) => Math.max(max, age(card)), 0);
    return {
      ...column,
      count: cards.length,
      overdue:
        column.key === "NEW"
          ? 0
          : cards.filter((c) => tone(c) === "overdue").length,
      stuck:
        column.key === "NEW" || column.key === "READY_FOR_PICKUP"
          ? 0
          : cards.filter((card) => age(card) >= stuckAfterMs).length,
      oldestMs: cards.length ? oldest : null,
    };
  });

  return { day, now: { stages, overdue, stuck, problems } };
}

export type DailyReport = ReturnType<typeof buildDailyReport>;

// День из адреса (?day=ГГГГ-ММ-ДД); будущие и кривые даты — сегодня.
export function parseReportDay(value: unknown, today: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return today;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return today;
  if (parsed.toISOString().slice(0, 10) !== value) return today;
  return value > today ? today : value;
}

// Вечерний итог дня для Telegram: те же цифры, что под доской распила.
export const eveningReportHour = 19;
const messageListLimit = 5;

function shortDate(day: string) {
  return day.split("-").reverse().slice(0, 2).join(".");
}

function shortCard(card: ReportCard) {
  const material =
    card.material.length > 50
      ? `${card.material.slice(0, 49)}…`
      : card.material;
  return `${card.number ?? card.id.slice(0, 8).toUpperCase()} · ${material}`;
}

export function buildDailyReportMessage(report: DailyReport, day: string) {
  const { day: stats, now } = report;
  const inWork = now.stages
    .filter((stage) => stage.key !== "NEW")
    .reduce((sum, stage) => sum + stage.count, 0);
  const listed = (
    cards: ReportCard[],
    detail: (card: ReportCard) => string,
  ) => [
    ...cards
      .slice(0, messageListLimit)
      .map((card) => `  • ${shortCard(card)} — ${detail(card)}`),
    ...(cards.length > messageListLimit
      ? [`  … и ещё ${cards.length - messageListLimit}`]
      : []),
  ];
  const lines = [
    `Новых заявок: ${stats.created} · запущено в цех: ${stats.launched}`,
    `Распилено: ${stats.cut}${stats.cutSheets ? ` (${stats.cutSheets} лист.)` : ""} · кромка: ${stats.edged} · присадка: ${stats.drilled}`,
    `Готово к выдаче: ${stats.ready}${stats.readyLate ? ` (с опозданием: ${stats.readyLate})` : ""} · выдано клиентам: ${stats.issued}`,
    `Проблем сообщено: ${stats.problemsReported} · решено: ${stats.problemsResolved}`,
    "",
    `Сейчас в работе: ${inWork} · просрочено: ${now.overdue.length} · висят дольше суток: ${now.stuck.length} · с проблемой: ${now.problems.length}`,
    `По этапам: ${
      now.stages
        .filter((stage) => stage.count)
        .map((stage) => `${stage.title} ${stage.count}`)
        .join(" · ") || "пусто"
    }`,
  ];
  if (now.overdue.length)
    lines.push(
      "",
      `Просрочены: ${now.overdue.length}`,
      ...listed(
        now.overdue,
        (card) => `срок был ${shortDate(card.dueDate ?? "")}`,
      ),
    );
  if (now.stuck.length)
    lines.push(
      "",
      `Висят дольше суток: ${now.stuck.length}`,
      ...listed(
        now.stuck,
        (card) => reportColumns.find((c) => c.key === card.column)?.title ?? "",
      ),
    );
  if (now.problems.length)
    lines.push(
      "",
      `С проблемой: ${now.problems.length}`,
      ...listed(now.problems, (card) =>
        cuttingProblemLabel(card.problemReason),
      ),
    );
  if (stats.people.length)
    lines.push(
      "",
      `Кто двигал заявки: ${stats.people
        .map((person) => `${person.name} ${person.moves}`)
        .join(", ")}`,
    );
  return { title: `Итог дня по распилу · ${shortDate(day)}`, lines };
}
