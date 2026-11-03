import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Flame,
  LayoutGrid,
  List,
  TriangleAlert,
} from "lucide-react";

import { setProductionStageAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { SetupState } from "@/components/admin/setup-state";
import { Input } from "@/components/ui/input";
import { CuttingStage, RequestStatus } from "@/generated/prisma";
import { Deadline, WorkflowFlags } from "@/features/production/queue-view";
import {
  productionBoardPath,
  productionTimeZone,
} from "@/features/production/queue";
import {
  deadlineTone,
  formatDuration,
} from "@/features/production/workflow-flags";
import { requestStatusLabels } from "@/features/admin/operations-filters";
import { requireAdminSession } from "@/lib/auth/dal";
import { canManageProduction } from "@/lib/auth/roles";
import { hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import {
  getProductionBoard,
  type BoardColumnKey,
} from "@/lib/server/production-workspace";
import styles from "./board.module.css";

export const dynamic = "force-dynamic";

type Card = Awaited<ReturnType<typeof getProductionBoard>>["cards"][number];

const columns: Array<{
  key: BoardColumnKey;
  title: string;
  hint: string;
  next?: { stage: CuttingStage; label: string; needsCell?: boolean };
}> = [
  {
    key: "NEW",
    title: "Новые",
    hint: "Ещё не запущены в цех",
    next: { stage: CuttingStage.ACCEPTED, label: "Запустить в цех" },
  },
  {
    key: "QUEUED",
    title: "Ждут распила",
    hint: "Запущены, в очереди на станок",
    next: { stage: CuttingStage.CUTTING, label: "Начать распил" },
  },
  {
    key: "CUTTING",
    title: "Распил",
    hint: "Сейчас на распиле",
    next: { stage: CuttingStage.EDGING, label: "На кромку" },
  },
  {
    key: "EDGING",
    title: "Кромка",
    hint: "Сейчас на кромке",
    next: { stage: CuttingStage.DRILLING, label: "На присадку" },
  },
  {
    key: "DRILLING",
    title: "Присадка",
    hint: "Сейчас на присадке",
    next: {
      stage: CuttingStage.READY_FOR_PICKUP,
      label: "Готово",
      needsCell: true,
    },
  },
  {
    key: "READY_FOR_PICKUP",
    title: "К выдаче",
    hint: "Готово, ждёт клиента",
  },
];

const notices: Record<string, { tone: "success" | "error"; text: string }> = {
  "stage-updated": { tone: "success", text: "Заявка перенесена." },
  "stage-conflict": {
    tone: "error",
    text: "Этап уже изменили на другом устройстве. Доска обновлена.",
  },
  "action-forbidden": {
    tone: "error",
    text: "Для этого аккаунта действие недоступно.",
  },
  "request-missing": { tone: "error", text: "Заявка не найдена." },
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  timeZone: productionTimeZone,
});

export default async function ProductionBoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdminSession(
    `/login?next=${productionBoardPath}`,
    productionBoardPath,
  );
  if (!canManageProduction(session.roleCode)) redirect("/admin/production");
  if (!hasDatabaseUrl() && !isDemoModeEnabled())
    return (
      <SetupState
        title="Доска распила появится после подключения БД"
        description="Для доски нужна рабочая база заявок."
        steps={["Настройте DATABASE_URL.", "Откройте доску повторно."]}
      />
    );

  const params = await searchParams;
  const noticeKey = typeof params.notice === "string" ? params.notice : "";
  const notice = notices[noticeKey];
  const board = await getProductionBoard();
  const now = board.now;
  const byColumn = new Map<BoardColumnKey, Card[]>(
    columns.map((column) => [column.key, []]),
  );
  for (const card of board.cards) byColumn.get(card.column)?.push(card);
  const inWork = board.cards.filter((card) => card.column !== "NEW");
  const overdue = inWork.filter(
    (card) =>
      deadlineTone(
        card.dueDate,
        board.today,
        card.stage === CuttingStage.READY_FOR_PICKUP,
      ) === "overdue",
  ).length;
  const dueToday = inWork.filter(
    (card) =>
      deadlineTone(
        card.dueDate,
        board.today,
        card.stage === CuttingStage.READY_FOR_PICKUP,
      ) === "today",
  ).length;
  const urgent = board.cards.filter((card) => card.workflow.isUrgent).length;
  const problems = board.cards.filter(
    (card) => card.workflow.problemReason,
  ).length;

  return (
    <div className={styles.board}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>
            <LayoutGrid size={16} /> Производство
          </p>
          <h1>Доска распила</h1>
        </div>
        <Link className={styles.listLink} href="/admin/production">
          <List size={16} /> Списком
        </Link>
      </header>

      {notice ? (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={notice.tone === "error" ? styles.error : styles.success}
        >
          {notice.text}
        </p>
      ) : null}

      <dl className={styles.summary}>
        <div>
          <dt>В работе</dt>
          <dd>{inWork.length}</dd>
        </div>
        <div data-tone={overdue ? "bad" : undefined}>
          <dt>Просрочено</dt>
          <dd>{overdue}</dd>
        </div>
        <div data-tone={dueToday ? "warn" : undefined}>
          <dt>Срок сегодня</dt>
          <dd>{dueToday}</dd>
        </div>
        <div data-tone={urgent ? "bad" : undefined}>
          <dt>Срочные</dt>
          <dd>{urgent}</dd>
        </div>
        <div data-tone={problems ? "warn" : undefined}>
          <dt>С проблемой</dt>
          <dd>{problems}</dd>
        </div>
        <div>
          <dt>Выдано сегодня</dt>
          <dd>{board.issuedToday}</dd>
        </div>
      </dl>

      {board.truncated ? (
        <p className={styles.error}>
          Показаны первые 400 открытых заявок. Закройте выданные, чтобы доска
          была полной.
        </p>
      ) : null}

      <div className={styles.columns}>
        {columns.map((column) => {
          const cards = byColumn.get(column.key) ?? [];
          return (
            <section
              key={column.key}
              className={styles.column}
              aria-labelledby={`column-${column.key}`}
            >
              <header className={styles.columnHead}>
                <h2 id={`column-${column.key}`}>{column.title}</h2>
                <span>{cards.length}</span>
              </header>
              <p className={styles.columnHint}>{column.hint}</p>
              {cards.length ? (
                <ul className={styles.cards}>
                  {cards.map((card) => (
                    <BoardCard
                      key={card.id}
                      card={card}
                      next={column.next}
                      today={board.today}
                      now={now}
                      planning={board.planning}
                      highlighted={params.id === card.id}
                    />
                  ))}
                </ul>
              ) : (
                <p className={styles.empty}>Пусто</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({
  card,
  next,
  today,
  now,
  planning,
  highlighted,
}: {
  card: Card;
  next?: { stage: CuttingStage; label: string; needsCell?: boolean };
  today: string;
  now: number;
  planning: boolean;
  highlighted: boolean;
}) {
  const number = card.number ?? card.id.slice(0, 8).toUpperCase();
  const href = `/admin/production/${encodeURIComponent(card.id)}?${new URLSearchParams({ returnTo: productionBoardPath })}`;
  const tone = deadlineTone(
    card.dueDate,
    today,
    card.stage === CuttingStage.READY_FOR_PICKUP,
  );
  return (
    <li
      className={styles.card}
      data-urgent={card.workflow.isUrgent || undefined}
      data-problem={card.workflow.problemReason ? true : undefined}
      data-due={tone}
      data-highlighted={highlighted || undefined}
    >
      <div className={styles.cardTop}>
        <Link href={href} className={styles.cardNumber}>
          {number}
        </Link>
        <Link href={href} aria-label={`Открыть ${number}`}>
          <ArrowRight size={16} />
        </Link>
      </div>
      <WorkflowFlags workflow={card.workflow} />
      <p className={styles.material}>{card.material}</p>
      <p className={styles.meta}>
        {card.contactName}
        {card.sheets ? ` · ${card.sheets} лист.` : ""}
        {card.edgeMeters ? ` · ${card.edgeMeters} м кромки` : ""}
      </p>
      <div className={styles.meta}>
        {planning ? (
          <span>
            Срок:{" "}
            <Deadline
              date={card.dueDate}
              today={today}
              stage={card.stage ?? CuttingStage.ACCEPTED}
            />
          </span>
        ) : null}
      </div>
      <p className={styles.meta}>
        {card.column === "NEW"
          ? `${requestStatusLabels[card.status]} · с ${dateFormatter.format(card.createdAt)}`
          : `На этапе ${formatDuration(now - card.stageSince.getTime())}`}
        {card.pickupCell ? ` · ячейка ${card.pickupCell}` : ""}
      </p>
      <p className={styles.meta}>
        Менеджер: {card.manager ?? <em>не назначен</em>}
      </p>
      {next ? (
        <form action={setProductionStageAction} className={styles.cardAction}>
          <input type="hidden" name="requestId" value={card.id} />
          <input type="hidden" name="expectedStage" value={card.stage ?? ""} />
          <input type="hidden" name="cuttingStage" value={next.stage} />
          <input type="hidden" name="returnTo" value={productionBoardPath} />
          <input type="hidden" name="origin" value="board" />
          {next.needsCell ? (
            <Input
              name="cuttingPickupCell"
              placeholder="Ячейка"
              aria-label={`Ячейка выдачи для ${number}`}
              required
              className={styles.cellInput}
            />
          ) : null}
          <AdminSubmitButton
            type="submit"
            variant="secondary"
            size="sm"
            idleLabel={next.label}
            pendingLabel="..."
          />
        </form>
      ) : (
        <Link href={href} className={styles.issueLink}>
          Выдать клиенту
        </Link>
      )}
      {card.workflow.problemReason ? (
        <p className={styles.problemHint}>
          <TriangleAlert size={12} /> Откройте заявку, чтобы снять проблему
        </p>
      ) : null}
      {card.workflow.isUrgent && card.status !== RequestStatus.IN_PROGRESS ? (
        <p className={styles.problemHint}>
          <Flame size={12} /> Срочная, но ещё не запущена
        </p>
      ) : null}
    </li>
  );
}
