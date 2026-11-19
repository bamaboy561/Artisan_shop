// Смены цеха по «Системе ответственности участка распила»: чек-лист
// приёмки и сдачи смены, журнал фактов и сводка за месяц. Здесь только
// правила и расчёты без базы, чтобы их можно было проверить тестами.

export type ShiftRole = "operator" | "helper" | "master";
export type ShiftPhase = "start" | "end";
export type ItemMark = "done" | "deviation" | "na";

export const shiftRoleLabels: Record<ShiftRole, string> = {
  operator: "Оператор станка",
  helper: "Помощник",
  master: "Мастер",
};

// Показатели со стр. 4 документа. Веса предложены для утверждения
// руководителем; денег здесь нет, только процент выполнения.
export type ShiftIndicator =
  | "clean"
  | "zone"
  | "care"
  | "schedule"
  | "handover"
  | "safety";

export const shiftIndicators: Array<{
  key: ShiftIndicator;
  label: string;
  weight: number;
}> = [
  { key: "clean", label: "Сдача чистого станка", weight: 20 },
  { key: "zone", label: "Порядок в своей зоне", weight: 15 },
  { key: "care", label: "Уход за оборудованием", weight: 20 },
  { key: "schedule", label: "Соблюдение графика", weight: 10 },
  { key: "handover", label: "Своевременная передача", weight: 20 },
  { key: "safety", label: "Безопасное выполнение", weight: 15 },
];

export type ShiftItem = {
  key: string;
  phase: ShiftPhase;
  label: string;
  hint?: string;
  indicator?: ShiftIndicator;
};

const operatorItems: ShiftItem[] = [
  {
    key: "s_state",
    phase: "start",
    label: "Принял станок, замечания прошлой смены записал",
    hint: "Если нашли дефект от прошлой смены, отметьте «Отклонение» и опишите до начала работы — тогда он не ваш.",
  },
  {
    key: "s_safety",
    phase: "start",
    label: "Средства защиты на мне, защитные устройства станка на месте",
    indicator: "safety",
  },
  {
    key: "s_zone",
    phase: "start",
    label: "Зона и проходы свободны, материал на своих местах",
  },
  {
    key: "s_care",
    phase: "start",
    label: "Утренние операции по уходу выполнены по графику",
    hint: "Только те, к которым вы допущены. Ремонт делает тот, кто допущен.",
    indicator: "care",
  },
  {
    key: "e_clean",
    phase: "end",
    label: "Станок убран по перечню уборки, безопасным способом",
    hint: "Пыль во время распила — не нарушение. Проверяется состояние после уборки.",
    indicator: "clean",
  },
  {
    key: "e_zone",
    phase: "end",
    label: "Отходы и инструмент убраны, проходы свободны",
    indicator: "zone",
  },
  {
    key: "e_care",
    phase: "end",
    label: "Операции по уходу за смену выполнены",
    indicator: "care",
  },
  {
    key: "e_faults",
    phase: "end",
    label: "Все неисправности за смену переданы мастеру",
  },
  {
    key: "e_parts",
    phase: "end",
    label: "Готовые детали переданы дальше с маркировкой и номером заказа",
    indicator: "handover",
  },
  {
    key: "e_unfinished",
    phase: "end",
    label: "Незавершённые заказы и причины задержек переданы следующей смене",
    indicator: "handover",
  },
  {
    key: "e_safety",
    phase: "end",
    label: "Работал по инструкции, защиту не обходил",
    indicator: "safety",
  },
];

const helperItems: ShiftItem[] = [
  {
    key: "s_safety",
    phase: "start",
    label: "Средства защиты на мне",
    indicator: "safety",
  },
  {
    key: "s_zone",
    phase: "start",
    label: "Зона и проходы свободны, инвентарь на месте",
  },
  {
    key: "e_zone",
    phase: "end",
    label: "Отходы вынесены, проходы свободны, инструмент на местах",
    indicator: "zone",
  },
  {
    key: "e_parts",
    phase: "end",
    label: "Детали разложены и подписаны номером заказа",
    indicator: "handover",
  },
  {
    key: "e_safety",
    phase: "end",
    label: "Работал по инструкции, о проблемах сообщал мастеру",
    indicator: "safety",
  },
];

