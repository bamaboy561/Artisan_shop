import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";

import { SetupState } from "@/components/admin/setup-state";
import { requireAdminSession } from "@/lib/auth/dal";
import { canManageProduction } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import {
  addDaysToDateKey,
  productionDateKey,
  validDate,
} from "@/features/production/queue";
import {
  absenceReasonLabels,
  buildShiftScore,
  countDeviations,
  incidentAreas,
  incidentCauses,
  incidentDecisions,
  incidentStatus,
  incidentStatusLabels,
  monthBounds,
  parseMonth,
  shiftItems,
  shiftMonth,
  shiftRoleLabels,
  summarizeShiftDay,
  type AbsenceReason,
  type IncidentArea,
  type IncidentCause,
  type IncidentDecision,
  type ShiftRole,
} from "@/features/production/shift";
import {
  formatHours,
  workStationLabels,
  workStations,
} from "@/features/production/cycle-time";
import { formatDuration } from "@/features/production/workflow-flags";
import { FaultForms } from "@/features/production/fault-forms";
import { ResultList } from "@/features/production/shift-result-list";
import {
  getIncidents,
  getOpenFaults,
  getShiftSettings,
  getShiftsForDay,
  getShiftsForRange,
  getWorkshopStaff,
  keyFromDate,
  prepareShifts,
  shiftDateTimeFormatter,
  shiftResults,
  shiftTimeFormatter,
  type ShiftSettings,
} from "@/lib/server/production-shifts";
import { getProductionAnalytics } from "@/lib/server/production-analytics";
import {
  confirmShiftAction,
  createIncidentAction,
  decideIncidentAction,
  explainIncidentAction,
  markAbsenceAction,
  saveShiftSettingsAction,
} from "../shift-actions";
import styles from "@/features/production/shift.module.css";

export const dynamic = "force-dynamic";

const basePath = "/admin/production/shifts";

const tabs = [
  { key: "today", label: "Смена" },
  { key: "journal", label: "Журнал фактов" },
  { key: "month", label: "Итоги месяца" },
  { key: "machines", label: "Цикл и станки" },
] as const;
type Tab = (typeof tabs)[number]["key"];

const notices: Record<string, { tone: "success" | "error"; text: string }> = {
  "settings-saved": { tone: "success", text: "График смены сохранён." },
  "confirm-saved": { tone: "success", text: "Сдача смены принята." },
  "confirm-not-started": {
    tone: "error",
    text: "Сотрудник ещё не принял смену.",
  },
  "absence-saved": { tone: "success", text: "Отметка сохранена." },
  "absence-already": {
    tone: "error",
    text: "Сотрудник уже принял смену — отсутствие не ставится.",
  },
  "incident-saved": {
    tone: "success",
    text: "Факт записан. Теперь нужно объяснение сотрудника.",
  },
  "incident-incomplete": {
    tone: "error",
    text: "Выберите сотрудника, направление и опишите, что обнаружено.",
  },
  "explain-saved": { tone: "success", text: "Объяснение записано." },
  "explain-empty": {
    tone: "error",
    text: "Впишите объяснение или отметьте отказ.",
  },
  "decide-saved": {
    tone: "success",
    text: "Решение записано. Сотрудник увидит его в «Моя смена».",
  },
  "decide-empty": { tone: "error", text: "Выберите решение." },
  "decide-already": {
    tone: "error",
    text: "Решение уже принято. За один случай — одно решение.",
  },
  "decide-not-explained": {
    tone: "error",
    text: "Сначала нужно объяснение сотрудника или отметка об отказе.",
  },
  "fault-saved": { tone: "success", text: "Неисправность записана." },
  "fault-resolved-saved": { tone: "success", text: "Отмечено: устранено." },
};

