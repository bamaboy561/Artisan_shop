import {
  reportFaultAction,
  resolveFaultAction,
} from "@/app/admin/production/shift-actions";
import {
  workStationLabels,
  workStations,
  type WorkStation,
} from "./cycle-time";
import styles from "./shift.module.css";

export type FaultView = {
  id: string;
  station: string;
  machine: string | null;
  description: string;
  stopped: boolean;
  reportedAt: string;
  reportedByName: string | null;
};

// Сообщить о неисправности и отметить «Устранено». Время от сообщения до
// «Устранено» у остановленного станка считается простоем.
export function FaultForms({
  faults,
  defaultStation,
  returnTo,
}: {
  faults: FaultView[];
  defaultStation: WorkStation;
  returnTo: "shift" | "shifts";
}) {
  return (
    <div className={styles.form}>
      {faults.length ? (
        <ul className={styles.cards}>
          {faults.map((fault) => (
            <li key={fault.id} className={styles.card}>
              <div className={styles.cardBody} style={{ paddingTop: 12 }}>
                <p>
                  <strong>
                    {workStationLabels[fault.station as WorkStation] ??
                      fault.station}
                    {fault.machine ? `, ${fault.machine}` : ""}
                  </strong>{" "}
                  <span
                    className={styles.pill}
                    data-tone={fault.stopped ? "bad" : "warn"}
                  >
                    {fault.stopped ? "Станок стоит" : "Работает с дефектом"}
                  </span>
                </p>
                <p>{fault.description}</p>
                <p className={styles.hint}>
                  {fault.reportedAt}
                  {fault.reportedByName ? ` · ${fault.reportedByName}` : ""}
                </p>
                <form action={resolveFaultAction} className={styles.inline}>
                  <input type="hidden" name="id" value={fault.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input
                    className={styles.input}
                    name="resolution"
                    maxLength={1000}
                    placeholder="Что сделали (необязательно)"
                  />
                  <button className={styles.secondary} type="submit">
                    Устранено
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>Открытых неисправностей нет.</p>
      )}
      <details className={styles.card}>
        <summary>
          <strong>+ Сообщить о неисправности</strong>
        </summary>
        <form
          action={reportFaultAction}
          className={`${styles.cardBody} ${styles.form}`}
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className={styles.fields}>
            <label className={styles.field}>
              Станция
              <select
                className={styles.select}
                name="station"
                defaultValue={defaultStation}
              >
                {workStations.map((station) => (
                  <option key={station} value={station}>
                    {workStationLabels[station]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Станок
              <input
                className={styles.input}
                name="machine"
                maxLength={120}
                placeholder="Например: HOMAG, Altendorf"
              />
            </label>
          </div>
          <label className={styles.field}>
            Что случилось
            <textarea
              className={styles.textarea}
              name="description"
              required
              maxLength={1000}
            />
          </label>
          <label className={styles.check}>
            <input type="checkbox" name="stopped" /> Станок остановлен, работать
            нельзя
          </label>
          <div>
            <button className={styles.primary} type="submit">
              Сообщить мастеру
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