const masterItems: ShiftItem[] = [
  {
    key: "m_people",
    phase: "start",
    label: "Отметил, кто вышел, кто отсутствует и кто опоздал",
  },
  {
    key: "m_assign",
    phase: "start",
    label: "Станки и зоны закреплены за сотрудниками до начала смены",
  },
  {
    key: "m_supply",
    phase: "start",
    label: "Средства защиты, уборочный инвентарь и время на уборку есть",
  },
  {
    key: "m_material",
    phase: "start",
    label: "Материал и карты распила на смену готовы",
  },
  {
    key: "m_accept",
    phase: "end",
    label: "Проверил сдачу смены у каждого станка",
  },
  {
    key: "m_repairs",
    phase: "end",
    label: "Неисправности переданы в ремонт или устранены",
  },
  {
    key: "m_orders",
    phase: "end",
    label: "Незавершённые заказы и риски срока записаны",
  },
  {
    key: "m_journal",
    phase: "end",
    label: "Факты за смену занесены в журнал",
  },
];

export const shiftItems: Record<ShiftRole, ShiftItem[]> = {
  operator: operatorItems,
  helper: helperItems,
  master: masterItems,
};

export function itemsFor(role: ShiftRole, phase: ShiftPhase) {
  return shiftItems[role].filter((item) => item.phase === phase);
}

export function parseShiftRole(value: unknown): ShiftRole | null {
  return value === "operator" || value === "helper" || value === "master"
    ? value
    : null;
}

export type ItemResult = { mark: ItemMark; note: string };
export type ItemResults = Record<string, ItemResult>;

export const itemMarkLabels: Record<ItemMark, string> = {
  done: "Выполнено",
  deviation: "Отклонение",
  na: "Неприменимо",
};

// Разбирает ответы формы. «Отклонение» и «Неприменимо» требуют пояснения,
// как в документе: отметка «неприменимо» сопровождается причиной.
export function parseItemResults(
  role: ShiftRole,
  phase: ShiftPhase,
  get: (key: string) => string,
):
  | { ok: true; results: ItemResults }
  | { ok: false; missing: string[]; needNote: string[] } {
  const results: ItemResults = {};
  const missing: string[] = [];
  const needNote: string[] = [];
  for (const item of itemsFor(role, phase)) {
    const mark = get(`mark_${item.key}`);
    const note = get(`note_${item.key}`).slice(0, 500);
    if (mark !== "done" && mark !== "deviation" && mark !== "na") {
      missing.push(item.key);
      continue;
    }
    if (mark !== "done" && !note) needNote.push(item.key);
    results[item.key] = { mark, note };
  }
  return missing.length || needNote.length
    ? { ok: false, missing, needNote }
    : { ok: true, results };
}

export function parseStoredResults(value: unknown): ItemResults {
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const results: ItemResults = {};
    for (const [key, raw] of Object.entries(parsed ?? {})) {
      const entry = raw as { mark?: unknown; note?: unknown };
      if (
        entry &&
        (entry.mark === "done" ||
          entry.mark === "deviation" ||
          entry.mark === "na")
      )
        results[key] = {
          mark: entry.mark,
          note: typeof entry.note === "string" ? entry.note : "",
        };
    }
    return results;
  } catch {
    return {};
  }
}

export function countDeviations(results: ItemResults) {
  return Object.values(results).filter((r) => r.mark === "deviation").length;
}

// «09:00» → минуты от полуночи. Неверное значение — 9:00.
export const defaultShiftStart = "09:00";
export const defaultShiftEnd = "18:00";

export function parseClock(value: unknown, fallback = defaultShiftStart) {
  const text = typeof value === "string" ? value.trim() : "";
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 24 && minutes < 60)
      return `${String(hours).padStart(2, "0")}:${match[2]}`;
  }
  return fallback;
}

export function clockMinutes(clock: string) {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}

// Минуты от полуночи по Бишкеку (UTC+6, без перехода на летнее время).
export function bishkekMinutes(date: Date) {
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + 6 * 60;
  return minutes % (24 * 60);
}

// Опоздание в минутах относительно графика, без штрафа «за минуту».
export function lateMinutes(arrivedAt: Date, shiftStart: string) {
  return Math.max(0, bishkekMinutes(arrivedAt) - clockMinutes(shiftStart));
}

export type AbsenceReason = "sick" | "leave" | "excused" | "unexcused";

export const absenceReasonLabels: Record<AbsenceReason, string> = {
  sick: "Болезнь (документы у кадровика)",
  leave: "Выходной или отпуск",
  excused: "Другая уважительная причина",
  unexcused: "Без подтверждения — рассмотреть",
};

export function parseAbsenceReason(value: unknown): AbsenceReason | null {
  return value === "sick" ||
    value === "leave" ||
    value === "excused" ||
    value === "unexcused"
    ? value
    : null;
}

