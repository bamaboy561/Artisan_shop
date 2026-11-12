import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import type {
  DailyReport,
  ReportCard,
} from "@/features/production/daily-report";
import {
  addDaysToDateKey,
  productionBoardPath,
} from "@/features/production/queue";
import {
  cuttingProblemLabel,
  formatDuration,
} from "@/features/production/workflow-flags";
import styles from "./board.module.css";

const listLimit = 8;

function formatDay(day: string) {
  return day.split("-").reverse().join(".");
}

function dayHref(day: string, today: string) {
  return day === today
    ? `${productionBoardPath}#daily-report`
    : `${productionBoardPath}?day=${day}#daily-report`;
}

function cardHref(card: ReportCard) {
  return `/admin/production/${encodeURIComponent(card.id)}?${new URLSearchParams({ returnTo: productionBoardPath })}`;
}

function cardNumber(card: ReportCard) {
  return card.number ?? card.id.slice(0, 8).toUpperCase();
}

const columnTitles: Record<ReportCard["column"], string> = {
  NEW: "Новые",
  QUEUED: "Ждут распила",
  CUTTING: "Распил",
  EDGING: "Кромка",
  DRILLING: "Присадка",
  READY_FOR_PICKUP: "К выдаче",
};

function CardList({
  title,
  cards,
  detail,
}: {
  title: string;
  cards: ReportCard[];
  detail: (card: ReportCard) => string;
}) {
  if (!cards.length) return null;
  return (
    <div className={styles.reportList}>
      <h3>
        {title} <span>{cards.length}</span>
      </h3>
      <ul>
        {cards.slice(0, listLimit).map((card) => (
          <li key={card.id}>
            <Link href={cardHref(card)}>{cardNumber(card)}</Link>
            <span>
              {columnTitles[card.column]} · {detail(card)}
            </span>
          </li>
        ))}
      </ul>
      {cards.length > listLimit ? (
        <p className={styles.columnHint}>… и ещё {cards.length - listLimit}</p>
      ) : null}
    </div>
  );
}

export function DailyReportSection({
  report,
  day,
  today,
  now,
}: {
  report: DailyReport;
  day: string;
  today: string;
  now: number;
}) {
  const stats = report.day;
  const isToday = day === today;
  const tiles: Array<{
    label: string;
    value: number | string;
    tone?: "bad" | "warn" | "good";
  }> = [
    { label: "Новых заявок", value: stats.created },
    { label: "Запущено в цех", value: stats.launched },
    {
      label: "Распилено",
      value: stats.cutSheets
        ? `${stats.cut} · ${stats.cutSheets} лист.`
        : stats.cut,
    },
    { label: "Прошли кромку", value: stats.edged },
    { label: "Прошли присадку", value: stats.drilled },
    {
      label: "Готово к выдаче",
      value: stats.ready,
      tone: stats.ready ? "good" : undefined,
    },
    {
      label: "Готово с опозданием",
      value: stats.readyLate,
      tone: stats.readyLate ? "bad" : undefined,
    },
    { label: "Выдано клиентам", value: stats.issued },
    {
      label: "Проблем сообщено",
      value: stats.problemsReported,
      tone: stats.problemsReported ? "warn" : undefined,
    },
    { label: "Проблем решено", value: stats.problemsResolved },
  ];

  return (
    <section
      id="daily-report"
      className={styles.report}
      aria-labelledby="daily-report-title"
    >
      <header className={styles.reportHead}>
        <h2 id="daily-report-title">
          <CalendarDays size={18} /> Отчёт за{" "}
          {isToday ? "сегодня" : formatDay(day)}
        </h2>
        <nav className={styles.reportNav} aria-label="Выбор дня">
          <Link href={dayHref(addDaysToDateKey(day, -1), today)}>
            <ChevronLeft size={16} /> Пред. день
          </Link>
          {isToday ? null : (
            <>
              <Link href={dayHref(addDaysToDateKey(day, 1), today)}>
                След. день <ChevronRight size={16} />
              </Link>
              <Link href={dayHref(today, today)}>Сегодня</Link>
            </>
          )}
        </nav>
      </header>

      <dl className={styles.summary}>
        {tiles.map((tile) => (
          <div key={tile.label} data-tone={tile.tone}>
            <dt>{tile.label}</dt>
            <dd>{tile.value}</dd>
          </div>
        ))}
      </dl>

      {stats.people.length ? (
        <div className={styles.reportList}>
          <h3>Кто двигал заявки</h3>
          <ul>
            {stats.people.map((person) => (
              <li key={person.name}>
                <strong>{person.name}</strong>
                <span>{person.moves} перев. по этапам</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.columnHint}>
          За этот день заявки по этапам не переводили.
        </p>
      )}

      <h2 className={styles.reportSubtitle}>Где висят заявки сейчас</h2>
      <div className={styles.reportTable}>
        <table>
          <thead>
            <tr>
              <th>Этап</th>
              <th>Всего</th>
              <th>Просрочено</th>
              <th>Дольше суток</th>
              <th>Дольше всех</th>
            </tr>
          </thead>
          <tbody>
            {report.now.stages.map((stage) => (
              <tr key={stage.key}>
                <th scope="row">{stage.title}</th>
                <td>{stage.count}</td>
                <td data-tone={stage.overdue ? "bad" : undefined}>
                  {stage.key === "NEW" ? "—" : stage.overdue}
                </td>
                <td data-tone={stage.stuck ? "warn" : undefined}>
                  {stage.key === "NEW" || stage.key === "READY_FOR_PICKUP"
                    ? "—"
                    : stage.stuck}
                </td>
                <td>
                  {stage.oldestMs === null
                    ? "—"
                    : formatDuration(stage.oldestMs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.reportLists}>
        <CardList
          title="Просрочены"
          cards={report.now.overdue}
          detail={(card) => `срок был ${formatDay(card.dueDate ?? "")}`}
        />
        <CardList
          title="Висят дольше суток"
          cards={report.now.stuck}
          detail={(card) =>
            `на этапе ${formatDuration(now - card.stageSince.getTime())}`
          }
        />
        <CardList
          title="С проблемой"
          cards={report.now.problems}
          detail={(card) => cuttingProblemLabel(card.problemReason)}
        />
      </div>
    </section>
  );
}
