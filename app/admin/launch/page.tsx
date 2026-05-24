import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  type LucideIcon,
} from "lucide-react";

import {
  configureTelegramWebhookAction,
  sendTelegramTestAction,
} from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  getLaunchReadiness,
  type LaunchCheckStatus,
} from "@/lib/server/launch-readiness";

export const dynamic = "force-dynamic";

type AdminLaunchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const statusMeta: Record<
  LaunchCheckStatus,
  {
    label: string;
    icon: LucideIcon;
    tone: "success" | "warning" | "neutral";
    className: string;
  }
> = {
  ready: {
    label: "Готово",
    icon: CheckCircle2,
    tone: "success",
    className: "text-emerald-600",
  },
  warning: {
    label: "Доработать",
    icon: CircleDashed,
    tone: "warning",
    className: "text-[#c65b3a]",
  },
  blocked: {
    label: "Блокер",
    icon: AlertTriangle,
    tone: "neutral",
    className: "text-red-600",
  },
};

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function AdminLaunchPage({
  searchParams,
}: AdminLaunchPageProps) {
  const readiness = await getLaunchReadiness();
  const resolvedSearchParams = await searchParams;
  const telegramTest = getSearchValue(resolvedSearchParams, "telegramTest");
  const telegramMessage = getSearchValue(
    resolvedSearchParams,
    "telegramMessage",
  );
  const telegramThread = getSearchValue(resolvedSearchParams, "telegramThread");
  const telegramWebhook = getSearchValue(
    resolvedSearchParams,
    "telegramWebhook",
  );
  const telegramWebhookUrl = getSearchValue(
    resolvedSearchParams,
    "telegramWebhookUrl",
  );

  return (
    <div className="space-y-5">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
          <SectionHeading
            title="Подготовка к запуску"
            description="Контрольный список production-функционала: база, доступы, каталог, калькулятор, доставка и уведомления. Здесь видно, что уже готово к работе, а что еще мешает запуску."
            titleClassName="text-2xl sm:text-3xl"
            descriptionClassName="max-w-3xl text-sm leading-7"
          />

          <div className="rounded-2xl border border-[color:var(--line)] bg-white px-5 py-4">
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--muted)] uppercase">
              Готовность
            </p>
            <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
              {readiness.score}%
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {readiness.readyCount} готово, {readiness.warningCount} в работе,{" "}
              {readiness.blockedCount} блокеров
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        {readiness.checks.map((check) => {
          const meta = statusMeta[check.status];
          const Icon = meta.icon;

          return (
            <article
              key={check.key}
              className="grid gap-4 rounded-[22px] border border-[color:var(--line)] bg-white p-5 shadow-[0_18px_48px_rgba(17,17,17,0.04)] md:grid-cols-[44px_minmax(0,1fr)_auto] md:items-center"
            >
              <span className="flex size-11 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[var(--surface)]">
                <Icon className={`size-5 ${meta.className}`} strokeWidth={1.8} />
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--foreground)]">
                    {check.title}
                  </h2>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                  {check.value ? (
                    <span className="rounded-full border border-[color:var(--line)] px-2.5 py-1 text-xs text-[var(--muted)]">
                      {check.value}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {check.description}
                </p>
              </div>

              {check.href && check.actionLabel ? (
                <Link
                  href={check.href}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[color:var(--line-strong)] px-4 text-sm font-medium text-[var(--foreground)] transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
                >
                  {check.actionLabel}
                </Link>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-white p-5 shadow-[0_18px_48px_rgba(17,17,17,0.04)]">
        <SectionHeading
          title="Проверка Telegram"
          description="Отправьте тест в нужную тему: распил, заказы или общие заявки. Если сообщение не пришло, проблема почти всегда в env-переменных Vercel или правах бота в группе."
          titleClassName="text-xl sm:text-2xl"
          descriptionClassName="max-w-3xl text-sm leading-6"
        />

        {telegramTest ? (
          <div
            className={`mt-4 rounded-2xl border p-3 text-sm ${
              telegramTest === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            <strong>
              {telegramTest === "ok" ? "Отправлено" : "Не отправлено"}
              {telegramThread ? ` · ${telegramThread}` : ""}
            </strong>
            {telegramMessage ? <p className="mt-1">{telegramMessage}</p> : null}
          </div>
        ) : null}

        {telegramWebhook ? (
          <div
            className={`mt-4 rounded-2xl border p-3 text-sm ${
              telegramWebhook === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            <strong>
              {telegramWebhook === "ok"
                ? "Webhook подключен"
                : "Webhook не подключен"}
            </strong>
            {telegramMessage ? <p className="mt-1">{telegramMessage}</p> : null}
            {telegramWebhookUrl ? (
              <p className="mt-1 break-all text-xs">{telegramWebhookUrl}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            { key: "cutting", label: "Тест распила" },
            { key: "orders", label: "Тест заказов" },
            { key: "requests", label: "Тест заявок" },
          ].map((item) => (
            <form key={item.key} action={sendTelegramTestAction}>
              <input type="hidden" name="threadKey" value={item.key} />
              <AdminSubmitButton
                type="submit"
                variant={item.key === "cutting" ? "accent" : "secondary"}
                className="h-10 w-full"
                idleLabel={item.label}
                pendingLabel="Отправляем..."
              />
            </form>
          ))}
        </div>

        <form action={configureTelegramWebhookAction} className="mt-3">
          <AdminSubmitButton
            type="submit"
            variant="secondary"
            className="h-10 w-full sm:w-auto"
            idleLabel="Подключить webhook и кнопки бота"
            pendingLabel="Подключаем..."
          />
        </form>
      </section>
    </div>
  );
}
