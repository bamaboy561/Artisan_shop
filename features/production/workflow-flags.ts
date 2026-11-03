// Срочность и «Проблема» по заявке на распил: общие для сервера и экрана.

export const cuttingProblemReasons = {
  "no-material": "Нет материала",
  defect: "Брак, нужен перепил",
  "waiting-client": "Ждём клиента",
  "file-error": "Ошибка в файле или размерах",
  machine: "Станок не работает",
  other: "Другое",
} as const;

export type CuttingProblemReason = keyof typeof cuttingProblemReasons;

export function parseCuttingProblemReason(
  value: string,
): CuttingProblemReason | null {
  return Object.prototype.hasOwnProperty.call(cuttingProblemReasons, value)
    ? (value as CuttingProblemReason)
    : null;
}

export function cuttingProblemLabel(reason: string | null | undefined) {
  if (!reason) return "";
  const known = parseCuttingProblemReason(reason);
  return known ? cuttingProblemReasons[known] : reason;
}

export type CuttingWorkflowDto = {
  isUrgent: boolean;
  problemReason: string | null;
  problemNote: string | null;
  problemAt: Date | null;
  problemByName: string | null;
};

export const emptyCuttingWorkflow: CuttingWorkflowDto = {
  isUrgent: false,
  problemReason: null,
  problemNote: null,
  problemAt: null,
  problemByName: null,
};

// Старые заявки помечали срочность только текстом («Приоритет: срочно»).
export function isUrgentByText(subject: string, message: string | null) {
  return /срочно/i.test(
    `${subject} ${message ?? ""}`.replace(/Приоритет:\s*стандарт/gi, ""),
  );
}

// Сколько дней до плановой готовности: <0 просрочено, 0 сегодня, 1 завтра.
export function daysUntil(dueDate: string | null, today: string) {
  if (!dueDate) return null;
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(due) || !Number.isFinite(now)) return null;
  return Math.round((due - now) / 86_400_000);
}

export type DeadlineTone = "none" | "overdue" | "today" | "soon" | "later";

export function deadlineTone(
  dueDate: string | null,
  today: string,
  ready: boolean,
): DeadlineTone {
  const days = daysUntil(dueDate, today);
  if (days === null || ready) return "none";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "soon";
  return "later";
}

export function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} д ${restHours} ч` : `${days} д`;
}
