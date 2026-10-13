import assert from "node:assert/strict";
import test from "node:test";

import { formatTelegramHtml } from "../features/telegram/format";

test("staff message gets a bold title, highlighted values and no section line", () => {
  const text = formatTelegramHtml("Новая заявка на распил R-15", [
    "Тип: Распил: ЛДСП Кашемир",
    "Клиент: Иван <Петров>",
    "Телефон: +996 555 123 456",
    "Материал: ЛДСП 16 мм",
    "Комментарий: нужно к пятнице",
    "Раздел: /admin/requests",
  ]);
  const lines = text.split("\n");

  assert.equal(lines[0], "🪚 <b>Новая заявка на распил R-15</b>");
  assert.equal(lines[1], "");
  assert.ok(lines.includes("Тип: <b>Распил: ЛДСП Кашемир</b>"));
  assert.ok(lines.includes("👤 Клиент: <b>Иван &lt;Петров&gt;</b>"));
  assert.ok(lines.includes("📞 Телефон: <b>+996 555 123 456</b>"));
  assert.deepEqual(lines.slice(-2), ["", "💬 <i>нужно к пятнице</i>"]);
  assert.doesNotMatch(text, /Раздел/);
});

test("the Artisan prefix is dropped and status starts its own block", () => {
  const text = formatTelegramHtml("Artisan · заказ A-7 готов к выдаче", [
    "Клиент: Айбек",
    "Статус: Готов к выдаче",
  ]);

  assert.equal(
    text,
    "✅ <b>Заказ A-7 готов к выдаче</b>\n\n👤 Клиент: <b>Айбек</b>\n\nСтатус: <b>Готов к выдаче</b>",
  );
});

test("lists, links and free text stay as they are", () => {
  const text = formatTelegramHtml("Сводка на утро", [
    "Вчера: заказов 4 на 125 000 сом, заявок 7",
    "",
    "",
    "Заявки без менеджера: 5",
    "  • R-1 · Клиент · ждёт 30 ч",
    "  https://example.test/admin/requests?assignment=unassigned",
    "Новый → Оплачен",
  ]);
  const lines = text.split("\n");

  assert.equal(lines[0], "📋 <b>Сводка на утро</b>");
  assert.ok(lines.includes("Заявки без менеджера: <b>5</b>"));
  assert.ok(lines.includes("  • R-1 · Клиент · ждёт 30 ч"));
  assert.ok(
    lines.includes(
      "  https://example.test/admin/requests?assignment=unassigned",
    ),
  );
  assert.ok(lines.includes("Новый → Оплачен"));
  // Две пустые строки подряд схлопываются в одну.
  assert.doesNotMatch(text, /\n\n\n/);
});
