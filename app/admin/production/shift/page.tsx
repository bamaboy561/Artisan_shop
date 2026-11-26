import Link from "next/link";
import { ClipboardCheck } from "lucide-react";

import { SetupState } from "@/components/admin/setup-state";
import { requireAdminSession } from "@/lib/auth/dal";
import { canManageProduction } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import { productionDateKey } from "@/features/production/queue";
import {
  absenceReasonLabels,
  incidentAreas,
  incidentDecisions,
  incidentStatus,
  incidentStatusLabels,
  itemsFor,
  shiftRoleLabels,
  type AbsenceReason,
  type IncidentArea,
  type IncidentDecision,
  type ShiftRole,
} from "@/features/production/shift";
import {
  workStationLabels,
  workStations,
  type WorkStation,
} from "@/features/production/cycle-time";
import { ShiftChecklistForm } from "@/features/production/shift-checklist-form";
import { FaultForms } from "@/features/production/fault-forms";
import { ResultList } from "@/features/production/shift-result-list";
import { ShiftPhotoInput } from "@/features/production/shift-photo-input";
import {
  defaultRoleFor,
  getIncidents,
  getMyShift,
  getOpenFaults,
  getShiftSettings,
  getStationOpenRequests,
  prepareShifts,
  shiftDateTimeFormatter,
  shiftResults,
  shiftTimeFormatter,
} from "@/lib/server/production-shifts";
import {
  acknowledgeIncidentAction,
  endShiftAction,
  explainIncidentAction,
  startShiftAction,
} from "../shift-actions";
import styles from "@/features/production/shift.module.css";

export const dynamic = "force-dynamic";

const notices: Record<string, { tone: "success" | "error"; text: string }> = {
  "start-saved": { tone: "success", text: "Смена принята. Хорошей работы!" },
  "start-already": { tone: "error", text: "Смена уже принята сегодня." },
  "end-saved": {
    tone: "success",
    text: "Смена сдана. Мастер проверит и подтвердит.",
  },
  "end-already": { tone: "error", text: "Смена уже сдана." },
  "end-not-started": {
    tone: "error",
    text: "Сначала примите смену, потом сдавайте.",
  },
  "checklist-incomplete": {
    tone: "error",
    text: "Отметьте все пункты. У «Отклонение» и «Неприменимо» нужно пояснение.",
  },
  "photo-failed": {
    tone: "error",
    text: "Фото не загрузилось. Попробуйте ещё раз или сдайте без фото.",
  },
  "fault-saved": {
    tone: "success",
    text: "Неисправность записана, мастер получил сообщение.",
  },
  "fault-incomplete": {
    tone: "error",
    text: "Выберите станцию и опишите, что случилось.",
  },
  "fault-resolved-saved": {
    tone: "success",
    text: "Отмечено: неисправность устранена.",
  },
  "explain-saved": { tone: "success", text: "Объяснение записано." },
  "explain-empty": { tone: "error", text: "Напишите объяснение." },
  "explain-already": {
    tone: "error",
    text: "По этой записи уже принято решение.",
  },
  "ack-saved": { tone: "success", text: "Отмечено, что вы ознакомлены." },
  "start-unavailable": { tone: "error", text: "База недоступна, повторите." },
  "end-unavailable": { tone: "error", text: "База недоступна, повторите." },
  "start-forbidden": {
    tone: "error",
    text: "Для этого аккаунта действие недоступно.",
  },
};

