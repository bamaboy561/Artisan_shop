import Link from "next/link";
import { ClipboardList, ReceiptText, Scissors } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getAdminPulse,
  PULSE_FIRST_HOUR,
  PULSE_LAST_HOUR,
  type AdminPulse as AdminPulseData,
} from "@/lib/server/admin-pulse";

import { AutoRefresh } from "./auto-refresh";
import { CountUp } from "./count-up";
import styles from "./pulse.module.css";

const number = new Intl.NumberFormat("ru-RU");

function dayLabel(now: Date) {
  const text = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Bishkek",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const time = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Bishkek",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} · ${time}`;
}

function ago(at: Date, now: Date) {
  const minutes = Math.max(
    0,
    Math.round((now.getTime() - at.getTime()) / 60000),
  );
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  return `${Math.floor(hours / 24)} дн.`;
}

function percentDelta(today: number, before: number) {
  if (before <= 0) return null;
  return Math.round(((today - before) / before) * 100);
}

function Hero({ pulse }: { pulse: AdminPulseData }) {
  const max = Math.max(1, ...pulse.hourly);
  const delta = percentDelta(pulse.revenueToday, pulse.revenueSameTimeLastWeek);
  const orderDelta = pulse.ordersToday - pulse.ordersLastWeek;
  const hourMarks = [PULSE_FIRST_HOUR, 12, 15, 18, PULSE_LAST_HOUR];

  return (
    <section className={styles.hero}>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[13px] text-zinc-400">
          <i className={styles.live} aria-hidden />
          {dayLabel(pulse.now)} · обновляется само
        </p>
        <p className={cn(styles.big, "mt-3")}>
          <CountUp value={pulse.revenueToday} />
          <span className="ml-2 text-[0.42em] font-semibold tracking-normal text-zinc-400">
            сом за сегодня
          </span>
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          {delta === null ? (
            "заказы с сайта, зала и менеджеров"
          ) : (
            <>
              <span
                className={cn(
                  "font-semibold",
                  delta >= 0 ? "text-emerald-400" : "text-red-400",
                )}
              >
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
              </span>{" "}
              к прошлой неделе в это же время
            </>
          )}
        </p>
        <div className={cn(styles.bars, "mt-5")} aria-hidden>
          {pulse.hourly.map((value, index) => (
            <i
              key={index}
              className={cn(
                styles.bar,
                index > pulse.currentHourIndex && styles.barEmpty,
                index === pulse.currentHourIndex && value > 0 && styles.barNow,
              )}
              style={{
                height: `${Math.max(5, (value / max) * 100)}%`,
                animationDelay: `${index * 50}ms`,
              }}
              title={`${PULSE_FIRST_HOUR + index}:00 · ${number.format(value)} сом`}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-zinc-500">
          {hourMarks.map((hour) => (
            <span key={hour}>{hour}:00</span>
          ))}
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-2 content-start gap-3">
        <Link
          href="/admin/orders"
          className={cn(styles.tile, "transition hover:bg-white/10")}
        >
          <p className="text-[12.5px] text-zinc-400">Заказы сегодня</p>
          <p className="mt-1.5 text-[30px] font-bold tracking-tight tabular-nums">
            <CountUp value={pulse.ordersToday} />
          </p>
          <p
            className={cn(
              "text-xs",
              orderDelta > 0 ? "text-emerald-400" : "text-zinc-400",
            )}
          >
            {orderDelta === 0
              ? "как неделю назад"
              : `${orderDelta > 0 ? "▲" : "▼"} ${Math.abs(orderDelta)} к прошлой неделе`}
          </p>
        </Link>
        <Link
          href="/admin/cutting"
          className={cn(styles.tile, "transition hover:bg-white/10")}
        >
          <p className="text-[12.5px] text-zinc-400">Распил сегодня</p>
          <p className="mt-1.5 text-[30px] font-bold tracking-tight tabular-nums">
            <CountUp value={pulse.cuttingToday} />
          </p>
          <p className="text-xs text-zinc-400">
            {pulse.cuttingSheetsToday > 0
              ? `${number.format(pulse.cuttingSheetsToday)} листов`
              : "новых заявок"}
          </p>
        </Link>
        <Link
          href="/admin/production/board"
          className={cn(styles.tile, "transition hover:bg-white/10")}
        >
          <p className="text-[12.5px] text-zinc-400">Листов в цеху</p>
          <p className="mt-1.5 text-[30px] font-bold tracking-tight tabular-nums">
            <CountUp value={pulse.sheetsInWork} />
          </p>
          <p className="text-xs text-zinc-400">
            {pulse.inWork} заказов на доске
          </p>
        </Link>
        <Link
          href="/admin/requests?origin=site&status=NEW"
          className={cn(styles.tile, "transition hover:bg-white/10")}
        >
          <p className="text-[12.5px] text-zinc-400">Новые с сайта</p>
          <p className="mt-1.5 text-[30px] font-bold tracking-tight tabular-nums">
            <CountUp value={pulse.siteWaiting} />
          </p>
          <p
            className={cn(
              "text-xs",
              pulse.siteWaitingOverHour > 0 ? "text-red-400" : "text-zinc-400",
            )}
          >
            {pulse.siteWaitingOverHour > 0
              ? `${pulse.siteWaitingOverHour} ждут больше часа`
              : "ждут менеджера"}
          </p>
        </Link>
      </div>
    </section>
  );
}

function Workshop({ pulse }: { pulse: AdminPulseData }) {
  return (
    <section className="flex min-w-0 flex-col rounded-[var(--radius-card)] border border-[color:var(--line)] bg-white p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Цех сейчас</h2>
        <p className="text-[13px] text-[var(--muted)]">
          {pulse.inWork} в работе
          {pulse.overdue > 0 ? (
            <>
              {" · "}
              <span className="font-semibold text-red-600">
                {pulse.overdue} просрочено
              </span>
            </>
          ) : null}
          {" · "}
          <Link
            href="/admin/production/board"
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            Доска →
          </Link>
        </p>
      </div>
      <div className="-mx-1 flex flex-1 flex-col justify-center overflow-x-auto px-1 pt-2 pb-1">
        <ol className="relative grid min-w-[540px] grid-cols-6">
          <span className={styles.track} aria-hidden />
          {pulse.stages.map((stage) => (
            <li
              key={stage.key}
              className={cn(
                styles.stage,
                "flex flex-col items-center text-center",
              )}
            >
              <Link
                href="/admin/production/board"
                className={cn(styles.node, stage.count >= 5 && styles.nodeHot)}
              >
                {stage.count}
                {stage.overdue > 0 ? (
                  <sup className="absolute -top-2 -right-2.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                    {stage.overdue}
                  </sup>
                ) : null}
              </Link>
              <b className="mt-2.5 text-sm">{stage.label}</b>
              <span className="text-xs text-[var(--muted)]">
                {stage.sheets > 0 ? `${number.format(stage.sheets)} л.` : " "}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <dl className="grid grid-cols-3 gap-3 pt-5">
        {[
          { label: "Выдано сегодня", value: pulse.issuedToday, tone: "" },
          {
            label: "Срочные",
            value: pulse.urgent,
            tone: pulse.urgent ? "text-[var(--accent)]" : "",
          },
          {
            label: "С проблемой",
            value: pulse.problems,
            tone: pulse.problems ? "text-red-600" : "",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[var(--radius-inner)] bg-[var(--surface-muted)] px-4 py-3"
          >
            <dt className="text-xs text-[var(--muted)]">{item.label}</dt>
            <dd
              className={cn("mt-1 text-2xl font-bold tabular-nums", item.tone)}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Feed({ pulse }: { pulse: AdminPulseData }) {
  return (
    <section className="min-w-0 rounded-[var(--radius-card)] border border-[color:var(--line)] bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Лента</h2>
        <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <i className={styles.live} aria-hidden />
          вживую
        </span>
      </div>
      {pulse.events.length === 0 ? (
        <p className="py-3 text-sm text-[var(--muted)]">Событий пока нет.</p>
      ) : (
        <ul>
          {pulse.events.slice(0, 6).map((event, index) => {
            const Icon =
              event.kind === "order"
                ? ReceiptText
                : event.title.toLowerCase().includes("распил") ||
                    event.title.toLowerCase().includes("этап")
                  ? Scissors
                  : ClipboardList;
            return (
              <li
                key={event.id}
                className={styles.rise}
                style={{ animationDelay: `${200 + index * 90}ms` }}
              >
                <Link
                  href={event.href}
                  className="flex items-center gap-3 border-t border-[color:var(--line)] py-2.5 first:border-t-0 hover:text-[var(--accent-strong)]"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--surface-muted)] text-[var(--muted)]">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">
                      {event.title}
                    </span>
                    {event.detail ? (
                      <span className="block truncate text-xs text-[var(--muted)]">
                        {event.detail}
                      </span>
                    ) : null}
                  </span>
                  <time className="shrink-0 text-xs text-[var(--muted)]">
                    {ago(event.at, pulse.now)}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// «Пульт дня» — первый экран главной админки.
export async function AdminPulse() {
  let pulse: AdminPulseData | null = null;
  try {
    pulse = await getAdminPulse();
  } catch (error) {
    console.error("[admin:pulse]", error);
  }
  if (!pulse) return null;

  return (
    <div className="space-y-4">
      <AutoRefresh />
      <Hero pulse={pulse} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Workshop pulse={pulse} />
        <Feed pulse={pulse} />
      </div>
    </div>
  );
}
