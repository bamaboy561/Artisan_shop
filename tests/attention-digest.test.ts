import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStaffDigest,
  formatAge,
  type AttentionGroup,
  type AttentionSummary,
} from "../features/admin/attention";

const group = (
  key: AttentionGroup["key"],
  title: string,
  count: number,
): AttentionGroup => ({
  key,
  title,
  hint: "",
  href: `/admin/${key}`,
  count,
  items: Array.from({ length: Math.min(count, 5) }, (_, index) => ({
    id: `${key}-${index}`,
    label: `№${index + 1} · Клиент`,
    detail: "ждёт 30 ч",
    href: `/admin/${key}/${index}`,
  })),
});

const summary = (groups: AttentionGroup[]): AttentionSummary => ({
  groups,
  yesterday: { orders: 4, ordersTotal: 125000, requests: 7 },
});

test("digest lists only groups that have something and links to them", () => {
  const { title, lines } = buildStaffDigest(
    summary([
      group("unassignedRequests", "Заявки без менеджера", 5),
      group("unpaidOrders", "Заказы без оплаты", 0),
    ]),
    "https://example.test",
  );
  const text = lines.join("\n");

  assert.equal(title, "Сводка на утро");
  assert.match(lines[0], /заказов 4 на 125\s000 сом, заявок 7/);
  assert.match(text, /Заявки без менеджера: 5/);
  assert.match(text, /… и ещё 2/);
  assert.match(text, /https:\/\/example\.test\/admin\/unassignedRequests/);
  assert.doesNotMatch(text, /Заказы без оплаты/);
  assert.notEqual(lines.at(-1), "");
});

test("digest says so when nothing is stuck", () => {
  const { lines } = buildStaffDigest(
    summary([group("lowStock", "Товары заканчиваются", 0)]),
    "https://example.test",
  );

  assert.match(lines.join("\n"), /Зависших заказов и заявок нет/);
});

test("age is shown in hours up to two days, then in days", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000);

  assert.equal(formatAge(ago(0.5), now), "меньше часа");
  assert.equal(formatAge(ago(30), now), "30 ч");
  assert.equal(formatAge(ago(75), now), "3 дн.");
});