// Журнал фактов (акт со стр. 6). Направления — строки таблицы со стр. 2.
export const incidentAreas = {
  clean: "Чистота станка",
  zone: "Рабочее место",
  care: "Уход за оборудованием",
  schedule: "Начало смены",
  absence: "Отсутствие",
  handover: "Передача заказа",
  safety: "Техника безопасности",
} as const;
export type IncidentArea = keyof typeof incidentAreas;

export function parseIncidentArea(value: unknown): IncidentArea | null {
  return typeof value === "string" && value in incidentAreas
    ? (value as IncidentArea)
    : null;
}

// Проверка причин перед решением (стр. 6).
export const incidentCauses = {
  training: "Не было обучения или инструкции",
  supplies: "Не было инвентаря или средств защиты",
  equipment: "Неисправность оборудования",
  material: "Не было материала",
  load: "Плановая загрузка, не хватило времени",
  excused: "Уважительные обстоятельства",
} as const;
export type IncidentCause = keyof typeof incidentCauses;

export function parseIncidentCauses(values: unknown[]): IncidentCause[] {
  return [
    ...new Set(
      values.filter(
        (value): value is IncidentCause =>
          typeof value === "string" && value in incidentCauses,
      ),
    ),
  ];
}

// Меры — после рассмотрения случая, не автоматически по счёту записей.
// Правило «три нарушения — увольнение» не вводится; денежных штрафов нет.
export const incidentDecisions = {
  none: "Без мер — вины нет или причина вне контроля",
  briefing: "Устранение причины и разъяснение (инструктаж)",
  remark: "Замечание",
  reprimand: "Выговор",
  severe: "Строгий выговор",
  separate: "Рассмотреть отдельно руководителем",
} as const;
export type IncidentDecision = keyof typeof incidentDecisions;

export function parseIncidentDecision(value: unknown): IncidentDecision | null {
  return typeof value === "string" && value in incidentDecisions
    ? (value as IncidentDecision)
    : null;
}

export type IncidentStatus = "explain" | "decide" | "acknowledge" | "closed";

export const incidentStatusLabels: Record<IncidentStatus, string> = {
  explain: "Ждёт объяснения",
  decide: "Ждёт решения",
  acknowledge: "Ждёт ознакомления",
  closed: "Закрыт",
};

export function incidentStatus(input: {
  explanation: string | null;
  explanationRefused: boolean;
  decision: string | null;
  acknowledgedAt: Date | null;
}): IncidentStatus {
  if (!input.explanation && !input.explanationRefused) return "explain";
  if (!input.decision) return "decide";
  if (!input.acknowledgedAt) return "acknowledge";
  return "closed";
}

// Сводка за месяц по формуле со стр. 4:
// процент = сумма (вес × В) / сумма применимых весов.
export type ScoreShift = {
  role: ShiftRole;
  absent: AbsenceReason | null;
  lateMinutes: number;
  lateExcused: boolean;
  startResults: ItemResults;
  endResults: ItemResults | null;
  // Пункты, по которым мастер при приёмке поставил «отклонение».
  masterDeviations: string[];
};

export type IndicatorScore = {
  key: ShiftIndicator;
  label: string;
  weight: number;
  done: number;
  checks: number;
};

export function buildShiftScore(shifts: ScoreShift[]) {
  const totals = new Map<ShiftIndicator, { done: number; checks: number }>(
    shiftIndicators.map((indicator) => [indicator.key, { done: 0, checks: 0 }]),
  );
  let worked = 0;
  let absences = 0;
  let unexcused = 0;
  let late = 0;
  for (const shift of shifts) {
    if (shift.absent) {
      absences += 1;
      if (shift.absent === "unexcused") unexcused += 1;
      continue;
    }
    worked += 1;
    const schedule = totals.get("schedule")!;
    schedule.checks += 1;
    if (shift.lateMinutes > 0 && !shift.lateExcused) late += 1;
    else schedule.done += 1;
    const results = { ...shift.startResults, ...(shift.endResults ?? {}) };
    for (const item of shiftItems[shift.role]) {
      if (!item.indicator) continue;
      // Несданная смена: пункты сдачи не проверены — не считаем их.
      if (item.phase === "end" && !shift.endResults) continue;
      const result = results[item.key];
      if (!result || result.mark === "na") continue;
      const total = totals.get(item.indicator)!;
      total.checks += 1;
      const deviation =
        result.mark === "deviation" ||
        shift.masterDeviations.includes(item.key);
      if (!deviation) total.done += 1;
    }
  }
  const indicators: IndicatorScore[] = shiftIndicators.map((indicator) => ({
    ...indicator,
    ...totals.get(indicator.key)!,
  }));
  const applicable = indicators.filter((indicator) => indicator.checks > 0);
  const weightSum = applicable.reduce((sum, i) => sum + i.weight, 0);
  // Нет наблюдений — оценку не ставим (а не ноль).
  const percent = weightSum
    ? Math.round(
        (applicable.reduce(
          (sum, i) => sum + i.weight * (i.done / i.checks),
          0,
        ) /
          weightSum) *
          100,
      )
    : null;
  return { indicators, percent, worked, absences, unexcused, late };
}