function tabHref(tab: Tab, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({
    ...(tab === "today" ? {} : { tab }),
    ...extra,
  });
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdminSession(`/login?next=${basePath}`, basePath);
  if (!canManageProduction(actor.roleCode)) redirect("/admin/production/shift");
  if (!hasDatabaseUrl() || !(await prepareShifts()))
    return (
      <SetupState
        title="Смены появятся после подключения БД"
        description="Чек-листы, журнал фактов и итоги хранятся в базе."
        steps={["Настройте DATABASE_URL.", "Откройте страницу повторно."]}
      />
    );
  const params = await searchParams;
  const tab: Tab = tabs.find((t) => t.key === params.tab)?.key ?? "today";
  const notice =
    notices[typeof params.notice === "string" ? params.notice : ""];
  const today = productionDateKey(new Date());
  const settings = await getShiftSettings();

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>
            <ClipboardList size={16} /> Производство
          </p>
          <h1>Смены цеха</h1>
          <p className={styles.hint}>
            Порядок по «Системе ответственности участка распила». Денежных
            штрафов нет: журнал фиксирует факт, решение — после объяснения.
          </p>
        </div>
        <Link className={styles.secondary} href="/admin/production/shift">
          Моя смена
        </Link>
      </header>
      <nav className={styles.tabs} aria-label="Разделы смен">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            aria-current={t.key === tab ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {notice ? (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={notice.tone === "error" ? styles.error : styles.success}
        >
          {notice.text}
        </p>
      ) : null}
      {tab === "today" ? (
        <TodayTab
          day={validDate(String(params.day ?? "")) || today}
          today={today}
          settings={settings}
        />
      ) : tab === "journal" ? (
        <JournalTab
          filter={params.filter === "all" ? "all" : "open"}
          today={today}
        />
      ) : tab === "month" ? (
        <MonthTab month={parseMonth(params.month, today.slice(0, 7))} />
      ) : (
        <MachinesTab
          month={parseMonth(params.month, today.slice(0, 7))}
          settings={settings}
        />
      )}
    </div>
  );
}

// ——— Смена за день ———