export default async function MyShiftPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdminSession(
    "/login?next=/admin/production/shift",
    "/admin/production/shift",
  );
  if (!hasDatabaseUrl() || !(await prepareShifts()))
    return (
      <SetupState
        title="Смены появятся после подключения БД"
        description="Чек-листы смены хранятся в базе."
        steps={["Настройте DATABASE_URL.", "Откройте страницу повторно."]}
      />
    );
  const params = await searchParams;
  const notice =
    notices[typeof params.notice === "string" ? params.notice : ""];
  const today = productionDateKey(new Date());
  const station = (actor.productionStation ?? null) as WorkStation | null;
  const [shift, settings, faults, incidents, openNumbers] = await Promise.all([
    getMyShift(actor, today),
    getShiftSettings(),
    getOpenFaults(),
    getIncidents({ employeeId: actor.userId, take: 30 }),
    getStationOpenRequests(station),
  ]);
  const manager = canManageProduction(actor.roleCode);
  const defaultRole = defaultRoleFor(actor);
  const roles: ShiftRole[] = manager
    ? ["master", "operator", "helper"]
    : ["operator", "helper"];
  const role = (shift?.role as ShiftRole | undefined) ?? defaultRole;
  const results = shift ? shiftResults(shift) : null;
  const openIncidents = incidents.filter(
    (incident) => incidentStatus(incident) !== "closed",
  );

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>
            <ClipboardCheck size={16} /> Производство ·{" "}
            {today.split("-").reverse().join(".")}
          </p>
          <h1>Моя смена</h1>
          <p className={styles.hint}>
            График: {settings.start}–{settings.end}
            {station ? ` · ${workStationLabels[station]}` : ""}
          </p>
        </div>
        {manager ? (
          <Link className={styles.secondary} href="/admin/production/shifts">
            Смены цеха
          </Link>
        ) : null}
      </header>

      {notice ? (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={notice.tone === "error" ? styles.error : styles.success}
        >
          {notice.text}
        </p>
      ) : null}

      {openIncidents.length ? (
        <p className={styles.warn}>
          В журнале есть записи, где нужен ваш ответ: {openIncidents.length}.{" "}
          <a href="#journal">Открыть</a>
        </p>
      ) : null}

      {shift?.absence ? (
        <section className={styles.section}>
          <h2>Сегодня вы отмечены отсутствующим</h2>
          <p>
            {absenceReasonLabels[shift.absence as AbsenceReason] ??
              shift.absence}
            {shift.absenceNote ? ` · ${shift.absenceNote}` : ""}
          </p>
          <p className={styles.hint}>
            Если это ошибка, скажите мастеру — он снимет отметку.
          </p>
        </section>
      ) : !shift?.startedAt ? (
        <section className={styles.section}>
          <h2>1. Принять смену</h2>
          <p className={styles.hint}>
            Проверьте станок и зону до начала работы. Дефект от прошлой смены,
            записанный сейчас, не будет считаться вашим. При угрозе безопасности
            опасную операцию не начинайте и сразу сообщите мастеру.
          </p>
          <ShiftChecklistForm
            action={startShiftAction}
            itemsByRole={Object.fromEntries(
              roles.map((r) => [r, itemsFor(r, "start")]),
            )}
            roles={roles}
            defaultRole={defaultRole}
            submitLabel="Принять смену"
          >
            <label className={styles.field}>
              Замечания (что приняли от прошлой смены)
              <textarea
                className={styles.textarea}
                name="note"
                maxLength={1000}
                placeholder="Необязательно"
              />
            </label>
            <label className={styles.field}>
              Если опоздали — причина
              <input
                className={styles.input}
                name="lateReason"
                maxLength={500}
                placeholder="Время прихода запишется само"
              />
            </label>
          </ShiftChecklistForm>
        </section>
      ) : (
        <>
          <section className={styles.section}>
            <h2>
              Смена принята в {shiftTimeFormatter.format(shift.startedAt)}
            </h2>
            <p className={styles.hint}>
              {shiftRoleLabels[role]}
              {shift.lateMinutes
                ? ` · опоздание ${shift.lateMinutes} мин${shift.lateReason ? ` (${shift.lateReason})` : ""}`
                : " · вовремя"}
            </p>
            <ResultList role={role} phase="start" results={results!.start} />
          </section>
          {!shift.endedAt ? (
            <section className={styles.section}>
              <h2>2. Сдать смену</h2>
              <p className={styles.hint}>
                Отмечайте состояние после уборки. Пыль во время распила — не
                нарушение.
              </p>
              <ShiftChecklistForm
                action={endShiftAction}
                itemsByRole={{ [role]: itemsFor(role, "end") }}
                roles={[role]}
                defaultRole={role}
                submitLabel="Сдать смену"
              >
                <label className={styles.field}>
                  Незавершённые заказы и следующий шаг
                  <textarea
                    className={styles.textarea}
                    name="unfinished"
                    maxLength={2000}
                    defaultValue={
                      openNumbers.length ? `${openNumbers.join(", ")} — ` : ""
                    }
                    placeholder="Например: 1234 — осталось 2 листа, ждём материал"
                  />
                </label>
                <label className={styles.field}>
                  Замечания за смену
                  <textarea
                    className={styles.textarea}
                    name="note"
                    maxLength={1000}
                    placeholder="Необязательно"
                  />
                </label>
                <ShiftPhotoInput />
              </ShiftChecklistForm>
            </section>
          ) : (
            <section className={styles.section}>
              <h2>Смена сдана в {shiftTimeFormatter.format(shift.endedAt)}</h2>
              <p className={styles.hint}>
                {shift.confirmedAt
                  ? `Мастер ${shift.confirmedByName ?? ""} принял сдачу в ${shiftTimeFormatter.format(shift.confirmedAt)}.`
                  : "Ждёт проверки мастером."}
                {shift.masterNote
                  ? ` Замечание мастера: ${shift.masterNote}`
                  : ""}
              </p>
              {results!.end ? (
                <ResultList
                  role={role}
                  phase="end"
                  results={results!.end}
                  masterDeviations={results!.masterDeviations}
                />
              ) : null}
            </section>
          )}
        </>
      )}

      <section className={styles.section} id="faults">
        <h2>Неисправность станка</h2>
        <p className={styles.hint}>
          Сообщайте сразу. Ремонт, к которому вы не допущены, не делайте. При
          опасности остановите работу безопасным способом.
        </p>
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
          defaultStation={station ?? workStations[0]}
          returnTo="shift"
        />
      </section>

      <section className={styles.section} id="journal">
        <h2>Мои записи в журнале фактов</h2>
        <p className={styles.hint}>
          Запись — это наблюдение, а не готовое решение. Вы можете дать
          объяснение и написать несогласие.
        </p>
        {incidents.length === 0 ? (
          <p className={styles.muted}>Записей нет.</p>
        ) : (
          <ul className={styles.cards}>
            {incidents.map((incident) => {
              const status = incidentStatus(incident);
              return (
                <li
                  key={incident.id}
                  className={styles.card}
                  id={`incident-${incident.id}`}
                >
                  <div className={styles.cardBody} style={{ paddingTop: 12 }}>
                    <p>
                      <strong>
                        {incidentAreas[incident.area as IncidentArea] ??
                          incident.area}
                      </strong>{" "}
                      · {shiftDateTimeFormatter.format(incident.occurredAt)}{" "}
                      <span
                        className={styles.pill}
                        data-tone={status === "closed" ? "good" : "warn"}
                      >
                        {incidentStatusLabels[status]}
                      </span>
                    </p>
                    <p>{incident.observed}</p>
                    {incident.explanation ? (
                      <p className={styles.hint}>
                        Ваше объяснение: {incident.explanation}
                      </p>
                    ) : null}
                    {incident.decision ? (
                      <p>
                        Решение:{" "}
                        <strong>
                          {incidentDecisions[
                            incident.decision as IncidentDecision
                          ] ?? incident.decision}
                        </strong>
                        {incident.decisionNote
                          ? ` · ${incident.decisionNote}`
                          : ""}
                      </p>
                    ) : null}
                    {status === "explain" ? (
                      <form
                        action={explainIncidentAction}
                        className={styles.form}
                      >
                        <input type="hidden" name="id" value={incident.id} />
                        <label className={styles.field}>
                          Ваше объяснение
                          <textarea
                            className={styles.textarea}
                            name="explanation"
                            required
                            maxLength={2000}
                          />
                        </label>
                        <div>
                          <button className={styles.primary} type="submit">
                            Отправить объяснение
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {status === "acknowledge" ? (
                      <form
                        action={acknowledgeIncidentAction}
                        className={styles.form}
                      >
                        <input type="hidden" name="id" value={incident.id} />
                        <label className={styles.field}>
                          Если не согласны — напишите (можно оставить пустым)
                          <textarea
                            className={styles.textarea}
                            name="objection"
                            maxLength={2000}
                          />
                        </label>
                        <div>
                          <button className={styles.primary} type="submit">
                            Ознакомлен
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {incident.objection ? (
                      <p className={styles.hint}>
                        Ваше несогласие: {incident.objection}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
