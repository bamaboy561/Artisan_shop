// Заказы сайта → папка проектов GibLab на компьютере оператора. Программа
// цеха (та же, что смотрит папки станков) забирает новые заказы и кладёт
// файл .project в папку дня: projects\2026\Ноябрь\21-11\R-2045 Имя тел.project.
// Нет папки — создаёт; файл с таким именем уже есть — не трогает.

export type GibLabOrderTrigger = "in-progress" | "new";

export type GibLabOrderSettings = {
  enabled: boolean;
  root: string;
  trigger: GibLabOrderTrigger;
  // С какого момента выгружать: старые заявки не сыплются в папку разом.
  since: string | null;
};

export const defaultGibLabOrderSettings: GibLabOrderSettings = {
  enabled: true,
  root: "D:\\GibLabLocal\\projects",
  trigger: "new",
  since: null,
};

const months = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export function parseGibLabOrderSettings(
  raw: string | null | undefined,
): GibLabOrderSettings {
  if (!raw) return defaultGibLabOrderSettings;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return normalizeGibLabOrderSettings(value);
  } catch {
    return defaultGibLabOrderSettings;
  }
}

export function normalizeGibLabOrderSettings(
  value: Record<string, unknown>,
): GibLabOrderSettings {
  const root =
    typeof value.root === "string"
      ? value.root
          .replace(/[\u0000-\u001f]/g, "")
          .trim()
          .slice(0, 300)
      : "";
  const since =
    typeof value.since === "string" && !Number.isNaN(Date.parse(value.since))
      ? value.since
      : null;
  return {
    enabled: value.enabled === true,
    root: root || defaultGibLabOrderSettings.root,
    trigger: value.trigger === "in-progress" ? "in-progress" : "new",
    since,
  };
}

// Дата в Бишкеке: папка дня — по рабочему дню цеха.
function bishkekParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bishkek",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day") };
}

// «2026\Ноябрь\21-11» — как оператор называет папки сейчас.
export function gibLabOrderFolder(date: Date) {
  const { year, month, day } = bishkekParts(date);
  return `${year}\\${months[Number(month) - 1]}\\${day}-${month}`;
}

function safeName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
}

// «R-2045 Алишер 0703981048.project»: номер в начале, чтобы станки и
// сайт узнавали заказ по имени файла. Если в заявке есть Базис, в конце
// код сайта для QR «СБОРКА»: «R-2045 Алишер 0703981048 K7M2XQ9P.project».
// GibLab берёт название проекта из имени файла, и сайт находит код в QR.
export function gibLabOrderFileName(input: {
  number: string | null;
  id: string;
  contactName: string;
  contactPhone: string;
  code?: string | null;
}) {
  const number = input.number || input.id.slice(0, 8).toUpperCase();
  // Как у операторов: местный формат 0703981048, без +996.
  const digits = input.contactPhone.replace(/\D/g, "");
  const phone =
    digits.length === 12 && digits.startsWith("996")
      ? `0${digits.slice(3)}`
      : digits.slice(-10);
  const name = safeName(input.contactName).slice(0, 60);
  const code = input.code ? safeName(input.code) : "";
  // Код не обрезаем: без него QR не найдёт проект.
  const base = safeName([number, name, phone].filter(Boolean).join(" "))
    .slice(0, code ? 110 : 120)
    .trim();
  return `${[base, code].filter(Boolean).join(" ")}.project`;
}

// Файлы Базиса заявки по порядку загрузки: первый — «1», второй — «2».
// Этот порядок общий для проекта GibLab и кода QR, поэтому новый файл
// встаёт в конец и номера прежних не меняются.
export function orderedBazisFiles<
  T extends { fileName: string; createdAt?: Date | string | null; id?: string },
>(files: T[]) {
  const time = (value: Date | string | null | undefined) =>
    value ? new Date(value).getTime() || 0 : 0;
  return files
    .filter((file) => /\.b3d$/i.test(file.fileName))
    .map((file, index) => ({ file, index }))
    .sort(
      (a, b) =>
        time(a.file.createdAt) - time(b.file.createdAt) || a.index - b.index,
    )
    .map(({ file }) => file);
}

// Позиция детали в общем проекте GibLab из нескольких файлов Базиса:
// «2-5» — файл 2, позиция 5. При одном файле позиция как в Базисе.
export function gibLabPartPosition(
  fileNumber: number,
  fileCount: number,
  position: string,
) {
  return fileCount > 1 && position ? `${fileNumber}-${position}` : position;
}

// Обратно: из позиции с этикетки GibLab — номер файла (с нуля) и позиция
// в этом файле. Без номера, или если такого файла нет, — первый файл.
export function parseGibLabPartPosition(value: string, fileCount: number) {
  const match = /^(\d+)-(.+)$/.exec(value.trim());
  if (fileCount > 1 && match) {
    const fileNumber = Number.parseInt(match[1], 10);
    if (fileNumber >= 1 && fileNumber <= fileCount) {
      return { fileIndex: fileNumber - 1, position: match[2].trim() };
    }
  }
  return { fileIndex: 0, position: value.trim() };
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Пустой проект с именем заказа: детали оператор вносит в GibLab сам.
export function emptyGibLabProject(name: string, comment?: string | null) {
  const note = comment
    ? `\n\t<!-- ${escapeXml(comment).replaceAll("--", "—")} -->`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<project currency="сом" version="1">${note}\n\t<good id="1" typeId="product" count="1" name="${escapeXml(name)}" />\n</project>\n`;
}

export function isGibLabProjectFile(fileName: string) {
  return /\.project$/i.test(fileName);
}
