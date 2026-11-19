import {
  itemMarkLabels,
  shiftItems,
  type ItemResults,
  type ShiftPhase,
  type ShiftRole,
} from "./shift";
import styles from "./shift.module.css";

export function ResultList({
  role,
  phase,
  results,
  masterDeviations = [],
}: {
  role: ShiftRole;
  phase: ShiftPhase;
  results: ItemResults;
  masterDeviations?: string[];
}) {
  const items = shiftItems[role].filter((item) => item.phase === phase);
  return (
    <ul className={styles.resultList}>
      {items.map((item) => {
        const result = results[item.key];
        const byMaster = masterDeviations.includes(item.key);
        const mark = byMaster ? "deviation" : result?.mark;
        return (
          <li key={item.key} data-mark={mark}>
            <span className={styles.pill} data-tone={toneFor(mark)}>
              {mark ? itemMarkLabels[mark] : "—"}
            </span>
            <span>
              {item.label}
              {result?.note ? ` — ${result.note}` : ""}
              {byMaster ? " (отметил мастер)" : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function toneFor(mark: string | undefined) {
  return mark === "done" ? "good" : mark === "deviation" ? "bad" : undefined;
}