export function monthBounds(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const from = `${month}-01`;
  const next =
    mon === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(mon + 1).padStart(2, "0")}-01`;
  return { from, next };
}

export function parseMonth(value: unknown, fallback: string) {
  return typeof value === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
    value >= "2024-01" &&
    value <= "2100-12"
    ? value
    : fallback;
}

export function shiftMonth(month: string, delta: number) {
  const [year, mon] = month.split("-").map(Number);
  const index = year * 12 + (mon - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

// Итог смены за день: кто принял, кто сдал, кто не вышел.
export type DayStaff = { id: string; name: string };
export type DayShift = {
  userId: string;
  userName: string;
  startedAt: Date | null;
  endedAt: Date | null;
  confirmedAt: Date | null;
  absence: string | null;
  lateMinutes: number;
  deviations: number;
};

export function summarizeShiftDay(staff: DayStaff[], shifts: DayShift[]) {
  const byUser = new Map(shifts.map((shift) => [shift.userId, shift]));
  const names = new Map(staff.map((person) => [person.id, person.name]));
  for (const shift of shifts)
    if (!names.has(shift.userId)) names.set(shift.userId, shift.userName);
  const ids = [...names.keys()];
  const pick = (test: (shift: DayShift | undefined) => boolean) =>
    ids.filter((id) => test(byUser.get(id))).map((id) => names.get(id)!);
  return {
    total: ids.length,
    notStarted: pick((s) => !s || (!s.startedAt && !s.absence)),
    absent: ids
      .filter((id) => byUser.get(id)?.absence)
      .map((id) => ({
        name: names.get(id)!,
        reason: byUser.get(id)!.absence as AbsenceReason,
      })),
    working: pick((s) => Boolean(s?.startedAt && !s.endedAt)),
    ended: pick((s) => Boolean(s?.endedAt)),
    unconfirmed: pick((s) => Boolean(s?.endedAt && !s.confirmedAt)),
    late: ids
      .filter((id) => (byUser.get(id)?.lateMinutes ?? 0) > 0)
      .map((id) => ({
        name: names.get(id)!,
        minutes: byUser.get(id)!.lateMinutes,
      })),
    deviations: shifts.reduce((sum, shift) => sum + shift.deviations, 0),
  };
}

export type ShiftDaySummary = ReturnType<typeof summarizeShiftDay>;

export function shiftDayMessageLines(
  summary: ShiftDaySummary,
  extra: { openFaults: number; pendingIncidents: number },
) {
  if (!summary.total) return [];
  const lines = [
    `Смена: приняли ${summary.total - summary.notStarted.length - summary.absent.length} из ${summary.total} · сдали ${summary.ended.length}`,
  ];
  const working = summary.working.filter(Boolean);
  if (working.length) lines.push(`Не сдали смену: ${working.join(", ")}`);
  if (summary.notStarted.length)
    lines.push(`Не принимали смену: ${summary.notStarted.join(", ")}`);
  if (summary.absent.length)
    lines.push(
      `Отсутствуют: ${summary.absent
        .map((a) => `${a.name} (${absenceShortLabels[a.reason] ?? "—"})`)
        .join(", ")}`,
    );
  if (summary.late.length)
    lines.push(
      `Опоздания: ${summary.late.map((l) => `${l.name} ${l.minutes} мин`).join(", ")}`,
    );
  if (summary.deviations)
    lines.push(`Отклонений в чек-листах: ${summary.deviations}`);
  if (summary.unconfirmed.length)
    lines.push(`Мастер не принял сдачу: ${summary.unconfirmed.join(", ")}`);
  if (extra.openFaults)
    lines.push(`Неисправностей не устранено: ${extra.openFaults}`);
  if (extra.pendingIncidents)
    lines.push(`Записей в журнале фактов в работе: ${extra.pendingIncidents}`);
  return lines;
}

const absenceShortLabels: Record<AbsenceReason, string> = {
  sick: "болезнь",
  leave: "выходной",
  excused: "уважительная",
  unexcused: "без подтверждения",
};
