// Оформление сообщений Telegram: заголовок жирным со значком, пустая строка,
// затем поля «Название: значение» с выделенным значением. Используется и для
// рабочего чата, и для сообщений клиентам, чтобы они читались одинаково.

export function escapeTelegramHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// Порядок важен: первым стоит более точное слово.
const titleIcons: Array<[RegExp, string]> = [
  [/срочн/i, "🔥"],
  [/отмен/i, "❌"],
  [/готов|ждёт вас|ждет вас/i, "✅"],
  [/бонус|балл|уровень|статус клиента/i, "🎁"],
  [/сводка/i, "📋"],
  [/распил/i, "🪚"],
  [/заказ/i, "🛒"],
  [/заявк/i, "📝"],
  [/акци|скидк/i, "🏷"],
];

const fieldIcons: Record<string, string> = {
  клиент: "👤",
  телефон: "📞",
  сумма: "💰",
  ориентир: "💰",
  комментарий: "💬",
};

// Поля, после которых идёт новый смысловой блок: перед ними пустая строка.
const blockStarters = new Set(["комментарий", "позиций", "статус"]);

const fieldPattern = /^([A-Za-zА-Яа-яЁё№][A-Za-zА-Яа-яЁё№ ,./-]{1,31}): (.+)$/;

export function formatTelegramHtml(title: string, lines: string[]) {
  const cleanTitle = title.replace(/^Artisan\s*·\s*/i, "").trim();
  const icon =
    titleIcons.find(([pattern]) => pattern.test(cleanTitle))?.[1] ?? "🔔";
  const head = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  const body: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Ссылка на раздел не нужна: под сообщением есть кнопка.
    if (/^Раздел: \/admin/.test(line)) continue;

    if (!line.trim()) {
      if (body.length > 0 && body.at(-1) !== "") body.push("");
      continue;
    }

    const field = /^[\s•…]/.test(line) ? null : fieldPattern.exec(line);

    if (!field) {
      body.push(escapeTelegramHtml(line));
      continue;
    }

    const label = field[1];
    const key = label.toLowerCase();
    const fieldIcon = fieldIcons[key] ? `${fieldIcons[key]} ` : "";

    if (blockStarters.has(key) && body.length > 0 && body.at(-1) !== "") {
      body.push("");
    }

    body.push(
      key === "комментарий"
        ? `${fieldIcon}<i>${escapeTelegramHtml(field[2])}</i>`
        : `${fieldIcon}${escapeTelegramHtml(label)}: <b>${escapeTelegramHtml(field[2])}</b>`,
    );
  }

  while (body.at(-1) === "") body.pop();

  return [`${icon} <b>${escapeTelegramHtml(head)}</b>`, "", ...body]
    .join("\n")
    .trimEnd();
}
