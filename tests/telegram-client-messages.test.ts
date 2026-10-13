import assert from "node:assert/strict";
import test from "node:test";

import { buildOrderStatusClientText } from "../features/telegram/client-messages";

const base = {
  number: "A-7",
  statusLabel: "Какой-то статус",
  total: "12 000 сом",
  contacts: {
    address: "ул. Примерная, 1",
    hours: "Пн-Пт 9-17",
    phone: "+996 000",
  },
};

test("ready order tells the client where and when to pick it up", () => {
  const text = buildOrderStatusClientText({
    ...base,
    status: "READY_FOR_PICKUP",
  });

  assert.equal(text.title, "Заказ A-7 готов к выдаче");
  assert.deepEqual(text.lines, [
    "Адрес: ул. Примерная, 1",
    "Часы работы: Пн-Пт 9-17",
    "Телефон: +996 000",
  ]);
});

test("each status has its own title", () => {
  const titles = [
    "NEW",
    "RESERVED",
    "CONFIRMED",
    "PAID",
    "IN_PRODUCTION",
    "READY_FOR_PICKUP",
    "SHIPPED",
    "COMPLETED",
    "CANCELED",
  ].map((status) => buildOrderStatusClientText({ ...base, status }).title);

  assert.equal(new Set(titles).size, titles.length);
  assert.ok(titles.every((title) => title.includes("A-7")));
});

test("unknown status falls back to the plain label", () => {
  const text = buildOrderStatusClientText({ ...base, status: "SOMETHING" });

  assert.equal(text.title, "Статус заказа A-7 обновлён");
  assert.deepEqual(text.lines, [
    "Теперь: Какой-то статус",
    "Сумма: 12 000 сом",
  ]);
});
