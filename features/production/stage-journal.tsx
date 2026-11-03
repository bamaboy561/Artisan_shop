import { CuttingStage } from "@/generated/prisma";
import { cuttingStageLabels } from "@/features/cutting/progress";
import { formatDuration } from "./workflow-flags";
import { productionTimeZone } from "./queue";

type StageEvent = {
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string | null;
  createdAt: Date;
};

export type StageJournalRow = {
  stage: CuttingStage;
  label: string;
  actorName: string | null;
  startedAt: Date;
  durationMs: number;
  running: boolean;
};

const stages = new Set<string>(Object.values(CuttingStage));

// Кто и когда переводил заявку по этапам и сколько она пробыла на каждом.
export function buildStageJournal(
  events: StageEvent[],
  now: Date = new Date(),
): StageJournalRow[] {
  const changes = events
    .filter(
      (event) =>
        event.eventType === "cutting_stage" &&
        event.toStatus &&
        stages.has(event.toStatus) &&
        event.fromStatus !== event.toStatus,
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return changes.map((event, index) => {
    const next = changes[index + 1];
    const stage = event.toStatus as CuttingStage;
    return {
      stage,
      label: cuttingStageLabels[stage],
      actorName: event.actorName,
      startedAt: event.createdAt,
      durationMs:
        (next ? next.createdAt.getTime() : now.getTime()) -
        event.createdAt.getTime(),
      running: !next,
    };
  });
}

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: productionTimeZone,
});

export function StageJournal({
  events,
  closed,
}: {
  events: StageEvent[];
  closed: boolean;
}) {
  const rows = buildStageJournal(events);
  return (
    <section className="border-y border-[color:var(--line)] bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold">Журнал этапов</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Этапы по этой заявке ещё не отмечались.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[460px] text-left text-sm">
            <thead className="text-xs text-[var(--muted)]">
              <tr>
                <th className="py-2 pr-3 font-medium">Этап</th>
                <th className="py-2 pr-3 font-medium">Кто</th>
                <th className="py-2 pr-3 font-medium">Начало</th>
                <th className="py-2 font-medium">Сколько</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.stage}-${index}`}
                  className="border-t border-[color:var(--line)]"
                >
                  <td className="py-2 pr-3 font-medium">{row.label}</td>
                  <td className="py-2 pr-3">{row.actorName ?? "—"}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {timeFormatter.format(row.startedAt)}
                  </td>
                  <td className="py-2 tabular-nums">
                    {row.running && !closed ? (
                      <span className="font-semibold text-[var(--accent)]">
                        {row.stage === CuttingStage.READY_FOR_PICKUP
                          ? "ждёт выдачи "
                          : "идёт "}
                        {formatDuration(row.durationMs)}
                      </span>
                    ) : row.running ? (
                      "—"
                    ) : (
                      formatDuration(row.durationMs)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