async function TodayTab({
  day,
  today,
  settings,
}: {
  day: string;
  today: string;
  settings: ShiftSettings;
}) {
  const [staff, shifts, faults] = await Promise.all([
    getWorkshopStaff(),
    getShiftsForDay(day),
    getOpenFaults(),
  ]);
  const returnPath = tabHref("today", day === today ? {} : { day });
  const byUser = new Map(shifts.map((shift) => [shift.userId, shift]));
  const people = [
    ...staff,
    ...shifts
      .filter((shift) => !staff.some((p) => p.id === shift.userId))
      .map((shift) => ({
        id: shift.userId,
        name: shift.userName,
        stationLabel: null as string | null,
      })),
  ];
  const summary = summarizeShiftDay(
    people,
    shifts.map((shift) => {
      const r = shiftResults(shift);
      return {
        ...shift,
        deviations:
          countDeviations(r.start) + (r.end ? countDeviations(r.end) : 0),
      };
    }),
  );
  return (
    <>
      <div className={styles.monthNav}>
        <Link href={tabHref("today", { day: addDaysToDateKey(day, -1) })}>
          ←
        </Link>
        <strong>
          {day === today ? "Сегодня, " : ""}
          {day.split("-").reverse().join(".")}
        </strong>
        {day < today ? (
          <Link href={tabHref("today", { day: addDaysToDateKey(day, 1) })}>
            →
          </Link>
        ) : null}
      </div>
      <dl className={styles.summary}>
        <div>
          <dt>Сотрудников</dt>
          <dd>{summary.total}</dd>
        </div>
        <div data-tone={summary.notStarted.length ? "warn" : "good"}>
          <dt>Не приняли смену</dt>
          <dd>{summary.notStarted.length}</dd>
        </div>
        <div>
          <dt>В смене</dt>
          <dd>{summary.working.length}</dd>
        </div>
        <div>
          <dt>Сдали</dt>
          <dd>{summary.ended.length}</dd>
        </div>
        <div data-tone={summary.unconfirmed.length ? "warn" : undefined}>
          <dt>Ждут вашей проверки</dt>
          <dd>{summary.unconfirmed.length}</dd>
        </div>
        <div data-tone={summary.late.length ? "warn" : undefined}>
          <dt>Опоздали</dt>
          <dd>{summary.late.length}</dd>
        </div>
        <div data-tone={summary.deviations ? "bad" : undefined}>
          <dt>Отклонений</dt>
          <dd>{summary.deviations}</dd>
        </div>
        <div data-tone={faults.length ? "bad" : undefined}>
          <dt>Неисправностей</dt>
          <dd>{faults.length}</dd>
        </div>
      </dl>

      <section className={styles.section}>
        <h2>Сотрудники</h2>
        <p className={styles.hint}>
          Нажмите на сотрудника, чтобы посмотреть чек-лист и принять сдачу
          смены. Если сотрудника нет в списке, создайте ему производственный
          аккаунт в «Сотрудники».
        </p>
        {people.length === 0 ? (
          <p className={styles.muted}>Производственных аккаунтов пока нет.</p>
        ) : (
          <ul className={styles.cards}>
            {people.map((person) => {
              const shift = byUser.get(person.id);
              return (
                <StaffCard
                  key={person.id}
                  person={person}
                  shift={shift ?? null}
                  day={day}
                  returnPath={returnPath}
                />
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.section} id="faults">
        <h2>Неисправности станков</h2>
        <FaultForms
          faults={faults.map((fault) => ({
            id: fault.id,
            station: fault.station,
            machine: fault.machine,
            description: fault.description,
            stopped: fault.stopped,
            reportedAt: shiftDateTimeFormatter.format(fault.reportedAt),
            reportedByName: fault.reportedByName,
          }))}
          defaultStation="CUTTING"
          returnTo="shifts"
        />
      </section>

      <section className={styles.section}>
        <h2>График смены</h2>
        <p className={styles.hint}>
          От начала считается опоздание (в минутах, без штрафа). Окончание нужно
          для расчёта загрузки станков.
        </p>
        <form action={saveShiftSettingsAction} className={styles.inline}>
          <input type="hidden" name="returnPath" value={returnPath} />
          <label className={styles.field}>
            Начало
            <input
              className={styles.input}
              type="time"
              name="start"
              defaultValue={settings.start}
              required
            />
          </label>
          <label className={styles.field}>
            Конец
            <input
              className={styles.input}
              type="time"
              name="end"
              defaultValue={settings.end}
              required
            />
          </label>
          <button className={styles.secondary} type="submit">
            Сохранить
          </button>
        </form>
      </section>
    </>
  );
}

type ShiftRecord = Awaited<ReturnType<typeof getShiftsForDay>>[number];

function StaffCard({
  person,
  shift,
  day,
  returnPath,
}: {
  person: { id: string; name: string; stationLabel: string | null };
  shift: ShiftRecord | null;
  day: string;
  returnPath: string;
}) {
  const results = shift ? shiftResults(shift) : null;
  const role = (shift?.role as ShiftRole | undefined) ?? "operator";
  const deviations = results
    ? countDeviations(results.start) +
      (results.end ? countDeviations(results.end) : 0)
    : 0;
  const status = shift?.absence
    ? { text: "Отсутствует", tone: "warn" }
    : !shift?.startedAt
      ? { text: "Не принял смену", tone: "bad" }
      : !shift.endedAt
        ? { text: "В смене", tone: undefined }
        : shift.confirmedAt
          ? { text: "Сдал, принято", tone: "good" }
          : { text: "Сдал, ждёт проверки", tone: "warn" };
  return (
    <li>
      <details className={styles.card}>
        <summary>
          <strong>{person.name}</strong>
          {person.stationLabel ? (
            <span className={styles.muted}>{person.stationLabel}</span>
          ) : null}
          <span className={styles.pill} data-tone={status.tone}>
            {status.text}
          </span>
          {shift?.startedAt ? (
            <span className={styles.muted}>
              пришёл {shiftTimeFormatter.format(shift.startedAt)}
              {shift.endedAt
                ? ` · сдал ${shiftTimeFormatter.format(shift.endedAt)}`
                : ""}
            </span>
          ) : null}
          {shift?.lateMinutes ? (
            <span className={styles.pill} data-tone="warn">
              опоздание {shift.lateMinutes} мин
            </span>
          ) : null}
          {deviations ? (
            <span className={styles.pill} data-tone="bad">
              отклонений {deviations}
            </span>
          ) : null}
        </summary>
        <div className={styles.cardBody}>
          {shift?.absence ? (
            <p>
              {absenceReasonLabels[shift.absence as AbsenceReason] ??
                shift.absence}
              {shift.absenceNote ? ` · ${shift.absenceNote}` : ""}
            </p>
          ) : null}
          {shift?.startedAt && results ? (
            <>
              <p className={styles.hint}>
                {shiftRoleLabels[role]}
                {shift.lateReason
                  ? ` · причина опоздания: ${shift.lateReason}`
                  : ""}
                {shift.startNote ? ` · при приёмке: ${shift.startNote}` : ""}
              </p>
              <strong>Приёмка</strong>
              <ResultList role={role} phase="start" results={results.start} />
              {results.end ? (
                <>
                  <strong>Сдача</strong>
                  <ResultList
                    role={role}
                    phase="end"
                    results={results.end}
                    masterDeviations={results.masterDeviations}
                  />
                  {shift.unfinished ? (
                    <p>Незавершённые заказы: {shift.unfinished}</p>
                  ) : null}
                  {shift.endNote ? <p>Замечания: {shift.endNote}</p> : null}
                  {shift.photoUrl ? (
                    <a href={shift.photoUrl} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className={styles.photo}
                        src={shift.photoUrl}
                        alt={`Станок после смены, ${person.name}`}
                      />
                    </a>
                  ) : null}
                </>
              ) : null}
              <form action={confirmShiftAction} className={styles.form}>
                <input type="hidden" name="shiftId" value={shift.id} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <strong>
                  {shift.confirmedAt
                    ? `Принято: ${shift.confirmedByName ?? ""}, ${shiftTimeFormatter.format(shift.confirmedAt)}. Можно исправить.`
                    : "Проверка мастера"}
                </strong>
                <p className={styles.hint}>
                  Отметьте пункты, где при проверке нашли отклонение. Одно
                  состояние — одна отметка, несколько фото не считаются
                  отдельными нарушениями.
                </p>
                {shiftItems[role].map((item) => (
                  <label key={item.key} className={styles.check}>
                    <input
                      type="checkbox"
                      name="deviation"
                      value={item.key}
                      defaultChecked={results.masterDeviations.includes(
                        item.key,
                      )}
                    />
                    {item.label}
                  </label>
                ))}
                {shift.lateMinutes ? (
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      name="lateExcused"
                      defaultChecked={shift.lateExcused}
                    />
                    Опоздание по уважительной причине (не считать)
                  </label>
                ) : null}
                <input
                  className={styles.input}
                  name="note"
                  maxLength={1000}
                  defaultValue={shift.masterNote ?? ""}
                  placeholder="Замечание мастера (необязательно)"
                />
                <div>
                  <button className={styles.primary} type="submit">
                    {shift.endedAt
                      ? "Принять сдачу смены"
                      : "Сохранить проверку"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <form action={markAbsenceAction} className={styles.inline}>
              <input type="hidden" name="userId" value={person.id} />
              <input type="hidden" name="day" value={day} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <label className={styles.field}>
                Отсутствие
                <select
                  className={styles.select}
                  name="reason"
                  defaultValue={shift?.absence ?? ""}
                >
                  <option value="">Не отсутствует</option>
                  {Object.entries(absenceReasonLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <input
                className={styles.input}
                name="note"
                maxLength={300}
                defaultValue={shift?.absenceNote ?? ""}
                placeholder="Когда сообщил (без диагноза)"
              />
              <button className={styles.secondary} type="submit">
                Сохранить
              </button>
            </form>
          )}
        </div>
      </details>
    </li>
  );
}

// ——— Журнал фактов ———

async function JournalTab({
  filter,
  today,
}: {
  filter: "open" | "all";
  today: string;
}) {
  const [staff, incidents] = await Promise.all([
    getWorkshopStaff(),
    getIncidents({ take: 200 }),
  ]);
  const shown =
    filter === "open"
      ? incidents.filter((i) => incidentStatus(i) !== "closed")
      : incidents;
  const returnPath = tabHref("journal", filter === "all" ? { filter } : {});
  // Повторность смотрим по прежним записям того же сотрудника.
  const history = new Map<string, number>();
  for (const incident of incidents)
    if (incident.decision && incident.decision !== "none")
      history.set(
        incident.employeeId,
        (history.get(incident.employeeId) ?? 0) + 1,
      );
  const nowLocal = `${today}T${new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bishkek",
  }).format(new Date())}`;
  return (
    <>
      <section className={styles.section}>
        <h2>Порядок по каждому случаю</h2>
        <ol className={styles.hint} style={{ paddingLeft: 18, margin: 0 }}>
          <li>
            Зафиксировать факт: дата, место, обязанность, что обнаружено,
            доказательства. Опасность устранить сразу.
          </li>
          <li>
            Получить объяснение сотрудника (он пишет в «Моя смена») или отметить
            отказ.
          </li>
          <li>
            Проверить причины и принять одно решение. Без штрафов, «три
            нарушения — увольнение» не применяется.
          </li>
          <li>
            Сотрудник нажимает «Ознакомлен» и может написать несогласие. При
            взыскании приказ оформить в течение 3 рабочих дней.
          </li>
        </ol>
      </section>

      <section className={styles.section}>
        <details className={styles.card}>
          <summary>
            <strong>+ Записать факт</strong>
          </summary>
          <form
            action={createIncidentAction}
            className={`${styles.cardBody} ${styles.form}`}
          >
            <input type="hidden" name="returnPath" value={returnPath} />
            <div className={styles.fields}>
              <label className={styles.field}>
                Сотрудник
                <select className={styles.select} name="employeeId" required>
                  <option value="">Выберите</option>
                  {staff.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                      {person.stationLabel ? ` · ${person.stationLabel}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Направление
                <select className={styles.select} name="area" required>
                  {Object.entries(incidentAreas).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Когда
                <input
                  className={styles.input}
                  type="datetime-local"
                  name="occurredAt"
                  defaultValue={nowLocal}
                />
              </label>
              <label className={styles.field}>
                Станок или зона
                <input className={styles.input} name="place" maxLength={200} />
              </label>
            </div>
            <label className={styles.field}>
              Что обнаружено и какой пункт правила относится
              <textarea
                className={styles.textarea}
                name="observed"
                required
                maxLength={2000}
              />
            </label>
            <label className={styles.field}>
              Доказательства и свидетели
              <input
                className={styles.input}
                name="evidence"
                maxLength={1000}
                placeholder="Фото, кто видел"
              />
            </label>
            <p className={styles.hint}>
              Диагнозы и медицинские документы сюда не пишите — они у кадровика.
              «Виновата бригада» не записывается: только конкретный сотрудник.
            </p>
            <div>
              <button className={styles.primary} type="submit">
                Записать факт
              </button>
            </div>
          </form>
        </details>
      </section>

      <div className={styles.tabs}>
        <Link
          href={tabHref("journal")}
          aria-current={filter === "open" ? "page" : undefined}
        >
          В работе
        </Link>
        <Link
          href={tabHref("journal", { filter: "all" })}
          aria-current={filter === "all" ? "page" : undefined}
        >
          Все записи
        </Link>
      </div>

      {shown.length === 0 ? (
        <p className={styles.muted}>
          {filter === "open" ? "Открытых записей нет." : "Записей пока нет."}
        </p>
      ) : (
        <ul className={styles.cards}>
          {shown.map((incident) => {
            const status = incidentStatus(incident);
            const previous =
              (history.get(incident.employeeId) ?? 0) -
              (incident.decision && incident.decision !== "none" ? 1 : 0);
            const causes = (incident.causes ?? "")
              .split(",")
              .filter(Boolean) as IncidentCause[];
            return (
              <li key={incident.id} id={`incident-${incident.id}`}>
                <details className={styles.card} open={status !== "closed"}>
                  <summary>
                    <strong>{incident.employeeName}</strong>
                    <span>
                      {incidentAreas[incident.area as IncidentArea] ??
                        incident.area}
                    </span>
                    <span className={styles.muted}>
                      {shiftDateTimeFormatter.format(incident.occurredAt)}
                    </span>
                    <span
                      className={styles.pill}
                      data-tone={status === "closed" ? "good" : "warn"}
                    >
                      {incidentStatusLabels[status]}
                    </span>
                  </summary>
                  <div className={styles.cardBody}>
                    <p>{incident.observed}</p>
                    <p className={styles.hint}>
                      {incident.place ? `Место: ${incident.place} · ` : ""}
                      {incident.evidence
                        ? `Доказательства: ${incident.evidence} · `
                        : ""}
                      Записал: {incident.reportedByName ?? "—"}
                      {previous > 0
                        ? ` · ранее мер по сотруднику: ${previous}`
                        : " · ранее мер не было"}
                    </p>
                    {incident.explanation ? (
                      <p>Объяснение: {incident.explanation}</p>
                    ) : incident.explanationRefused ? (
                      <p>Сотрудник отказался дать объяснение (оформить акт).</p>
                    ) : null}
                    {status === "explain" ? (
                      <form
                        action={explainIncidentAction}
                        className={styles.form}
                      >
                        <input type="hidden" name="id" value={incident.id} />
                        <input type="hidden" name="returnTo" value="shifts" />
                        <input
                          type="hidden"
                          name="returnPath"
                          value={returnPath}
                        />
                        <label className={styles.field}>
                          Объяснение со слов сотрудника
                          <textarea
                            className={styles.textarea}
                            name="explanation"
                            maxLength={2000}
                          />
                        </label>
                        <label className={styles.check}>
                          <input type="checkbox" name="refused" /> Отказался
                          дать объяснение
                        </label>
                        <div>
                          <button className={styles.secondary} type="submit">
                            Записать
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {status === "decide" ? (
                      <form
                        action={decideIncidentAction}
                        className={styles.form}
                      >
                        <input type="hidden" name="id" value={incident.id} />
                        <input
                          type="hidden"
                          name="returnPath"
                          value={returnPath}
                        />
                        <strong>Проверка причин</strong>
                        {Object.entries(incidentCauses).map(([key, label]) => (
                          <label key={key} className={styles.check}>
                            <input type="checkbox" name="cause" value={key} />
                            {label}
                          </label>
                        ))}
                        <label className={styles.field}>
                          Решение
                          <select
                            className={styles.select}
                            name="decision"
                            required
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Выберите
                            </option>
                            {Object.entries(incidentDecisions).map(
                              ([key, label]) => (
                                <option key={key} value={key}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <label className={styles.field}>
                          Обоснование
                          <textarea
                            className={styles.textarea}
                            name="note"
                            maxLength={2000}
                          />
                        </label>
                        <p className={styles.hint}>
                          Первое малозначительное — разъяснение. Повторное —
                          замечание или выговор с учётом тяжести. Опасная работа
                          — сначала прекратить и проверить условия.
                        </p>
                        <div>
                          <button className={styles.primary} type="submit">
                            Записать решение
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {incident.decision ? (
                      <p>
                        Решение:{" "}
                        <strong>
                          {incidentDecisions[
                            incident.decision as IncidentDecision
                          ] ?? incident.decision}
                        </strong>
                        {incident.decidedByName
                          ? ` · ${incident.decidedByName}`
                          : ""}
                        {incident.decidedAt
                          ? `, ${shiftDateTimeFormatter.format(incident.decidedAt)}`
                          : ""}
                        {incident.decisionNote
                          ? ` · ${incident.decisionNote}`
                          : ""}
                        {causes.length
                          ? ` · причины: ${causes
                              .map((c) => incidentCauses[c] ?? c)
                              .join("; ")}`
                          : ""}
                      </p>
                    ) : null}
                    {incident.acknowledgedAt ? (
                      <p className={styles.hint}>
                        Ознакомлен{" "}
                        {shiftDateTimeFormatter.format(incident.acknowledgedAt)}
                        {incident.objection
                          ? ` · несогласие: ${incident.objection}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ——— Итоги месяца ———

async function MonthTab({ month }: { month: string }) {
  const { from, next } = monthBounds(month);
  const [staff, shifts, incidents] = await Promise.all([
    getWorkshopStaff(),
    getShiftsForRange(from, next),
    getIncidents({
      from: new Date(`${from}T00:00:00+06:00`),
      to: new Date(`${next}T00:00:00+06:00`),
      take: 1000,
    }),
  ]);
  const people = new Map(staff.map((p) => [p.id, p.name]));
  for (const shift of shifts)
    if (!people.has(shift.userId)) people.set(shift.userId, shift.userName);
  const rows = [...people].map(([id, name]) => {
    const own = shifts.filter((shift) => shift.userId === id);
    const score = buildShiftScore(
      own.map((shift) => {
        const r = shiftResults(shift);
        return {
          role: (shift.role as ShiftRole) ?? "operator",
          absent: (shift.absence as AbsenceReason | null) ?? null,
          lateMinutes: shift.lateMinutes,
          lateExcused: shift.lateExcused,
          startResults: r.start,
          endResults: r.end,
          masterDeviations: r.masterDeviations,
        };
      }),
    );
    const notEnded = own.filter((s) => s.startedAt && !s.endedAt).length;
    return {
      id,
      name,
      score,
      notEnded,
      incidents: incidents.filter((i) => i.employeeId === id).length,
      days: own.filter((s) => s.startedAt).map((s) => keyFromDate(s.shiftDate)),
    };
  });
  return (
    <>
      <div className={styles.monthNav}>
        <Link href={tabHref("month", { month: shiftMonth(month, -1) })}>←</Link>
        <strong>{monthTitle(month)}</strong>
        <Link href={tabHref("month", { month: shiftMonth(month, 1) })}>→</Link>
      </div>
      <section className={styles.section}>
        <h2>Выполнение обязанностей</h2>
        <p className={styles.hint}>
          Процент выполненных проверок по 6 показателям с весами из документа
          (станок 20%, зона 15%, уход 20%, график 10%, передача 20%,
          безопасность 15%). Отсутствия по уважительной причине и неприменимые
          пункты не считаются. Это не деньги: премию по этой модели можно ввести
          только отдельным положением.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Итог</th>
                {buildShiftScore([]).indicators.map((i) => (
                  <th key={i.key}>
                    {i.label} <span className={styles.muted}>{i.weight}%</span>
                  </th>
                ))}
                <th>Смен</th>
                <th>Опозд.</th>
                <th>Отсутств.</th>
                <th>Не сдал</th>
                <th>Фактов</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>
                    <strong>
                      {row.score.percent === null
                        ? "—"
                        : `${row.score.percent}%`}
                    </strong>
                  </td>
                  {row.score.indicators.map((i) => (
                    <td key={i.key}>
                      {i.checks
                        ? `${Math.round((i.done / i.checks) * 100)}%`
                        : "—"}
                      {i.checks ? (
                        <span className={styles.muted}>
                          {" "}
                          {i.done}/{i.checks}
                        </span>
                      ) : null}
                    </td>
                  ))}
                  <td>{row.score.worked}</td>
                  <td>{row.score.late || ""}</td>
                  <td>
                    {row.score.absences || ""}
                    {row.score.unexcused
                      ? ` (без подтв. ${row.score.unexcused})`
                      : ""}
                  </td>
                  <td>{row.notEnded || ""}</td>
                  <td>{row.incidents || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function monthTitle(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, mon - 1, 1)));
}

// ——— Цикл и станки ———

async function MachinesTab({
  month,
  settings,
}: {
  month: string;
  settings: ShiftSettings;
}) {
  const { from, next } = monthBounds(month);
  const data = await getProductionAnalytics({
    from,
    toExclusive: next,
    shiftStart: settings.start,
    shiftEnd: settings.end,
  });
  const fmt = (ms: number | undefined | null) =>
    ms === undefined || ms === null ? "—" : formatDuration(ms);
  const s = data.summary;
  return (
    <>
      <div className={styles.monthNav}>
        <Link href={tabHref("machines", { month: shiftMonth(month, -1) })}>
          ←
        </Link>
        <strong>{monthTitle(month)}</strong>
        <Link href={tabHref("machines", { month: shiftMonth(month, 1) })}>
          →
        </Link>
      </div>

      <section className={styles.section}>
        <h2>Время цикла по клиентам</h2>
        <p className={styles.hint}>
          Считается по заявкам на распил, которые стали «Готово» в этом месяце.
          «От заявки» — с момента, когда клиент оставил заявку. «В цеху» — от
          запуска в цех до «Готово».
        </p>
        <dl className={styles.summary}>
          <div>
            <dt>Готово заявок</dt>
            <dd>{data.cycles.length}</dd>
          </div>
          <div>
            <dt>От заявки, в среднем</dt>
            <dd>{fmt(s.client?.averageMs)}</dd>
          </div>
          <div>
            <dt>От заявки, медиана</dt>
            <dd>{fmt(s.client?.medianMs)}</dd>
          </div>
          <div>
            <dt>В цеху, в среднем</dt>
            <dd>{fmt(s.shop?.averageMs)}</dd>
          </div>
          <div>
            <dt>Ожидание распила</dt>
            <dd>{fmt(s.wait?.averageMs)}</dd>
          </div>
          {workStations.map((station) => (
            <div key={station}>
              <dt>{workStationLabels[station]}, в среднем</dt>
              <dd>{fmt(s.stages[station]?.averageMs)}</dd>
            </div>
          ))}
        </dl>
        {data.cycles.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Заявка</th>
                  <th>Клиент</th>
                  <th>От заявки</th>
                  <th>В цеху</th>
                  <th>Ожидание</th>
                  {workStations.map((station) => (
                    <th key={station}>{workStationLabels[station]}</th>
                  ))}
                  <th>Листов</th>
                </tr>
              </thead>
              <tbody>
                {data.cycles.slice(0, 100).map((cycle) => (
                  <tr key={cycle.id}>
                    <td>
                      <Link
                        href={`/admin/production/${encodeURIComponent(cycle.id)}`}
                      >
                        {cycle.number ?? cycle.id.slice(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td>{cycle.contactName}</td>
                    <td>
                      <strong>{fmt(cycle.clientMs)}</strong>
                    </td>
                    <td>{fmt(cycle.shopMs)}</td>
                    <td>{cycle.launchedAt ? fmt(cycle.waitMs) : "—"}</td>
                    {workStations.map((station) => (
                      <td key={station}>
                        {cycle.stageMs[station]
                          ? fmt(cycle.stageMs[station])
                          : "—"}
                      </td>
                    ))}
                    <td>{cycle.sheets ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.cycles.length > 100 ? (
              <p className={styles.hint}>
                Показаны 100 самых долгих из {data.cycles.length}.
              </p>
            ) : null}
          </div>
        ) : (
          <p className={styles.muted}>В этом месяце готовых заявок ещё нет.</p>
        )}
      </section>

      <section className={styles.section}>
        <h2>Работа станков</h2>
        <p className={styles.hint}>
          «В работе» — часы смены ({settings.start}–{settings.end}, пн–сб),
          когда на станции была хотя бы одна заявка. «Простой» — когда станок
          был остановлен из-за неисправности.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Станция</th>
                <th>В работе</th>
                <th>Загрузка</th>
                <th>Простой</th>
                <th>Неисправностей</th>
              </tr>
            </thead>
            <tbody>
              {data.stations.map((row) => {
                const load = row.workMs
                  ? Math.min(100, Math.round((row.busyMs / row.workMs) * 100))
                  : 0;
                const down = row.workMs
                  ? Math.min(
                      100,
                      Math.round((row.downtimeMs / row.workMs) * 100),
                    )
                  : 0;
                return (
                  <tr key={row.station}>
                    <td>{workStationLabels[row.station]}</td>
                    <td>
                      {formatHours(row.busyMs)} из {formatHours(row.workMs)}
                    </td>
                    <td style={{ minWidth: 120 }}>
                      {load}%
                      <div className={styles.bar}>
                        <span style={{ width: `${load}%` }} />
                      </div>
                    </td>
                    <td>
                      {formatHours(row.downtimeMs)}
                      {down ? (
                        <div className={styles.bar}>
                          <span
                            data-tone="down"
                            style={{ width: `${down}%` }}
                          />
                        </div>
                      ) : null}
                    </td>
                    <td>{row.faults || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data.faults.length ? (
          <>
            <h3 style={{ margin: "14px 0 6px", fontSize: 15 }}>
              Неисправности за месяц
            </h3>
            <ul className={styles.resultList}>
              {data.faults.map((fault) => (
                <li key={fault.id}>
                  <span
                    className={styles.pill}
                    data-tone={fault.resolvedAt ? "good" : "bad"}
                  >
                    {fault.resolvedAt ? "устранено" : "открыта"}
                  </span>
                  <span>
                    {shiftDateTimeFormatter.format(fault.reportedAt)} ·{" "}
                    {workStationLabels[
                      fault.station as keyof typeof workStationLabels
                    ] ?? fault.station}
                    {fault.machine ? `, ${fault.machine}` : ""} —{" "}
                    {fault.description}
                    {fault.resolvedAt
                      ? ` · простой ${formatDuration(fault.resolvedAt.getTime() - fault.reportedAt.getTime())}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </>
  );
}
