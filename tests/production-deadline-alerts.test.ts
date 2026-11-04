import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeadlineAlert,
  isAlertWorkingHour,
  planDeadlineAlert,
  type DeadlineAlertCard,
} from "../features/production/deadline-alerts";

const today = "2026-11-04";

function card(
  id: string,
  dueDate: string | null,
  extra: Partial<DeadlineAlertCard> = {},
): DeadlineAlertCard {
  return {
    id,
    number: id.toUpperCase(),
    material: "ЛДСП белый",
    column: "QUEUED",
    dueDate,
    isUrgent: false,
    problemReason: null,
    ...extra,
  };
}

const cards = [
  card("late1", "2026-11-01"),
  card("late2", "2026-11-03", { column: "CUTTING" }),
  card("today1", today),
  card("today2", today, { isUrgent: true }),
  card("tomorrow", "2026-11-05", { column: "NEW" }),
  card("later", "2026-11-09"),
  card("ready", "2026-11-01", { column: "READY_FOR_PICKUP" }),
  card("noplan", null),
];

test("splits cards into overdue, today and tomorrow; ready ones are skipped", () => {
  const plan = planDeadlineAlert({
    cards,
    today,
    announced: null,
    overdueDue: true,
  });
  assert.deepEqual(
    plan.overdue.map((c) => c.id),
    ["late1", "late2"],
  );
  assert.deepEqual(
    plan.dueToday.map((c) => c.id),
    ["today2", "today1"],
  );
  assert.deepEqual(
    plan.dueTomorrow.map((c) => c.id),
    ["tomorrow"],
  );
  assert.equal(plan.send, true);
  assert.equal(plan.sendOverdue, true);
  assert.deepEqual(plan.newPriorityIds, ["today2", "today1", "tomorrow"]);
});

test("priority list is sent once a day, again only when a new request appears", () => {
  const first = planDeadlineAlert({
    cards,
    today,
    announced: null,
    overdueDue: false,
  });
  const noLate = cards.filter((c) => !c.id.startsWith("late"));
  const again = planDeadlineAlert({
    cards: noLate,
    today,
    announced: first.announced,
    overdueDue: true,
  });
  assert.equal(again.send, false);

  const withNew = planDeadlineAlert({
    cards: [...noLate, card("fresh", "2026-11-05")],
    today,
    announced: first.announced,
    overdueDue: false,
  });
  assert.equal(withNew.send, true);
  assert.deepEqual(withNew.newPriorityIds, ["fresh"]);

  const nextDay = planDeadlineAlert({
    cards: noLate,
    today: "2026-11-05",
    announced: first.announced,
    overdueDue: false,
  });
  assert.equal(nextDay.send, true);
});

test("overdue reminder repeats only when its interval has passed", () => {
  const announced = planDeadlineAlert({
    cards,
    today,
    announced: null,
    overdueDue: true,
  }).announced;
  assert.equal(
    planDeadlineAlert({ cards, today, announced, overdueDue: false }).send,
    false,
  );
  const due = planDeadlineAlert({ cards, today, announced, overdueDue: true });
  assert.equal(due.send, true);
  assert.equal(due.sendOverdue, true);
  assert.deepEqual(due.newPriorityIds, []);
});

test("message lists overdue first with lateness, marks new and urgent ones", () => {
  const plan = planDeadlineAlert({
    cards,
    today,
    announced: null,
    overdueDue: true,
  });
  const message = buildDeadlineAlert({ ...plan, today });
  assert.match(message.title, /Просроченные заказы: 2/);
  assert.equal(message.lines[0], "Просрочено: 2");
  assert.match(
    message.lines[1],
    /LATE1 · ЛДСП белый · ждёт распила · срок был 01\.11, опоздание 3 дн\./,
  );
  assert.ok(message.lines.some((line) => /TODAY2 .*новый · СРОЧНО/.test(line)));
  assert.ok(message.lines.includes("Срок завтра: 1"));
  assert.ok(
    message.lines.some((line) => /TOMORROW · .*не запущен в цех/.test(line)),
  );

  const quiet = buildDeadlineAlert({
    ...plan,
    overdue: [],
    sendOverdue: false,
    today,
  });
  assert.equal(quiet.title, "Подходит срок: сделать в первую очередь");
  assert.equal(quiet.lines[0], "Срок сегодня: 2");
});

test("no alerts at night", () => {
  assert.equal(isAlertWorkingHour(7), false);
  assert.equal(isAlertWorkingHour(8), true);
  assert.equal(isAlertWorkingHour(19), true);
  assert.equal(isAlertWorkingHour(20), false);
});

test("a crowded alert still fits one Telegram message", () => {
  const long =
    "ЛДСП Egger H1145 ST10 Дуб Бардолино натуральный 18 мм 2800×2070";
  const many = (prefix: string, due: string, n: number) =>
    Array.from({ length: n }, (_, i) =>
      card(`${prefix}${i}`, due, {
        material: long + " ".repeat(40) + "x",
        isUrgent: true,
        problemReason: "no-material",
        column: "DRILLING",
      }),
    );
  const all = [
    ...many("late", "2026-10-01", 40),
    ...many("today", today, 40),
    ...many("tomorrow", "2026-11-05", 40),
  ];
  const plan = planDeadlineAlert({
    cards: all,
    today,
    announced: null,
    overdueDue: true,
  });
  const message = buildDeadlineAlert({ ...plan, today });
  const text = [message.title, ...message.lines].join("\n");
  assert.ok(text.length <= 3500, `length ${text.length}`);
  assert.ok(message.lines.includes("Просрочено: 40"));
  assert.ok(message.lines.includes("Срок сегодня: 40"));
  assert.ok(message.lines.includes("Срок завтра: 40"));
  assert.ok(message.lines.some((line) => /… и ещё \d+/.test(line)));
});
